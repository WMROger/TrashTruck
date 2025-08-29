import { AuthProvider, useAuthContext } from '@/components/AuthContext';
import { db } from '@/config/firebase';
import { Colors } from '@/constants/Colors';
import { ThemeProvider, useTheme } from '@/hooks/useTheme';
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
      if (isDesktopWeb) {
        if (currentSegment !== 'admin') {
          router.replace('/admin/login' as any);
        }
      } else {
        if (currentSegment !== 'splash' && currentSegment !== 'auth' && currentSegment !== '(auth)') {
          router.replace('/auth' as any);
        }
      }
    } else if (isAuthenticated && (currentSegment === '(auth)' || currentSegment === 'admin')) {
      // Don't redirect admin users away from admin section
      if (currentSegment === 'admin' && isAdmin) {
        // Admin user in admin section - let them stay
        return;
      }
      // Regular user or admin user in auth section - redirect to tabs
      router.replace('/(tabs)' as any);
    }
  }, [isAuthenticated, loading, segments, router, isDesktopWeb, isAdmin]);

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
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="test-tabs" options={{ headerShown: false }} />
      <Stack.Screen name="admin" options={{ headerShown: false }} />
      <Stack.Screen name="+not-found" />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <RootLayoutNav />
      </AuthProvider>
    </ThemeProvider>
  );
}
