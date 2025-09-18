import * as AuthSession from 'expo-auth-session';
import Constants from 'expo-constants';
import * as WebBrowser from 'expo-web-browser';
import {
  FacebookAuthProvider,
  GoogleAuthProvider,
  signInWithCredential,
  signInWithPopup,
} from 'firebase/auth';
import { Platform } from 'react-native';
import { auth } from './firebase';

// Configure WebBrowser for auth
WebBrowser.maybeCompleteAuthSession();

// Google OAuth configuration
// Prefer platform-specific client IDs. For iOS implicit flow, use the iOS client ID.
const GOOGLE_IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID;
const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
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
      // Mobile platform - OAuth compliant: use proxy in Expo Go, custom scheme in dev/prod builds
      console.log('Using AuthSession for mobile Google sign-in');

      // In Expo Go, always use the Web client ID to match the https proxy redirect
      const isExpoGo = Constants.appOwnership === 'expo';
      const clientId = isExpoGo
        ? (GOOGLE_WEB_CLIENT_ID || GOOGLE_IOS_CLIENT_ID)
        : (Platform.OS === 'ios' ? (GOOGLE_IOS_CLIENT_ID) : (GOOGLE_WEB_CLIENT_ID || GOOGLE_IOS_CLIENT_ID));
      if (!clientId) {
        throw new Error('Google Client ID not configured');
      }

      // Compute redirect URI. In Expo Go, hardcode the proxy URL to avoid accidental exp:// redirects.
      const expoOwner = (Constants as any)?.expoConfig?.owner || (Constants as any)?.easConfig?.owner;
      const expoSlug = (Constants as any)?.expoConfig?.slug || 'trashtrack';
      const proxyBase = expoOwner && expoSlug
        ? `https://auth.expo.dev/@${expoOwner}/${expoSlug}`
        : `https://auth.expo.dev/@wmroger/trashtrack`;
      const redirectUri = isExpoGo
        ? proxyBase
        : (AuthSession.makeRedirectUri as any)({ scheme: 'myapp', path: 'auth/callback' });
      console.log('Google redirect URI:', redirectUri);
      console.log('Google clientId:', clientId);

      const nonce = Math.random().toString(36).slice(2);
      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(
        clientId
      )}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=id_token&scope=${encodeURIComponent(
        'openid email profile'
      )}&prompt=select_account&nonce=${encodeURIComponent(nonce)}`;

      const wbResult = await WebBrowser.openAuthSessionAsync(authUrl, redirectUri);
      if (wbResult.type === 'success' && wbResult.url) {
        console.log('Google auth returned URL:', wbResult.url);
        const fullUrl = wbResult.url;
        const fragment = fullUrl.includes('#') ? fullUrl.split('#')[1] : '';
        const hashParams = new URLSearchParams(fragment);
        const queryString = fullUrl.split('?')[1]?.split('#')[0] || '';
        const queryParams = new URLSearchParams(queryString);
        const idToken = hashParams.get('id_token') || queryParams.get('id_token');
        if (!idToken) {
          throw new Error('No id_token returned from Google');
        }
        const credential = GoogleAuthProvider.credential(idToken);
        await signInWithCredential(auth, credential);
        console.log('Google sign-in successful on mobile');
        return { success: true };
      }
      if (wbResult.type === 'cancel' || wbResult.type === 'dismiss') {
        throw new Error('Google authentication was cancelled');
      }
      throw new Error('Google authentication failed');
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
      // Mobile platform - Use implicit flow for an access token, then sign in with Firebase
      if (!FACEBOOK_APP_ID) {
        throw new Error('Facebook App ID not configured for mobile');
      }

      const redirectUri = (AuthSession.makeRedirectUri as any)({ useProxy: true });

      const authUrl = `https://www.facebook.com/v18.0/dialog/oauth?client_id=${encodeURIComponent(
        FACEBOOK_APP_ID
      )}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=token&scope=${encodeURIComponent(
        'public_profile,email'
      )}`;

      const wbResult = await WebBrowser.openAuthSessionAsync(authUrl, redirectUri);

      if (wbResult.type === 'success' && wbResult.url) {
        const fragment = wbResult.url.split('#')[1] || '';
        const params = new URLSearchParams(fragment);
        const accessToken = params.get('access_token');

        if (!accessToken) {
          throw new Error('No access token returned from Facebook');
        }

        const credential = FacebookAuthProvider.credential(accessToken);
        await signInWithCredential(auth, credential);

        console.log('Facebook sign-in successful on mobile');
        return { success: true };
      }
      if (wbResult.type === 'cancel' || wbResult.type === 'dismiss') {
        throw new Error('Facebook authentication was cancelled');
      }
      throw new Error('Facebook authentication failed');
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
