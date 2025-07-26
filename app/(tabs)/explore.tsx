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

// Firebase imports (with error handling)
let functions: any = null;
let httpsCallable: any = null;

try {
  const firebaseModule = require('firebase/functions');
  const firebaseConfig = require('@/config/firebase');
  functions = firebaseConfig.functions;
  httpsCallable = firebaseModule.httpsCallable;
} catch (error) {
  console.log('Firebase not configured, using mock mode');
}

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

export default function ChatScreen() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'ai',
      text: functions ? 'Hello! I\'m your AI assistant for TrashTrack. How can I help you today?' : 'Hello! I\'m your AI assistant for TrashTrack (Demo Mode). How can I help you today?',
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

      // Try Firebase Functions first, fallback to mock
      if (functions && httpsCallable) {
        try {
          const chatWithRAG = httpsCallable(functions, 'chatWithRAG');
          const result = await chatWithRAG({ query: userMessage.text });
          aiResponse = (result.data as any)?.reply || 'Sorry, I couldn\'t process your request.';
        } catch (firebaseError) {
          console.log('Firebase error, using mock:', firebaseError);
          // Simulate API delay
          await new Promise(resolve => setTimeout(resolve, 1000));
          aiResponse = generateMockResponse(userMessage.text);
        }
      } else {
        // Use mock implementation
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
      console.error('Error sending message:', error);
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
          {functions ? 'Powered by RAG + Groq' : 'Powered by RAG (Demo Mode)'}
        </Text>
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
