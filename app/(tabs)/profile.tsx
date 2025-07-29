import { IconSymbol } from '@/components/ui/IconSymbol';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useRouter } from 'expo-router';
import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function ProfilePage() {
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
          Profile
        </Text>
      </View>

      <View style={styles.content}>
        <View style={[styles.profileCard, { backgroundColor: colors.surface }]}>
          <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
            <IconSymbol name="person.fill" size={40} color={colors.surface} />
          </View>
          <Text style={[styles.userName, { color: colors.textPrimary }]}>
            John Doe
          </Text>
          <Text style={[styles.userEmail, { color: colors.textSecondary }]}>
            john.doe@example.com
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
            Account Settings
          </Text>
          
          <TouchableOpacity style={[styles.menuItem, { backgroundColor: colors.surface }]}>
            <IconSymbol name="person.circle" size={24} color={colors.primary} />
            <Text style={[styles.menuText, { color: colors.textPrimary }]}>
              Edit Profile
            </Text>
            <IconSymbol name="chevron.right" size={16} color={colors.textTertiary} />
          </TouchableOpacity>

          <TouchableOpacity style={[styles.menuItem, { backgroundColor: colors.surface }]}>
            <IconSymbol name="bell" size={24} color={colors.primary} />
            <Text style={[styles.menuText, { color: colors.textPrimary }]}>
              Notifications
            </Text>
            <IconSymbol name="chevron.right" size={16} color={colors.textTertiary} />
          </TouchableOpacity>

          <TouchableOpacity style={[styles.menuItem, { backgroundColor: colors.surface }]}>
            <IconSymbol name="lock" size={24} color={colors.primary} />
            <Text style={[styles.menuText, { color: colors.textPrimary }]}>
              Privacy & Security
            </Text>
            <IconSymbol name="chevron.right" size={16} color={colors.textTertiary} />
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
            App Settings
          </Text>
          
          <TouchableOpacity style={[styles.menuItem, { backgroundColor: colors.surface }]}>
            <IconSymbol name="gear" size={24} color={colors.primary} />
            <Text style={[styles.menuText, { color: colors.textPrimary }]}>
              Preferences
            </Text>
            <IconSymbol name="chevron.right" size={16} color={colors.textTertiary} />
          </TouchableOpacity>

          <TouchableOpacity style={[styles.menuItem, { backgroundColor: colors.surface }]}>
            <IconSymbol name="questionmark.circle" size={24} color={colors.primary} />
            <Text style={[styles.menuText, { color: colors.textPrimary }]}>
              Help & Support
            </Text>
            <IconSymbol name="chevron.right" size={16} color={colors.textTertiary} />
          </TouchableOpacity>

          <TouchableOpacity style={[styles.menuItem, { backgroundColor: colors.surface }]}>
            <IconSymbol name="info.circle" size={24} color={colors.primary} />
            <Text style={[styles.menuText, { color: colors.textPrimary }]}>
              About TrashTrack
            </Text>
            <IconSymbol name="chevron.right" size={16} color={colors.textTertiary} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity 
          style={[styles.logoutButton, { backgroundColor: colors.error }]} 
          onPress={handleLogout}
        >
          <IconSymbol name="rectangle.portrait.and.arrow.right" size={20} color={colors.surface} />
          <Text style={[styles.logoutText, { color: colors.surface }]}>
            Logout
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingTop: 60,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  content: {
    padding: 20,
    gap: 24,
  },
  profileCard: {
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  userName: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
  },
  section: {
    gap: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 8,
    gap: 12,
  },
  menuText: {
    flex: 1,
    fontSize: 16,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 8,
    gap: 8,
    marginTop: 20,
  },
  logoutText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
}); 