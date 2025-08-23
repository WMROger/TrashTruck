// import * as AuthSession from 'expo-auth-session';
// import * as Crypto from 'expo-crypto';
import * as WebBrowser from 'expo-web-browser';
import {
  FacebookAuthProvider,
  GoogleAuthProvider,
  signInWithPopup
} from 'firebase/auth';
import { Platform } from 'react-native';
import { auth } from './firebase';

// Configure WebBrowser for auth
WebBrowser.maybeCompleteAuthSession();

// Google OAuth configuration
const GOOGLE_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_SECRET;

// Facebook OAuth configuration  
const FACEBOOK_APP_ID = process.env.EXPO_PUBLIC_FACEBOOK_APP_ID;

export const signInWithGoogle = async (): Promise<{ success: boolean; error?: string }> => {
  try {
    console.log('Starting Google sign-in...');
    
    if (Platform.OS === 'web') {
      // Web platform - use Firebase popup
      console.log('Using Firebase popup for web');
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      return { success: true };
    } else {
      // Mobile platform - temporarily disabled due to expo-auth-session compatibility issues
      console.log('Mobile Google sign-in temporarily disabled - using web fallback');
      
      // For now, redirect to web or show a message
      return { success: false, error: 'Mobile Google sign-in is temporarily unavailable. Please use the web version.' };
      
      // TODO: Re-enable when expo-auth-session compatibility is resolved
      /*
      if (!GOOGLE_CLIENT_ID) {
        throw new Error('Google Client ID not configured for mobile');
      }

      // Create auth request
      const redirectUri = AuthSession.makeRedirectUri({
        scheme: 'myapp',
        path: 'auth/callback'
      });

      const request = new AuthSession.AuthRequest({
        clientId: GOOGLE_CLIENT_ID,
        scopes: ['openid', 'profile', 'email'],
        redirectUri,
        responseType: AuthSession.ResponseType.Code,
        codeChallenge: await Crypto.digestStringAsync(
          Crypto.CryptoDigestAlgorithm.SHA256,
          Crypto.randomUUID(),
          { encoding: Crypto.CryptoEncoding.HEX }
        ),
        codeChallengeMethod: AuthSession.CodeChallengeMethod.S256,
      });

      // Start auth session
      const result = await request.promptAsync({
        authorizationEndpoint: 'https://accounts.google.com/oauth/authorize',
      });

      if (result.type === 'success' && result.params.code) {
        // Exchange code for tokens
        const tokenResponse = await AuthSession.exchangeCodeAsync(
          {
            clientId: GOOGLE_CLIENT_ID,
            clientSecret: GOOGLE_CLIENT_SECRET || '',
            code: result.params.code,
            redirectUri,
            extraParams: {
              code_verifier: request.codeChallenge || '',
            },
          },
          {
            tokenEndpoint: 'https://oauth2.googleapis.com/token',
          }
        );

        // Sign in with Firebase using the access token
        const credential = GoogleAuthProvider.credential(tokenResponse.accessToken);
        await signInWithCredential(auth, credential);
        
        console.log('Google sign-in successful on mobile');
        return { success: true };
      } else {
        throw new Error('Google authentication was cancelled or failed');
      }
      */
    }
  } catch (error: any) {
    console.error('Google sign-in error:', error);
    
    if (error.code === 'auth/popup-closed-by-user') {
      return { success: false, error: 'Sign-in was cancelled' };
    } else if (error.code === 'auth/popup-blocked') {
      return { success: false, error: 'Pop-up was blocked. Please allow pop-ups and try again.' };
    } else if (error.code === 'auth/network-request-failed') {
      return { success: false, error: 'Network error. Please check your connection and try again.' };
    } else {
      return { success: false, error: error.message || 'Google sign-in failed' };
    }
  }
};

export const signInWithFacebook = async (): Promise<{ success: boolean; error?: string }> => {
  try {
    console.log('Starting Facebook sign-in...');
    
    if (Platform.OS === 'web') {
      // Web platform - use Firebase popup
      console.log('Using Firebase popup for web');
      const provider = new FacebookAuthProvider();
      await signInWithPopup(auth, provider);
      return { success: true };
    } else {
      // Mobile platform - temporarily disabled due to expo-auth-session compatibility issues
      console.log('Mobile Facebook sign-in temporarily disabled - using web fallback');
      
      // For now, redirect to web or show a message
      return { success: false, error: 'Mobile Facebook sign-in is temporarily unavailable. Please use the web version.' };
      
      // TODO: Re-enable when expo-auth-session compatibility is resolved
      /*
      if (!FACEBOOK_APP_ID) {
        throw new Error('Facebook App ID not configured for mobile');
      }

      // Create auth request
      const redirectUri = AuthSession.makeRedirectUri({
        scheme: 'myapp',
        path: 'auth/callback'
      });

      const request = new AuthSession.AuthRequest({
        clientId: FACEBOOK_APP_ID,
        scopes: ['public_profile', 'email'],
        redirectUri,
        responseType: AuthSession.ResponseType.Code,
      });

      // Start auth session
      const result = await request.promptAsync({
        authorizationEndpoint: 'https://www.facebook.com/v18.0/dialog/oauth',
      });

      if (result.type === 'success' && result.params.code) {
        // Exchange code for tokens
        const tokenResponse = await AuthSession.exchangeCodeAsync(
          {
            clientId: FACEBOOK_APP_ID,
            code: result.params.code,
            redirectUri,
          },
          {
            tokenEndpoint: 'https://graph.facebook.com/v18.0/oauth/access_token',
          }
        );

        // Sign in with Firebase using the access token
        const credential = FacebookAuthProvider.credential(tokenResponse.accessToken);
        await signInWithCredential(auth, credential);
        
        console.log('Facebook sign-in successful on mobile');
        return { success: true };
      } else {
        throw new Error('Facebook authentication was cancelled or failed');
      }
      */
    }
  } catch (error: any) {
    console.error('Facebook sign-in error:', error);
    
    if (error.code === 'auth/popup-closed-by-user') {
      return { success: false, error: 'Sign-in was cancelled' };
    } else if (error.code === 'auth/popup-blocked') {
      return { success: false, error: 'Pop-up was blocked. Please allow pop-ups and try again.' };
    } else if (error.code === 'auth/network-request-failed') {
      return { success: false, error: 'Network error. Please check your connection and try again.' };
    } else {
      return { success: false, error: error.message || 'Facebook sign-in failed' };
    }
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
