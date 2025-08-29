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
    if (!email || !password || !confirmPassword) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters long');
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
      }
      
      Alert.alert('Sign Up Error', errorMessage);
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
              style={styles.input}
              placeholder="Enter your email"
              placeholderTextColor="#999"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Password</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter your password"
              placeholderTextColor="#999"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Confirm Password</Text>
            <TextInput
              style={styles.input}
              placeholder="Confirm your password"
              placeholderTextColor="#999"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
            />
          </View>

          {/* Remember Me */}
          <View style={styles.rememberMeContainer}>
            <TouchableOpacity 
              style={styles.rememberMeButton}
              onPress={() => setRememberMe(!rememberMe)}
            >
              <View style={[styles.checkbox, rememberMe && styles.checkboxChecked]}>
                {rememberMe && <Ionicons name="checkmark" size={16} color="white" />}
              </View>
              <Text style={styles.rememberMeText}>Remember me</Text>
            </TouchableOpacity>
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
});
