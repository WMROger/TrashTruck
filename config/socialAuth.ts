import { FacebookAuthProvider, getRedirectResult, GoogleAuthProvider, signInWithPopup, signInWithRedirect } from 'firebase/auth';
import { Platform } from 'react-native';
import { auth } from './firebase';

// Configure authentication for web
export const configureAuth = () => {
  if (Platform.OS === 'web') {
    // Handle redirect result for web
    getRedirectResult(auth).catch((error) => {
      console.error('Redirect result error:', error);
    });
  }
};

// Google Sign-In
export const signInWithGoogle = async () => {
  try {
    const provider = new GoogleAuthProvider();
    
    if (Platform.OS === 'web') {
      // Web platform - use popup
      const result = await signInWithPopup(auth, provider);
      return {
        success: true,
        user: result.user,
        error: null
      };
    } else {
      // Mobile platforms - use Firebase Auth with Google provider
      // For mobile, we need to use a different approach since signInWithRedirect doesn't work properly
      try {
        // Try to use signInWithPopup on mobile (some platforms support it)
        const result = await signInWithPopup(auth, provider);
        return {
          success: true,
          user: result.user,
          error: null
        };
      } catch (popupError: any) {
        // If popup fails, fall back to a different approach
        console.log('Popup failed on mobile, trying alternative method:', popupError.message);
        
        // For now, return an error suggesting to use web or implement native auth
        return {
          success: false,
          user: null,
          error: 'Google sign-in on mobile requires additional setup. Please use the web version or contact support.'
        };
      }
    }
  } catch (error: any) {
    console.error('Google Sign-In Error:', error);
    
    // Handle specific error cases
    if (error.code === 'auth/popup-closed-by-user') {
      return {
        success: false,
        user: null,
        error: 'Sign-in was cancelled by user'
      };
    } else if (error.code === 'auth/popup-blocked') {
      return {
        success: false,
        user: null,
        error: 'Pop-up was blocked by browser. Please allow pop-ups for this site.'
      };
    } else if (error.code === 'auth/network-request-failed') {
      return {
        success: false,
        user: null,
        error: 'Network error. Please check your internet connection.'
      };
    }
    
    return {
      success: false,
      user: null,
      error: error.message || 'Google sign-in failed'
    };
  }
};

// Facebook Sign-In
export const signInWithFacebook = async () => {
  try {
    const provider = new FacebookAuthProvider();
    
    if (Platform.OS === 'web') {
      // Web platform - use popup
      const result = await signInWithPopup(auth, provider);
      return {
        success: true,
        user: result.user,
        error: null
      };
    } else {
      // Mobile platforms - use redirect (will be handled by native auth)
      await signInWithRedirect(auth, provider);
      return {
        success: true,
        user: null, // User will be available after redirect
        error: null
      };
    }
  } catch (error: any) {
    console.error('Facebook Sign-In Error:', error);
    return {
      success: false,
      user: null,
      error: error.message || 'Facebook sign-in failed'
    };
  }
};

// Sign out
export const signOut = async () => {
  try {
    await auth.signOut();
  } catch (error) {
    console.error('Sign-Out Error:', error);
  }
};

// Check if user is signed in
export const isSignedIn = () => {
  return !!auth.currentUser;
};

// Get current user
export const getCurrentUser = () => {
  return auth.currentUser;
};

// Check if user is signed in with specific provider
export const isSignedInWithProvider = (providerId: string) => {
  const user = auth.currentUser;
  return user?.providerData.some((provider: any) => provider.providerId === providerId) || false;
};

// Check if user is signed in with Google
export const isSignedInWithGoogle = () => {
  return isSignedInWithProvider('google.com');
};

// Check if user is signed in with Facebook
export const isSignedInWithFacebook = () => {
  return isSignedInWithProvider('facebook.com');
};

// Get current Google user
export const getCurrentGoogleUser = () => {
  const user = auth.currentUser;
  if (user?.providerData.some((provider: any) => provider.providerId === 'google.com')) {
    return user;
  }
  return null;
};

// Get current Facebook user
export const getCurrentFacebookUser = () => {
  const user = auth.currentUser;
  if (user?.providerData.some((provider: any) => provider.providerId === 'facebook.com')) {
    return user;
  }
  return null;
};
