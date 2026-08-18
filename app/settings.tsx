import { useAuthContext } from '@/components/AuthContext';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { UPLOAD_PRESETS } from '@/config/cloudinary';
import { auth, db, storage } from '@/config/firebase';
import { Colors } from '@/constants/Colors';
import { DANAO_CITY_BARANGAYS, mergeDanaoBarangays } from '@/constants/danaoBarangays';
import { useTheme } from '@/hooks/useTheme';
import DropDownPicker from 'react-native-dropdown-picker';
import { cloudinaryService, UPLOAD_FOLDERS } from '@/services/cloudinaryService';
import { writeAuditLog } from '@/services/auditLogService';
import { setFcmPushEnabled } from '@/services/pushTokenService';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword } from 'firebase/auth';
import { addDoc, collection, doc, getDoc, onSnapshot, query, serverTimestamp, setDoc, where } from 'firebase/firestore';
import { getDownloadURL, ref } from 'firebase/storage';
import React, { useEffect, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ActivityIndicator, Alert, Image, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';

export default function SettingsPage() {
  const insets = useSafeAreaInsets();
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
    barangay?: string;
  } | null>(null);
  const [showNotificationsModal, setShowNotificationsModal] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [showAboutModal, setShowAboutModal] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [showBarangayModal, setShowBarangayModal] = useState(false);
  const [editBarangay, setEditBarangay] = useState('');
  const [barangayOpen, setBarangayOpen] = useState(false);
  const [availableBarangays, setAvailableBarangays] = useState<string[]>([...DANAO_CITY_BARANGAYS]);
  const [feedbackSelected, setFeedbackSelected] = useState<number | null>(null);
  const [feedbackText, setFeedbackText] = useState('');
  const [pushEnabled, setPushEnabled] = useState(true);
  const [reminderEnabled, setReminderEnabled] = useState(true);
  const [reportUpdatesEnabled, setReportUpdatesEnabled] = useState(true);
  const [announcementNotificationsEnabled, setAnnouncementNotificationsEnabled] = useState(true);
  const [proximityAlertsEnabled, setProximityAlertsEnabled] = useState(true);
  const [proximityRadiusMeters, setProximityRadiusMeters] = useState(500);
  const [verifiedRewardCount, setVerifiedRewardCount] = useState(0);
  const [earnedRewardTokens, setEarnedRewardTokens] = useState(0);
  const [redeemedRewardTokens, setRedeemedRewardTokens] = useState(0);
  const router = useRouter();
  const availableRewardTokens = Math.max(0, earnedRewardTokens - redeemedRewardTokens);

  useEffect(() => {
    if (!user?.uid || !db) return;
    getDoc(doc(db, 'user_settings', user.uid)).then(snapshot => {
      const preferences = snapshot.data()?.notificationPreferences;
      if (!preferences) return;
      setPushEnabled(preferences.pushEnabled !== false);
      setReminderEnabled(preferences.pickupReminders !== false);
      setReportUpdatesEnabled(preferences.reportUpdates !== false);
      setAnnouncementNotificationsEnabled(preferences.announcements !== false);
      setProximityAlertsEnabled(preferences.proximityAlerts !== false);
      setProximityRadiusMeters([250, 500, 1000].includes(preferences.proximityRadiusMeters) ? preferences.proximityRadiusMeters : 500);
    }).catch(error => console.warn('Unable to load notification preferences:', error));
  }, [user?.uid]);

  useEffect(() => {
    if (!user?.uid || !db) return;
    const unsubscribeAwards = onSnapshot(
      query(collection(db, 'reward_awards'), where('userId', '==', user.uid)),
      snapshot => {
        setVerifiedRewardCount(snapshot.size);
        setEarnedRewardTokens(snapshot.docs.reduce((sum, item) => sum + Math.max(0, Number(item.data().tokens || 0)), 0));
      },
    );
    const unsubscribeRedemptions = onSnapshot(
      query(collection(db, 'reward_redemptions'), where('userId', '==', user.uid)),
      snapshot => setRedeemedRewardTokens(snapshot.docs.reduce((sum, item) => sum + Math.max(0, Number(item.data().cost || 0)), 0)),
    );
    return () => { unsubscribeAwards(); unsubscribeRedemptions(); };
  }, [user?.uid]);

  const saveNotificationPreferences = async () => {
    if (!user?.uid || !db) return;
    const notificationPreferences = {
      pushEnabled,
      pickupReminders: reminderEnabled,
      reportUpdates: reportUpdatesEnabled,
      announcements: announcementNotificationsEnabled,
      proximityAlerts: proximityAlertsEnabled,
      proximityRadiusMeters,
    };
    try {
      await setDoc(doc(db, 'user_settings', user.uid), { notificationPreferences, updatedAt: serverTimestamp() }, { merge: true });
      await setFcmPushEnabled(user.uid, pushEnabled);
      await writeAuditLog('notification.preferences_updated', 'user', user.uid, notificationPreferences);
      setShowNotificationsModal(false);
    } catch {
      Alert.alert('Unable to save', 'Notification preferences could not be updated. Check your connection and try again.');
    }
  };

  // Resolve storage path to public URL if needed
  const resolvePhotoURL = async (maybePath?: string) => {
    try {
      // Resolving photo URL
      if (!maybePath) {
        // No photo path provided
        return undefined;
      }
      
      // Check for local file paths (these won't work for display)
      const isLocalFile = /^file:\/\//.test(maybePath);
      if (isLocalFile) {
        // Local file path detected, cannot display
        return undefined; // Don't try to display local file paths
      }
      
      const isHttp = /^https?:\/\//i.test(maybePath);
      const isDataOrLocal = /^(data:|content:|asset(s)?:\/\/|blob:|expo-file:)/i.test(maybePath);
      
      if (isHttp || isDataOrLocal) {
        // Direct URL found
        return maybePath;
      }
      
      if (!storage) {
        // Firebase storage not available
        return undefined;
      }
      
      // Fetching download URL from Firebase Storage
      const r = ref(storage, maybePath);
      const downloadURL = await getDownloadURL(r);
      // Download URL obtained
      return downloadURL;
    } catch (e) {
      // Failed to resolve photo URL
      return undefined;
    }
  };

  // Fetch user profile data from Firestore
  useEffect(() => {
    const fetchUserProfile = async () => {
      if (!user || !db) {
        // User or DB not available
        return;
      }

      try {
        // Fetching user profile
        const userRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userRef);
        
        if (userSnap.exists()) {
          const userData = userSnap.data();
          console.log('📄 Firestore user data:', userData);
          console.log('🖼️ PhotoURL from Firestore:', userData.photoURL);
          console.log('🖼️ PhotoURL from Auth:', user.photoURL);
          
          // Prioritize Cloudinary URLs from Firestore, never fall back to local paths
          let photoURLToUse = userData.photoURL;
          
          // Check if the Firestore photoURL is a valid Cloudinary/HTTP URL
          const isValidCloudinaryURL = photoURLToUse && (
            photoURLToUse.includes('cloudinary.com') || 
            photoURLToUse.startsWith('https://') || 
            photoURLToUse.startsWith('http://')
          );
          
          // Only use Firestore photoURL if it's a valid Cloudinary/HTTP URL
          if (!isValidCloudinaryURL) {
            // Check Auth photoURL only if it's a valid Cloudinary/HTTP URL
            const authPhotoURL = user.photoURL;
            const isValidAuthURL = authPhotoURL && (
              authPhotoURL.includes('cloudinary.com') || 
              authPhotoURL.startsWith('https://') || 
              authPhotoURL.startsWith('http://')
            );
            
            if (isValidAuthURL) {
              photoURLToUse = authPhotoURL;
            } else {
              photoURLToUse = undefined; // No valid URL available, use placeholder
            }
          }
          
          console.log('🎯 Selected photoURL for resolution:', photoURLToUse);
          const resolved = await resolvePhotoURL(photoURLToUse);
          console.log('✅ Resolved photoURL:', resolved);
          
          setUserProfile({
            displayName: userData.displayName || user.displayName || 'User',
            photoURL: resolved,
            barangay: userData.barangay || '',
          });
        } else {
          console.log('❌ No Firestore document found, checking auth data');
          // Only use auth photoURL if it's a valid Cloudinary/HTTP URL
          const authPhotoURL = user.photoURL;
          const isValidAuthURL = authPhotoURL && (
            authPhotoURL.includes('cloudinary.com') || 
            authPhotoURL.startsWith('https://') || 
            authPhotoURL.startsWith('http://')
          );
          
          const photoURLToUse = isValidAuthURL ? authPhotoURL : undefined;
          const resolved = await resolvePhotoURL(photoURLToUse);
          console.log('✅ Fallback resolved photoURL:', resolved);
          
          setUserProfile({
            displayName: user.displayName || 'User',
            photoURL: resolved,
          });
        }
      } catch (error) {
        // Error fetching user profile
        // Only use auth photoURL if it's a valid Cloudinary/HTTP URL
        const authPhotoURL = user?.photoURL;
        const isValidAuthURL = authPhotoURL && (
          authPhotoURL.includes('cloudinary.com') || 
          authPhotoURL.startsWith('https://') || 
          authPhotoURL.startsWith('http://')
        );
        
        const photoURLToUse = isValidAuthURL ? authPhotoURL : undefined;
        const resolved = await resolvePhotoURL(photoURLToUse);
        console.log('✅ Error fallback resolved photoURL:', resolved);
        
        setUserProfile({
          displayName: user.displayName || 'User',
          photoURL: resolved,
        });
      }
    };

    const fetchBarangays = async () => {
      try {
        const { collection, getDocs } = require('firebase/firestore');
        const snap = await getDocs(collection(db, 'barangay_schedules'));
        const barangayNames = new Set<string>();
        snap.forEach((doc: any) => {
          const data = doc.data();
          if (data.barangayName) {
            barangayNames.add(data.barangayName);
          }
        });
        setAvailableBarangays(mergeDanaoBarangays(Array.from(barangayNames)));
      } catch (err) {
        console.error('Error fetching available barangays:', err);
      }
    };

    fetchUserProfile();
    fetchBarangays();
  }, [user]);

  const handleLogout = () => {
    console.log('Logout button pressed');
    setLogoutError(null);
    setShowLogoutModal(true);
    console.log('Modal should now be visible:', true);
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
    
    // Check if current photo URL is a local file path
    const currentPhotoURL = userProfile?.photoURL || user?.photoURL || undefined;
    if (currentPhotoURL && currentPhotoURL.startsWith('file://')) {
      console.warn('⚠️ Current photo URL is a local file path, clearing it');
      setEditPhotoURL(undefined); // Clear local file paths
    } else {
      setEditPhotoURL(currentPhotoURL);
    }
  };

  const handleCancelEdit = () => {
    setIsEditMode(false);
    setEditName(userProfile?.displayName || user?.displayName || '');
    
    // Check if current photo URL is a local file path
    const currentPhotoURL = userProfile?.photoURL || user?.photoURL || undefined;
    if (currentPhotoURL && currentPhotoURL.startsWith('file://')) {
      console.warn('⚠️ Cancel edit: Current photo URL is a local file path, clearing it');
      setEditPhotoURL(undefined); // Clear local file paths
    } else {
      setEditPhotoURL(currentPhotoURL);
    }
  };

  const handleSaveProfile = async () => {
    setIsSaving(true);
    try {
      console.log('💾 Saving profile with:', { displayName: editName, photoURL: editPhotoURL });
      
      // Check if photoURL is a local file path and warn
      if (editPhotoURL && editPhotoURL.startsWith('file://')) {
        console.warn('⚠️ Attempting to save local file path as photoURL:', editPhotoURL);
        Alert.alert('Error', 'Cannot save local file path. Please wait for image upload to complete or select a new image.');
        return;
      }
      
      await updateProfile({ displayName: editName, photoURL: editPhotoURL });
      
      // Update local profile state with the new data
      setUserProfile({
        displayName: editName,
        photoURL: editPhotoURL,
      });
      
      console.log('✅ Profile saved successfully');
      Alert.alert('Success', 'Profile updated successfully');
      setIsEditMode(false);
    } catch (err: any) {
      console.error('❌ Profile update error:', err);
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
      ? (ImagePicker as any).MediaType.image
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
        uploadSource = dataUrl;
      }

      try {
        console.log('🔄 Uploading image to Cloudinary...');
        // Don't set any URL until upload completes
        const result = await cloudinaryService.uploadImage(uploadSource, { folder: UPLOAD_FOLDERS.PROFILES, preset: UPLOAD_PRESETS.PROFILES });
        if (result.success && result.url) {
          console.log('✅ Cloudinary upload successful:', result.url);
          setEditPhotoURL(result.url); // Only set the Cloudinary URL
        } else {
          console.error('❌ Cloudinary upload failed:', result.error);
          Alert.alert('Upload Error', result.error || 'Failed to upload profile image.');
          // Keep the previous photo URL on failure
        }
      } catch (err) {
        console.error('❌ Cloudinary upload error:', err);
        Alert.alert('Upload Error', 'Failed to upload profile image.');
        // Keep the previous photo URL on failure
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
    if (!/(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`])/.test(password)) {
      return 'Password must contain at least one special character';
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
      if (!auth || !user?.email) {
        throw new Error('Authentication not available');
      }

      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);
      
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

  const handleSaveBarangay = async () => {
    if (!auth || !user?.uid) return;
    setIsSaving(true);
    try {
      const { updateDoc } = require('firebase/firestore');
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        barangay: editBarangay,
        updatedAt: new Date()
      });
      setUserProfile(prev => prev ? { ...prev, barangay: editBarangay } : null);
      setShowBarangayModal(false);
      Alert.alert('Success', 'Barangay preference updated successfully');
    } catch (error) {
      console.error('Failed to update barangay:', error);
      Alert.alert('Error', 'Failed to update barangay preference');
    } finally {
      setIsSaving(false);
    }
  };

  // Feedback handling
  const handleSendFeedback = async () => {
    if (feedbackSelected === null || !feedbackText.trim()) {
      Alert.alert('Error', 'Please select a rating and enter your feedback.');
      return;
    }

    const ratingOptions = ['Terrible', 'Bad', 'Good', 'Loved it'];
    const rating = ratingOptions[feedbackSelected] || 'Average';

    try {
      await addDoc(collection(db, 'feedback'), {
        rating,
        title: `${rating} feedback`,
        description: feedbackText,
        message: feedbackText,
        userId: auth.currentUser?.uid || 'anonymous',
        userEmail: auth.currentUser?.email || 'anonymous',
        street: userProfile?.barangay || 'unknown',
        createdAt: new Date().toISOString(),
      });
      Alert.alert('Thank you!', 'Your feedback has been submitted successfully.');
      setFeedbackSelected(null);
      setFeedbackText('');
      setShowFeedbackModal(false);
    } catch (err) {
      console.error('Feedback error:', err);
      Alert.alert('Error', 'Failed to send feedback. Please try again.');
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: '#C8E6C9' }]}>
      {/* Settings Header */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 20) }]}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <IconSymbol name="arrow.left" size={24} color="#234033" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.scrollContent} contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 20) + 100 }}>
        <Modal
          visible={isEditMode}
          transparent
          animationType="slide"
          onRequestClose={handleCancelEdit}
        >
          <KeyboardAvoidingView
            style={styles.modalOverlay}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          >
            <View style={[styles.profileCard, { backgroundColor: colors.surface, marginHorizontal: 20, width: '90%', borderRadius: 16 }]}>
              <TouchableOpacity 
                style={styles.avatarContainer} 
                onPress={pickImage} 
                activeOpacity={0.7}
              >
                {editPhotoURL ? (
                  <Image source={{ uri: editPhotoURL }} style={styles.avatar} />
                ) : (
                  <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
                    <IconSymbol name="person.fill" size={40} color={colors.surface} />
                  </View>
                )}
                <Text style={styles.avatarEditText}>Tap to change photo</Text>
              </TouchableOpacity>
              
              <TextInput
                value={editName}
                onChangeText={setEditName}
                style={[styles.editNameInput, { color: colors.textPrimary, backgroundColor: colors.background }]}
                placeholder="Enter your name"
                placeholderTextColor={colors.textTertiary}
              />
              
              <Text style={[styles.userEmail, { color: colors.textSecondary }]}>
                {user?.email || 'No email'}
              </Text>

              <TouchableOpacity 
                style={[styles.saveButton, { backgroundColor: colors.primary, width: '100%' }]} 
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
              <TouchableOpacity 
                style={{ marginTop: 16, paddingVertical: 8 }} 
                onPress={handleCancelEdit}
              >
                <Text style={{ color: colors.textSecondary, textAlign: 'center', fontWeight: '600' }}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </Modal>

        {/* EnviroHero Badges */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitleSmall}>EnviroHero Badges</Text>
          <TouchableOpacity onPress={() => router.push('/rewards' as any)}>
            <Text style={styles.viewAllText}>VIEW ALL</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.badgesRow}>
          <View style={styles.badgeCardSmall}>
            <View style={[styles.badgeIconBg, { backgroundColor: '#FDE68A' }]}>
              <IconSymbol name="leaf.fill" size={24} color="#D97706" />
            </View>
            <Text style={styles.badgeTitle}>Verified Pickups</Text>
            <Text style={styles.badgeSubtitle}>{verifiedRewardCount} REWARDED</Text>
          </View>
          <View style={styles.badgeCardSmall}>
            <View style={[styles.badgeIconBg, { backgroundColor: '#C8E6C9' }]}>
              <IconSymbol name="arrow.triangle.2.circlepath" size={24} color="#2E7D32" />
            </View>
            <Text style={styles.badgeTitle}>Eco Tokens</Text>
            <Text style={styles.badgeSubtitle}>{availableRewardTokens.toLocaleString()} AVAILABLE</Text>
          </View>
        </View>

        <View style={styles.badgeCardLarge}>
          <View style={[styles.badgeIconBg, { backgroundColor: '#A5D6A7' }]}>
            <IconSymbol name="person.circle.fill" size={32} color="#1B5E20" />
          </View>
          <Text style={styles.badgeTitle}>{availableRewardTokens >= 500 ? 'Souvenir Eligible' : 'Next Souvenir'}</Text>
          <Text style={styles.badgeSubtitle}>{availableRewardTokens >= 500 ? 'OPEN REWARDS TO REVIEW OPTIONS' : `${500 - availableRewardTokens} TOKENS TO A CENRO TOTE`}</Text>
        </View>

        {/* Location & Service */}
        <Text style={[styles.sectionTitleSmall, { marginTop: 16, marginHorizontal: 20 }]}>Location & Service</Text>
        <View style={styles.settingsCard}>
          <TouchableOpacity 
            style={styles.settingsRow} 
            onPress={() => {
              setEditBarangay(userProfile?.barangay || '');
              setShowBarangayModal(true);
            }}
          >
            <View style={styles.settingsIconBg}>
              <IconSymbol name="mappin.circle.fill" size={20} color="#2E7D32" />
            </View>
            <View style={styles.settingsTextContainer}>
              <Text style={styles.settingsRowTitle}>Barangay Preference</Text>
              <Text style={styles.settingsRowSubtitle}>{userProfile?.barangay || "Tap to set barangay"}</Text>
            </View>
            <IconSymbol name="chevron.right" size={20} color="#9E9E9E" />
          </TouchableOpacity>
          <View style={styles.divider} />
          <TouchableOpacity style={styles.settingsRow} onPress={() => router.push('/(tabs)/schedule')}>
            <View style={styles.settingsIconBg}>
              <IconSymbol name="calendar" size={20} color="#2E7D32" />
            </View>
            <View style={styles.settingsTextContainer}>
              <Text style={styles.settingsRowTitle}>Area Schedule</Text>
              <Text style={styles.settingsRowSubtitle}>Open your published collection calendar</Text>
            </View>
            <IconSymbol name="chevron.right" size={20} color="#9E9E9E" />
          </TouchableOpacity>
        </View>

        {/* Profile Settings */}
        <Text style={[styles.sectionTitleSmall, { marginTop: 16, marginHorizontal: 20 }]}>Profile Settings</Text>
        <View style={styles.settingsCard}>
          <TouchableOpacity style={styles.settingsRow} onPress={handleEditProfile}>
            <View style={[styles.settingsIconBg, { backgroundColor: '#F5F5F5' }]}>
              <IconSymbol name="person.fill" size={20} color="#4A6741" />
            </View>
            <View style={styles.settingsTextContainer}>
              <Text style={styles.settingsRowTitle}>Edit Personal Info</Text>
            </View>
            <IconSymbol name="chevron.right" size={20} color="#9E9E9E" />
          </TouchableOpacity>
          <View style={styles.divider} />
          <TouchableOpacity style={styles.settingsRow} onPress={() => setShowNotificationsModal(true)}>
            <View style={[styles.settingsIconBg, { backgroundColor: '#F5F5F5' }]}>
              <IconSymbol name="bell" size={20} color="#4A6741" />
            </View>
            <View style={styles.settingsTextContainer}>
              <Text style={styles.settingsRowTitle}>Notification Preferences</Text>
            </View>
            <IconSymbol name="chevron.right" size={20} color="#9E9E9E" />
          </TouchableOpacity>
          <View style={styles.divider} />
          <TouchableOpacity style={styles.settingsRow} onPress={handleChangePassword}>
            <View style={[styles.settingsIconBg, { backgroundColor: '#F5F5F5' }]}>
              <IconSymbol name="shield.fill" size={20} color="#4A6741" />
            </View>
            <View style={styles.settingsTextContainer}>
              <Text style={styles.settingsRowTitle}>Security & Privacy</Text>
            </View>
            <IconSymbol name="chevron.right" size={20} color="#9E9E9E" />
          </TouchableOpacity>
          <View style={styles.divider} />
          <TouchableOpacity style={styles.settingsRow} onPress={() => setShowFeedbackModal(true)}>
            <View style={[styles.settingsIconBg, { backgroundColor: '#F5F5F5' }]}>
              <IconSymbol name="message.fill" size={20} color="#4A6741" />
            </View>
            <View style={styles.settingsTextContainer}>
              <Text style={styles.settingsRowTitle}>Send Feedback</Text>
            </View>
            <IconSymbol name="chevron.right" size={20} color="#9E9E9E" />
          </TouchableOpacity>
          <View style={styles.divider} />
          <TouchableOpacity style={styles.settingsRow} onPress={togglePreferences}>
            <View style={[styles.settingsIconBg, { backgroundColor: '#F5F5F5' }]}>
              <IconSymbol name="gear" size={20} color="#4A6741" />
            </View>
            <View style={styles.settingsTextContainer}>
              <Text style={styles.settingsRowTitle}>Theme Preferences</Text>
            </View>
            <IconSymbol name={preferencesExpanded ? "chevron.down" : "chevron.right"} size={20} color="#9E9E9E" />
          </TouchableOpacity>
          {preferencesExpanded && (
            <View style={{ paddingHorizontal: 20, paddingVertical: 12, backgroundColor: colors.background, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ color: colors.textPrimary, fontSize: 15, fontWeight: '500' }}>Dark Mode</Text>
              <TouchableOpacity 
                onPress={toggleTheme}
                style={{
                  width: 44,
                  height: 24,
                  borderRadius: 12,
                  backgroundColor: theme === 'dark' ? colors.primary : '#E5E5E5',
                  justifyContent: 'center',
                  paddingHorizontal: 2
                }}
              >
                <View style={{
                  width: 20,
                  height: 20,
                  borderRadius: 10,
                  backgroundColor: '#fff',
                  transform: [{ translateX: theme === 'dark' ? 20 : 0 }]
                }} />
              </TouchableOpacity>
            </View>
          )}
          <View style={styles.divider} />
          <TouchableOpacity style={styles.settingsRow} onPress={handleLogout}>
            <View style={[styles.settingsIconBg, { backgroundColor: '#FFEBEE' }]}>
              <IconSymbol name="door.left.hand.open" size={20} color="#D32F2F" />
            </View>
            <View style={styles.settingsTextContainer}>
              <Text style={[styles.settingsRowTitle, { color: '#D32F2F', fontWeight: 'bold' }]}>Sign Out</Text>
            </View>
            <IconSymbol name="chevron.right" size={20} color="#D32F2F" />
          </TouchableOpacity>
        </View>

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
                <TouchableOpacity 
                  style={[styles.modalButton, { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 }]} 
                  onPress={cancelLogout}
                  activeOpacity={0.7}
                  hitSlop={{ top: 5, bottom: 5, left: 5, right: 5 }}
                >
                  <Text style={[styles.modalButtonText, { color: colors.textPrimary }]}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={[styles.modalButtonConfirm, { backgroundColor: colors.error }]} 
                  onPress={confirmLogout} 
                  disabled={isLoggingOut}
                  activeOpacity={0.7}
                  hitSlop={{ top: 5, bottom: 5, left: 5, right: 5 }}
                >
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

        {/* Notifications Modal (Driver-style) */}
        <Modal
          visible={showNotificationsModal}
          transparent
          animationType="slide"
          onRequestClose={() => setShowNotificationsModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.passwordModalContainer, { backgroundColor: colors.surface }]}> 
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Notifications</Text>
              <Text style={[styles.modalMessage, { color: colors.textSecondary }]}>
                Control push notifications and pickup reminders.
              </Text>
              <View style={{ gap: 16 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.textPrimary, fontWeight: '600', fontSize: 16 }}>Enable Push Notifications</Text>
                    <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 2 }}>
                      Allow the app to send you notifications on this device.
                    </Text>
                  </View>
                  <Switch value={pushEnabled} onValueChange={setPushEnabled} />
                </View>

                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.textPrimary, fontWeight: '600', fontSize: 16 }}>Pickup Reminders</Text>
                    <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 2 }}>
                      Receive reminders 24h and 1h before your scheduled pickup.
                    </Text>
                  </View>
                  <Switch value={reminderEnabled} onValueChange={setReminderEnabled} />
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.textPrimary, fontWeight: '600', fontSize: 16 }}>Report Status Updates</Text>
                    <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 2 }}>Receive acknowledgement, dispatch, and resolution updates.</Text>
                  </View>
                  <Switch value={reportUpdatesEnabled} onValueChange={setReportUpdatesEnabled} disabled={!pushEnabled} />
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.textPrimary, fontWeight: '600', fontSize: 16 }}>Announcements</Text>
                    <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 2 }}>Receive new CENRO announcement alerts.</Text>
                  </View>
                  <Switch value={announcementNotificationsEnabled} onValueChange={setAnnouncementNotificationsEnabled} disabled={!pushEnabled} />
                </View>
                <View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.textPrimary, fontWeight: '600', fontSize: 16 }}>Truck Proximity Alerts</Text>
                      <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 2 }}>Notify me once when my assigned collection truck enters the selected radius.</Text>
                    </View>
                    <Switch value={proximityAlertsEnabled} onValueChange={setProximityAlertsEnabled} disabled={!pushEnabled} />
                  </View>
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                    {[250, 500, 1000].map(radius => (
                      <TouchableOpacity
                        key={radius}
                        onPress={() => setProximityRadiusMeters(radius)}
                        disabled={!pushEnabled || !proximityAlertsEnabled}
                        style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16, borderWidth: 1, borderColor: proximityRadiusMeters === radius ? colors.primary : colors.border, backgroundColor: proximityRadiusMeters === radius ? `${colors.primary}18` : colors.surface }}
                      >
                        <Text style={{ color: proximityRadiusMeters === radius ? colors.primary : colors.textSecondary, fontWeight: '700', fontSize: 12 }}>{radius} m</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </View>

              <View style={[styles.modalActions, { marginTop: 16 }]}>
                <TouchableOpacity 
                  style={[styles.modalButton, { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 }]} 
                  onPress={saveNotificationPreferences}
                >
                  <Text style={[styles.modalButtonText, { color: colors.textPrimary }]}>Save Preferences</Text>
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
          <KeyboardAvoidingView
            style={styles.modalOverlay}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          >
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
                <Text style={[styles.requirementText, { color: colors.textTertiary }]}>• One special character</Text>
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
          </KeyboardAvoidingView>
        </Modal>

        {/* Feedback Modal */}
        <Modal
          visible={showFeedbackModal}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowFeedbackModal(false)}
        >
          <KeyboardAvoidingView
            style={styles.modalOverlay}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          >
            <View style={[styles.feedbackModalContainer, { backgroundColor: colors.background }]}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: colors.text, marginBottom: 0 }]}>Send Feedback</Text>
                <TouchableOpacity onPress={() => setShowFeedbackModal(false)} style={styles.closeButton}>
                  <IconSymbol name="xmark" size={24} color={colors.icon} />
                </TouchableOpacity>
              </View>

              <Text style={[styles.feedbackQuestion, { color: colors.text }]}>How was your experience today?</Text>
              
              <View style={styles.feedbackRow}>
                {[
                  { id: 0, emoji: '😣', label: 'Terrible', color: '#EF5350' },
                  { id: 1, emoji: '😕', label: 'Bad', color: '#FFB300' },
                  { id: 2, emoji: '😊', label: 'Good', color: '#66BB6A' },
                  { id: 3, emoji: '😍', label: 'Loved it', color: '#4CAF50' },
                ].map((reaction) => (
                  <TouchableOpacity
                    key={reaction.id}
                    style={[
                      styles.feedbackReaction,
                      { borderColor: feedbackSelected === reaction.id ? reaction.color : '#E0E0E0' },
                      feedbackSelected === reaction.id && { backgroundColor: `${reaction.color}15` }
                    ]}
                    onPress={() => setFeedbackSelected(reaction.id)}
                  >
                    <Text style={{ fontSize: 24, marginBottom: 4 }}>{reaction.emoji}</Text>
                    <Text style={[styles.feedbackReactionLabel, { color: feedbackSelected === reaction.id ? reaction.color : '#757575' }]}>
                      {reaction.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TextInput
                style={[styles.feedbackInput, { color: colors.text, backgroundColor: colors.surface }]}
                placeholder="Tell us what you liked or how we can improve..."
                placeholderTextColor={colors.icon}
                multiline
                numberOfLines={4}
                value={feedbackText}
                onChangeText={setFeedbackText}
              />

              <View style={styles.modalActions}>
                <TouchableOpacity 
                  style={[styles.modalButton, { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 }]} 
                  onPress={() => {
                    setShowFeedbackModal(false);
                    setFeedbackSelected(null);
                    setFeedbackText('');
                  }}
                >
                  <Text style={[styles.modalButtonText, { color: colors.textPrimary }]}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={[styles.modalButtonConfirm, { backgroundColor: colors.primary }]} 
                  onPress={handleSendFeedback}
                >
                  <Text style={[styles.modalButtonText, { color: colors.surface }]}>Send Feedback</Text>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>

        {/* Barangay Modal */}
        <Modal
          visible={showBarangayModal}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowBarangayModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.passwordModalContainer, { backgroundColor: colors.background }]}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: colors.text, marginBottom: 0 }]}>Select Barangay</Text>
                <TouchableOpacity onPress={() => setShowBarangayModal(false)} style={styles.closeButton}>
                  <IconSymbol name="xmark" size={24} color={colors.icon} />
                </TouchableOpacity>
              </View>
              
              <View style={[styles.passwordInputContainer, { zIndex: 1000 }]}>
                <Text style={[styles.passwordLabel, { color: colors.text }]}>Barangay (Danao City)</Text>
                <View style={[styles.passwordInputWrapper, { borderColor: 'transparent', padding: 0, height: 50 }]}>
                  <DropDownPicker
                    open={barangayOpen}
                    value={editBarangay}
                    items={availableBarangays.map(b => ({ label: b, value: b }))}
                    setOpen={setBarangayOpen}
                    setValue={setEditBarangay}
                    placeholder="Select a barangay"
                    placeholderStyle={{ color: colors.icon }}
                    style={{
                      backgroundColor: colors.background,
                      borderWidth: 1,
                      borderColor: colors.border,
                      minHeight: 50,
                      borderRadius: 8,
                    }}
                    dropDownContainerStyle={{
                      backgroundColor: colors.background,
                      borderColor: colors.border,
                      borderRadius: 8,
                    }}
                    textStyle={{
                      fontSize: 15,
                      color: colors.text
                    }}
                    zIndex={1000}
                    listMode={Platform.OS === 'web' ? 'FLATLIST' : 'SCROLLVIEW'}
                    scrollViewProps={{
                      nestedScrollEnabled: true,
                    }}
                  />
                </View>
              </View>

              <TouchableOpacity 
                style={[styles.saveButton, { backgroundColor: colors.primary }]}
                onPress={handleSaveBarangay}
                disabled={isSaving}
              >
                {isSaving ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={[styles.saveButtonText, { color: colors.surface }]}>Save Preferences</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

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
  headerTitle: {
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingTop: 20,
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
  // Gamified Settings Styles
  backButton: {
    padding: 8,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: 20,
    marginTop: 16,
    marginBottom: 12,
  },
  sectionTitleSmall: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1B5E20',
  },
  viewAllText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  badgesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginHorizontal: 20,
    marginBottom: 12,
  },
  badgeCardSmall: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 4,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  badgeCardLarge: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginHorizontal: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  badgeIconBg: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  badgeTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#2E7D32',
    textAlign: 'center',
    marginBottom: 4,
  },
  badgeSubtitle: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#9E9E9E',
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  settingsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginHorizontal: 20,
    marginTop: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  settingsIconBg: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E8F5E9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  settingsTextContainer: {
    flex: 1,
  },
  settingsRowTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#424242',
  },
  settingsRowSubtitle: {
    fontSize: 14,
    color: '#757575',
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: '#EEEEEE',
    marginLeft: 72,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 8,
    gap: 8,
    marginTop: 20,
    marginBottom: 40,
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
    alignItems: 'center',
    zIndex: 9999,
  },
  modalContainer: {
    width: '80%',
    borderRadius: 12,
    padding: 20,
    zIndex: 10000,
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
  feedbackModalContainer: {
    width: '90%',
    maxWidth: 400,
    borderRadius: 12,
    padding: 20,
  },
  feedbackQuestion: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 10,
    marginBottom: 16,
  },
  feedbackRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
    paddingHorizontal: 10,
  },
  feedbackReaction: {
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderRadius: 12,
    borderWidth: 2,
    minWidth: 60,
    flex: 1,
    marginHorizontal: 2,
  },
  feedbackReactionEmoji: {
    fontSize: 24,
    marginBottom: 4,
  },
  feedbackReactionLabel: {
    fontSize: 10,
    fontWeight: '500',
    textAlign: 'center',
  },
  feedbackInput: {
    height: 100,
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
    textAlignVertical: 'top',
    fontSize: 14,
  },
});

