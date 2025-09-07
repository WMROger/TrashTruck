import { auth, db } from '@/config/firebase';
import { signInWithFacebook, signInWithGoogle } from '@/config/socialAuth';
import { Ionicons } from '@expo/vector-icons';
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

export default function SignupScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState<{[key: string]: string}>({});
  const [showErrorPopup, setShowErrorPopup] = useState(false);

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

  // Show error popup
  const showError = (message: string) => {
    setErrors({ general: message });
    setShowErrorPopup(true);
    setTimeout(() => setShowErrorPopup(false), 4000);
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
        return { text: 'Very Weak', color: '#EF4444' };
      case 2:
        return { text: 'Weak', color: '#F97316' };
      case 3:
        return { text: 'Good', color: '#EAB308' };
      case 4:
        return { text: 'Strong', color: '#22C55E' };
      default:
        return { text: 'Very Weak', color: '#EF4444' };
    }
  };

  const upsertUserProfile = async (provider: string) => {
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
      const writeOnce = async () => {
        if (!snap.exists()) {
          await setDoc(userRef, {
            uid: currentUser.uid,
            email: rawEmail || '',
            displayName: currentUser.displayName || '',
            photoURL: currentUser.photoURL || '',
            verified: currentUser.emailVerified === true,
            role: 'user',
            provider,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        } else {
          // Ensure we don't overwrite an existing role; just update metadata
          await setDoc(
            userRef,
            {
              email: rawEmail || '',
              displayName: currentUser.displayName || '',
              photoURL: currentUser.photoURL || '',
              verified: currentUser.emailVerified === true,
              provider,
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

    // Validate confirm password
    if (!confirmPassword) {
      showError('Please confirm your password');
      return;
    }
    if (password !== confirmPassword) {
      showError('Passwords do not match');
      return;
    }

    setIsLoading(true);
    try {
      // Use Firebase authentication
      if (auth) {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        console.log('User created successfully:', user.email);
        await upsertUserProfile('password');
        
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
      console.error('Signup error:', error);
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
      console.error('Google signup error:', error);
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
      console.error('Facebook signup error:', error);
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
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={handleBack}>
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
        </View>

        {/* Content */}
        <View style={styles.content}>
          <Text style={styles.title}>SignUp to TrashTrack</Text>
          <Text style={styles.subtitle}>Enter your email and password to sign up</Text>

          {/* Input Fields */}
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Email</Text>
            <TextInput
              style={[
                styles.input,
                email.length > 0 && !validateEmail(email) && styles.inputError
              ]}
              placeholder="Enter your email"
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
            {errors.email && (
              <View style={styles.errorContainer}>
                <Ionicons name="alert-circle" size={16} color="#EF4444" />
                <Text style={styles.errorText}>{errors.email}</Text>
              </View>
            )}
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Password</Text>
            <View style={styles.passwordInputContainer}>
              <TextInput
                style={styles.passwordInput}
                placeholder="Enter your password"
                placeholderTextColor="#999"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
              />
              <TouchableOpacity
                style={styles.eyeButton}
                onPress={() => setShowPassword(!showPassword)}
              >
                <Ionicons
                  name={showPassword ? "eye-off" : "eye"}
                  size={20}
                  color="#666"
                />
              </TouchableOpacity>
            </View>
            
            {/* Password Strength Indicator */}
            {password.length > 0 && (
              <View style={styles.passwordStrengthContainer}>
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
                <Text
                  style={[
                    styles.passwordStrengthText,
                    { color: getPasswordStrengthText(validatePasswordStrength(password).strength).color },
                  ]}
                >
                  {getPasswordStrengthText(validatePasswordStrength(password).strength).text}
                </Text>
              </View>
            )}
            
            {/* Password Requirements */}
            {password.length > 0 && (
              <View style={styles.requirementsContainer}>
                <Text style={styles.requirementsTitle}>Password Requirements:</Text>
                {Object.entries(validatePasswordStrength(password).requirements).map(([key, isValid]) => (
                  <View key={key} style={styles.requirementItem}>
                    <Ionicons
                      name={isValid ? "checkmark-circle" : "close-circle"}
                      size={16}
                      color={isValid ? "#22C55E" : "#EF4444"}
                    />
                    <Text style={[styles.requirementText, { color: isValid ? "#22C55E" : "#EF4444" }]}>
                      {key === 'length' && 'At least 8 characters'}
                      {key === 'lowercase' && 'One lowercase letter'}
                      {key === 'uppercase' && 'One uppercase letter'}
                      {key === 'special' && 'One special character'}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Confirm Password</Text>
            <View style={styles.passwordInputContainer}>
              <TextInput
                style={styles.passwordInput}
                placeholder="Confirm your password"
                placeholderTextColor="#999"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showConfirmPassword}
              />
              <TouchableOpacity
                style={styles.eyeButton}
                onPress={() => setShowConfirmPassword(!showConfirmPassword)}
              >
                <Ionicons
                  name={showConfirmPassword ? "eye-off" : "eye"}
                  size={20}
                  color="#666"
                />
              </TouchableOpacity>
            </View>
            
            {/* Password Match Indicator */}
            {confirmPassword.length > 0 && (
              <View style={styles.passwordMatchContainer}>
                <Ionicons
                  name={password === confirmPassword ? "checkmark-circle" : "close-circle"}
                  size={16}
                  color={password === confirmPassword ? "#22C55E" : "#EF4444"}
                />
                <Text
                  style={[
                    styles.passwordMatchText,
                    { color: password === confirmPassword ? "#22C55E" : "#EF4444" },
                  ]}
                >
                  {password === confirmPassword ? "Passwords match" : "Passwords do not match"}
                </Text>
              </View>
            )}
          </View>
        
          {/* Sign Up Button */}
          <TouchableOpacity 
            style={[styles.primaryButton, isLoading && styles.disabledButton]}
            onPress={handleSignUp}
            disabled={isLoading}
          >
            <Text style={styles.primaryButtonText}>
              {isLoading ? 'Signing up...' : 'Sign Up'}
            </Text>
          </TouchableOpacity>

          {/* Separator */}
          <View style={styles.separatorContainer}>
            <View style={styles.separatorLine} />
            <Text style={styles.separatorText}>or sign up with</Text>
            <View style={styles.separatorLine} />
          </View>

          {/* Social Sign Up Buttons */}
          <View style={styles.socialButtonsContainer}>
            <TouchableOpacity style={styles.socialButton} onPress={handleGoogleSignUp}>
              <View style={styles.socialButtonContent}>
                <Text style={styles.socialIcon}>G</Text>
                <Text style={styles.socialButtonText}>Google</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity style={styles.socialButton} onPress={handleFacebookSignUp}>
              <View style={styles.socialButtonContent}>
                <Text style={styles.socialIcon}>f</Text>
                <Text style={styles.socialButtonText}>Facebook</Text>
              </View>
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

        {/* Error Popup */}
        {showErrorPopup && errors.general && (
          <View style={styles.errorPopup}>
            <View style={styles.errorPopupContent}>
              <Ionicons name="alert-circle" size={24} color="#EF4444" />
              <Text style={styles.errorPopupText}>{errors.general}</Text>
              <TouchableOpacity
                style={styles.errorPopupClose}
                onPress={() => setShowErrorPopup(false)}
              >
                <Ionicons name="close" size={20} color="#666" />
              </TouchableOpacity>
            </View>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#E8F5E8',
  },
  keyboardView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 20,
  },
  backButton: {
    padding: 8,
  },
  content: {
    flex: 1,
    paddingHorizontal: 32,
    paddingTop: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#5B7C67',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 40,
  },
  inputContainer: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#333',
  },
  passwordInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  passwordInput: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    paddingRight: 8,
  },
  eyeButton: {
    padding: 4,
  },
  passwordStrengthContainer: {
    marginTop: 8,
  },
  passwordStrengthBar: {
    height: 4,
    backgroundColor: '#E5E7EB',
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 4,
  },
  passwordStrengthFill: {
    height: '100%',
    borderRadius: 2,
  },
  passwordStrengthText: {
    fontSize: 12,
    fontWeight: '600',
  },
  requirementsContainer: {
    marginTop: 8,
    padding: 12,
    backgroundColor: '#F9FAFB',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  requirementsTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 6,
  },
  requirementItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  requirementText: {
    fontSize: 12,
    marginLeft: 6,
  },
  passwordMatchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  passwordMatchText: {
    fontSize: 12,
    marginLeft: 6,
    fontWeight: '500',
  },
  rememberMeContainer: {
    marginBottom: 30,
  },
  rememberMeButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderColor: '#5B7C67',
    borderRadius: 4,
    marginRight: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#5B7C67',
  },
  rememberMeText: {
    fontSize: 14,
    color: '#333',
  },
  primaryButton: {
    backgroundColor: '#5B7C67',
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 30,
  },
  primaryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  disabledButton: {
    opacity: 0.6,
  },
  separatorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 30,
  },
  separatorLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E0E0E0',
  },
  separatorText: {
    marginHorizontal: 16,
    fontSize: 14,
    color: '#666',
  },
  socialButtonsContainer: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 40,
  },
  socialButton: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  socialButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  socialIcon: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  socialButtonText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  loginContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loginText: {
    fontSize: 14,
    color: '#666',
  },
  loginLink: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '600',
  },
  // Error styles
  inputError: {
    borderColor: '#EF4444',
    borderWidth: 2,
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
  errorPopup: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  errorPopupContent: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    marginHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
    maxWidth: '90%',
  },
  errorPopupText: {
    flex: 1,
    fontSize: 16,
    color: '#1F2937',
    marginLeft: 12,
    marginRight: 12,
    lineHeight: 22,
  },
  errorPopupClose: {
    padding: 4,
  },
});
