import { AuthProvider, useAuthContext } from '@/components/AuthContext';
import { db } from '@/config/firebase';
import { Colors } from '@/constants/Colors';
import { ThemeProvider, useTheme } from '@/hooks/useTheme';
import { getTransitionConfig } from '@/utils/transitions';
import { useFonts } from 'expo-font';
import { Stack, useRouter, useSegments } from 'expo-router';
import { doc, getDoc } from 'firebase/firestore';
import { useEffect, useRef, useState } from 'react';
import { Platform, useWindowDimensions } from 'react-native';

function RootLayoutNav() {
  const { loading, isAuthenticated, user } = useAuthContext();
  const segments = useSegments();
  const router = useRouter();
  const lastAuthState = useRef<boolean | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const { theme } = useTheme();
  const colors = Colors[theme ?? 'light'];
  const { width } = useWindowDimensions();
  const isDesktopWeb = Platform.OS === 'web' && width >= 1024;

  // Check if user has admin role
  useEffect(() => {
    const checkAdminRole = async () => {
      if (!user || !db) {
        setIsAdmin(false);
        return;
      }

      try {
        const userRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userRef);
        
        if (userSnap.exists()) {
          const userData = userSnap.data();
          setIsAdmin(userData.role === 'admin');
        } else {
          setIsAdmin(false);
        }
      } catch (error) {
        console.error('Error checking admin role:', error);
        setIsAdmin(false);
      }
    };

    checkAdminRole();
  }, [user]);

  useEffect(() => {
    if (loading) return;
    if (lastAuthState.current === isAuthenticated) return; // Prevent unnecessary navigation

    lastAuthState.current = isAuthenticated;
    const currentSegment = segments[0];

    if (!isAuthenticated) {
      // Not authenticated - redirect to appropriate login
      if (isDesktopWeb) {
        // Desktop: redirect to admin splash screen
        if (currentSegment !== 'admin') {
          router.replace('/admin/splash' as any);
        }
      } else {
        // Mobile: redirect to user auth
        if (currentSegment !== 'splash' && currentSegment !== 'auth' && currentSegment !== '(auth)') {
          router.replace('/auth' as any);
        }
      }
    } else if (isAuthenticated) {
      // Authenticated - redirect based on device type
      if (isDesktopWeb) {
        // Desktop: redirect to admin dashboard
        if (currentSegment !== 'admin') {
          router.replace('/admin/dashboard' as any);
        }
      } else {
        // Mobile: redirect to user tabs (but allow loading page to show first)
        if (currentSegment === 'admin' || currentSegment === 'splash') {
          router.replace('/home' as any);
        }
        // Don't redirect if user is on loading page - let it handle its own navigation
      }
    }
  }, [isAuthenticated, loading, segments, router, isDesktopWeb, isAdmin]);

  // Route-scoped global font: Poppins on admin, SF Pro stack elsewhere
  useEffect(() => {
    const currentSegment = segments[0];
    const isAdminRoute = currentSegment === 'admin';

    const adminFont = Platform.select({
      web: 'Poppins, -apple-system, system-ui, Segoe UI, Roboto, Helvetica Neue, Arial, sans-serif',
      ios: 'Poppins',
      android: 'Poppins',
      default: 'System',
    }) as string;

    const sfProStack = Platform.select({
      web: 'SF Pro, SF Pro Display, -apple-system, system-ui, Segoe UI, Roboto, Helvetica Neue, Arial, sans-serif',
      ios: 'System',
      android: 'Roboto', // Closest system match to SF Pro on Android
      default: 'System',
    }) as string;

    const targetFont = isAdminRoute ? adminFont : sfProStack;

    // Set global font styles using style injection (web only)
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const style = document.createElement('style');
      style.textContent = `
        * {
          font-family: ${targetFont} !important;
        }
      `;
      document.head.appendChild(style);

      return () => {
        if (document.head.contains(style)) {
          document.head.removeChild(style);
        }
      };
    }
  }, [segments]);

  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  if (!loaded || loading) {
    // Async font loading only occurs in development.
    return null;
  }

  return (
    <Stack 
      initialRouteName="splash"
      screenOptions={getTransitionConfig('slideFromRight')}
    >
      <Stack.Screen 
        name="index" 
        options={{ 
          headerShown: false,
          ...getTransitionConfig('fade'),
        }} 
      />
      <Stack.Screen 
        name="splash" 
        options={{ 
          headerShown: false,
          ...getTransitionConfig('fade'),
        }} 
      />
      <Stack.Screen 
        name="auth" 
        options={{ 
          headerShown: false,
          ...getTransitionConfig('slideFromRight'),
        }} 
      />
      <Stack.Screen 
        name="(auth)" 
        options={{ 
          headerShown: false,
          ...getTransitionConfig('auth'),
        }} 
      />
      <Stack.Screen 
        name="(tabs)" 
        options={{ 
          headerShown: false,
          ...getTransitionConfig('slideFromRight'),
        }} 
      />
      <Stack.Screen 
        name="(driver)" 
        options={{ 
          headerShown: false,
          ...getTransitionConfig('slideFromRight'),
        }} 
      />
      <Stack.Screen 
        name="profile" 
        options={{ 
          headerShown: false, 
          ...getTransitionConfig('slideFromRight'),
        }} 
      />
      <Stack.Screen 
        name="test-tabs" 
        options={{ 
          headerShown: false,
          ...getTransitionConfig('slideFromRight'),
        }} 
      />
      <Stack.Screen 
        name="admin" 
        options={{ 
          headerShown: false,
          ...getTransitionConfig('admin'),
        }} 
      />
      <Stack.Screen 
        name="+not-found" 
        options={{
          ...getTransitionConfig('fade'),
        }}
      />
    </Stack>
  );
}

export default function RootLayout() {
  // Set global default fonts using CSS for web platform
  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const defaultFont = Platform.select({
        web: 'SF Pro, SF Pro Display, -apple-system, system-ui, Segoe UI, Roboto, Helvetica Neue, Arial, sans-serif',
        default: 'System',
      }) as string;

      const style = document.createElement('style');
      style.textContent = `
        * {
          font-family: ${defaultFont} !important;
        }
        /* Desktop web: force Material Icons font ONLY for actual icon elements */
        [style*="font-family: material"][style*="font-size: 24px"],
        [style*="font-family: material"][style*="font-size: 20px"],
        [style*="font-family: material"][style*="font-size: 18px"],
        [style*="font-family: material"][style*="font-size: 16px"] {
          font-family: 'Material Icons' !important;
          font-style: normal !important;
          font-weight: normal !important;
          font-variant: normal !important;
          text-transform: none !important;
          line-height: 1 !important;
          letter-spacing: normal !important;
          direction: ltr !important;
          -webkit-font-feature-settings: 'liga';
          -webkit-font-smoothing: antialiased;
        }
      `;
      document.head.appendChild(style);

      return () => {
        if (document.head.contains(style)) {
          document.head.removeChild(style);
        }
      };
    }
  }, []);

  return (
    <ThemeProvider>
      <AuthProvider>
        <RootLayoutNav />
      </AuthProvider>
    </ThemeProvider>
  );
}
