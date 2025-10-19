import { useAuthContext } from '@/components/AuthContext';
import { db } from '@/config/firebase';
import { Colors } from '@/constants/Colors';
import { useTheme } from '@/hooks/useTheme';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, ScrollView, StatusBar, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';

interface DriverProfile {
  displayName?: string;
  email?: string;
  photoURL?: string;
  role?: string;
}

export default function DriverProfilePage() {
  const { theme, setTheme } = useTheme();
  const colors = Colors[theme ?? 'light'];
  const { user, logout } = useAuthContext();
  const router = useRouter();
  
  const [driverProfile, setDriverProfile] = useState<DriverProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editName, setEditName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [showAboutModal, setShowAboutModal] = useState(false);

  // Fetch driver profile data
  useEffect(() => {
    const fetchDriverProfile = async () => {
      if (!user || !db) {
        setLoading(false);
        return;
      }

      try {
        const userRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userRef);
        
        if (userSnap.exists()) {
          const userData = userSnap.data();
          setDriverProfile({
            displayName: userData.displayName || user.displayName || 'Driver',
            email: userData.email || user.email || '',
            photoURL: (typeof userData.photoURL === 'string' ? userData.photoURL : undefined) || (user.photoURL || undefined),
            role: userData.role || 'driver'
          });
          setEditName(userData.displayName || user.displayName || 'Driver');
        } else {
          setDriverProfile({
            displayName: user.displayName || 'Driver',
            email: user.email || '',
            photoURL: user.photoURL || undefined,
            role: 'driver'
          });
          setEditName(user.displayName || 'Driver');
        }
      } catch (error) {
        console.error('Error fetching driver profile:', error);
        setDriverProfile({
          displayName: user.displayName || 'Driver',
          email: user.email || '',
          photoURL: user.photoURL || undefined,
          role: 'driver'
        });
        setEditName(user.displayName || 'Driver');
      } finally {
        setLoading(false);
      }
    };

    fetchDriverProfile();
  }, [user]);

  // Handle profile name update
  const handleSaveProfile = async () => {
    if (!db || !user) return;
    
    setIsSaving(true);
    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        displayName: editName,
        updatedAt: new Date()
      });
      
      setDriverProfile(prev => prev ? { ...prev, displayName: editName } : null);
      setIsEditMode(false);
      Alert.alert('Success', 'Profile updated successfully!');
    } catch (error) {
      console.error('Error updating profile:', error);
      Alert.alert('Error', 'Failed to update profile. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  // Handle logout
  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
      router.replace('/');
    } catch (error) {
      console.error('Error logging out:', error);
      Alert.alert('Error', 'Failed to log out. Please try again.');
    } finally {
      setIsLoggingOut(false);
      setShowLogoutModal(false);
    }
  };

  // Handle theme toggle
  const handleThemeToggle = () => {
    setTheme(theme === 'light' ? 'dark' : 'light');
  };

  // Navigation handlers
  const handleMyAccount = () => {
    try {
      router.push('/profile');
    } catch {
      Alert.alert('My Account', 'Unable to open Profile right now.');
    }
  };

 

  const handleTwoFactorAuth = () => {
    Alert.alert('Two-Factor Authentication', '2FA setup coming soon!');
  };

  const handleHelpSupport = () => {
    setShowHelpModal(true);
  };

  const handleAboutApp = () => {
    setShowAboutModal(true);
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color="#4F6F52" />
        <Text style={styles.loadingText}>Loading profile...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={theme === 'dark' ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />
      
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>DRIVER PROFILE</Text>
      </View>

      <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Profile Card */}
        <View style={[styles.profileCard, { backgroundColor: colors.primary }]}>
          <View style={styles.profileInfo}>
            <View style={styles.avatarContainer}>
              {driverProfile?.photoURL ? (
                <Image source={{ uri: driverProfile.photoURL }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatarPlaceholder, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
                  <MaterialIcons name="person" size={40} color={colors.surface} />
                </View>
              )}
            </View>
            
            <View style={styles.profileDetails}>
              {isEditMode ? (
                <View style={styles.editContainer}>
                  <TextInput
                    value={editName}
                    onChangeText={setEditName}
                    style={[styles.editInput, { backgroundColor: 'rgba(255,255,255,0.2)', color: colors.surface }]}
                    placeholder="Enter your name"
                    placeholderTextColor="rgba(255,255,255,0.7)"
                  />
                  <TouchableOpacity 
                    style={[styles.saveButton, { backgroundColor: colors.surface }]} 
                    onPress={handleSaveProfile}
                    disabled={isSaving}
                  >
                    {isSaving ? (
                      <ActivityIndicator size="small" color={colors.primary} />
                    ) : (
                      <MaterialIcons name="check" size={20} color={colors.primary} />
                    )}
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.nameContainer}>
                  <Text style={[styles.driverName, { color: colors.surface }]}>{driverProfile?.displayName || 'Driver'}</Text>
                  <TouchableOpacity 
                    style={styles.editIcon} 
                    onPress={handleMyAccount}
                  >
                    <MaterialIcons name="edit" size={20} color={colors.surface} />
                  </TouchableOpacity>
                </View>
              )}
              
              <Text style={[styles.driverEmail, { color: 'rgba(255,255,255,0.8)' }]}>@{driverProfile?.email?.split('@')[0] || 'driver'}</Text>
            </View>
          </View>
        </View>

        {/* Account and Security Section */}
        <View style={styles.section}>
          <View style={[styles.menuItem, { backgroundColor: colors.surface }]} onTouchEnd={handleMyAccount}>
            <View style={[styles.menuIcon, { backgroundColor: colors.surfaceVariant }]}>
              <MaterialIcons name="person" size={24} color={colors.primary} />
            </View>
            <View style={styles.menuContent}>
              <Text style={[styles.menuTitle, { color: colors.textPrimary }]}>My Account</Text>
              <Text style={[styles.menuSubtitle, { color: colors.textSecondary }]}>Make changes to your account</Text>
            </View>
            <View style={styles.menuRight}>
              <MaterialIcons name="warning" size={20} color={colors.error} />
              <MaterialIcons name="chevron-right" size={24} color={colors.textTertiary} />
            </View>
          </View>

          

          <View style={[styles.menuItem, { backgroundColor: colors.surface }]}>
            <View style={[styles.menuIcon, { backgroundColor: colors.surfaceVariant }]}>
              <MaterialIcons name="dark-mode" size={24} color={colors.primary} />
            </View>
            <View style={styles.menuContent}>
              <Text style={[styles.menuTitle, { color: colors.textPrimary }]}>Dark Mode / Light Mode</Text>
              <Text style={[styles.menuSubtitle, { color: colors.textSecondary }]}>Switch app appearance</Text>
            </View>
            <Switch
              value={theme === 'dark'}
              onValueChange={handleThemeToggle}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor={theme === 'dark' ? colors.surface : colors.surfaceVariant}
            />
          </View>

          
          <View style={[styles.menuItem, { backgroundColor: colors.surface }]} onTouchEnd={() => setShowLogoutModal(true)}>
            <View style={[styles.menuIcon, { backgroundColor: colors.surfaceVariant }]}>
              <MaterialIcons name="logout" size={24} color={colors.primary} />
            </View>
            <View style={styles.menuContent}>
              <Text style={[styles.menuTitle, { color: colors.textPrimary }]}>Log out</Text>
              <Text style={[styles.menuSubtitle, { color: colors.textSecondary }]}>Further secure your account for safety</Text>
            </View>
            <MaterialIcons name="chevron-right" size={24} color={colors.textTertiary} />
          </View>
        </View>

        {/* More Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>More</Text>
          
          <View style={[styles.menuItem, { backgroundColor: colors.surface }]} onTouchEnd={handleHelpSupport}>
            <View style={[styles.menuIcon, { backgroundColor: colors.surfaceVariant }]}>
              <MaterialIcons name="notifications" size={24} color={colors.primary} />
            </View>
            <View style={styles.menuContent}>
              <Text style={[styles.menuTitle, { color: colors.textPrimary }]}>Help & Support</Text>
            </View>
            <MaterialIcons name="chevron-right" size={24} color={colors.textTertiary} />
          </View>

          <View style={[styles.menuItem, { backgroundColor: colors.surface }]} onTouchEnd={handleAboutApp}>
            <View style={[styles.menuIcon, { backgroundColor: colors.surfaceVariant }]}>
              <MaterialIcons name="favorite" size={24} color={colors.primary} />
            </View>
            <View style={styles.menuContent}>
              <Text style={[styles.menuTitle, { color: colors.textPrimary }]}>About App</Text>
            </View>
            <MaterialIcons name="chevron-right" size={24} color={colors.textTertiary} />
          </View>
        </View>
      </ScrollView>

      {/* Logout Modal */}
      {showLogoutModal && (
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Log Out</Text>
            <Text style={[styles.modalMessage, { color: colors.textSecondary }]}>Are you sure you want to log out?</Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={[styles.modalButtonCancel, { borderColor: colors.border }]} 
                onPress={() => setShowLogoutModal(false)}
              >
                <Text style={[styles.modalButtonCancelText, { color: colors.textSecondary }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalButtonConfirm, { backgroundColor: colors.primary }]} 
                onPress={handleLogout}
                disabled={isLoggingOut}
              >
                {isLoggingOut ? (
                  <ActivityIndicator size="small" color={colors.surface} />
                ) : (
                  <Text style={[styles.modalButtonConfirmText, { color: colors.surface }]}>Log Out</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* Help & Support Modal */}
      {showHelpModal && (
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Help & Support</Text>
            <Text style={[styles.modalMessage, { color: colors.textSecondary }]}>Need assistance? Here are a few ways to get help:</Text>
            <View style={{ gap: 8 }}>
              <Text style={[styles.menuSubtitle, { color: colors.textSecondary }]}>• Email: support@trashtrack.app</Text>
              <Text style={[styles.menuSubtitle, { color: colors.textSecondary }]}>• Docs: docs.trashtrack.app</Text>
              <Text style={[styles.menuSubtitle, { color: colors.textSecondary }]}>• Tips: Make sure you are online and signed in.</Text>
            </View>
            <View style={styles.modalButtons}>
              <TouchableOpacity style={[styles.modalButtonCancel, { borderColor: colors.border }]} onPress={() => setShowHelpModal(false)}>
                <Text style={[styles.modalButtonCancelText, { color: colors.textSecondary }]}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* About App Modal */}
      {showAboutModal && (
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>About TrashTrack</Text>
            <Text style={[styles.modalMessage, { color: colors.textSecondary }]}>TrashTrack Driver helps you view schedules, complete pickups with photo proof, and keep your history organized.</Text>
            <Text style={[styles.menuSubtitle, { color: colors.textSecondary }]}>Version 1.0.0</Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity style={[styles.modalButtonCancel, { borderColor: colors.border }]} onPress={() => setShowAboutModal(false)}>
                <Text style={[styles.modalButtonCancelText, { color: colors.textSecondary }]}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  header: {

    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  headerTitle: {
    top:-10,
    fontSize: 18,
    fontWeight: 'bold',
  },
  scrollContent: {
    flex: 1,
    paddingHorizontal: 20,
  },
  profileCard: {
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
  },
  profileInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarContainer: {
    marginRight: 16,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  avatarPlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileDetails: {
    flex: 1,
  },
  nameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  driverName: {
    fontSize: 18,
    fontWeight: 'bold',
    flex: 1,
  },
  editIcon: {
    padding: 4,
  },
  editContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  editInput: {
    flex: 1,
    fontSize: 18,
    fontWeight: 'bold',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
  },
  saveButton: {
    padding: 8,
    borderRadius: 6,
  },
  driverEmail: {
    fontSize: 14,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  menuIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  menuContent: {
    flex: 1,
  },
  menuTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  menuSubtitle: {
    fontSize: 12,
  },
  menuRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  modalContent: {
    borderRadius: 12,
    padding: 24,
    margin: 20,
    minWidth: 280,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  modalMessage: {
    fontSize: 14,
    marginBottom: 24,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButtonCancel: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  modalButtonCancelText: {
    fontSize: 16,
    fontWeight: '600',
  },
  modalButtonConfirm: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalButtonConfirmText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
