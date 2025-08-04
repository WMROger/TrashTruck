import { IconSymbol } from '@/components/ui/IconSymbol';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useRouter } from 'expo-router';
import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function HomePage() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const handleLogout = () => {
    // Navigate back to splash screen (logout)
    router.replace('/splash');
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>
          Welcome to TrashTrack
        </Text>
        <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
          <IconSymbol name="rectangle.portrait.and.arrow.right" size={20} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <IconSymbol name="leaf.fill" size={32} color={colors.primary} />
          <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>
            Track Your Waste
          </Text>
          <Text style={[styles.cardSubtitle, { color: colors.textSecondary }]}>
            Monitor your daily waste generation and set reduction goals
          </Text>
        </View>

        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <IconSymbol name="arrow.triangle.2.circlepath" size={32} color={colors.primary} />
          <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>
            Recycling Tips
          </Text>
          <Text style={[styles.cardSubtitle, { color: colors.textSecondary }]}>
            Get personalized tips for better recycling practices
          </Text>
        </View>

        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <IconSymbol name="chart.line.uptrend.xyaxis" size={32} color={colors.primary} />
          <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>
            Progress Analytics
          </Text>
          <Text style={[styles.cardSubtitle, { color: colors.textSecondary }]}>
            View your environmental impact and progress over time
          </Text>
        </View>

        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <IconSymbol name="message.fill" size={32} color={colors.primary} />
          <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>
            AI Assistant
          </Text>
          <Text style={[styles.cardSubtitle, { color: colors.textSecondary }]}>
            Chat with our AI for waste management advice
          </Text>
        </View>
      </View>
    </ScrollView>
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
    paddingTop: 60,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  logoutButton: {
    padding: 8,
  },
  content: {
    padding: 20,
    gap: 16,
  },
  card: {
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 12,
    marginBottom: 8,
    textAlign: 'center',
  },
  cardSubtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
}); 