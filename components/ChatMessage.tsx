import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { IconSymbol } from '@/components/ui/IconSymbol';

interface ChatMessageProps {
  message: {
    role: 'user' | 'ai';
    text: string;
    timestamp?: Date;
  };
}

export default function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user';

  return (
    <View style={[styles.container, isUser ? styles.userContainer : styles.aiContainer]}>
      {!isUser && (
        <View style={styles.aiHeader}>
          <IconSymbol name="leaf.fill" size={16} color="#5B7C67" />
          <Text style={styles.aiLabel}>TrashTrack AI</Text>
        </View>
      )}
      <View style={[styles.bubble, isUser ? styles.userBubble : styles.aiBubble]}>
        <Text style={[styles.text, isUser ? styles.userText : styles.aiText]}>
          {message.text}
        </Text>
        {message.timestamp && (
          <Text style={[styles.timestamp, isUser ? styles.userTimestamp : styles.aiTimestamp]}>
            {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        )}
      </View>
      {!isUser && (
        <View style={styles.aiFooter}>
          <Text style={styles.aiFooterText}>💚 Powered by TrashTrack</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 4,
    paddingHorizontal: 16,
  },
  userContainer: {
    alignItems: 'flex-end',
  },
  aiContainer: {
    alignItems: 'flex-start',
  },
  aiHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    marginLeft: 4,
  },
  aiLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#5B7C67',
    marginLeft: 4,
  },
  bubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 18,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  userBubble: {
    backgroundColor: '#5B7C67',
    borderBottomRightRadius: 4,
  },
  aiBubble: {
    backgroundColor: '#F8F9FA',
    borderBottomLeftRadius: 4,
    borderLeftWidth: 3,
    borderLeftColor: '#5B7C67',
  },
  text: {
    fontSize: 16,
    lineHeight: 22,
  },
  userText: {
    color: '#FFFFFF',
  },
  aiText: {
    color: '#333333',
  },
  timestamp: {
    fontSize: 12,
    marginTop: 4,
    opacity: 0.7,
  },
  userTimestamp: {
    color: '#FFFFFF',
    textAlign: 'right',
  },
  aiTimestamp: {
    color: '#666666',
    textAlign: 'left',
  },
  aiFooter: {
    marginTop: 2,
    marginLeft: 4,
  },
  aiFooterText: {
    fontSize: 10,
    color: '#5B7C67',
    fontStyle: 'italic',
  },
}); 