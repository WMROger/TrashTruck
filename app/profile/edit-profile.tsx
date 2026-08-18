import { useAuthContext } from '@/components/AuthContext';
import { db } from '@/config/firebase';
import { Colors } from '@/constants/Colors';
import { useTheme } from '@/hooks/useTheme';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import { Stack, useRouter } from 'expo-router';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';

export default function EditProfileScreen() {
  const { theme } = useTheme();
  const colors = Colors[theme ?? 'light'];
  const { user } = useAuthContext();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [gender, setGender] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [email, setEmail] = useState('');
  const [photoURL, setPhotoURL] = useState<string | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());

  useEffect(() => {
    const fetchUserProfile = async () => {
      if (!user || !db) {
        setLoading(false);
        return;
      }

      try {
        const userRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {
          const userData = userSnap.data();
          const displayName = userData.displayName || user.displayName || '';
          const nameParts = displayName.split(' ');
          
          setFirstName(nameParts[0] || '');
          setLastName(nameParts.slice(1).join(' ') || '');
          setPhoneNumber(userData.phoneNumber || '');
          setGender(userData.gender || '');
          setDateOfBirth(userData.dateOfBirth || '');
          if (userData.dateOfBirth) {
            const dateParts = userData.dateOfBirth.split('/');
            if (dateParts.length === 3) {
              setSelectedDate(new Date(dateParts[2], dateParts[0] - 1, dateParts[1]));
            }
          }
          setEmail(userData.email || user.email || '');
          setPhotoURL(userData.photoURL || user.photoURL || null);
        } else {
          const displayName = user.displayName || '';
          const nameParts = displayName.split(' ');
          
          setFirstName(nameParts[0] || '');
          setLastName(nameParts.slice(1).join(' ') || '');
          setEmail(user.email || '');
          setPhotoURL(user.photoURL || null);
        }
      } catch (error) {
        console.error('Error fetching user profile:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchUserProfile();
  }, [user]);

  const handleUpdateProfile = async () => {
    if (!user || !db) return;

    if (!firstName.trim() || !lastName.trim()) {
      Alert.alert('Error', 'Please enter both first and last name');
      return;
    }

    setSaving(true);
    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        displayName: `${firstName.trim()} ${lastName.trim()}`,
        phoneNumber: phoneNumber.trim(),
        gender: gender.trim(),
        dateOfBirth: dateOfBirth.trim(),
        photoURL: photoURL || '',
        updatedAt: new Date(),
      });

      Alert.alert('Success', 'Profile updated successfully!', [
        { text: 'OK', onPress: () => router.back() }
      ]);
    } catch (error) {
      console.error('Error updating profile:', error);
      Alert.alert('Error', 'Failed to update profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handlePickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'Gallery permission is required to select photos.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
    });

    if (!result.canceled && result.assets[0]) {
      setPhotoURL(result.assets[0].uri);
    }
  };

  const handleDateChange = (event: any, date?: Date) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
    }
    
    if (date) {
      setSelectedDate(date);
      const formattedDate = `${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}/${date.getFullYear()}`;
      setDateOfBirth(formattedDate);
    }
  };

  const handleShowDatePicker = () => {
    if (Platform.OS === 'android') {
      setShowDatePicker(true);
    } else {
      // For iOS, toggle the inline picker
      setShowDatePicker(!showDatePicker);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Header */}
        <View style={[styles.header, { backgroundColor: colors.background }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Profile</Text>
          <View style={{ width: 24 }} />
        </View>

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
          style={{ flex: 1 }}
        >
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={{ paddingBottom: 60 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Profile Photo */}
            <View style={styles.photoSection}>
              <TouchableOpacity onPress={handlePickImage} style={styles.photoContainer}>
                {photoURL ? (
                  <Image source={{ uri: photoURL }} style={styles.profilePhoto} />
                ) : (
                  <View style={[styles.photoPlaceholder, { backgroundColor: colors.primary }]}>
                    <Ionicons name="person" size={50} color={colors.surface} />
                  </View>
                )}
              </TouchableOpacity>
              <Text style={[styles.userName, { color: colors.textPrimary }]}>
                {firstName} {lastName}
              </Text>
              <Text style={[styles.userEmail, { color: colors.textSecondary }]}>
                {email}
              </Text>
            </View>

            {/* Form Fields */}
            <View style={styles.formSection}>
              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>
                  What’s your first name?
                </Text>
                <TextInput
                  value={firstName}
                  onChangeText={setFirstName}
                  style={[styles.input, { backgroundColor: colors.surface, color: colors.textPrimary }]}
                  placeholder="First name"
                  placeholderTextColor={colors.textTertiary}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>
                  And your last name?
                </Text>
                <TextInput
                  value={lastName}
                  onChangeText={setLastName}
                  style={[styles.input, { backgroundColor: colors.surface, color: colors.textPrimary }]}
                  placeholder="Last name"
                  placeholderTextColor={colors.textTertiary}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>
                  Phone number
                </Text>
                <View style={styles.phoneContainer}>
                  <View style={[styles.countryCode, { backgroundColor: colors.surface }]}>
                    <Text style={{ fontSize: 24 }}>🇵🇭</Text>
                  </View>
                  <TextInput
                    value={phoneNumber}
                    onChangeText={setPhoneNumber}
                    style={[styles.phoneInput, { backgroundColor: colors.surface, color: colors.textPrimary }]}
                    placeholder="Phone number"
                    placeholderTextColor={colors.textTertiary}
                    keyboardType="phone-pad"
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>
                  Select your gender
                </Text>
                <TouchableOpacity 
                  style={[styles.input, styles.dropdown, { backgroundColor: colors.surface }]}
                  onPress={() => {
                    Alert.alert(
                      'Select Gender',
                      '',
                      [
                        { text: 'Male', onPress: () => setGender('Male') },
                        { text: 'Female', onPress: () => setGender('Female') },
                        { text: 'Prefer not to say', onPress: () => setGender('Prefer not to say') },
                        { text: 'Cancel', style: 'cancel' }
                      ]
                    );
                  }}
                >
                  <Text style={[styles.dropdownText, { color: gender ? colors.textPrimary : colors.textTertiary }]}>
                    {gender || 'Select gender'}
                  </Text>
                  <Ionicons name="chevron-down" size={20} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>
                  Select your date of birth
                </Text>
                <TouchableOpacity 
                  style={[styles.input, styles.dropdown, { backgroundColor: colors.surface }]}
                  onPress={() => setShowDatePicker(true)}
                >
                  <Text style={[styles.dropdownText, { color: dateOfBirth ? colors.textPrimary : colors.textTertiary }]}>
                    {dateOfBirth || 'MM/DD/YYYY'}
                  </Text>
                  <Ionicons name="calendar-outline" size={20} color={colors.textSecondary} />
                </TouchableOpacity>
                {showDatePicker && (
                  <DateTimePicker
                    value={selectedDate}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={handleDateChange}
                    maximumDate={new Date()}
                    minimumDate={new Date(1900, 0, 1)}
                  />
                )}
              </View>
            </View>

            {/* Update Button */}
            <View style={styles.buttonContainer}>
              <TouchableOpacity
                style={[styles.updateButton, { backgroundColor: colors.primary }]}
                onPress={handleUpdateProfile}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator size="small" color={colors.surface} />
                ) : (
                  <Text style={[styles.updateButtonText, { color: colors.surface }]}>
                    Update Profile
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: Platform.OS === 'android' ? 40 : 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  photoSection: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  photoContainer: {
    marginBottom: 16,
  },
  profilePhoto: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  photoPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  userName: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
  },
  formSection: {
    paddingHorizontal: 24,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    marginBottom: 8,
  },
  input: {
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  phoneContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  countryCode: {
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  phoneInput: {
    flex: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  dropdown: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dropdownText: {
    fontSize: 16,
  },
  buttonContainer: {
    paddingHorizontal: 24,
    paddingVertical: 24,
  },
  updateButton: {
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  updateButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});

