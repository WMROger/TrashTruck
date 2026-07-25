import { auth, db } from '@/config/firebase';
import { signInWithFacebook, signInWithGoogle } from '@/config/socialAuth';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { createUserWithEmailAndPassword, sendEmailVerification, signOut } from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import DropDownPicker from 'react-native-dropdown-picker';
import ErrorModal from './ErrorModal';

export default function SignupScreen() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [selectedBarangay, setSelectedBarangay] = useState('');
  const [barangayOpen, setBarangayOpen] = useState(false);
  const [availableBarangays, setAvailableBarangays] = useState<string[]>([]);
  
  React.useEffect(() => {
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
        const sorted = Array.from(barangayNames).sort();
        setAvailableBarangays(sorted);
        if (sorted.length > 0) {
          setSelectedBarangay(sorted[0]);
        }
      } catch (err) {
        console.error('Error fetching available barangays:', err);
      }
    };
    fetchBarangays();
  }, []);
  const [consent, setConsent] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<{[key: string]: string}>({});
  const [errorModal, setErrorModal] = useState({
    visible: false,
    title: 'Error',
    message: '',
    type: 'error' as 'error' | 'warning' | 'info' | 'success',
  });

  // Email validation
  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  // Clear specific error
  const clearError = (field: string) => {
    setErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[field];
      return newErrors;
    });
  };

  // Show error modal
  const showError = (message: string, title = 'Error', type: 'error' | 'warning' | 'info' | 'success' = 'error') => {
    setErrorModal({
      visible: true,
      title,
      message,
      type,
    });
  };

  // Close error modal
  const closeErrorModal = () => {
    setErrorModal(prev => ({ ...prev, visible: false }));
  };

  // Password strength validation
  const validatePasswordStrength = (password: string) => {
    const requirements = {
      length: password.length >= 8,
      lowercase: /[a-z]/.test(password),
      uppercase: /[A-Z]/.test(password),
      special: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password),
    };
    
    const isValid = Object.values(requirements).every(req => req);
    const strength = Object.values(requirements).filter(req => req).length;
    
    return { requirements, isValid, strength };
  };

  const getPasswordStrengthText = (strength: number) => {
    switch (strength) {
      case 0:
      case 1:
        return { text: 'WEAK', color: '#EF4444' };
      case 2:
        return { text: 'WEAK', color: '#F97316' };
      case 3:
        return { text: 'GOOD', color: '#EAB308' };
      case 4:
        return { text: 'STRONG', color: '#22C55E' };
      default:
        return { text: 'WEAK', color: '#EF4444' };
    }
  };

  const upsertUserProfile = async (provider: string, displayNameParam?: string) => {
    try {
      if (!auth || !db) return;
      const currentUser = auth.currentUser;
      if (!currentUser) return;
      // Ensure fresh auth token is available to Firestore right after signup
      try {
        await currentUser.getIdToken(true);
      } catch {}
      const rawEmail = (currentUser.email || email || '').trim().toLowerCase();
      const userId = currentUser.uid; // Firestore rules expect userId to equal auth.uid
      const userRef = doc(db, 'users', userId);
      const snap = await getDoc(userRef);
      const finalDisplayName = displayNameParam || currentUser.displayName || name || '';

      const writeOnce = async () => {
        if (!snap.exists()) {
          await setDoc(userRef, {
            uid: currentUser.uid,
            email: rawEmail || '',
            displayName: finalDisplayName,
            photoURL: currentUser.photoURL || '',
            verified: currentUser.emailVerified === true,
            role: 'user',
            provider,
            barangay: selectedBarangay,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        } else {
          // Ensure we don't overwrite an existing role; just update metadata
          await setDoc(
            userRef,
            {
              email: rawEmail || '',
              displayName: finalDisplayName,
              photoURL: currentUser.photoURL || '',
              verified: currentUser.emailVerified === true,
              provider,
              barangay: selectedBarangay,
              updatedAt: serverTimestamp(),
            },
            { merge: true }
          );
        }
      };

      try {
        await writeOnce();
      } catch (err: any) {
        // If immediately after signup, token propagation may lag. Retry once.
        if (err?.code === 'permission-denied' || /Missing or insufficient permissions/.test(String(err?.message))) {
          try {
            await currentUser.getIdToken(true);
          } catch {}
          await new Promise(r => setTimeout(r, 300));
          await writeOnce();
        } else {
          throw err;
        }
      }
    } catch (e) {
      console.error('Failed to upsert user profile:', e);
    }
  };

  const handleSignUp = async () => {
    // Clear previous errors
    setErrors({});

    // Validate name
    if (!name.trim()) {
      showError('Please enter your full name');
      return;
    }

    // Validate email
    if (!email) {
      showError('Please enter your email address');
      return;
    }
    if (!validateEmail(email)) {
      showError('Please enter a valid email address');
      return;
    }

    // Validate password
    if (!password) {
      showError('Please enter a password');
      return;
    }

    const passwordValidation = validatePasswordStrength(password);
    if (!passwordValidation.isValid) {
      showError('Password must contain at least 8 characters, 1 uppercase letter, 1 lowercase letter, and 1 special character');
      return;
    }

    if (!consent) {
      showError('You must provide informed consent to register.');
      return;
    }

    setIsLoading(true);
    try {
      // Use Firebase authentication
      if (auth) {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        console.log('User created successfully:', user.email);
        
        // Update user profile with name
        const { updateProfile } = require('firebase/auth');
        await updateProfile(user, { displayName: name });

        await upsertUserProfile('password', name);
        
        // Send email verification and redirect to login
        try {
          await sendEmailVerification(user);
          Alert.alert(
            'Verify your email',
            'We\'ve sent a verification link to your email. Please verify your email before logging in.'
          );
        } catch (verifyError: any) {
          console.error('Email verification error:', verifyError);
          Alert.alert('Verification Email Error', 'We could not send a verification email. You can request it again from the login screen.');
        }
        
        // Sign out and redirect to login
        try {
          await signOut(auth);
        } catch {}
        router.replace('/(auth)/login' as any);
      } else {
        // Fallback to mock signup if Firebase is not available
        await new Promise(resolve => setTimeout(resolve, 1000));
        console.log('Mock signup - Firebase not available');
        router.replace('/(auth)/login' as any);
      }
    } catch (error: any) {
      console.log('Signup failed:', error.code);
      let errorMessage = 'Sign up failed. Please try again.';
      
      if (error.code === 'auth/email-already-in-use') {
        errorMessage = 'An account with this email already exists.';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'Invalid email address.';
      } else if (error.code === 'auth/weak-password') {
        errorMessage = 'Password is too weak. Please choose a stronger password.';
      } else if (error.code === 'auth/network-request-failed') {
        errorMessage = 'Network error. Please check your internet connection.';
      } else if (error.code === 'auth/too-many-requests') {
        errorMessage = 'Too many attempts. Please try again later.';
      }
      
      showError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignUp = async () => {
    try {
      setIsLoading(true);
      const result = await signInWithGoogle();
      
      if (result.success) {
        await upsertUserProfile('google');
        console.log('Google signup successful');
        router.replace('/(tabs)' as any);
      } else {
        Alert.alert('Google Sign Up Error', result.error || 'Failed to sign up with Google. Please try again.');
      }
    } catch (error: any) {
      console.log('Google signup failed:', error.code);
      Alert.alert('Google Sign Up Error', 'Failed to sign up with Google. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFacebookSignUp = async () => {
    try {
      setIsLoading(true);
      const result = await signInWithFacebook();
      
      if (result.success) {
        await upsertUserProfile('facebook');
        console.log('Facebook signup successful');
        router.replace('/(tabs)' as any);
      } else {
        Alert.alert('Facebook Sign Up Error', result.error || 'Failed to sign up with Facebook. Please try again.');
      }
    } catch (error: any) {
      console.log('Facebook signup failed:', error.code);
      Alert.alert('Facebook Sign Up Error', 'Failed to sign up with Facebook. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = () => {
    router.push('/(auth)/login');
  };

  const handleBack = () => {
    router.back();
  };

  return (
    <LinearGradient
      colors={['#C1E1C1', '#F5F5F5']}
      style={styles.container}
    >
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={handleBack}>
            <Ionicons name="arrow-back-circle-outline" size={32} color="#6B705C" />
          </TouchableOpacity>
        </View>

        {/* Content Card Overlay */}
        <View style={styles.contentCard}>
          <Ionicons name="leaf" size={100} color="#F2F8F2" style={styles.leafWatermark} />
          
          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>
            Join our mission to keep the neighborhood clean and earn rewards for sustainable waste disposal.
          </Text>

          <View style={styles.formContainer}>
            {/* Full Name */}
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Full Name</Text>
              <View style={[styles.inputWrapper, name.length > 0 && name.trim() === '' && styles.inputError]}>
                <Ionicons name="person-outline" size={20} color="#999" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="John Doe"
                  placeholderTextColor="#999"
                  value={name}
                  onChangeText={setName}
                  autoCapitalize="words"
                />
              </View>
            </View>

            {/* Barangay */}
            <View style={[styles.inputContainer, { zIndex: 1000 }]}>
              <Text style={styles.inputLabel}>Barangay (Danao City)</Text>
              <View style={[styles.inputWrapper, { padding: 0, borderWidth: 0 }]}>
                <DropDownPicker
                  open={barangayOpen}
                  value={selectedBarangay}
                  items={availableBarangays.map(b => ({ label: b, value: b }))}
                  setOpen={setBarangayOpen}
                  setValue={setSelectedBarangay}
                  placeholder="Select a barangay"
                  placeholderStyle={{ color: '#999' }}
                  style={{
                    backgroundColor: '#F9FAFB',
                    borderWidth: 1,
                    borderColor: '#E5E7EB',
                    minHeight: 50,
                    borderRadius: 12,
                    paddingLeft: 44,
                  }}
                  dropDownContainerStyle={{
                    backgroundColor: '#F9FAFB',
                    borderColor: '#E5E7EB',
                    borderRadius: 12,
                  }}
                  textStyle={{
                    fontSize: 15,
                    color: '#333'
                  }}
                  zIndex={1000}
                  listMode={Platform.OS === 'web' ? 'FLATLIST' : 'SCROLLVIEW'}
                  scrollViewProps={{
                    nestedScrollEnabled: true,
                  }}
                />
                <View style={{ position: 'absolute', left: 16, top: 15, zIndex: 1001 }}>
                  <Ionicons name="location-outline" size={20} color="#999" />
                </View>
              </View>
            </View>

            {/* Email Address */}
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Email Address</Text>
              <View style={[styles.inputWrapper, email.length > 0 && !validateEmail(email) && styles.inputError]}>
                <Ionicons name="mail-outline" size={20} color="#999" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="john@example.com"
                  placeholderTextColor="#999"
                  value={email}
                  onChangeText={(text) => {
                    setEmail(text);
                    if (text.length > 0 && !validateEmail(text)) {
                      setErrors(prev => ({ ...prev, email: 'Invalid email format' }));
                    } else {
                      clearError('email');
                    }
                  }}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>
              {errors.email && (
                <View style={styles.errorContainer}>
                  <Ionicons name="alert-circle" size={16} color="#EF4444" />
                  <Text style={styles.errorText}>{errors.email}</Text>
                </View>
              )}
            </View>

            {/* Secure Password */}
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Secure Password</Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="lock-closed-outline" size={20} color="#999" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="••••••••"
                  placeholderTextColor="#999"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeButton}>
                  <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={20} color="#999" />
                </TouchableOpacity>
              </View>
            </View>

            {/* Password Strength */}
            {password.length > 0 && (
              <View style={styles.passwordStrengthRow}>
                <View style={styles.passwordStrengthBar}>
                  <View
                    style={[
                      styles.passwordStrengthFill,
                      {
                        width: `${(validatePasswordStrength(password).strength / 4) * 100}%`,
                        backgroundColor: getPasswordStrengthText(validatePasswordStrength(password).strength).color,
                      },
                    ]}
                  />
                </View>
                <Text style={[styles.passwordStrengthText, { color: '#666' }]}>
                  {getPasswordStrengthText(validatePasswordStrength(password).strength).text}
                </Text>
              </View>
            )}

            {/* Consent Checkbox */}
            <TouchableOpacity style={styles.consentContainer} onPress={() => setConsent(!consent)} activeOpacity={0.8}>
              <View style={[styles.checkbox, consent && styles.checkboxChecked]}>
                {consent && <Ionicons name="checkmark" size={14} color="white" />}
              </View>
              <Text style={styles.consentText}>
                I provide my <Text style={styles.linkText}>Informed Consent</Text> for TrashTrack to process my personal data to facilitate waste collection services. I have read and agree to the <Text style={styles.linkText}>Data Privacy Terms</Text>.
              </Text>
            </TouchableOpacity>

            {/* Sign Up Button */}
            <TouchableOpacity 
              style={[styles.primaryButton, isLoading && styles.disabledButton]}
              onPress={handleSignUp}
              disabled={isLoading}
            >
              <Text style={styles.primaryButtonText}>
                {isLoading ? 'Signing up...' : 'Create Account'}
              </Text>
            </TouchableOpacity>

            {/* Separator */}
            <View style={styles.separatorContainer}>
              <View style={styles.separatorLine} />
              <Text style={styles.separatorText}>OR CONTINUE WITH</Text>
              <View style={styles.separatorLine} />
            </View>

            {/* Social Buttons (Side by side) */}
            <View style={styles.socialButtonsRow}>
              <TouchableOpacity style={styles.socialButtonHalf} onPress={handleGoogleSignUp} disabled={isLoading}>
                <View style={styles.socialIconCircle}>
                  <Text style={{fontWeight: 'bold', color: '#DB4437'}}>G</Text>
                </View>
                <Text style={styles.socialButtonText}>Google</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.socialButtonHalf} onPress={handleFacebookSignUp} disabled={isLoading}>
                <Ionicons name="logo-facebook" size={18} color="#1877F2" style={{marginRight: 6}} />
                <Text style={styles.socialButtonText}>Facebook</Text>
              </TouchableOpacity>
            </View>

            {/* Login Link */}
            <View style={styles.loginContainer}>
              <Text style={styles.loginText}>Already have an account? </Text>
              <TouchableOpacity onPress={handleLogin}>
                <Text style={styles.loginLink}>Login</Text>
              </TouchableOpacity>
            </View>

          </View>
        </View>

        {/* Error Modal */}
        <ErrorModal
          visible={errorModal.visible}
          title={errorModal.title}
          message={errorModal.message}
          type={errorModal.type}
          onClose={closeErrorModal}
          autoClose={true}
          autoCloseDelay={4000}
        />
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 40,
    paddingBottom: 10,
    zIndex: 1,
  },
  backButton: {
    padding: 4,
  },
  contentCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 20,
    borderRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
    position: 'relative',
    overflow: 'hidden',
  },
  leafWatermark: {
    position: 'absolute',
    top: -10,
    right: -10,
    transform: [{ rotate: '15deg' }],
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#4A6B48', // Darker green
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 13,
    color: '#666',
    lineHeight: 18,
    marginBottom: 24,
    paddingRight: 20,
  },
  formContainer: {
    // Form wrapper
  },
  inputContainer: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#333',
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FAFAFA', // Very light grey/white background inside card
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingHorizontal: 12,
  },
  inputIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 15,
    color: '#333',
  },
  eyeButton: {
    padding: 4,
  },
  inputError: {
    borderColor: '#EF4444',
  },
  passwordStrengthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 8,
    gap: 12,
  },
  passwordStrengthBar: {
    flex: 1,
    height: 4,
    backgroundColor: '#E5E7EB',
    borderRadius: 2,
    overflow: 'hidden',
  },
  passwordStrengthFill: {
    height: '100%',
    borderRadius: 2,
  },
  passwordStrengthText: {
    fontSize: 11,
    fontWeight: '700',
  },
  consentContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 8,
    marginBottom: 24,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 1.5,
    borderColor: '#CCC',
    borderRadius: 4,
    marginRight: 12,
    marginTop: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#5C7C54',
    borderColor: '#5C7C54',
  },
  consentText: {
    flex: 1,
    fontSize: 12,
    color: '#555',
    lineHeight: 18,
  },
  linkText: {
    color: '#709A67', // Green link text
    textDecorationLine: 'underline',
  },
  primaryButton: {
    backgroundColor: '#5C7C54',
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 24,
  },
  primaryButtonText: {
    color: 'white',
    fontSize: 15,
    fontWeight: '700',
  },
  disabledButton: {
    opacity: 0.6,
  },
  separatorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  separatorLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E5E7EB',
  },
  separatorText: {
    marginHorizontal: 12,
    fontSize: 11,
    fontWeight: '600',
    color: '#A3A3A3',
    letterSpacing: 1,
  },
  socialButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 24,
  },
  socialButtonHalf: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  socialIconCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },
  socialButtonText: {
    fontSize: 13,
    color: '#333',
    fontWeight: '600',
  },
  loginContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loginText: {
    fontSize: 13,
    color: '#666',
  },
  loginLink: {
    fontSize: 13,
    color: '#4A76FF',
    fontWeight: '600',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  errorText: {
    fontSize: 12,
    color: '#EF4444',
    marginLeft: 6,
    fontWeight: '500',
  },
});
