import { useAuthContext } from '@/components/AuthContext';
import { auth } from '@/config/firebase';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Image, ScrollView, StatusBar, StyleSheet, Switch, Text, TouchableOpacity, View, Alert } from 'react-native';

export default function DriverProfileSettings() {
  const router = useRouter();
  const { user } = useAuthContext();
  const [isDarkMode, setIsDarkMode] = useState(false);

  const handleThemeToggle = (value: boolean) => {
    setIsDarkMode(value);
    Alert.alert('Theme Settings', value ? 'Dark mode applied.' : 'Light mode applied.');
  };

  const handleLogout = async () => {
    try {
      await auth.signOut();
      router.replace('/auth');
    } catch (error) {
      console.error('Logout error', error);
    }
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <StatusBar barStyle="dark-content" backgroundColor="#F9FAFB" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Feather name="arrow-left" size={24} color="#1F2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Profile Card */}
      <View style={styles.profileCard}>
        <Image 
          source={{ uri: user?.photoURL || 'https://i.pravatar.cc/150?img=33' }} 
          style={styles.avatar} 
        />
        <View style={styles.profileInfo}>
          <Text style={styles.profileName}>{user?.displayName || 'Louisse Natasha Valeria'}</Text>
          <Text style={styles.profileHandle}>{user?.email ? user.email : '@jellylace'}</Text>
        </View>
        <TouchableOpacity 
          style={styles.editButton} 
          onPress={() => router.push('/(driver)/edit-profile')}
        >
          <Feather name="edit-2" size={16} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* Main Menu */}
      <View style={styles.menuSection}>
        <TouchableOpacity 
          style={styles.menuItem} 
          onPress={() => router.push('/(driver)/edit-profile')}
        >
          <View style={styles.menuIconContainer}>
            <Feather name="user" size={18} color="#6B7280" />
          </View>
          <View style={styles.menuTextContainer}>
            <Text style={styles.menuTitle}>My Account</Text>
            <Text style={styles.menuSubtitle}>Make changes to your account</Text>
          </View>
          <Feather name="chevron-right" size={20} color="#9CA3AF" />
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.menuItem}
          onPress={() => Alert.alert('Coming Soon', 'Beneficiary management will be available in the next update.')}
        >
          <View style={styles.menuIconContainer}>
            <Feather name="user-check" size={18} color="#6B7280" />
          </View>
          <View style={styles.menuTextContainer}>
            <Text style={styles.menuTitle}>Saved Beneficiary</Text>
            <Text style={styles.menuSubtitle}>Manage your saved accounts</Text>
          </View>
          <Feather name="chevron-right" size={20} color="#9CA3AF" />
        </TouchableOpacity>

        <View style={styles.menuItem}>
          <View style={styles.menuIconContainer}>
            <Feather name="moon" size={18} color="#6B7280" />
          </View>
          <View style={styles.menuTextContainer}>
            <Text style={styles.menuTitle}>Dark Mode / Light Mode</Text>
            <Text style={styles.menuSubtitle}>Customize your app appearance</Text>
          </View>
          <Switch
            value={isDarkMode}
            onValueChange={handleThemeToggle}
            trackColor={{ false: '#E5E7EB', true: '#3B5241' }}
            thumbColor={isDarkMode ? '#FFFFFF' : '#FFFFFF'}
          />
        </View>

        <TouchableOpacity 
          style={styles.menuItem}
          onPress={() => Alert.alert('2FA Settings', 'Two-factor authentication setup instructions have been sent to your email.')}
        >
          <View style={styles.menuIconContainer}>
            <Feather name="shield" size={18} color="#6B7280" />
          </View>
          <View style={styles.menuTextContainer}>
            <Text style={styles.menuTitle}>Two-Factor Authentication</Text>
            <Text style={styles.menuSubtitle}>Further secure your account for safety</Text>
          </View>
          <Feather name="chevron-right" size={20} color="#9CA3AF" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem} onPress={handleLogout}>
          <View style={styles.menuIconContainer}>
            <Feather name="log-out" size={18} color="#6B7280" />
          </View>
          <View style={styles.menuTextContainer}>
            <Text style={styles.menuTitle}>Log out</Text>
            <Text style={styles.menuSubtitle}>Sign out of your driver account</Text>
          </View>
          <Feather name="chevron-right" size={20} color="#9CA3AF" />
        </TouchableOpacity>
      </View>

      {/* More Section */}
      <Text style={styles.sectionTitle}>More</Text>
      
      <View style={styles.menuSection}>
        <TouchableOpacity 
          style={styles.menuItem}
          onPress={() => Alert.alert('Help & Support', 'Please contact CENRO dispatch at (032) 123-4567 for immediate assistance.')}
        >
          <View style={styles.menuIconContainer}>
            <Feather name="bell" size={18} color="#6B7280" />
          </View>
          <View style={styles.menuTextContainer}>
            <Text style={styles.menuTitle}>Help & Support</Text>
          </View>
          <Feather name="chevron-right" size={20} color="#9CA3AF" />
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.menuItem}
          onPress={() => Alert.alert('About TrashTrack', 'TrashTrack Driver Portal v1.0.0\nDeveloped for Cebu City CENRO.')}
        >
          <View style={styles.menuIconContainer}>
            <Feather name="heart" size={18} color="#6B7280" />
          </View>
          <View style={styles.menuTextContainer}>
            <Text style={styles.menuTitle}>About App</Text>
          </View>
          <Feather name="chevron-right" size={20} color="#9CA3AF" />
        </TouchableOpacity>
      </View>
      
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 60,
    marginBottom: 30,
  },
  backButton: {
    padding: 8,
    marginLeft: -8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
  },
  profileCard: {
    backgroundColor: '#3B5241',
    borderRadius: 20,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 30,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  profileInfo: {
    flex: 1,
    marginLeft: 16,
  },
  profileName: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  profileHandle: {
    color: '#9CA3AF',
    fontSize: 13,
  },
  editButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  menuIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  menuTextContainer: {
    flex: 1,
  },
  menuTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 2,
  },
  menuSubtitle: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#4B5563',
    marginBottom: 12,
    marginLeft: 4,
  },
});
