import { AuthProvider, useAuthContext } from '@/components/AuthContext';
import { Colors } from '@/constants/Colors';
import { ThemeProvider, useTheme } from '@/hooks/useTheme';
import { useFonts } from 'expo-font';
import { Stack, useRouter, useSegments } from 'expo-router';
import { useEffect, useRef } from 'react';

function RootLayoutNav() {
  const { loading, isAuthenticated } = useAuthContext();
  const segments = useSegments();
  const router = useRouter();
  const lastAuthState = useRef<boolean | null>(null);
  const { theme } = useTheme();
  const colors = Colors[theme ?? 'light'];

  useEffect(() => {
    if (loading) return;
    if (lastAuthState.current === isAuthenticated) return; // Prevent unnecessary navigation
    
    lastAuthState.current = isAuthenticated;
    const currentSegment = segments[0];

    if (!isAuthenticated) {
      if (currentSegment !== 'splash' && currentSegment !== 'auth' && currentSegment !== '(auth)') {
        router.replace('/auth' as any); // Redirect to auth screen
      }
    } else if (isAuthenticated && currentSegment === '(auth)') {
      router.replace('/(tabs)' as any); // Redirect to tabs if authenticated and in auth group
    }
  }, [isAuthenticated, loading, segments, router]);

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
