import { auth, db } from '@/config/firebase';
import { takePendingAuthRequest } from '@/services/pendingAuthService';
import { signInWithFacebook, signInWithGoogle } from '@/config/socialAuth';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { sendEmailVerification, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Animated,
    Dimensions,
    Platform,
    SafeAreaView,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import ErrorModal from '../../components/ErrorModal';
import { isCictoEmail, ensureCictoProfileInFirestore } from '@/constants/cictoConfig';

async function ensureCenroProfileInFirestore(
  uid: string,
  email: string,
  displayName: string = 'CENRO Admin',
): Promise<void> {
  if (!db) return;
  try {
    const userRef = doc(db, 'users', uid);
    await setDoc(
      userRef,
      {
        uid,
        email,
        displayName,
        name: displayName,
        role: 'admin',
        verified: true,
        status: 'active',
        department: 'City Environment and Natural Resources Office (CENRO Danao)',
        agency: 'CENRO Danao City',
        updatedAt: serverTimestamp(),
        lastLogin: serverTimestamp(),
      },
      { merge: true },
    );
  } catch (error) {
    console.warn('Could not auto-heal CENRO profile in loading page:', error);
  }
}

const { width, height } = Dimensions.get('window');

export default function LoadingPage() {
  const router = useRouter();
  const [fadeAnim] = useState(new Animated.Value(0));
  const [scaleAnim] = useState(new Animated.Value(0.8));
  const [loadingText, setLoadingText] = useState('Initializing...');
  const [progress, setProgress] = useState(0);
  const [errorModal, setErrorModal] = useState({
    visible: false,
    title: 'Error',
    message: '',
    type: 'error' as 'error' | 'warning' | 'info' | 'success',
  });

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

  // Helper function to update user profile in Firestore
  const upsertUserProfile = async (provider: string) => {
    try {
      const user = auth?.currentUser;
      if (!user || !db) return;

      const userRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(userRef);
      
      if (!userSnap.exists()) {
        // New user - create profile adhering strictly to security rules
        await setDoc(userRef, {
          uid: user.uid,
          email: user.email || '',
          displayName: user.displayName || user.email?.split('@')[0] || 'User',
          name: user.displayName || user.email?.split('@')[0] || 'User',
          verified: user.emailVerified === true,
          role: 'user', // Default role
          provider: provider,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        console.log('Created new user profile');
      } else {
        // Existing user - update login timestamp
        const existingData = userSnap.data();
        const isSpecialVerified = existingData?.verified === true || existingData?.role === 'driver' || existingData?.role === 'admin' || existingData?.role === 'cenro' || existingData?.role === 'cicto' || existingData?.role === 'coordinator';
        await setDoc(userRef, {
          email: user.email || existingData?.email || '',
          displayName: user.displayName || existingData?.displayName || existingData?.name || 'User',
          verified: isSpecialVerified ? true : user.emailVerified === true,
          updatedAt: serverTimestamp(),
          lastLogin: serverTimestamp(),
        }, { merge: true });
        console.log('Updated existing user profile');
      }
    } catch (error) {
      console.warn('Upserting user profile note:', error);
    }
  };

  useEffect(() => {
    // Start animations
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
    ]).start();

    // Start authentication process
    const handleAuthentication = async () => {
      try {
        const pendingAuth = takePendingAuthRequest();

        if (pendingAuth?.kind === 'email') {
          await handleEmailPasswordAuth(pendingAuth);
        } else if (pendingAuth?.kind === 'social') {
          await handleSocialAuth(pendingAuth.provider);
        } else {
          // No authentication data found - this shouldn't happen
          showError('No authentication data found. Please try logging in again.', 'Authentication Error', 'error');
          setTimeout(() => {
            router.replace('/(auth)/login' as any);
          }, 2000);
        }
      } catch (error: any) {
        console.error('Error during authentication:', error);
        showError('Authentication failed. Please try again.', 'Authentication Error', 'error');
        setTimeout(() => {
          router.replace('/(auth)/login' as any);
        }, 2000);
      }
    };

    // Start authentication after brief delay for UI
    const authTimeout = setTimeout(handleAuthentication, 1000);

    return () => {
      clearTimeout(authTimeout);
    };
  }, [router, fadeAnim, scaleAnim]);

  // Handle email/password authentication
  const handleEmailPasswordAuth = async (credentials: any) => {
    try {
      setLoadingText('Verifying credentials...');
      setProgress(25);

      if (!auth) {
        throw new Error('Firebase auth not available');
      }

      const userCredential = await signInWithEmailAndPassword(auth, credentials.email, credentials.password);
      const user = userCredential.user;
      console.log('User logged in successfully:', user.email);

      setLoadingText('Checking user role...');
      setProgress(50);

      const normEmail = (credentials?.email || user.email || '').toLowerCase();
      const isKnownStaff = isCictoEmail(normEmail) || normEmail.endsWith('@driver.com') || normEmail.includes('driver') || normEmail.startsWith('admin@') || normEmail.startsWith('cenro@') || normEmail.includes('admin') || normEmail.includes('cenro');
      let isDriverOrPreVerified = isKnownStaff;
      
      // Check user role and route properly
      if (db) {
        const snap = await getDoc(doc(db, 'users', user.uid));
        if (snap.exists()) {
          const data = snap.data();
          const userRole = (data as any)?.role;
          if (userRole === 'driver' || userRole === 'admin' || userRole === 'cicto' || userRole === 'cenro' || userRole === 'coordinator' || (data as any)?.verified === true) {
            isDriverOrPreVerified = true;
          }
          
          // Handle admin and cicto logins
          if (userRole === 'admin' || userRole === 'cicto' || userRole === 'cenro') {
            if (Platform.OS === 'web') {
              if (userRole === 'cicto') {
                router.replace('/cicto/dashboard' as any);
              } else {
                router.replace('/admin/dashboard' as any);
              }
              return;
            } else {
              try { 
                await signOut(auth);
              } catch {}
              
              const message = 'Admin access is restricted to the desktop website. Please log in on a computer.';
              showError(message, 'Restricted Access', 'warning');
              setTimeout(() => {
                router.replace('/(auth)/login' as any);
              }, 3000);
              return;
            }
          }
        } else if (isKnownStaff) {
          if (isCictoEmail(normEmail)) {
            await ensureCictoProfileInFirestore(user.uid, normEmail, user.displayName || 'CICTO Super Admin');
            router.replace('/cicto/dashboard' as any);
            return;
          } else if (normEmail.startsWith('admin@') || normEmail.startsWith('cenro@') || normEmail.includes('admin') || normEmail.includes('cenro')) {
            await ensureCenroProfileInFirestore(user.uid, normEmail, user.displayName || 'CENRO Admin');
            router.replace('/admin/dashboard' as any);
            return;
          }
        }
      }

      setLoadingText('Verifying credentials...');
      setProgress(75);

      // Password accounts must verify their email before proceeding (unless pre-verified or driver).
      const isPasswordProvider = Array.isArray(user.providerData) && user.providerData.some(p => p?.providerId === 'password');
      if (isPasswordProvider && !user.emailVerified && !isDriverOrPreVerified) {
        try {
          await sendEmailVerification(user);
          showError('A verification link has been sent to your email. Please verify before logging in.', 'Email Verification Required', 'info');
        } catch {
          showError('Could not send a verification email. Please check spam and try again.', 'Email Verification Error', 'warning');
        }
        try { await signOut(auth); } catch {}
        setTimeout(() => {
          router.replace('/(auth)/login' as any);
        }, 3000);
        return;
      }

      setLoadingText('Setting up profile...');
      setProgress(90);

      // Update user profile
      await upsertUserProfile(isPasswordProvider ? 'password' : 'oauth');

      setLoadingText('Almost ready...');
      setProgress(100);

      // Navigate based on role
      await navigateBasedOnRole();

    } catch (error: any) {
      console.warn('Email/password authentication error:', error);
      let errorMessage = 'Login failed. Please try again.';
      let errorTitle = 'Authentication Failed';
      
      const isQuota = error?.code === 'resource-exhausted' || error?.message?.includes('Quota exceeded') || error?.message?.includes('resource-exhausted');

      if (isQuota) {
        errorTitle = 'Database Quota Exceeded';
        errorMessage = 'Firebase free daily database quota has been reached for today. Operations will resume once the daily quota resets (~3:00 PM PHT) or when upgraded to the Blaze plan.';
      } else if (error.code === 'auth/user-not-found') {
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
      
      showError(errorMessage, errorTitle, isQuota ? 'warning' : 'error');
      setTimeout(() => {
        router.replace('/(auth)/login' as any);
      }, isQuota ? 5000 : 3000);
    }
  };

  // Handle social authentication
  const handleSocialAuth = async (authType: string) => {
    try {
      setLoadingText(`Signing in with ${authType}...`);
      setProgress(25);

      let result;
      if (authType === 'google') {
        result = await signInWithGoogle();
      } else if (authType === 'facebook') {
        result = await signInWithFacebook();
      } else {
        throw new Error('Unsupported authentication type');
      }

      if (!result.success) {
        throw new Error(result.error || `${authType} sign-in failed`);
      }

      setLoadingText('Setting up profile...');
      setProgress(75);

      await upsertUserProfile(authType);

      setLoadingText('Almost ready...');
      setProgress(100);

      // Navigate based on role
      await navigateBasedOnRole();

    } catch (error: any) {
      console.warn(`${authType} authentication error:`, error);
      showError(error.message || `${authType} sign-in failed`, 'Authentication Failed', 'error');
      setTimeout(() => {
        router.replace('/(auth)/login' as any);
      }, 3000);
    }
  };

  // Navigate based on user role
  const navigateBasedOnRole = async () => {
    try {
      const currentUser = auth?.currentUser;
      if (currentUser && db) {
        const snap = await getDoc(doc(db, 'users', currentUser.uid));
        const userData = snap.exists() ? (snap.data() as any) : {};
        const role = userData?.role || 'user';

        // Check if temporary access code/password has expired (5-minute limit)
        const nowMillis = Date.now();
        const expiresAtMillis = userData?.temporaryPasswordExpiresAt?.toMillis
          ? userData.temporaryPasswordExpiresAt.toMillis()
          : (userData?.temporaryPasswordExpiresAt ? new Date(userData.temporaryPasswordExpiresAt).getTime() : null);

        if (userData?.mustChangePassword === true && expiresAtMillis && nowMillis > expiresAtMillis) {
          try { await signOut(auth); } catch {}
          showError(
            'Your temporary access code/password has expired (valid for 5 minutes). Please contact your administrator to re-provision credentials.',
            'Access Code Expired',
            'error'
          );
          setTimeout(() => { router.replace('/(auth)/login' as any); }, 3500);
          return;
        }
        
        if (role === 'admin' || role === 'cenro' || role === 'cicto') {
          if (Platform.OS !== 'web') {
            try { await signOut(auth); } catch {}
            showError('Admin access is restricted to the desktop website. Please log in on a computer.', 'Restricted Access', 'warning');
            setTimeout(() => { router.replace('/(auth)/login' as any); }, 3000);
            return;
          }
          if (role === 'cicto') {
            console.log('CICTO user detected, redirecting to CICTO dashboard');
            router.replace('/cicto/dashboard' as any);
          } else {
            console.log('CENRO admin user detected, redirecting to admin dashboard');
            router.replace('/admin/dashboard' as any);
          }
        } else if (role === 'driver') {
          console.log('Driver user detected, redirecting to driver interface');
          router.replace('/(driver)' as any);
        } else {
          console.log('Regular user detected, redirecting to home');
          router.replace('/(tabs)/home' as any);
        }
      } else {
        throw new Error('Authentication profile services are unavailable.');
      }
    } catch (error: any) {
      console.error('Error during navigation decision:', error);
      showError('Failed to load user profile. Please try logging in again.', 'Navigation Error', 'error');
      setTimeout(() => {
        router.replace('/(auth)/login' as any);
      }, 3000);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Animated.View
        style={[
          styles.content,
          {
            opacity: fadeAnim,
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        {/* App Icon/Logo */}
        <View style={styles.logoContainer}>
          <View style={styles.logoBackground}>
            <Ionicons name="trash" size={60} color="#4f6b4f" />
          </View>
        </View>

        {/* App Name */}
        <Text style={styles.appName}>TrashTrack</Text>
        <Text style={styles.welcomeText}>Welcome back!</Text>

        {/* Loading Animation */}
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4f6b4f" />
          <Text style={styles.loadingText}>{loadingText}</Text>
        </View>

        {/* Progress Bar */}
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${progress}%` }]} />
          </View>
          <Text style={styles.progressText}>{progress}%</Text>
        </View>

        {/* Loading Dots Animation */}
        <View style={styles.dotsContainer}>
          <Animated.View style={[styles.dot, styles.dot1]} />
          <Animated.View style={[styles.dot, styles.dot2]} />
          <Animated.View style={[styles.dot, styles.dot3]} />
        </View>
      </Animated.View>

      {/* Error Modal */}
      <ErrorModal
        visible={errorModal.visible}
        title={errorModal.title}
        message={errorModal.message}
        type={errorModal.type}
        onClose={closeErrorModal}
        autoClose={true}
        autoCloseDelay={5000}
        actionButton={{
          text: 'Go to Login',
          onPress: () => {
            closeErrorModal();
            router.replace('/(auth)/login' as any);
          }
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#E8F5E8',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  logoContainer: {
    marginBottom: 30,
  },
  logoBackground: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  appName: {
    fontSize: 32,
    fontWeight: '700',
    color: '#2f3a31',
    marginBottom: 8,
    textAlign: 'center',
  },
  welcomeText: {
    fontSize: 16,
    color: '#6b6b6b',
    marginBottom: 40,
    textAlign: 'center',
  },
  loadingContainer: {
    alignItems: 'center',
    marginBottom: 30,
  },
  loadingText: {
    fontSize: 16,
    color: '#4f6b4f',
    marginTop: 16,
    textAlign: 'center',
    fontWeight: '500',
  },
  progressContainer: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 30,
  },
  progressBar: {
    width: '100%',
    height: 6,
    backgroundColor: 'rgba(79, 107, 79, 0.2)',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#4f6b4f',
    borderRadius: 3,
  },
  progressText: {
    fontSize: 14,
    color: '#4f6b4f',
    fontWeight: '600',
  },
  dotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4f6b4f',
    marginHorizontal: 4,
  },
  dot1: {
    opacity: 0.4,
  },
  dot2: {
    opacity: 0.7,
  },
  dot3: {
    opacity: 1,
  },
});
