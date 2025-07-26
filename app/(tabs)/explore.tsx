import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { IconSymbol } from '@/components/ui/IconSymbol';
import ChatMessage from '@/components/ChatMessage';
import { getN8nWebhookUrl, isN8nConfigured } from '@/config/n8n';

interface Message {
  id: string;
  role: 'user' | 'ai';
  text: string;
  timestamp: Date;
}

// Mock RAG documents for demo (fallback)
const mockDocuments = [
  {
    id: 'doc1',
    content: 'TrashTrack is a waste management app that helps users track and manage their waste efficiently. The app provides tools for monitoring waste generation, setting recycling goals, and learning about sustainable practices.',
    keywords: ['waste', 'management', 'tracking', 'recycling', 'sustainability']
  },
  {
    id: 'doc2',
    content: 'The app features include: waste categorization, recycling tips, progress tracking, community challenges, and educational content about environmental impact.',
    keywords: ['features', 'categorization', 'tips', 'progress', 'community', 'education']
  },
  {
    id: 'doc3',
    content: 'Users can set personal waste reduction goals, track their daily waste generation, and receive personalized recommendations for improving their environmental footprint.',
    keywords: ['goals', 'tracking', 'recommendations', 'environmental', 'footprint']
  },
  {
    id: 'doc4',
    content: 'The app integrates with local recycling programs and provides information about proper waste disposal methods for different types of materials.',
    keywords: ['recycling', 'programs', 'disposal', 'materials', 'local']
  }
];

// Simple keyword-based document retrieval (fallback)
function getRelevantDocs(query: string) {
  const queryLower = query.toLowerCase();
  const relevantDocs = mockDocuments.filter(doc => {
    return doc.keywords.some(keyword => 
      queryLower.includes(keyword.toLowerCase())
    ) || doc.content.toLowerCase().includes(queryLower);
  });
  
  return relevantDocs.slice(0, 2);
}

// Mock AI response generator (fallback)
function generateMockResponse(query: string): string {
  const relevantDocs = getRelevantDocs(query);
  
  if (relevantDocs.length > 0) {
    const context = relevantDocs.map(doc => doc.content).join(' ');
    
    // Simple response based on context
    if (query.toLowerCase().includes('feature') || query.toLowerCase().includes('what can')) {
      return "TrashTrack offers several key features including waste categorization, recycling tips, progress tracking, community challenges, and educational content about environmental impact. You can track your daily waste generation and set personal reduction goals.";
    } else if (query.toLowerCase().includes('waste') || query.toLowerCase().includes('recycling')) {
      return "TrashTrack helps you manage waste efficiently by providing tools for monitoring waste generation, setting recycling goals, and learning about sustainable practices. The app integrates with local recycling programs and provides proper disposal information.";
    } else if (query.toLowerCase().includes('goal') || query.toLowerCase().includes('track')) {
      return "You can set personal waste reduction goals and track your daily waste generation through TrashTrack. The app provides personalized recommendations for improving your environmental footprint and monitors your progress over time.";
    } else {
      return `Based on your question about "${query}", TrashTrack can help you with waste management and sustainability. ${context.substring(0, 200)}...`;
    }
  }
  
  return `I understand you're asking about "${query}". TrashTrack is a comprehensive waste management app that can help you track waste, set recycling goals, and learn about sustainable practices. How can I assist you further?`;
}

