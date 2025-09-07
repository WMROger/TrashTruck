import { useAuthContext } from '@/components/AuthContext';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { db } from '@/config/firebase';
import { Colors } from '@/constants/Colors';
import { useTheme } from '@/hooks/useTheme';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { doc, getDoc } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

export default function ProfilePage() {
  const { theme, setTheme, toggleSystem } = useTheme();
  const colors = Colors[theme ?? 'light'];
  const { user, logout, updateProfile } = useAuthContext();
  const [preferencesExpanded, setPreferencesExpanded] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editName, setEditName] = useState(user?.displayName || '');
  const [editPhotoURL, setEditPhotoURL] = useState(user?.photoURL || null);
  const [isSaving, setIsSaving] = useState(false);
  const [userProfile, setUserProfile] = useState<{
    displayName?: string;
    photoURL?: string;
  } | null>(null);
  const router = useRouter();

  // Fetch user profile data from Firestore
  useEffect(() => {
    const fetchUserProfile = async () => {
      if (!user || !db) return;

      try {
        const userRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userRef);
        
        if (userSnap.exists()) {
          const userData = userSnap.data();
          setUserProfile({
            displayName: userData.displayName || user.displayName || 'User',
            photoURL: userData.photoURL || user.photoURL || null,
          });
        } else {
          // Fallback to auth data if Firestore document doesn't exist
          setUserProfile({
            displayName: user.displayName || 'User',
            photoURL: user.photoURL || null,
          });
        }
      } catch (error) {
        console.error('Error fetching user profile:', error);
        // Fallback to auth data on error
        setUserProfile({
          displayName: user.displayName || 'User',
          photoURL: user.photoURL || null,
        });
      }
    };

    fetchUserProfile();
  }, [user]);

  // ...existing code...

  const handleLogout = () => {
    setLogoutError(null);
    setShowLogoutModal(true);
  };

  const cancelLogout = () => {
    setShowLogoutModal(false);
    setLogoutError(null);
  };

  const confirmLogout = async () => {
    setLogoutError(null);
    setIsLoggingOut(true);
    try {
      await logout();
      setShowLogoutModal(false);
    } catch (e: any) {
      setLogoutError(e?.message || 'Logout failed');
    } finally {
      setIsLoggingOut(false);
    }
  };

  const togglePreferences = () => {
    setPreferencesExpanded(!preferencesExpanded);
  };

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    console.log('Theme changed to:', newTheme);
  };

  const handleEditProfile = () => {
    setIsEditMode(true);
    setEditName(userProfile?.displayName || user?.displayName || '');
    setEditPhotoURL(userProfile?.photoURL || user?.photoURL || null);
  };

  const handleCancelEdit = () => {
    setIsEditMode(false);
    setEditName(userProfile?.displayName || user?.displayName || '');
    setEditPhotoURL(userProfile?.photoURL || user?.photoURL || null);
  };

  const handleSaveProfile = async () => {
    setIsSaving(true);
    try {
      await updateProfile({ displayName: editName, photoURL: editPhotoURL });
      
      // Update local profile state with the new data
      setUserProfile({
        displayName: editName,
        photoURL: editPhotoURL,
      });
      
      Alert.alert('Success', 'Profile updated successfully');
      setIsEditMode(false);
    } catch (err: any) {
      console.error('Profile update error:', err);
      let errorMessage = 'Failed to update profile';
      
      if (err?.code === 'auth/invalid-profile-attribute') {
        errorMessage = 'Profile photo URL is too long. Please try with a different image.';
      } else if (err?.message) {
        errorMessage = err.message;
      }
      
      Alert.alert('Error', errorMessage);
    } finally {
      setIsSaving(false);
    }
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.7,
    });
    if (!result.canceled && result.assets && result.assets.length > 0) {
      const selectedImageUri = result.assets[0].uri;
      
      // Check if the URI is too long for Firebase Auth
      if (selectedImageUri.length > 2000) {
        Alert.alert(
          'Image URL Too Long', 
          'The selected image URL is too long for Firebase Auth. The image will be saved to your profile but may not appear in Firebase Auth. Consider using a different image or uploading to a cloud service.'
        );
      }
      
      setEditPhotoURL(selectedImageUri);
    }
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
          <TouchableOpacity 
            style={styles.avatarContainer} 
            onPress={isEditMode ? pickImage : undefined} 
            activeOpacity={isEditMode ? 0.7 : 1}
          >
            {isEditMode ? (
              editPhotoURL ? (
                <Image source={{ uri: editPhotoURL }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
                  <IconSymbol name="person.fill" size={40} color={colors.surface} />
                </View>
              )
            ) : (
              userProfile?.photoURL ? (
                <Image source={{ uri: userProfile.photoURL }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
                  <IconSymbol name="person.fill" size={40} color={colors.surface} />
                </View>
              )
            )}
            {isEditMode && <Text style={styles.avatarEditText}>Tap to change photo</Text>}
          </TouchableOpacity>
          
          {isEditMode ? (
            <TextInput
              value={editName}
              onChangeText={setEditName}
              style={[styles.editNameInput, { color: colors.textPrimary, backgroundColor: colors.background }]}
              placeholder="Enter your name"
              placeholderTextColor={colors.textTertiary}
            />
          ) : (
            <Text style={[styles.userName, { color: colors.textPrimary }]}>
              {userProfile?.displayName || 'User'}
            </Text>
          )}
          
          <Text style={[styles.userEmail, { color: colors.textSecondary }]}>
            {user?.email || 'No email'}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
            Account Settings
          </Text>
          
          <TouchableOpacity 
            style={[styles.menuItem, { backgroundColor: colors.surface }]} 
            onPress={isEditMode ? handleCancelEdit : handleEditProfile}
          >
            <IconSymbol name={isEditMode ? "xmark.circle" : "person.circle"} size={24} color={colors.primary} />
            <Text style={[styles.menuText, { color: colors.textPrimary }]}> 
              {isEditMode ? 'Cancel Edit' : 'Edit Profile'}
            </Text>
            {!isEditMode && <IconSymbol name="chevron.right" size={16} color={colors.textTertiary} />}
          </TouchableOpacity>

          {isEditMode && (
            <TouchableOpacity 
              style={[styles.saveButton, { backgroundColor: colors.primary }]} 
              onPress={handleSaveProfile}
              disabled={isSaving}
            >
              {isSaving ? (
                <ActivityIndicator color={colors.surface} />
              ) : (
                <Text style={[styles.saveButtonText, { color: colors.surface }]}>
                  Save Changes
                </Text>
              )}
            </TouchableOpacity>
          )}

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
              {/* Theme Status Display */}
              <View style={styles.themeStatusContainer}>
                <Text style={[styles.themeStatusText, { color: colors.textSecondary }]}>
                  Current Theme: {theme?.toUpperCase()}
                </Text>
                <Text style={[styles.themeStatusText, { color: colors.textTertiary }]}>
                  Background: {colors.background}
                </Text>
              </View>

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

              {/* System Theme Toggle */}
              <View style={styles.toggleContainer}>
                <TouchableOpacity 
                  style={[
                    styles.systemToggleSwitch, 
                    { 
                      backgroundColor: colors.surface,
                      borderColor: colors.primary,
                      borderWidth: 2
                    }
                  ]}
                  onPress={toggleSystem}
                  activeOpacity={0.8}
                >
                  <IconSymbol 
                    name="gear" 
                    size={20} 
                    color={colors.primary} 
                  />
                  <Text style={[
                    styles.systemToggleText, 
                    { color: colors.textPrimary }
                  ]}>
                    Use System Theme
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
          style={[
            styles.logoutButton, 
            { 
              backgroundColor: isLoggingOut ? colors.textTertiary : colors.error,
              opacity: isLoggingOut ? 0.6 : 1
            }
          ]} 
          onPress={handleLogout}
          disabled={isLoggingOut}
        >
          <IconSymbol name="rectangle.portrait.and.arrow.right" size={20} color={colors.surface} />
          <Text style={[styles.logoutText, { color: colors.surface }]}>
            {isLoggingOut ? 'Logging Out...' : 'Logout'}
          </Text>
        </TouchableOpacity>

        {/* Logout Confirmation Modal */}
        <Modal
          visible={showLogoutModal}
          transparent
          animationType="fade"
          onRequestClose={cancelLogout}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContainer, { backgroundColor: colors.surface }]}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Confirm Logout</Text>
              <Text style={[styles.modalMessage, { color: colors.textSecondary }]}>Are you sure you want to logout?</Text>

              {logoutError ? <Text style={styles.errorText}>{logoutError}</Text> : null}

              <View style={styles.modalActions}>
                <TouchableOpacity style={[styles.modalButton, { backgroundColor: colors.surface }]} onPress={cancelLogout}>
                  <Text style={[styles.modalButtonText, { color: colors.textPrimary }]}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity style={[styles.modalButtonConfirm, { backgroundColor: colors.error }]} onPress={confirmLogout} disabled={isLoggingOut}>
                  {isLoggingOut ? (
                    <ActivityIndicator color={colors.surface} />
                  ) : (
                    <Text style={[styles.modalButtonText, { color: colors.surface }]}>Logout</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
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
  systemToggleSwitch: {
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
  systemToggleText: {
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
  themeStatusContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  themeStatusText: {
    fontSize: 14,
    marginBottom: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center'
  },
  modalContainer: {
    width: '80%'
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center'
  },
  modalMessage: {
    fontSize: 14,
    marginBottom: 16,
    textAlign: 'center'
  },
  errorText: {
    color: '#ff4d4f',
    textAlign: 'center',
    marginBottom: 8
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  modalButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    marginRight: 8,
    alignItems: 'center'
  },
  modalButtonConfirm: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    marginLeft: 8,
    alignItems: 'center'
  },
  modalButtonText: {
    fontWeight: 'bold'
  },
  avatarContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarEditText: {
    color: '#888',
    fontSize: 12,
    marginTop: 4,
  },
  editNameInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 4,
    borderColor: '#ddd',
  },
  saveButton: {
    marginTop: 16,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveButtonText: {
    fontWeight: 'bold',
    fontSize: 16,
  },
}); 