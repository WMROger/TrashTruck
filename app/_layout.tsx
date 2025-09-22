import { AuthProvider, useAuthContext } from '@/components/AuthContext';
import { db } from '@/config/firebase';
import { Colors } from '@/constants/Colors';
import { ThemeProvider, useTheme } from '@/hooks/useTheme';
import { useFonts } from 'expo-font';
import { Stack, useRouter, useSegments } from 'expo-router';
import { doc, getDoc } from 'firebase/firestore';
import { useEffect, useRef, useState } from 'react';
import { Platform, Text, TextInput, useWindowDimensions } from 'react-native';

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
        // Desktop: redirect to admin login
        if (currentSegment !== 'admin') {
          router.replace('/admin/login' as any);
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

    if (!Text.defaultProps) Text.defaultProps = {};
    if (!Text.defaultProps.style) Text.defaultProps.style = {} as any;
    (Text.defaultProps.style as any).fontFamily = targetFont;

    if (!TextInput.defaultProps) TextInput.defaultProps = {} as any;
    if (!TextInput.defaultProps.style) TextInput.defaultProps.style = {} as any;
    (TextInput.defaultProps.style as any).fontFamily = targetFont;
  }, [segments]);

  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  if (!loaded || loading) {
    // Async font loading only occurs in development.
    return null;
  }

  return (
    <Stack initialRouteName="splash">
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="splash" options={{ headerShown: false }} />
      <Stack.Screen name="auth" options={{ headerShown: false }} />
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="(driver)" options={{ headerShown: false }} />
      <Stack.Screen name="profile" options={{ headerShown: false, presentation: 'modal' }} />
      <Stack.Screen name="test-tabs" options={{ headerShown: false }} />
      <Stack.Screen name="admin" options={{ headerShown: false }} />
      <Stack.Screen name="+not-found" />
    </Stack>
  );
}

export default function RootLayout() {
  // Set global default fonts (SF Pro system on iOS, sans-serif on Android)
  if (!Text.defaultProps) Text.defaultProps = {};
  if (!Text.defaultProps.style) Text.defaultProps.style = {} as any;
  const textStyle = Text.defaultProps.style as any;
  if (!textStyle.fontFamily) {
    textStyle.fontFamily = Platform.select({
      ios: 'System',
      android: 'Roboto',
      web: 'SF Pro, SF Pro Display, -apple-system, system-ui, Segoe UI, Roboto, Helvetica Neue, Arial, sans-serif',
      default: 'System',
    }) as string;
  }

  if (!TextInput.defaultProps) TextInput.defaultProps = {} as any;
  if (!TextInput.defaultProps.style) TextInput.defaultProps.style = {} as any;
  const inputStyle = TextInput.defaultProps.style as any;
  if (!inputStyle.fontFamily) {
    inputStyle.fontFamily = Platform.select({
      ios: 'System',
      android: 'Roboto',
      web: 'SF Pro, SF Pro Display, -apple-system, system-ui, Segoe UI, Roboto, Helvetica Neue, Arial, sans-serif',
      default: 'System',
    }) as string;
  }

  return (
    <ThemeProvider>
      <AuthProvider>
        <RootLayoutNav />
      </AuthProvider>
    </ThemeProvider>
  );
}
