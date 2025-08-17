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
      color: colors.primary,
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
      backgroundColor: colors.chatUserBubble,
      borderBottomRightRadius: 4,
    },
    aiBubble: {
      backgroundColor: colors.chatAIBubble,
      borderBottomLeftRadius: 4,
      borderLeftWidth: 3,
      borderLeftColor: colors.chatAIBorder,
    },
    text: {
      fontSize: 16,
      lineHeight: 22,
    },
    userText: {
      color: colors.chatUserText,
    },
    aiText: {
      color: colors.chatAIText,
    },
    timestamp: {
      fontSize: 12,
      marginTop: 4,
      opacity: 0.7,
    },
    userTimestamp: {
      color: colors.chatUserText,
      textAlign: 'right',
    },
    aiTimestamp: {
      color: colors.textSecondary,
      textAlign: 'left',
    },
    aiFooter: {
      marginTop: 2,
      marginLeft: 4,
    },
    aiFooterText: {
      fontSize: 10,
      color: colors.primary,
      fontStyle: 'italic',
    },
  });

  return (
    <View style={[dynamicStyles.container, isUser ? dynamicStyles.userContainer : dynamicStyles.aiContainer]}>
      {!isUser && (
        <View style={dynamicStyles.aiHeader}>
          <IconSymbol name="leaf.fill" size={16} color={colors.primary} />
          <Text style={dynamicStyles.aiLabel}>TrashTrack AI</Text>
        </View>
      )}
      <View style={[dynamicStyles.bubble, isUser ? dynamicStyles.userBubble : dynamicStyles.aiBubble]}>
        <Text style={[dynamicStyles.text, isUser ? dynamicStyles.userText : dynamicStyles.aiText]}>
          {message.text}
        </Text>
        {message.timestamp && (
          <Text style={[dynamicStyles.timestamp, isUser ? dynamicStyles.userTimestamp : dynamicStyles.aiTimestamp]}>
            {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        )}
      </View>
      {!isUser && (
        <View style={dynamicStyles.aiFooter}>
          <Text style={dynamicStyles.aiFooterText}>💚 Powered by TrashTrack</Text>
        </View>
      )}
    </View>
  );
} 