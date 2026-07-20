import { auth, db } from '@/config/firebase';
import { Ionicons } from '@expo/vector-icons';
// Note: Using basic state management for remember me functionality
import { storage } from '@/utils/storage';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
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
      await storage.setItem(CREDENTIALS_KEY, credentials);
      console.log('Credentials saved securely for:', email);
    } catch (error) {
      console.error('Failed to save credentials:', error);
    }
  };

  const loadCredentials = async () => {
    try {
      const credentials = await storage.getItem(CREDENTIALS_KEY);
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
      await storage.deleteItem(CREDENTIALS_KEY);
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

    // Store credentials for remember me and immediately redirect to loading
    if (rememberMe) {
      await saveCredentials(email, password);
    } else {
      await clearCredentials();
    }

    // Store login credentials in temp storage for loading page to process
    try {
      await storage.setItem('temp_login_credentials', JSON.stringify({
        email: loginEmail,
        password: password,
        rememberMe: rememberMe
      }));
    } catch (error) {
      console.error('Failed to store temp credentials:', error);
    }

    // Immediately redirect to loading page
    router.replace('/(auth)/loading' as any);
  };

  const handleGoogleLogin = async () => {
    // Store auth type for loading page
    try {
      await storage.setItem('temp_auth_type', 'google');
    } catch (error) {
      console.error('Failed to store auth type:', error);
    }
    
    // Immediately redirect to loading page
    router.replace('/(auth)/loading' as any);
  };

  const handleFacebookLogin = async () => {
    // Store auth type for loading page
    try {
      await storage.setItem('temp_auth_type', 'facebook');
    } catch (error) {
      console.error('Failed to store auth type:', error);
    }
    
    // Immediately redirect to loading page
    router.replace('/(auth)/loading' as any);
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

        {/* Content */}
        <View style={styles.content}>
          {/* Top Section - Title and Inputs */}
          <View style={styles.topSection}>
            <Text style={styles.title}>
              Login to <Text style={styles.titleHighlight}>TrashTrack</Text>
            </Text>
            <Text style={styles.subtitle}>Enter your email and password to login</Text>

            {/* Input Fields */}
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Email</Text>
              <TextInput
                style={[
                  styles.input,
                  email.length > 0 && !validateEmail(email) && styles.inputError
                ]}
                placeholder=""
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
                  placeholder=""
                  placeholderTextColor="#999"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                  <Ionicons name={showPassword ? "eye-off" : "eye"} size={20} color="#666" />
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
                  {rememberMe && <Ionicons name="checkmark" size={14} color="white" />}
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
                style={styles.socialButton}
                onPress={handleGoogleLogin}
                disabled={isLoading}
              >
                <View style={styles.socialIconCircle}>
                  <Text style={{fontWeight: 'bold', color: '#DB4437'}}>G</Text>
                </View>
                <Text style={styles.socialButtonText}>Continue with Google</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.socialButton}
                onPress={handleFacebookLogin}
                disabled={isLoading}
              >
                <Ionicons name="logo-facebook" size={20} color="#1877F2" style={{marginRight: 8}} />
                <Text style={styles.socialButtonText}>Continue with Facebook</Text>
              </TouchableOpacity>
            </View>

            {/* Sign Up Link */}
            <View style={styles.signUpContainer}>
              <Text style={styles.signUpText}>Don't have an account? </Text>
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
  },
  keyboardView: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 40,
    paddingBottom: 20,
  },
  backButton: {
    padding: 4,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
  },
  topSection: {
    marginBottom: 30,
  },
  bottomSection: {
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 8,
  },
  titleHighlight: {
    color: '#6A9955', // Lighter green for TrashTrack
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 40,
  },
  inputContainer: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#555',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#F3FAF3',
    borderWidth: 1,
    borderColor: '#D4E8D4',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#333',
  },
  passwordInputContainer: {
    backgroundColor: '#F3FAF3',
    borderWidth: 1,
    borderColor: '#D4E8D4',
    borderRadius: 8,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 50,
  },
  passwordInput: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    paddingRight: 8,
    paddingVertical: 14,
  },
  rememberForgotContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 30,
  },
  rememberMeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkbox: {
    width: 18,
    height: 18,
    borderWidth: 1.5,
    borderColor: '#999',
    borderRadius: 4,
    marginRight: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#6A9955',
    borderColor: '#6A9955',
  },
  rememberMeText: {
    fontSize: 13,
    color: '#555',
  },
  forgotPasswordText: {
    fontSize: 13,
    color: '#4A76FF',
  },
  primaryButton: {
    backgroundColor: '#5C7C54',
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 30,
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
    marginBottom: 20,
    paddingHorizontal: 10,
  },
  separatorLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#A3A3A3',
  },
  separatorText: {
    marginHorizontal: 12,
    fontSize: 13,
    color: '#666',
  },
  socialButtons: {
    flexDirection: 'column',
    gap: 12,
    marginBottom: 30,
  },
  socialButton: {
    width: '100%',
    backgroundColor: '#E5E7EB',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  socialIconCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  socialButtonText: {
    fontSize: 15,
    color: '#555',
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
    color: '#4A76FF',
  },
  inputError: {
    borderColor: '#EF4444',
    borderWidth: 1,
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
