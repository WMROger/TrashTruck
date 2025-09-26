import { IconSymbol } from '@/components/ui/IconSymbol';
import { auth, db } from '@/config/firebase';
import { Colors } from '@/constants/Colors';
import { useTheme } from '@/hooks/useTheme';
import { driverImageService } from '@/services/driverImageService';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { signOut } from 'firebase/auth';
import { doc, getDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Dimensions,
  Image,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';

interface UserData {
  displayName: string;
  email: string;
  photoURL?: string;
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
  gender?: string;
  dateOfBirth?: string;
  role: string;
}

const { height: screenHeight } = Dimensions.get('window');

interface DriverProfilePageProps {
  onBack?: () => void;
}

export default function DriverProfilePage({ onBack }: DriverProfilePageProps) {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const colors = Colors[theme ?? 'light'];
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingProfile, setEditingProfile] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [showAboutModal, setShowAboutModal] = useState(false);
  
  // Draggable modal state
  const translateY = useRef(new Animated.Value(screenHeight)).current;
  const modalHeight = screenHeight * 0.9;
  
  // Edit form state
  const [editData, setEditData] = useState({
    firstName: '',
    lastName: '',
    phoneNumber: '',
    gender: '',
    dateOfBirth: '',
  });


  useEffect(() => {
    fetchUserData();
  }, []);

  // Modal animation functions
  const showModal = () => {
    setShowEditModal(true);
    Animated.spring(translateY, {
      toValue: 0,
      useNativeDriver: true,
      tension: 100,
      friction: 8,
    }).start();
  };

  const hideModal = () => {
    Animated.timing(translateY, {
      toValue: screenHeight,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      setShowEditModal(false);
    });
  };

  const handleModalPress = () => {
    hideModal();
  };

  const fetchUserData = async () => {
    try {
      const user = auth.currentUser;
      if (user && db) {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          const data = userDoc.data() as UserData;
          console.log('Fetched user data:', data);
          console.log('Photo URL from Firestore:', data.photoURL);
          setUserData(data);
          setEditData({
            firstName: data.firstName || '',
            lastName: data.lastName || '',
            phoneNumber: data.phoneNumber || '',
            gender: data.gender || '',
            dateOfBirth: data.dateOfBirth || '',
          });
          
        }
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleImagePicker = async () => {
    try {
      // Show action sheet for camera or gallery
      Alert.alert(
        'Select Photo',
        'Choose how you want to add a photo',
        [
          {
            text: 'Camera',
            onPress: () => openCamera(),
          },
          {
            text: 'Photo Library',
            onPress: () => openGallery(),
          },
          {
            text: 'Cancel',
            style: 'cancel',
          },
        ]
      );
    } catch (error) {
      console.error('Error showing image picker options:', error);
      showError('Failed to open image picker', 'Error', 'error');
    }
  };

  const openCamera = async () => {
    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled && result.assets[0]) {
        await processImage(result.assets[0]);
      }
    } catch (error) {
      console.error('Error opening camera:', error);
      showError('Failed to open camera', 'Error', 'error');
    }
  };

  const openGallery = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled && result.assets[0]) {
        await processImage(result.assets[0]);
      }
    } catch (error) {
      console.error('Error opening gallery:', error);
      showError('Failed to open photo library', 'Error', 'error');
    }
  };

  const processImage = async (asset: any) => {
    try {
      setUploadingImage(true);
      const imageUri = typeof asset.uri === 'string' ? asset.uri : String(asset.uri);
      
      // Upload to Cloudinary using driver image service
      const uploadResult = await driverImageService.uploadProfileImage(imageUri);

      if (uploadResult.success && uploadResult.url) {
        console.log('Upload successful, URL:', uploadResult.url);
        
        // Update user profile in Firestore
        const user = auth.currentUser;
        if (user && db) {
          await updateDoc(doc(db, 'users', user.uid), {
            photoURL: uploadResult.url,
            updatedAt: serverTimestamp(),
          });
          
          // Update local state
          setUserData(prev => prev ? { ...prev, photoURL: uploadResult.url } : null);
          console.log('Profile updated with URL:', uploadResult.url);
          Alert.alert('Success', 'Profile picture updated successfully!');
        }
      } else {
        Alert.alert('Upload Error', uploadResult.error || 'Failed to upload image. Please try again.');
      }
    } catch (error) {
      console.error('Error processing image:', error);
      Alert.alert('Error', 'Failed to process image. Please try again.');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleUpdateProfile = async () => {
    // Basic validation
    if (!editData.firstName.trim()) {
      Alert.alert('Validation Error', 'First name is required');
      return;
    }
    
    if (!editData.lastName.trim()) {
      Alert.alert('Validation Error', 'Last name is required');
      return;
    }
    
    if (editData.phoneNumber && editData.phoneNumber.length < 10) {
      Alert.alert('Validation Error', 'Please enter a valid 10-digit phone number');
      return;
    }
    
    try {
      setEditingProfile(true);
      const user = auth.currentUser;
      if (user && db) {
        await updateDoc(doc(db, 'users', user.uid), {
          firstName: editData.firstName.trim(),
          lastName: editData.lastName.trim(),
          phoneNumber: editData.phoneNumber.trim(),
          gender: editData.gender.trim(),
          dateOfBirth: editData.dateOfBirth.trim(),
          displayName: `${editData.firstName.trim()} ${editData.lastName.trim()}`,
          updatedAt: serverTimestamp(),
        });
        
        setUserData(prev => prev ? {
          ...prev,
          firstName: editData.firstName.trim(),
          lastName: editData.lastName.trim(),
          phoneNumber: editData.phoneNumber.trim(),
          gender: editData.gender.trim(),
          dateOfBirth: editData.dateOfBirth.trim(),
          displayName: `${editData.firstName.trim()} ${editData.lastName.trim()}`,
        } : null);
        
        Alert.alert('Success', 'Profile updated successfully!', [
          { text: 'OK', onPress: () => hideModal() }
        ]);
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      Alert.alert('Error', 'Failed to update profile. Please try again.');
    } finally {
      setEditingProfile(false);
    }
  };

  const showError = (message: string, title = 'Error', type: 'error' | 'warning' | 'info' | 'success' = 'error') => {
    Alert.alert(title, message);
  };

  // Date picker functions
  const handleDateChange = (dateString: string) => {
    setEditData(prev => ({ ...prev, dateOfBirth: dateString }));
  };

  const validateDate = (dateString: string) => {
    const dateRegex = /^(0[1-9]|1[0-2])\/(0[1-9]|[12][0-9]|3[01])\/\d{4}$/;
    return dateRegex.test(dateString);
  };

  const openDatePicker = () => {
    Alert.prompt(
      'Date of Birth',
      'Enter your date of birth (MM/DD/YYYY)',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'OK', 
          onPress: (text: string | undefined) => {
            if (text) {
              if (validateDate(text)) {
                const date = new Date(text);
                if (date <= new Date() && date >= new Date(1900, 0, 1)) {
                  handleDateChange(text);
                } else {
                  Alert.alert('Invalid Date', 'Please enter a valid date between 1900 and today.');
                }
              } else {
                Alert.alert('Invalid Format', 'Please enter the date in MM/DD/YYYY format.');
              }
            }
          }
        }
      ],
      'plain-text',
      editData.dateOfBirth
    );
  };

  // Generate optimized Cloudinary URL for profile images
  const getOptimizedImageUrl = (photoURL: string | undefined) => {
    if (!photoURL) {
      return 'https://via.placeholder.com/100x100/2E8B57/FFFFFF?text=Driver';
    }
    
    // For now, just return the original URL to ensure it works
    // TODO: Add optimization back once basic display is working
    console.log('Profile image URL:', photoURL);
    return photoURL;
  };

  const handleLogout = () => {
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
              await signOut(auth);
              router.replace('/auth' as any);
            } catch (error) {
              console.error('Error signing out:', error);
              Alert.alert('Error', 'Failed to logout. Please try again.');
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading profile...</Text>
        </View>
      </View>
    );
  }

  if (!userData) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.errorText}>Failed to load profile data</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Back Button Header */}
      <View style={[styles.backHeader, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={onBack || (() => router.back())}
        >
          <IconSymbol name="chevron.left" size={24} color={colors.primary} />
        </TouchableOpacity>
        <Text style={[styles.backHeaderTitle, { color: colors.textPrimary }]}>Profile</Text>
        <View style={{ width: 24 }} />
      </View>
      
      <ScrollView style={styles.scrollView}>
        {/* Profile Header */}
        <View style={[styles.profileHeader, { backgroundColor: colors.primary }]}>
          <View style={styles.avatarContainer}>
            <Image 
              source={{ 
                uri: getOptimizedImageUrl(userData.photoURL)
              }} 
              style={styles.avatar}
              onError={(error) => {
                console.log('Image load error:', error.nativeEvent.error);
                console.log('Failed URL:', getOptimizedImageUrl(userData.photoURL));
              }}
              onLoad={() => {
                console.log('Image loaded successfully');
              }}
              defaultSource={require('@/assets/images/icon.png')}
            />
            <TouchableOpacity 
              style={styles.editAvatarBtn}
              onPress={handleImagePicker}
              disabled={uploadingImage}
            >
              <IconSymbol 
                name={uploadingImage ? "clock.fill" : "camera.fill"} 
                size={16} 
                color="#FFFFFF" 
              />
            </TouchableOpacity>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{userData.displayName || 'Driver Name'}</Text>
            <Text style={styles.profileUsername}>@{userData.email?.split('@')[0] || 'driver'}</Text>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity 
              style={styles.editProfileBtn}
              onPress={showModal}
            >
              <IconSymbol name="pencil" size={20} color={colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.moreBtn}
              onPress={() => {
                // Add more options functionality here
                Alert.alert('More Options', 'More options coming soon!');
              }}
            >
              <IconSymbol name="ellipsis" size={20} color={colors.primary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Main Menu Section */}
        <View style={styles.menuSection}>
          <TouchableOpacity style={[styles.menuItem, { backgroundColor: colors.surface }]} onPress={showModal}>
            <View style={styles.menuItemLeft}>
              <View style={[styles.menuIcon, { backgroundColor: colors.secondary }]}>
                <IconSymbol name="person.circle.fill" size={20} color={colors.primary} />
              </View>
              <View style={styles.menuTextContainer}>
                <Text style={[styles.menuTitle, { color: colors.textPrimary }]}>Edit Profile</Text>
                <Text style={[styles.menuSubtitle, { color: colors.textSecondary }]}>Update your personal information</Text>
              </View>
            </View>
            <View style={styles.menuItemRight}>
              <IconSymbol name="chevron.right" size={16} color={colors.textTertiary} />
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.menuItem, { backgroundColor: colors.surface }]}>
            <View style={styles.menuItemLeft}>
              <View style={[styles.menuIcon, { backgroundColor: colors.secondary }]}>
                <IconSymbol name="lock.shield.fill" size={20} color={colors.primary} />
              </View>
              <View style={styles.menuTextContainer}>
                <Text style={[styles.menuTitle, { color: colors.textPrimary }]}>Privacy & Security</Text>
                <Text style={[styles.menuSubtitle, { color: colors.textSecondary }]}>Manage your account security</Text>
              </View>
            </View>
            <View style={styles.menuItemRight}>
              <IconSymbol name="chevron.right" size={16} color={colors.textTertiary} />
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.menuItem, { backgroundColor: colors.surface }]}>
            <View style={styles.menuItemLeft}>
              <View style={[styles.menuIcon, { backgroundColor: colors.secondary }]}>
                <IconSymbol name="bell.badge.fill" size={20} color={colors.primary} />
              </View>
              <View style={styles.menuTextContainer}>
                <Text style={[styles.menuTitle, { color: colors.textPrimary }]}>Notifications</Text>
                <Text style={[styles.menuSubtitle, { color: colors.textSecondary }]}>Customize your notifications</Text>
              </View>
            </View>
            <View style={styles.menuItemRight}>
              <IconSymbol name="chevron.right" size={16} color={colors.textTertiary} />
            </View>
          </TouchableOpacity>


          <TouchableOpacity style={[styles.menuItem, { backgroundColor: colors.surface }]}>
            <View style={styles.menuItemLeft}>
              <View style={[styles.menuIcon, { backgroundColor: colors.secondary }]}>
                <IconSymbol name="shield.fill" size={20} color={colors.primary} />
              </View>
              <View style={styles.menuTextContainer}>
                <Text style={[styles.menuTitle, { color: colors.textPrimary }]}>Two-Factor Authentication</Text>
                <Text style={[styles.menuSubtitle, { color: colors.textSecondary }]}>Further secure your account for safety</Text>
              </View>
            </View>
            <View style={styles.menuItemRight}>
              <IconSymbol name="chevron.right" size={16} color={colors.textTertiary} />
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.menuItem, { backgroundColor: colors.surface }]} onPress={handleLogout}>
            <View style={styles.menuItemLeft}>
              <View style={[styles.menuIcon, { backgroundColor: colors.secondary }]}>
                <IconSymbol name="door.left.hand.open" size={20} color={colors.error} />
              </View>
              <View style={styles.menuTextContainer}>
                <Text style={[styles.menuTitle, { color: colors.error }]}>Log out</Text>
                <Text style={[styles.menuSubtitle, { color: colors.textSecondary }]}>Sign out of your account</Text>
              </View>
            </View>
            <View style={styles.menuItemRight}>
              <IconSymbol name="chevron.right" size={16} color={colors.textTertiary} />
            </View>
          </TouchableOpacity>
        </View>

        {/* Help & Support Section */}
        <Text style={[styles.sectionTitle, styles.moreSectionTitle, { color: colors.textPrimary }]}>More</Text>
        <View style={[styles.menuSection, { backgroundColor: colors.surface }]}>
          <TouchableOpacity style={[styles.menuItem, { backgroundColor: colors.surface }]} onPress={() => setShowHelpModal(true)}>
            <View style={styles.menuItemLeft}>
              <View style={[styles.menuIcon, { backgroundColor: colors.secondary }]}>
                <IconSymbol name="questionmark.circle.fill" size={20} color={colors.primary} />
              </View>
              <View style={styles.menuTextContainer}>
                <Text style={[styles.menuTitle, { color: colors.textPrimary }]}>Help & Support</Text>
                <Text style={[styles.menuSubtitle, { color: colors.textSecondary }]}>Get help and support</Text>
              </View>
            </View>
            <View style={styles.menuItemRight}>
              <IconSymbol name="chevron.right" size={16} color={colors.textTertiary} />
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.menuItem, { backgroundColor: colors.surface }]} onPress={() => setShowAboutModal(true)}>
            <View style={styles.menuItemLeft}>
              <View style={[styles.menuIcon, { backgroundColor: colors.secondary }]}>
                <IconSymbol name="info.circle.fill" size={20} color={colors.primary} />
              </View>
              <View style={styles.menuTextContainer}>
                <Text style={[styles.menuTitle, { color: colors.textPrimary }]}>About App</Text>
                <Text style={[styles.menuSubtitle, { color: colors.textSecondary }]}>App information and version</Text>
              </View>
            </View>
            <View style={styles.menuItemRight}>
              <IconSymbol name="chevron.right" size={16} color={colors.textTertiary} />
            </View>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Draggable Edit Profile Modal */}
      <Modal
        visible={showEditModal}
        transparent={true}
        animationType="none"
        onRequestClose={hideModal}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity 
            style={styles.modalBackdrop} 
            activeOpacity={1} 
            onPress={handleModalPress}
          />
          <Animated.View 
            style={[
              styles.draggableModal,
              { 
                transform: [{ translateY: translateY }],
                height: modalHeight,
                backgroundColor: colors.surface
              }
            ]}
          >
            {/* Drag Handle */}
            <View style={styles.dragHandle}>
              <View style={[styles.dragHandleBar, { backgroundColor: colors.border }]} />
            </View>
            
            <View style={[styles.modalHeader, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
              <TouchableOpacity onPress={hideModal}>
                <IconSymbol name="xmark" size={24} color={colors.primary} />
              </TouchableOpacity>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Edit Profile</Text>
              <TouchableOpacity 
                onPress={handleUpdateProfile}
                disabled={editingProfile}
              >
                <Text style={[styles.saveButton, { color: colors.primary }, editingProfile && styles.saveButtonDisabled]}>
                  {editingProfile ? 'Saving...' : 'Save'}
                </Text>
              </TouchableOpacity>
            </View>

          <ScrollView style={styles.modalContent}>
            {/* Profile Picture */}
            <View style={styles.editProfilePicture}>
              <Image 
                source={{ 
                  uri: getOptimizedImageUrl(userData.photoURL)
                }} 
                style={[styles.editAvatar, { borderColor: colors.primary }]}
                onError={(error) => {
                  console.log('Modal image load error:', error.nativeEvent.error);
                  console.log('Failed URL:', getOptimizedImageUrl(userData.photoURL));
                }}
                onLoad={() => {
                  console.log('Modal image loaded successfully');
                }}
                defaultSource={require('@/assets/images/icon.png')}
              />
              <TouchableOpacity 
                style={[
                  styles.editAvatarBtn, 
                  { backgroundColor: colors.primary },
                  uploadingImage && { opacity: 0.6 }
                ]} 
                onPress={handleImagePicker}
                disabled={uploadingImage}
              >
                <IconSymbol 
                  name={uploadingImage ? "clock.fill" : "camera.fill"} 
                  size={16} 
                  color={colors.surface} 
                />
              </TouchableOpacity>
            </View>

            {uploadingImage && (
              <Text style={[styles.uploadingText, { color: colors.textSecondary }]}>
                Uploading image...
              </Text>
            )}

            {/* Debug info - remove in production */}
            {__DEV__ && userData?.photoURL && (
              <Text style={[styles.debugText, { color: colors.textTertiary }]}>
                URL: {userData.photoURL.substring(0, 50)}...
              </Text>
            )}

            <Text style={[styles.editProfileName, { color: colors.textPrimary }]}>{userData.displayName || 'Driver Name'}</Text>
            <Text style={[styles.editProfileEmail, { color: colors.textSecondary }]}>{userData.email}</Text>

            {/* Input Fields */}
            <View style={styles.inputContainer}>
              <Text style={[styles.inputLabel, { color: colors.textPrimary }]}>What's your first name?</Text>
              <TextInput
                style={[styles.textInput, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.textPrimary }]}
                value={editData.firstName}
                onChangeText={(text) => setEditData(prev => ({ ...prev, firstName: text }))}
                placeholder="First name"
                placeholderTextColor={colors.textTertiary}
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={[styles.inputLabel, { color: colors.textPrimary }]}>And your last name?</Text>
              <TextInput
                style={[styles.textInput, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.textPrimary }]}
                value={editData.lastName}
                onChangeText={(text) => setEditData(prev => ({ ...prev, lastName: text }))}
                placeholder="Last name"
                placeholderTextColor={colors.textTertiary}
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={[styles.inputLabel, { color: colors.textPrimary }]}>Phone number</Text>
              <View style={[styles.phoneInputContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={[styles.countryCodeContainer, { backgroundColor: colors.secondary, borderRightColor: colors.border }]}>
                  <Text style={[styles.countryCodeText, { color: colors.primary }]}>🇵🇭 +63</Text>
                </View>
                <TextInput
                  style={[styles.phoneInput, { color: colors.textPrimary }]}
                  value={editData.phoneNumber}
                  onChangeText={(text) => {
                    // Only allow 10 digits for Philippine phone numbers
                    const cleaned = text.replace(/\D/g, '').slice(0, 10);
                    setEditData(prev => ({ ...prev, phoneNumber: cleaned }));
                  }}
                  placeholder="9XXXXXXXXX"
                  placeholderTextColor={colors.textTertiary}
                  keyboardType="phone-pad"
                  maxLength={10}
                />
              </View>
            </View>

            <View style={styles.inputContainer}>
              <Text style={[styles.inputLabel, { color: colors.textPrimary }]}>Select your gender</Text>
              <TouchableOpacity 
                style={[styles.dropdownContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}
                onPress={() => {
                  Alert.alert(
                    'Select Gender',
                    'Choose your gender',
                    [
                      { text: 'Male', onPress: () => setEditData(prev => ({ ...prev, gender: 'Male' })) },
                      { text: 'Female', onPress: () => setEditData(prev => ({ ...prev, gender: 'Female' })) },
                      { text: 'Other', onPress: () => setEditData(prev => ({ ...prev, gender: 'Other' })) },
                      { text: 'Cancel', style: 'cancel' }
                    ]
                  );
                }}
              >
                <Text style={[styles.dropdownInput, { color: colors.textPrimary }, !editData.gender && { color: colors.textTertiary }]}>
                  {editData.gender || 'Select your gender'}
                </Text>
                <IconSymbol name="chevron.down" size={16} color={colors.textTertiary} />
              </TouchableOpacity>
            </View>

            <View style={styles.inputContainer}>
              <Text style={[styles.inputLabel, { color: colors.textPrimary }]}>What is your date of birth?</Text>
              <TouchableOpacity 
                style={[styles.dateInputContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}
                onPress={openDatePicker}
              >
                <Text style={[styles.dateInput, { color: colors.textPrimary }, !editData.dateOfBirth && { color: colors.textTertiary }]}>
                  {editData.dateOfBirth || 'Select your date of birth'}
                </Text>
                <IconSymbol name="calendar" size={16} color={colors.textTertiary} />
              </TouchableOpacity>
            </View>
          </ScrollView>
          </Animated.View>
        </View>
      </Modal>

      {/* Help & Support Modal */}
      <Modal
        transparent={true}
        visible={showHelpModal}
        animationType="slide"
        onRequestClose={() => setShowHelpModal(false)}
      >
        <View style={styles.centeredModalOverlay}>
          <View style={[styles.infoModalCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Help & Support</Text>
              <TouchableOpacity onPress={() => setShowHelpModal(false)} style={styles.closeButton}>
                <IconSymbol name="xmark" size={24} color={colors.textTertiary} />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.infoModalContent}>
              <View style={styles.infoSection}>
                <Text style={[styles.infoSectionTitle, { color: colors.textPrimary }]}>📞 Contact Support</Text>
                <Text style={[styles.infoText, { color: colors.textSecondary }]}>
                  Need immediate assistance? Contact our support team:
                </Text>
                <Text style={[styles.contactInfo, { color: colors.primary }]}>
                  📧 Email: support@trashtruck.com{'\n'}
                  📱 Phone: +1 (555) 123-4567{'\n'}
                  🕒 Hours: 24/7 Support Available
                </Text>
              </View>

              <View style={styles.infoSection}>
                <Text style={[styles.infoSectionTitle, { color: colors.textPrimary }]}>❓ Frequently Asked Questions</Text>
                
                <View style={styles.faqItem}>
                  <Text style={[styles.faqQuestion, { color: colors.textPrimary }]}>How do I complete a pickup?</Text>
                  <Text style={[styles.faqAnswer, { color: colors.textSecondary }]}>
                    1. Navigate to your assigned route{'\n'}
                    2. Take a photo of the completed pickup{'\n'}
                    3. Mark the pickup as completed in the app
                  </Text>
                </View>

                <View style={styles.faqItem}>
                  <Text style={[styles.faqQuestion, { color: colors.textPrimary }]}>What if I encounter an issue during pickup?</Text>
                  <Text style={[styles.faqAnswer, { color: colors.textSecondary }]}>
                    Contact dispatch immediately through the app or call the support number. Report any safety concerns or access issues.
                  </Text>
                </View>

                <View style={styles.faqItem}>
                  <Text style={[styles.faqQuestion, { color: colors.textPrimary }]}>How do I update my schedule?</Text>
                  <Text style={[styles.faqAnswer, { color: colors.textSecondary }]}>
                    Your schedule is managed by dispatch. For schedule changes, contact your supervisor or use the support contact above.
                  </Text>
                </View>
              </View>

              <View style={styles.infoSection}>
                <Text style={[styles.infoSectionTitle, { color: colors.textPrimary }]}>🚛 Driver Guidelines</Text>
                <Text style={[styles.infoText, { color: colors.textSecondary }]}>
                  • Always prioritize safety{'\n'}
                  • Follow designated routes{'\n'}
                  • Complete pickups during assigned time windows{'\n'}
                  • Report any vehicle issues immediately{'\n'}
                  • Maintain professional conduct with residents
                </Text>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* About App Modal */}
      <Modal
        transparent={true}
        visible={showAboutModal}
        animationType="slide"
        onRequestClose={() => setShowAboutModal(false)}
      >
        <View style={styles.centeredModalOverlay}>
          <View style={[styles.infoModalCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>About TrashTruck</Text>
              <TouchableOpacity onPress={() => setShowAboutModal(false)} style={styles.closeButton}>
                <IconSymbol name="xmark" size={24} color={colors.textTertiary} />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.infoModalContent}>
              <View style={styles.aboutHeader}>
                <View style={[styles.appIconContainer, { backgroundColor: colors.secondary }]}>
                  <IconSymbol name="truck.box.fill" size={40} color={colors.primary} />
                </View>
                <Text style={[styles.appName, { color: colors.textPrimary }]}>TrashTruck Driver</Text>
                <Text style={[styles.appVersion, { color: colors.textSecondary }]}>Version 1.0.0</Text>
              </View>

              <View style={styles.infoSection}>
                <Text style={[styles.infoSectionTitle, { color: colors.textPrimary }]}>🎯 Mission</Text>
                <Text style={[styles.infoText, { color: colors.textSecondary }]}>
                  TrashTruck is dedicated to revolutionizing waste management through smart technology, 
                  connecting drivers, dispatchers, and communities for efficient and reliable service.
                </Text>
              </View>

              <View style={styles.infoSection}>
                <Text style={[styles.infoSectionTitle, { color: colors.textPrimary }]}>✨ Features</Text>
                <Text style={[styles.infoText, { color: colors.textSecondary }]}>
                  • Real-time route management{'\n'}
                  • Digital pickup confirmation{'\n'}
                  • Schedule tracking{'\n'}
                  • Performance analytics{'\n'}
                  • Direct communication with dispatch{'\n'}
                  • Safety and compliance tools
                </Text>
              </View>

              <View style={styles.infoSection}>
                <Text style={[styles.infoSectionTitle, { color: colors.textPrimary }]}>👥 Development Team</Text>
                <Text style={[styles.infoText, { color: colors.textSecondary }]}>
                  Built with ❤️ by the TrashTruck development team{'\n'}
                  Committed to sustainable waste management solutions
                </Text>
              </View>

              <View style={styles.infoSection}>
                <Text style={[styles.infoSectionTitle, { color: colors.textPrimary }]}>📄 Legal</Text>
                <Text style={[styles.infoText, { color: colors.textSecondary }]}>
                  © 2024 TrashTruck Inc. All rights reserved.{'\n'}
                  Terms of Service • Privacy Policy
                </Text>
              </View>

              <View style={styles.infoSection}>
                <Text style={[styles.infoSectionTitle, { color: colors.textPrimary }]}>🔧 Technical Info</Text>
                <Text style={[styles.technicalInfo, { color: colors.textTertiary }]}>
                  React Native • Expo • Firebase{'\n'}
                  Build: 1.0.0 (100){'\n'}
                  Platform: {Platform.OS === 'ios' ? 'iOS' : Platform.OS === 'android' ? 'Android' : 'Web'}
                </Text>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#E8F5E8',
  },
  backHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  backButton: {
    padding: 8,
  },
  backHeaderTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2F3A31',
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#2E8B57',
  },
  errorText: {
    fontSize: 16,
    color: '#FF4444',
  },
  // Profile Header
  profileHeader: {
    backgroundColor: '#2E8B57',
    paddingHorizontal: 20,
    paddingVertical: 30,
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarContainer: {
    position: 'relative',
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  editAvatarBtn: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#2E8B57',
    borderRadius: 12,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  profileInfo: {
    flex: 1,
    marginLeft: 16,
  },
  profileName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  profileUsername: {
    fontSize: 14,
    color: '#B8E6B8',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  editProfileBtn: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moreBtn: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Menu Section
  menuSection: {
    backgroundColor: '#FFFFFF',
    marginTop: 20,
    marginHorizontal: 20,
    borderRadius: 12,
    paddingVertical: 8,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  menuIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E8F5E8',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  menuTextContainer: {
    flex: 1,
  },
  menuTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2F3A31',
    marginBottom: 2,
  },
  menuSubtitle: {
    fontSize: 12,
    color: '#6B8B6B',
  },
  menuItemRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  alertIcon: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FFE6E6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // More Section
  moreSection: {
    backgroundColor: '#FFFFFF',
    marginTop: 20,
    marginHorizontal: 20,
    borderRadius: 12,
    paddingVertical: 8,
    marginBottom: 20,
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    flex: 1,
  },
  draggableModal: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 10,
  },
  dragHandle: {
    alignItems: 'center',
    paddingVertical: 12,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  dragHandleBar: {
    width: 40,
    height: 4,
    backgroundColor: '#E0E0E0',
    borderRadius: 2,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#E8F5E8',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2F3A31',
  },
  saveButton: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2E8B57',
  },
  saveButtonDisabled: {
    color: '#999999',
  },
  modalContent: {
    flex: 1,
    paddingHorizontal: 20,
  },
  editProfilePicture: {
    alignItems: 'center',
    marginVertical: 30,
    position: 'relative',
  },
  editAvatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: '#2E8B57', // This will be overridden by dynamic styling
  },
  editProfileName: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 4,
  },
  editProfileEmail: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 30,
  },
  inputContainer: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  textInput: {
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    borderWidth: 1,
  },
  phoneInputContainer: {
    flexDirection: 'row',
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  countryCodeContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRightWidth: 1,
  },
  countryCodeText: {
    fontSize: 16,
    fontWeight: '600',
  },
  phoneInput: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
  },
  dropdownContainer: {
    flexDirection: 'row',
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  dropdownInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
  },
  dateInputContainer: {
    flexDirection: 'row',
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  dateInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
  },
  modalFooter: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  updateButton: {
    backgroundColor: '#2E8B57',
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: 'center',
  },
  updateButtonDisabled: {
    backgroundColor: '#6B8B6B',
  },
  updateButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  uploadingText: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
    fontStyle: 'italic',
  },
  debugText: {
    fontSize: 10,
    textAlign: 'center',
    marginTop: 4,
    fontFamily: 'monospace',
  },
  // Info Modal Styles
  centeredModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  infoModalCard: {
    borderRadius: 16,
    borderWidth: 1,
    width: '90%',
    maxWidth: 400,
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  infoModalContent: {
    maxHeight: 400,
    minHeight: 200,
  },
  infoSection: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  infoSectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 16,
    letterSpacing: 0.5,
  },
  infoText: {
    fontSize: 15,
    lineHeight: 24,
    marginBottom: 12,
    opacity: 0.8,
  },
  contactInfo: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '600',
    marginTop: 12,
    padding: 16,
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
  },
  faqItem: {
    marginBottom: 20,
    padding: 16,
    backgroundColor: 'rgba(0,0,0,0.02)',
    borderRadius: 12,
  },
  faqQuestion: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
    letterSpacing: 0.3,
  },
  faqAnswer: {
    fontSize: 14,
    lineHeight: 22,
    opacity: 0.8,
  },
  aboutHeader: {
    alignItems: 'center',
    padding: 20,
    backgroundColor: 'rgba(76, 175, 80, 0.05)',
  },
  appIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  appName: {
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  appVersion: {
    fontSize: 16,
    fontWeight: '500',
    opacity: 0.7,
    backgroundColor: 'rgba(76, 175, 80, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
  },
  technicalInfo: {
    fontSize: 13,
    lineHeight: 20,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    backgroundColor: 'rgba(0,0,0,0.05)',
    padding: 12,
    borderRadius: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
    paddingHorizontal: 16,
  },
  moreSectionTitle: {
    marginTop: 8,
    paddingHorizontal: 28,
    top: 20,
  },
});
