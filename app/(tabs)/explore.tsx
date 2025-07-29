import ChatMessage from '@/components/ChatMessage';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { getN8nWebhookUrl } from '@/config/n8n';
import { useTheme } from '@/hooks/useTheme';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

interface Message {
  id: string;
  role: 'user' | 'ai';
  text: string;
  timestamp: Date;
}

// Call n8n webhook for AI processing
async function callN8nWebhook(query: string): Promise<string> {
  try {
    const webhookUrl = getN8nWebhookUrl();
    console.log('🔗 Calling n8n webhook:', webhookUrl);
    
    const requestBody = {
      messageInput: query,
      timestamp: new Date().toISOString(),
      source: 'TrashTrack App'
    };
    
    console.log('📤 Request body:', JSON.stringify(requestBody, null, 2));
    
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    console.log('📥 n8n response status:', response.status);
    console.log('📥 n8n response headers:', Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ n8n error response:', errorText);
      throw new Error(`HTTP error! status: ${response.status}, body: ${errorText}`);
    }

    const data = await response.json();
    console.log('✅ n8n response data:', JSON.stringify(data, null, 2));
    
    // Handle different possible response formats
    let aiResponse = data.reply || data.response || data.answer || data.message || data.output || 'Sorry, I couldn\'t process your request.';
    
    // Clean the response by removing <think> tags and other internal processing
    aiResponse = cleanAiResponse(aiResponse);
    
    // Add guardrails for trash-related content
    aiResponse = applyGuardrails(aiResponse, query);
    
    return aiResponse;
  } catch (error) {
    console.error('❌ n8n webhook error:', error);
    throw error;
  }
}

function cleanAiResponse(response: string): string {
  // Remove <think> tags and their content
  response = response.replace(/<think>.*?<\/think>/gs, '');
  
  // Remove any remaining XML-like tags
  response = response.replace(/<[^>]*>/g, '');
  
  // Clean up extra whitespace
  response = response.replace(/\n\s*\n/g, '\n').trim();
  
  return response;
}

function applyGuardrails(response: string, originalQuery: string): string {
  // Basic content filtering for inappropriate responses
  const inappropriateKeywords = ['illegal', 'dangerous', 'harmful', 'toxic'];
  const hasInappropriateContent = inappropriateKeywords.some(keyword => 
    response.toLowerCase().includes(keyword)
  );
  
  if (hasInappropriateContent) {
    return 'I apologize, but I cannot provide advice about that. Please focus on safe and legal waste management practices. How can I help you with proper waste disposal and recycling?';
  }
  
  return response;
}

export default function ChatScreen() {
  const { colors, isDark, toggleTheme } = useTheme();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'ai',
      text: 'Hello! I\'m your AI assistant for TrashTrack. How can I help you today?',
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  const scrollToBottom = () => {
    if (flatListRef.current) {
      flatListRef.current.scrollToEnd({ animated: true });
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    const keyboardDidShow = () => {
      setIsKeyboardVisible(true);
      setTimeout(scrollToBottom, 100);
    };

    const keyboardDidHide = () => {
      setIsKeyboardVisible(false);
      setTimeout(scrollToBottom, 100);
    };

    const showSubscription = Keyboard.addListener('keyboardDidShow', keyboardDidShow);
    const hideSubscription = Keyboard.addListener('keyboardDidHide', keyboardDidHide);

    return () => {
      showSubscription?.remove();
      hideSubscription?.remove();
    };
  }, []);

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      text: input.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      console.log('🚀 Using n8n webhook for AI response');
      const aiResponse = await callN8nWebhook(userMessage.text);
      
      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'ai',
        text: aiResponse,
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, aiMessage]);
    } catch (error) {
      console.error('❌ Error sending message:', error);
      Alert.alert('Error', 'Failed to send message. Please try again.');
      
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'ai',
        text: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date(),
      };
      
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const renderMessage = ({ item }: { item: Message }) => (
    <ChatMessage message={item} />
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>
          TrashTrack AI Assistant
        </Text>
        <TouchableOpacity onPress={toggleTheme} style={styles.themeToggle}>
          <IconSymbol 
            name={isDark ? "sun.max.fill" : "moon.fill"} 
            size={24} 
            color={colors.textSecondary} 
          />
        </TouchableOpacity>
      </View>

      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id}
        style={styles.messagesList}
        contentContainerStyle={styles.messagesContainer}
        showsVerticalScrollIndicator={false}
      />

      {isLoading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            AI is thinking...
          </Text>
        </View>
      )}

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.inputContainer}
      >
        <View style={[styles.inputWrapper, { borderColor: colors.border }]}>
          <TextInput
            style={[styles.input, { color: colors.textPrimary }]}
            value={input}
            onChangeText={setInput}
            placeholder="Ask me about waste management..."
            placeholderTextColor={colors.textTertiary}
            multiline
            maxLength={500}
            onSubmitEditing={sendMessage}
          />
          <TouchableOpacity
            style={[styles.sendButton, { backgroundColor: colors.primary }]}
            onPress={sendMessage}
            disabled={!input.trim() || isLoading}
          >
            <IconSymbol 
              name="paperplane.fill" 
              size={20} 
              color={colors.surface} 
            />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  themeToggle: {
    padding: 8,
  },
  messagesList: {
    flex: 1,
  },
  messagesContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 8,
  },
  loadingText: {
    fontSize: 14,
  },
  inputContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    minHeight: 44,
  },
  input: {
    flex: 1,
    fontSize: 16,
    maxHeight: 100,
    paddingVertical: 8,
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
});
