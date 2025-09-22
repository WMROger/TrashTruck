import { useAuthContext } from '@/components/AuthContext';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { UPLOAD_PRESETS } from '@/config/cloudinary';
import { db, storage } from '@/config/firebase';
import { Colors } from '@/constants/Colors';
import { useTheme } from '@/hooks/useTheme';
import { cloudinaryService, UPLOAD_FOLDERS } from '@/services/cloudinaryService';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { doc, getDoc } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

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
  const [editPhotoURL, setEditPhotoURL] = useState<string | undefined>(user?.photoURL || undefined);
  const [isSaving, setIsSaving] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [userProfile, setUserProfile] = useState<{
    displayName?: string;
    photoURL?: string;
  } | null>(null);
  const [showNotificationsModal, setShowNotificationsModal] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [showAboutModal, setShowAboutModal] = useState(false);
  const [enableAnnouncementNotifs, setEnableAnnouncementNotifs] = useState(true);
  const [enableScheduleNotifs, setEnableScheduleNotifs] = useState(true);
  const router = useRouter();

  // Resolve storage path to public URL if needed
  const resolvePhotoURL = async (maybePath?: string) => {
    try {
      if (!maybePath) return undefined;
      const isHttp = /^https?:\/\//i.test(maybePath);
      const isDataOrLocal = /^(data:|file:|content:|asset(s)?:\/\/|blob:|expo-file:)/i.test(maybePath);
      if (isHttp || isDataOrLocal) return maybePath;
      if (!storage) return undefined;
      const { getDownloadURL, ref } = await import('firebase/storage');
      // Treat non-URL strings as storage paths or gs:// URLs
      const r = ref(storage, maybePath);
      return await getDownloadURL(r);
    } catch (e) {
      console.warn('Failed to resolve photo URL:', e);
      return undefined;
    }
  };

  // Fetch user profile data from Firestore
  useEffect(() => {
    const fetchUserProfile = async () => {
      if (!user || !db) return;

      try {
        const userRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userRef);
        
        if (userSnap.exists()) {
          const userData = userSnap.data();
          const resolved = await resolvePhotoURL(userData.photoURL || user.photoURL);
          setUserProfile({
            displayName: userData.displayName || user.displayName || 'User',
            photoURL: resolved,
          });
        } else {
        // Fallback to auth data if Firestore document doesn't exist
        const resolved = await resolvePhotoURL(user.photoURL || undefined);
        setUserProfile({
          displayName: user.displayName || 'User',
          photoURL: resolved,
        });
        }
      } catch (error) {
        console.error('Error fetching user profile:', error);
        // Fallback to auth data on error
        const resolved = await resolvePhotoURL(user?.photoURL || undefined);
        setUserProfile({
          displayName: user.displayName || 'User',
          photoURL: resolved,
        });
      }
    };

    fetchUserProfile();
  }, [user]);

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
    setEditPhotoURL(userProfile?.photoURL || user?.photoURL || undefined);
  };

  const handleCancelEdit = () => {
    setIsEditMode(false);
    setEditName(userProfile?.displayName || user?.displayName || '');
    setEditPhotoURL(userProfile?.photoURL || user?.photoURL || undefined);
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
    const mediaTypes = (ImagePicker as any).MediaType
      ? [(ImagePicker as any).MediaType.image]
      : ((ImagePicker as any).MediaTypeOptions?.Images ?? ImagePicker.MediaTypeOptions.Images);
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: mediaTypes as any,
      allowsEditing: true,
      quality: 0.7,
      base64: Platform.OS === 'web',
    } as any);
    if (!result.canceled && result.assets && result.assets.length > 0) {
      const asset: any = result.assets[0];
      const selectedImageUri = asset.uri;
      
      // Check if the URI is too long for Firebase Auth
      if (selectedImageUri.length > 2000) {
        Alert.alert(
          'Image URL Too Long', 
          'The selected image URL is too long for Firebase Auth. The image will be saved to your profile but may not appear in Firebase Auth. Consider using a different image or uploading to a cloud service.'
        );
      }
      
      let uploadSource = selectedImageUri;
      if (asset.base64) {
        const mime = asset.mimeType || 'image/jpeg';
        const dataUrl = `data:${mime};base64,${asset.base64}`;
        setEditPhotoURL(dataUrl);
        uploadSource = dataUrl;
      } else {
        setEditPhotoURL(selectedImageUri);
      }

      try {
        const result = await cloudinaryService.uploadImage(uploadSource, { folder: UPLOAD_FOLDERS.PROFILES, preset: UPLOAD_PRESETS.PROFILES });
        if (result.success && result.url) {
          setEditPhotoURL(result.url);
        } else {
          Alert.alert('Upload Error', result.error || 'Failed to upload profile image.');
        }
      } catch (err) {
        Alert.alert('Upload Error', 'Failed to upload profile image.');
      }
    }
  };

  const handleChangePassword = () => {
    setShowChangePassword(true);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
  };

  const handleCancelChangePassword = () => {
    setShowChangePassword(false);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setShowCurrentPassword(false);
    setShowNewPassword(false);
    setShowConfirmPassword(false);
  };

  const validatePassword = (password: string) => {
    if (password.length < 8) {
      return 'Password must be at least 8 characters long';
    }
    if (!/(?=.*[a-z])/.test(password)) {
      return 'Password must contain at least one lowercase letter';
    }
    if (!/(?=.*[A-Z])/.test(password)) {
      return 'Password must contain at least one uppercase letter';
    }
    if (!/(?=.*\d)/.test(password)) {
      return 'Password must contain at least one number';
    }
    if (!/(?=.*[@$!%*?&])/.test(password)) {
      return 'Password must contain at least one special character (@$!%*?&)';
    }
    return null;
  };

  const handleSavePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      Alert.alert('Error', 'Please fill in all password fields');
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert('Error', 'New passwords do not match');
      return;
    }

    const passwordError = validatePassword(newPassword);
    if (passwordError) {
      Alert.alert('Password Requirements', passwordError);
      return;
    }

    setIsChangingPassword(true);
    try {
      // Import Firebase Auth functions
      const { signInWithEmailAndPassword, updatePassword } = await import('firebase/auth');
      const { auth } = await import('@/config/firebase');
      
      if (!auth || !user?.email) {
        throw new Error('Authentication not available');
      }

      // Re-authenticate user with current password
      await signInWithEmailAndPassword(auth, user.email, currentPassword);
      
      // Update password
      await updatePassword(user, newPassword);
      
      Alert.alert('Success', 'Password updated successfully');
      handleCancelChangePassword();
    } catch (error: any) {
      console.error('Password change error:', error);
      let errorMessage = 'Failed to change password';
      
      if (error?.code === 'auth/wrong-password') {
        errorMessage = 'Current password is incorrect';
      } else if (error?.code === 'auth/weak-password') {
        errorMessage = 'New password is too weak';
      } else if (error?.code === 'auth/requires-recent-login') {
        errorMessage = 'Please log out and log back in before changing your password';
      } else if (error?.message) {
        errorMessage = error.message;
      }
      
      Alert.alert('Error', errorMessage);
    } finally {
      setIsChangingPassword(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Modal Header */}
      <View style={[styles.modalHeader, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity 
          style={styles.closeButton}
          onPress={() => router.back()}
        >
          <IconSymbol name="xmark" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Profile & Settings</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.scrollContent}>
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

          <TouchableOpacity 
            style={[styles.menuItem, { backgroundColor: colors.surface }]} 
            onPress={handleChangePassword}
          >
            <IconSymbol name="lock.rotation" size={24} color={colors.primary} />
            <Text style={[styles.menuText, { color: colors.textPrimary }]}>
              Change Password
            </Text>
            <IconSymbol name="chevron.right" size={16} color={colors.textTertiary} />
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.menuItem, { backgroundColor: colors.surface }]}
            onPress={() => setShowNotificationsModal(true)}
          >
            <IconSymbol name="bell" size={24} color={colors.primary} />
            <Text style={[styles.menuText, { color: colors.textPrimary }]}>
              Notifications
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

          <TouchableOpacity 
            style={[styles.menuItem, { backgroundColor: colors.surface }]}
            onPress={() => setShowHelpModal(true)}
          >
            <IconSymbol name="questionmark.circle" size={24} color={colors.primary} />
            <Text style={[styles.menuText, { color: colors.textPrimary }]}>
              Help & Support
            </Text>
            <IconSymbol name="chevron.right" size={16} color={colors.textTertiary} />
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.menuItem, { backgroundColor: colors.surface }]}
            onPress={() => setShowAboutModal(true)}
          >
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

        {/* Notifications Modal */}
        <Modal
          visible={showNotificationsModal}
          transparent
          animationType="slide"
          onRequestClose={() => setShowNotificationsModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.passwordModalContainer, { backgroundColor: colors.surface }]}> 
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Notifications</Text>
              <Text style={[styles.modalMessage, { color: colors.textSecondary }]}>Choose what you want to be notified about.</Text>
              <View style={{ gap: 12 }}>
                <TouchableOpacity 
                  style={[
                    styles.selectableItem,
                    {
                      backgroundColor: enableAnnouncementNotifs ? '#242E21' : colors.background,
                      borderColor: enableAnnouncementNotifs ? '#242E21' : colors.border
                    }
                  ]}
                  onPress={() => setEnableAnnouncementNotifs(!enableAnnouncementNotifs)}
                  activeOpacity={0.85}
                >
                  <Text style={[
                    styles.selectableLabel, 
                    { color: enableAnnouncementNotifs ? '#FFFFFF' : colors.textPrimary }
                  ]}>Announcements</Text>
                  <IconSymbol 
                    name={enableAnnouncementNotifs ? 'checkmark.circle.fill' : 'circle'} 
                    size={22} 
                    color={enableAnnouncementNotifs ? '#FFFFFF' : colors.textTertiary} 
                  />
                </TouchableOpacity>

                <TouchableOpacity 
                  style={[
                    styles.selectableItem,
                    {
                      backgroundColor: enableScheduleNotifs ? '#242E21' : colors.background,
                      borderColor: enableScheduleNotifs ? '#242E21' : colors.border
                    }
                  ]}
                  onPress={() => setEnableScheduleNotifs(!enableScheduleNotifs)}
                  activeOpacity={0.85}
                >
                  <Text style={[
                    styles.selectableLabel, 
                    { color: enableScheduleNotifs ? '#FFFFFF' : colors.textPrimary }
                  ]}>Pickup reminders</Text>
                  <IconSymbol 
                    name={enableScheduleNotifs ? 'checkmark.circle.fill' : 'circle'} 
                    size={22} 
                    color={enableScheduleNotifs ? '#FFFFFF' : colors.textTertiary} 
                  />
                </TouchableOpacity>
              </View>
              <View style={styles.modalActions}>
                <TouchableOpacity style={[styles.modalButton, { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 }]} onPress={() => setShowNotificationsModal(false)}>
                  <Text style={[styles.modalButtonText, { color: colors.textPrimary }]}>Done</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Help & Support Modal */}
        <Modal
          visible={showHelpModal}
          transparent
          animationType="slide"
          onRequestClose={() => setShowHelpModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.passwordModalContainer, { backgroundColor: colors.surface }]}> 
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Help & Support</Text>
              <Text style={[styles.modalMessage, { color: colors.textSecondary }]}>How can we help you?</Text>
              <View style={{ gap: 12 }}>
                <TouchableOpacity 
                  style={[styles.menuItem, { backgroundColor: colors.background }]}
                  onPress={() => {
                    const mailto = 'mailto:support@trashtrack.app?subject=Support%20Request&body=Describe%20your%20issue...';
                    try { (window as any).location.href = mailto; } catch {}
                  }}
                >
                  <IconSymbol name="envelope" size={22} color={colors.primary} />
                  <Text style={[styles.menuText, { color: colors.textPrimary }]}>Email support</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.menuItem, { backgroundColor: colors.background }]}
                  onPress={() => {
                    try { (window as any).open?.('https://docs.trashtrack.app', '_blank'); } catch {}
                  }}
                >
                  <IconSymbol name="book" size={22} color={colors.primary} />
                  <Text style={[styles.menuText, { color: colors.textPrimary }]}>View documentation</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.modalActions}>
                <TouchableOpacity style={[styles.modalButton, { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 }]} onPress={() => setShowHelpModal(false)}>
                  <Text style={[styles.modalButtonText, { color: colors.textPrimary }]}>Close</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* About Modal */}
        <Modal
          visible={showAboutModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowAboutModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.passwordModalContainer, { backgroundColor: colors.surface }]}> 
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>About TrashTrack</Text>
              <Text style={[styles.modalMessage, { color: colors.textSecondary }]}>TrashTrack helps you keep your community clean with schedules, reports, and announcements.</Text>
              <Text style={[styles.modalMessage, { color: colors.textTertiary }]}>Version 1.0.0</Text>
              <View style={styles.modalActions}>
                <TouchableOpacity style={[styles.modalButton, { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 }]} onPress={() => setShowAboutModal(false)}>
                  <Text style={[styles.modalButtonText, { color: colors.textPrimary }]}>Close</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
        {/* Change Password Modal */}
        <Modal
          visible={showChangePassword}
          transparent
          animationType="slide"
          onRequestClose={handleCancelChangePassword}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.passwordModalContainer, { backgroundColor: colors.surface }]}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Change Password</Text>
              
              {/* Current Password */}
              <View style={styles.passwordInputContainer}>
                <Text style={[styles.passwordLabel, { color: colors.textPrimary }]}>Current Password</Text>
                <View style={[styles.passwordInputWrapper, { backgroundColor: colors.background, borderColor: colors.border }]}>
                  <TextInput
                    style={[styles.passwordInput, { color: colors.textPrimary }]}
                    value={currentPassword}
                    onChangeText={setCurrentPassword}
                    placeholder="Enter current password"
                    placeholderTextColor={colors.textTertiary}
                    secureTextEntry={!showCurrentPassword}
                  />
                  <TouchableOpacity
                    style={styles.eyeButton}
                    onPress={() => setShowCurrentPassword(!showCurrentPassword)}
                  >
                    <IconSymbol 
                      name={showCurrentPassword ? "eye.slash" : "eye"} 
                      size={20} 
                      color={colors.textSecondary} 
                    />
                  </TouchableOpacity>
                </View>
              </View>

              {/* New Password */}
              <View style={styles.passwordInputContainer}>
                <Text style={[styles.passwordLabel, { color: colors.textPrimary }]}>New Password</Text>
                <View style={[styles.passwordInputWrapper, { backgroundColor: colors.background, borderColor: colors.border }]}>
                  <TextInput
                    style={[styles.passwordInput, { color: colors.textPrimary }]}
                    value={newPassword}
                    onChangeText={setNewPassword}
                    placeholder="Enter new password"
                    placeholderTextColor={colors.textTertiary}
                    secureTextEntry={!showNewPassword}
                  />
                  <TouchableOpacity
                    style={styles.eyeButton}
                    onPress={() => setShowNewPassword(!showNewPassword)}
                  >
                    <IconSymbol 
                      name={showNewPassword ? "eye.slash" : "eye"} 
                      size={20} 
                      color={colors.textSecondary} 
                    />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Confirm Password */}
              <View style={styles.passwordInputContainer}>
                <Text style={[styles.passwordLabel, { color: colors.textPrimary }]}>Confirm New Password</Text>
                <View style={[styles.passwordInputWrapper, { backgroundColor: colors.background, borderColor: colors.border }]}>
                  <TextInput
                    style={[styles.passwordInput, { color: colors.textPrimary }]}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    placeholder="Confirm new password"
                    placeholderTextColor={colors.textTertiary}
                    secureTextEntry={!showConfirmPassword}
                  />
                  <TouchableOpacity
                    style={styles.eyeButton}
                    onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                  >
                    <IconSymbol 
                      name={showConfirmPassword ? "eye.slash" : "eye"} 
                      size={20} 
                      color={colors.textSecondary} 
                    />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Password Requirements */}
              <View style={styles.passwordRequirements}>
                <Text style={[styles.requirementsTitle, { color: colors.textSecondary }]}>Password Requirements:</Text>
                <Text style={[styles.requirementText, { color: colors.textTertiary }]}>• At least 8 characters</Text>
                <Text style={[styles.requirementText, { color: colors.textTertiary }]}>• One uppercase letter</Text>
                <Text style={[styles.requirementText, { color: colors.textTertiary }]}>• One lowercase letter</Text>
                <Text style={[styles.requirementText, { color: colors.textTertiary }]}>• One number</Text>
                <Text style={[styles.requirementText, { color: colors.textTertiary }]}>• One special character (@$!%*?&)</Text>
              </View>

              <View style={styles.modalActions}>
                <TouchableOpacity 
                  style={[styles.modalButton, { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 }]} 
                  onPress={handleCancelChangePassword}
                >
                  <Text style={[styles.modalButtonText, { color: colors.textPrimary }]}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={[styles.modalButtonConfirm, { backgroundColor: colors.primary }]} 
                  onPress={handleSavePassword} 
                  disabled={isChangingPassword}
                >
                  {isChangingPassword ? (
                    <ActivityIndicator color={colors.surface} />
                  ) : (
                    <Text style={[styles.modalButtonText, { color: colors.surface }]}>Change Password</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    paddingHorizontal: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
  },
  closeButton: {
    padding: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  headerSpacer: {
    width: 40, // Same width as close button to center title
  },
  scrollContent: {
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
  selectableItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
  },
  selectableLabel: {
    fontSize: 16,
    fontWeight: '600',
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
  passwordModalContainer: {
    width: '90%',
    maxWidth: 400,
    borderRadius: 12,
    padding: 20,
  },
  passwordInputContainer: {
    marginBottom: 16,
  },
  passwordLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  passwordInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  passwordInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 12,
  },
  eyeButton: {
    padding: 8,
  },
  passwordRequirements: {
    marginBottom: 20,
    padding: 12,
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: 8,
  },
  requirementsTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  requirementText: {
    fontSize: 12,
    marginBottom: 2,
  },
});

