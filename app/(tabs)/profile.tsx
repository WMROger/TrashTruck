import { useAuthContext } from '@/components/AuthContext';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { Colors } from '@/constants/Colors';
import { useTheme } from '@/hooks/useTheme';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function ProfilePage() {
  const { theme, setTheme } = useTheme();
  const colors = Colors[theme ?? 'light'];
  const { user, logout } = useAuthContext();
  const [preferencesExpanded, setPreferencesExpanded] = useState(false);
  const router = useRouter();

  const handleLogout = async () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            try {
              await logout();
              // Navigate to splash screen after successful logout
              router.replace('/splash');
            } catch (error) {
              console.error('Logout error:', error);
              // Even if there's an error, redirect to splash
              router.replace('/splash');
            }
          },
        },
      ]
    );
  };

  const togglePreferences = () => {
    setPreferencesExpanded(!preferencesExpanded);
  };

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    console.log('Theme changed to:', newTheme);
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
            {user?.displayName || 'User'}
          </Text>
          <Text style={[styles.userEmail, { color: colors.textSecondary }]}>
            {user?.email || 'No email'}
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
          
          <TouchableOpacity 
            style={[styles.menuItem, { backgroundColor: colors.surface }]}
            onPress={togglePreferences}
          >
            <IconSymbol name="gear" size={24} color={colors.primary} />
            <Text style={[styles.menuText, { color: colors.textPrimary }]}>
              Preferences
            </Text>
            <IconSymbol 
              name={preferencesExpanded ? "chevron.up" : "chevron.right"} 
              size={16} 
              color={colors.textTertiary} 
            />
          </TouchableOpacity>

          {/* Preferences Dropdown */}
          {preferencesExpanded && (
            <View style={styles.preferencesDropdown}>
              {/* Single Theme Toggle */}
              <View style={styles.toggleContainer}>
                <TouchableOpacity 
                  style={[
                    styles.toggleSwitch, 
                    { 
                      backgroundColor: theme === 'dark' ? '#2C2C2C' : '#FFFFFF',
                      justifyContent: theme === 'dark' ? 'flex-end' : 'flex-start'
                    }
                  ]}
                  onPress={toggleTheme}
                  activeOpacity={0.8}
                >
                  <View style={[
                    styles.toggleThumb, 
                    { 
                      backgroundColor: theme === 'dark' ? '#FFFFFF' : '#2C2C2C'
                    }
                  ]}>
                    <IconSymbol 
                      name={theme === 'dark' ? "moon.fill" : "sun.max.fill"} 
                      size={16} 
                      color={theme === 'dark' ? "#2C2C2C" : "#FFFFFF"} 
                    />
                  </View>
                  <Text style={[
                    styles.toggleText, 
                    { 
                      color: theme === 'dark' ? '#FFFFFF' : '#000000',
                      marginLeft: theme === 'dark' ? 0 : 12,
                      marginRight: theme === 'dark' ? 12 : 0
                    }
                  ]}>
                    {theme === 'dark' ? 'DARK MODE' : 'LIGHT MODE'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

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
  preferencesDropdown: {
    marginLeft: 20,
    gap: 16,
    paddingVertical: 8,
  },
  toggleContainer: {
    alignItems: 'center',
  },
  toggleSwitch: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 200,
    height: 50,
    borderRadius: 25,
    paddingHorizontal: 16,
    gap: 12,
    // Neumorphic shadow effects
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
  },
  toggleThumb: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    // Inner shadow for depth
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  toggleText: {
    fontSize: 14,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 8,
    gap: 8,
    marginTop: 20,
    marginBottom: 70,
  },
  logoutText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
}); 