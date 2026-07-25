import { IconSymbol } from '@/components/ui/IconSymbol';
import { Colors } from '@/constants/Colors';
import { useTheme } from '@/hooks/useTheme';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface ChatMessageProps {
  message: {
    role: 'user' | 'ai';
    text: string;
    timestamp?: Date;
  };
}

export default function ChatMessage({ message }: ChatMessageProps) {
  const { theme } = useTheme();
  const colors = Colors[theme ?? 'light'];
  const isUser = message.role === 'user';

  const dynamicStyles = StyleSheet.create({
    container: {
      marginVertical: 6,
      paddingHorizontal: 16,
      width: '100%',
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
      marginBottom: 6,
      marginLeft: 4,
    },
    aiLabel: {
      fontSize: 13,
      fontWeight: '700',
      color: '#4A6741',
      marginLeft: 6,
    },
    bubble: {
      maxWidth: '85%',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderRadius: 20,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 3,
      elevation: 2,
    },
    userBubble: {
      backgroundColor: '#4A6741',
      borderBottomRightRadius: 4,
    },
    aiBubble: {
      backgroundColor: '#FFFFFF',
      borderBottomLeftRadius: 4,
      borderWidth: 1,
      borderColor: '#F3F4F6',
    },
    text: {
      fontSize: 15,
      lineHeight: 22,
    },
    userText: {
      color: '#FFFFFF',
    },
    aiText: {
      color: '#1F2937',
    },
    timestamp: {
      fontSize: 11,
      marginTop: 6,
      alignSelf: 'flex-end',
    },
    userTimestamp: {
      color: 'rgba(255,255,255,0.7)',
    },
    aiTimestamp: {
      color: '#9CA3AF',
    },
  });

  const renderFormattedText = (text: string) => {
    // Basic markdown parser for **bold**
    const parts = text.split(/(\*\*.*?\*\*)/g);
    
    return parts.map((part, index) => {
      if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
        return (
          <Text key={index} style={{ fontWeight: 'bold' }}>
            {part.substring(2, part.length - 2)}
          </Text>
        );
      }
      return <Text key={index}>{part}</Text>;
    });
  };

  return (
    <View style={[dynamicStyles.container, isUser ? dynamicStyles.userContainer : dynamicStyles.aiContainer]}>
      {!isUser && (
        <View style={dynamicStyles.aiHeader}>
          <IconSymbol name="sparkles" size={14} color="#4A6741" />
          <Text style={dynamicStyles.aiLabel}>Assistant</Text>
        </View>
      )}
      <View style={[dynamicStyles.bubble, isUser ? dynamicStyles.userBubble : dynamicStyles.aiBubble]}>
        <Text style={[dynamicStyles.text, isUser ? dynamicStyles.userText : dynamicStyles.aiText]}>
          {renderFormattedText(message.text)}
        </Text>
        {message.timestamp && (
          <Text style={[dynamicStyles.timestamp, isUser ? dynamicStyles.userTimestamp : dynamicStyles.aiTimestamp]}>
            {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        )}
      </View>
    </View>
  );
} 