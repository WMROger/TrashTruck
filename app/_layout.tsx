import { AuthProvider, useAuthContext } from '@/components/AuthContext';
import { db } from '@/config/firebase';
import { ThemeProvider } from '@/hooks/useTheme';
import '@/services/notificationService';
import { getTransitionConfig } from '@/utils/transitions';
import { useFonts } from 'expo-font';
import { Stack, useRouter, useSegments } from 'expo-router';
import { doc, getDoc } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { Platform, useWindowDimensions } from 'react-native';

function RootLayoutNav() {
  const { loading, isAuthenticated, user } = useAuthContext();
  const segments = useSegments();
  const router = useRouter();
  const [desktopRole, setDesktopRole] = useState<string | null>(null);
  const [roleLoading, setRoleLoading] = useState(false);
  const [roleResolvedForUid, setRoleResolvedForUid] = useState<string | null>(null);
  const { width } = useWindowDimensions();
  const isDesktopWeb = Platform.OS === 'web' && width >= 1024;

  // Resolve the desktop portal before routing. DICT previously got redirected
  // to the CENRO dashboard because this check only tracked an admin boolean.
  useEffect(() => {
    const checkDesktopRole = async () => {
      if (!user || !db) {
        setDesktopRole(null);
        setRoleResolvedForUid(null);
        setRoleLoading(false);
        return;
      }

      setRoleLoading(true);
      try {
        const userRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userRef);
        setDesktopRole(userSnap.exists() ? String(userSnap.data().role || 'user') : 'user');
      } catch (error) {
        console.error('Error checking desktop portal role:', error);
        setDesktopRole('user');
      } finally {
        setRoleResolvedForUid(user.uid);
        setRoleLoading(false);
      }
    };

    checkDesktopRole();
  }, [user]);

  useEffect(() => {
    if (loading || (isAuthenticated && (roleLoading || roleResolvedForUid !== user?.uid))) return;
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
          if (currentSegment !== 'splash' && currentSegment !== 'auth' && currentSegment !== '(auth)' && currentSegment !== 'driver-login') {
            router.replace('/auth' as any);
          }
      }
    } else if (isAuthenticated) {
      // Authenticated - redirect based on device type
      if (isDesktopWeb) {
        if (desktopRole === 'dict' && currentSegment !== 'dict') {
          router.replace('/dict/dashboard' as any);
        } else if (desktopRole === 'admin' && currentSegment !== 'admin') {
          router.replace('/admin/dashboard' as any);
        } else if (!['admin', 'dict'].includes(String(desktopRole)) && ['admin', 'dict'].includes(String(currentSegment))) {
          router.replace('/auth' as any);
        }
      } else {
        // Mobile: redirect to user tabs (but allow loading page to show first)
        if (currentSegment === 'admin' || currentSegment === 'splash') {
          router.replace('/home' as any);
        }
        // Don't redirect if user is on loading page - let it handle its own navigation
      }
    }
  }, [desktopRole, isAuthenticated, loading, roleLoading, roleResolvedForUid, segments, router, isDesktopWeb, user?.uid]);

  // Route-scoped global font: Poppins on admin, SF Pro stack elsewhere
  useEffect(() => {
    const currentSegment = segments[0];
    const isAdminRoute = currentSegment === 'admin' || currentSegment === 'dict';

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
        /* Apply font to text elements only — NOT to all elements,
           as that would override icon fonts (Ionicons, MaterialIcons, etc.)
           NOTE: no !important here — React Native Web's inline styles on
           icon <Text> components will naturally override this CSS rule. */
        body, button, input, select, textarea,
        p, span, div, h1, h2, h3, h4, h5, h6, a, label, li, td, th {
          font-family: ${targetFont};
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
        name="my-reports" 
        options={{ 
          headerShown: false,
          ...getTransitionConfig('slideFromRight'),
        }} 
      />
      <Stack.Screen 
        name="settings" 
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
        name="rewards"
        options={{
          headerShown: false,
          ...getTransitionConfig('slideFromRight'),
        }}
      />
      <Stack.Screen
        name="dict"
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
        /* Apply font to text elements only — NOT to all elements,
           as that would override icon fonts (Ionicons, MaterialIcons, etc.)
           NOTE: no !important here — React Native Web's inline styles on
           icon <Text> components will naturally override this CSS rule. */
        body, button, input, select, textarea,
        p, span, div, h1, h2, h3, h4, h5, h6, a, label, li, td, th {
          font-family: ${defaultFont};
        }
        /* Ensure Material Icons ligature font renders correctly */
        .material-icons {
          font-family: 'Material Icons' !important;
          font-feature-settings: 'liga';
          -webkit-font-feature-settings: 'liga';
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