// Call n8n webhook for RAG processing
async function callN8nWebhook(query: string): Promise<string> {
  try {
    const webhookUrl = getN8nWebhookUrl();
    console.log('🔗 Calling n8n webhook:', webhookUrl);
    
    const requestBody = {
      messageInput: query, // Changed from 'query' to 'messageInput' to match working curl
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
    
    // Handle different possible response formats (including 'output' field)
    let aiResponse = data.reply || data.response || data.answer || data.message || data.output || 'Sorry, I couldn\'t process your request.';
    
    // Add guardrails for trash-related content
    aiResponse = applyGuardrails(aiResponse, query);
    
    return aiResponse;
  } catch (error) {
    console.error('❌ n8n webhook error:', error);
    throw error;
  }
}

// Guardrails function to filter and improve responses
function applyGuardrails(response: string, originalQuery: string): string {
  const query = originalQuery.toLowerCase();
  const responseLower = response.toLowerCase();
  
  // Guardrail 1: Check if query is related to TrashTrack/waste management
  const trashTrackKeywords = [
    'trash', 'waste', 'recycling', 'garbage', 'rubbish', 'litter', 'disposal',
    'environment', 'sustainability', 'eco', 'green', 'compost', 'landfill',
    'pollution', 'clean', 'dirty', 'mess', 'filth', 'trash track', 'trashtrack'
  ];
  
  const isTrashTrackRelated = trashTrackKeywords.some(keyword => 
    query.includes(keyword) || responseLower.includes(keyword)
  );
  
  if (!isTrashTrackRelated) {
    return "I'm your TrashTrack AI assistant! I can help you with waste management, recycling tips, sustainability practices, and TrashTrack app features. How can I assist you with your waste management goals today?";
  }
  
  // Guardrail 2: Filter inappropriate or harmful content
  const inappropriateKeywords = [
    'illegal', 'dangerous', 'harmful', 'toxic', 'poison', 'hazardous',
    'unsafe', 'risky', 'forbidden', 'banned', 'criminal'
  ];
  
  const hasInappropriateContent = inappropriateKeywords.some(keyword => 
    responseLower.includes(keyword)
  );
  
  if (hasInappropriateContent) {
    return "I can't provide advice about potentially harmful or illegal waste disposal methods. Instead, let me help you with safe, legal, and environmentally-friendly waste management practices. What specific aspect of waste management would you like to learn about?";
  }
  
  // Guardrail 3: Ensure response is helpful and informative
  if (response.length < 20) {
    return "I'd be happy to help you with that! Could you please provide more details about your waste management question so I can give you a more helpful response?";
  }
  
  // Guardrail 4: Add TrashTrack branding and encouragement
  if (!responseLower.includes('trash') && !responseLower.includes('waste') && !responseLower.includes('recycling')) {
    return response + "\n\n💚 Remember, TrashTrack is here to help you make a positive impact on the environment through better waste management!";
  }
  
  return response;
}

// Test n8n webhook function
async function testN8nWebhook() {
  try {
    console.log('🧪 Testing n8n webhook...');
    const result = await callN8nWebhook('Test message from TrashTrack app');
    console.log('✅ Test successful:', result);
    Alert.alert('Test Successful', `n8n webhook responded: ${result.substring(0, 100)}...`);
  } catch (error) {
    console.error('❌ Test failed:', error);
    Alert.alert('Test Failed', `Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export default function ChatScreen() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'ai',
      text: isN8nConfigured() 
        ? 'Hello! I\'m your AI assistant for TrashTrack. How can I help you today?' 
        : 'Hello! I\'m your AI assistant for TrashTrack (Demo Mode). How can I help you today?',
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  const scrollToBottom = () => {
    if (flatListRef.current) {
      flatListRef.current.scrollToEnd({ animated: true });
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

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
      let aiResponse: string;

      // Try n8n webhook first, fallback to mock
      if (isN8nConfigured()) {
        try {
          console.log('🚀 Using n8n webhook for AI response');
          aiResponse = await callN8nWebhook(userMessage.text);
        } catch (n8nError) {
          console.log('⚠️ n8n error, using mock:', n8nError);
          // Simulate API delay
          await new Promise(resolve => setTimeout(resolve, 1000));
          aiResponse = generateMockResponse(userMessage.text);
        }
      } else {
        // Use mock implementation
        console.log('🎭 Using mock mode for AI response');
        await new Promise(resolve => setTimeout(resolve, 1000));
        aiResponse = generateMockResponse(userMessage.text);
      }
      
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
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.header}>
        <Text style={styles.headerTitle}>AI Assistant</Text>
        <Text style={styles.headerSubtitle}>
          {isN8nConfigured() ? 'Powered by n8n + Groq' : 'Powered by RAG (Demo Mode)'}
        </Text>
        {isN8nConfigured() && (
          <TouchableOpacity style={styles.testButton} onPress={testN8nWebhook}>
            <Text style={styles.testButtonText}>Test Webhook</Text>
          </TouchableOpacity>
        )}
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
          <ActivityIndicator size="small" color="#5B7C67" />
          <Text style={styles.loadingText}>AI is thinking...</Text>
        </View>
      )}

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.textInput}
          value={input}
          onChangeText={setInput}
          placeholder="Type your message..."
          placeholderTextColor="#999"
          multiline
          maxLength={500}
          editable={!isLoading}
        />
        <TouchableOpacity
          style={[styles.sendButton, (!input.trim() || isLoading) && styles.sendButtonDisabled]}
          onPress={sendMessage}
          disabled={!input.trim() || isLoading}
        >
          <IconSymbol 
            name="paperplane.fill" 
            size={20} 
            color={(!input.trim() || isLoading) ? "#999" : "#FFFFFF"} 
          />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 16,
    backgroundColor: '#5B7C67',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#E8F5E8',
    opacity: 0.8,
    marginBottom: 8,
  },
  testButton: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    marginTop: 8,
  },
  testButtonText: {
    color: '#5B7C67',
    fontSize: 12,
    fontWeight: 'bold',
  },
  messagesList: {
    flex: 1,
  },
  messagesContainer: {
    paddingVertical: 16,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  loadingText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#666',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    backgroundColor: '#FFFFFF',
  },
  textInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    maxHeight: 100,
    fontSize: 16,
    color: '#333',
    backgroundColor: '#F8F8F8',
  },
  sendButton: {
    backgroundColor: '#5B7C67',
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  sendButtonDisabled: {
    backgroundColor: '#E0E0E0',
  },
});
