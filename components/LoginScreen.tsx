import { auth, db } from '@/config/firebase';
import { signInWithFacebook, signInWithGoogle } from '@/config/socialAuth';
import { Ionicons } from '@expo/vector-icons';
// Note: Using basic state management for remember me functionality
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { sendEmailVerification, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
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
import ErrorModal from './ErrorModal';

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
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

  // Remember me functionality with secure storage
  const CREDENTIALS_KEY = 'loginCredentials';

  const saveCredentials = async (email: string, password: string) => {
    try {
      const credentials = JSON.stringify({ email, password });
      await SecureStore.setItemAsync(CREDENTIALS_KEY, credentials);
      console.log('Credentials saved securely for:', email);
    } catch (error) {
      console.error('Failed to save credentials:', error);
    }
  };

  const loadCredentials = async () => {
    try {
      const credentials = await SecureStore.getItemAsync(CREDENTIALS_KEY);
      if (credentials) {
        const { email: savedEmail, password: savedPassword } = JSON.parse(credentials);
        setEmail(savedEmail);
        setPassword(savedPassword);
        setRememberMe(true);
        console.log('Credentials loaded for:', savedEmail);
      }
    } catch (error) {
      console.error('Failed to load credentials:', error);
    }
  };

  const clearCredentials = async () => {
    try {
      await SecureStore.deleteItemAsync(CREDENTIALS_KEY);
      console.log('Credentials cleared from secure storage');
    } catch (error) {
      console.error('Failed to clear credentials:', error);
    }
  };

  const upsertUserProfile = async (provider: string) => {
    try {
      if (!auth || !db) return;
      const currentUser = auth.currentUser;
      if (!currentUser) return;
      // Ensure a fresh token for Firestore security rules
      try { await currentUser.getIdToken(true); } catch {}
      const rawEmail = (currentUser.email || email || '').trim().toLowerCase();
      const userRef = doc(db, 'users', currentUser.uid);
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
        if (err?.code === 'permission-denied' || /Missing or insufficient permissions/.test(String(err?.message))) {
          try { await currentUser.getIdToken(true); } catch {}
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

  // Configure authentication on component mount
  useEffect(() => {
    // Debug: Check Firebase auth status
    console.log('LoginScreen - Firebase auth object:', auth);
    if (auth) {
      console.log('LoginScreen - Auth methods available:');
      console.log('- signInWithRedirect:', typeof auth.signInWithRedirect);
      console.log('- signInWithPopup:', typeof auth.signInWithPopup);
      console.log('- signInWithEmailAndPassword:', typeof auth.signInWithEmailAndPassword);
    } else {
      console.log('LoginScreen - Firebase auth is null/undefined');
    }
    
    // Load saved credentials
    loadCredentials();
  }, []);

  const handleLogin = async () => {
    // Clear previous errors
    setErrors({});

    // Support username without @ by mapping to driver domain
    let loginEmail = (email || '').trim();
    if (loginEmail && !loginEmail.includes('@')) {
      loginEmail = `${loginEmail}@driver.com`;
    }
    // Validate email if it includes '@'
    if (!loginEmail) {
      showError('Please enter your email or username');
      return;
    }
    if (loginEmail.includes('@') && !validateEmail(loginEmail)) {
      showError('Please enter a valid email address');
      return;
    }

    // Validate password
    if (!password) {
      showError('Please enter your password');
      return;
    }

    setIsLoading(true);
    try {
      // Use Firebase authentication
      if (auth) {
        const userCredential = await signInWithEmailAndPassword(auth, loginEmail, password);
        const user = userCredential.user;
        console.log('User logged in successfully:', user.email);

        // Check user role and prevent admin login on user/driver UI
        if (db) {
          try {
            const snap = await getDoc(doc(db, 'users', user.uid));
            if (snap.exists()) {
              const data = snap.data();
              const userRole = (data as any)?.role;
              
              // If user is admin, show error and redirect to admin login
              if (userRole === 'admin') {
                try { 
                  await signOut(auth);
                  await clearCredentials(); // Clear saved credentials for admin accounts
                } catch {}
                showError('Admin accounts must use the admin login portal. Please go to the admin login page.', 'Wrong Login Portal', 'warning');
                return;
              }
            }
          } catch (error) {
            console.error('Error checking user role:', error);
          }
        }

        // Handle remember me functionality
        if (rememberMe) {
          await saveCredentials(email, password);
        } else {
          await clearCredentials();
        }

        // If password provider and email not verified, allow drivers to bypass
        const isPasswordProvider = Array.isArray(user.providerData) && user.providerData.some(p => p?.providerId === 'password');
        if (isPasswordProvider && !user.emailVerified) {
          let allowBypass = false;
          if (db) {
            try {
              const snap = await getDoc(doc(db, 'users', user.uid));
              if (snap.exists()) {
                const data = snap.data();
                if ((data as any)?.role === 'driver') {
                  allowBypass = true;
                }
              }
            } catch {}
          }
          if (!allowBypass) {
            try {
              await sendEmailVerification(user);
              showError('A verification link has been sent to your email. Please verify before logging in.');
            } catch (e: any) {
              showError('Could not send verification email. Please check spam and try again.');
            }
            try { 
              await signOut(auth);
              await clearCredentials(); // Clear saved credentials for unverified accounts
            } catch {}
            return;
          }
        }

        await upsertUserProfile(isPasswordProvider ? 'password' : 'oauth');
        router.replace('/(auth)/loading' as any);
      } else {
        // Fallback to mock login if Firebase is not available
        await new Promise(resolve => setTimeout(resolve, 1000));
        console.log('Mock login - Firebase not available');
        router.replace('/(auth)/loading' as any);
      }
    } catch (error: any) {
      console.error('Login error:', error);
      let errorMessage = 'Login failed. Please try again.';
      
      if (error.code === 'auth/user-not-found') {
        errorMessage = 'No account found with this email address.';
      } else if (error.code === 'auth/wrong-password') {
        errorMessage = 'Incorrect password. Please try again.';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'Invalid email address.';
      } else if (error.code === 'auth/too-many-requests') {
        errorMessage = 'Too many failed attempts. Please try again later.';
      } else if (error.code === 'auth/network-request-failed') {
        errorMessage = 'Network error. Please check your internet connection.';
      } else if (error.code === 'auth/user-disabled') {
        errorMessage = 'This account has been disabled.';
      }
      
      showError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      setIsLoading(true);
      console.log('Starting Google login...');
      
      const result = await signInWithGoogle();
      
      if (result.success) {
        await upsertUserProfile('google');
        console.log('Google login successful');
        router.replace('/(auth)/loading' as any);
      } else {
        console.error('Google login failed:', result.error);
        Alert.alert('Google Sign-In Error', result.error || 'Google sign-in failed');
      }
    } catch (error: any) {
      console.error('Google login error:', error);
      Alert.alert('Google Sign-In Error', error.message || 'Google sign-in failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFacebookLogin = async () => {
    try {
      setIsLoading(true);
      console.log('Starting Facebook login...');
      
      const result = await signInWithFacebook();
      
      if (result.success) {
        await upsertUserProfile('facebook');
        console.log('Facebook login successful');
        router.replace('/(auth)/loading' as any);
      } else {
        console.error('Facebook login failed:', result.error);
        Alert.alert('Facebook Sign-In Error', result.error || 'Facebook sign-in failed');
      }
    } catch (error: any) {
      console.error('Facebook login error:', error);
      Alert.alert('Facebook Sign-In Error', error.message || 'Facebook sign-in failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = () => {
    Alert.alert('Forgot Password', 'Password reset functionality would be implemented here');
  };

  const handleSignUp = () => {
    router.push('/(auth)/signup');
  };

  const handleBack = () => {
    router.back();
  };

  const handleRememberMeToggle = async () => {
    const newRememberMe = !rememberMe;
    setRememberMe(newRememberMe);
    
    // If unchecking remember me, clear saved credentials
    if (!newRememberMe) {
      await clearCredentials();
    }
  };

  return (
    <LinearGradient
      colors={['#B0D7A7', '#FFFFFF']}
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
            <Ionicons name="arrow-back" size={20} color="#2f3a31" />
          </TouchableOpacity>
        </View>

        {/* Content */}
        <View style={styles.content}>
          {/* Top Section - Title and Inputs */}
          <View style={styles.topSection}>
            <Text style={styles.title}>Login to TrashTrack</Text>
            <Text style={styles.subtitle}>Enter your email and password to login</Text>

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
            </View>

            {/* Remember Me and Forgot Password */}
            <View style={styles.rememberForgotContainer}>
            <TouchableOpacity 
              style={styles.rememberMeContainer}
              onPress={handleRememberMeToggle}
            >
                <View style={[styles.checkbox, rememberMe && styles.checkboxChecked]}>
                  {rememberMe && <Ionicons name="checkmark" size={16} color="white" />}
                </View>
                <Text style={styles.rememberMeText}>Remember me</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleForgotPassword}>
                <Text style={styles.forgotPasswordText}>Forgot password?</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Bottom Section - Buttons */}
          <View style={styles.bottomSection}>
            {/* Login Button */}
            <TouchableOpacity 
              style={[styles.primaryButton, isLoading && styles.disabledButton]}
              onPress={handleLogin}
              disabled={isLoading}
            >
              <Text style={styles.primaryButtonText}>
                {isLoading ? 'Logging in...' : 'Login'}
              </Text>
            </TouchableOpacity>

            {/* Separator */}
            <View style={styles.separatorContainer}>
              <View style={styles.separatorLine} />
              <Text style={styles.separatorText}>or sign in with</Text>
              <View style={styles.separatorLine} />
            </View>

            {/* Social Login Buttons */}
            <View style={styles.socialButtons}>
              <TouchableOpacity
                style={[styles.socialButton, styles.googleButton]}
                onPress={handleGoogleLogin}
                disabled={isLoading}
              >
                <Ionicons name="logo-google" size={20} color="#fff" />
                <Text style={styles.socialButtonText}>
                  {isLoading ? 'Signing in...' : 'Continue with Google'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.socialButton, styles.facebookButton]}
                onPress={handleFacebookLogin}
                disabled={isLoading}
              >
                <Ionicons name="logo-facebook" size={20} color="#fff" />
                <Text style={styles.socialButtonText}>
                  {isLoading ? 'Signing in...' : 'Continue with Facebook'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Sign Up Link */}
            <View style={styles.signUpContainer}>
              <Text style={styles.signUpText}>Don&apos;t have an account? </Text>
              <TouchableOpacity onPress={handleSignUp}>
                <Text style={styles.signUpLink}>Signup</Text>
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
    justifyContent: 'center',
  },
  keyboardView: {
    flex: 1,
    justifyContent: 'center',
    paddingTop: 60, // Account for the absolute header
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1,
  },
  backButton: {
    padding: 8,
  },
  content: {
    marginHorizontal: 20,
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderRadius: 20,
    paddingVertical: 32,
    paddingHorizontal: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  topSection: {
    // Contains title, subtitle, inputs, remember me
  },
  bottomSection: {
    // Contains login button, separator, social buttons, signup link
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: '#2f3a31',
    marginBottom: 6,
    textAlign: 'left',
  },
  subtitle: {
    fontSize: 14,
    color: '#6b6b6b',
    textAlign: 'left',
    marginBottom: 20,
  },
  inputContainer: {
    marginBottom: 14,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#dfe9df',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: '#333',
  },
  rememberForgotContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 18,
  },
  rememberMeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 1.6,
    borderColor: '#8aa08a',
    borderRadius: 6,
    marginRight: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#6f8b6f',
  },
  rememberMeText: {
    fontSize: 13,
    color: '#333',
  },
  forgotPasswordText: {
    fontSize: 13,
    color: '#6b8bff',
  },
  primaryButton: {
    backgroundColor: '#4f6b4f',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 18,
  },
  primaryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '700',
  },
  disabledButton: {
    opacity: 0.6,
  },
  separatorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 18,
  },
  separatorLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E6E6E6',
  },
  separatorText: {
    marginHorizontal: 12,
    fontSize: 13,
    color: '#888',
  },
  socialButtons: {
    flexDirection: 'column',
    gap: 12,
    marginBottom: 20,
  },
  socialButton: {
    width: '100%',
    backgroundColor: '#F5F5F5',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
  },
  googleButton: {
    backgroundColor: '#DB4437',
  },
  facebookButton: {
    backgroundColor: '#1877F2',
  },
  socialButtonText: {
    fontSize: 14,
    color: 'white',
    fontWeight: '600',
  },
  signUpContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  signUpText: {
    fontSize: 14,
    color: '#666',
  },
  signUpLink: {
    fontSize: 14,
    color: '#4a76ff',
    fontWeight: '600',
  },
  // Password input styles
  passwordInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#dfe9df',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
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
});
