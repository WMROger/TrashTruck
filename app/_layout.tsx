import { AuthProvider, useAuthContext } from '@/components/AuthContext';
import { db } from '@/config/firebase';
import { ThemeProvider } from '@/hooks/useTheme';
import '@/services/notificationService';
import { getTransitionConfig } from '@/utils/transitions';
import { useFonts } from 'expo-font';
import { Stack, useRouter, useSegments } from 'expo-router';
import { doc, getDoc } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { isDictEmail, ensureDictProfileInFirestore } from '@/constants/dictConfig';

function RootLayoutNav() {
  const { loading, isAuthenticated, user } = useAuthContext();
  const segments = useSegments();
  const router = useRouter();
  const [userRole, setUserRole] = useState<string | null>(null);
  const [roleLoading, setRoleLoading] = useState(false);
  const [roleResolvedForUid, setRoleResolvedForUid] = useState<string | null>(null);

  // Resolve user role for access control
  useEffect(() => {
    const checkUserRole = async () => {
      if (!user || !db) {
        setUserRole(null);
        setRoleResolvedForUid(null);
        setRoleLoading(false);
        return;
      }

      setRoleLoading(true);
      try {
        if (isDictEmail(user.email)) {
          await ensureDictProfileInFirestore(user.uid, user.email || 'dict@trashtrack.gov.ph', user.displayName || 'DICT Super Admin');
          setUserRole('dict');
        } else {
          const userRef = doc(db, 'users', user.uid);
          const userSnap = await getDoc(userRef);
          setUserRole(userSnap.exists() ? String(userSnap.data().role || 'user') : 'user');
        }
      } catch (error) {
        console.error('Error checking user role:', error);
        setUserRole(isDictEmail(user.email) ? 'dict' : 'user');
      } finally {
        setRoleResolvedForUid(user.uid);
        setRoleLoading(false);
      }
    };

    checkUserRole();
  }, [user]);

  useEffect(() => {
    if (loading || (isAuthenticated && (roleLoading || roleResolvedForUid !== user?.uid))) return;
    const currentSegment = segments[0];

    if (!isAuthenticated) {
      // Unauthenticated access
      if (currentSegment === 'admin') {
        // Admin segment: allow explicit navigation to admin screens
      } else if (currentSegment === 'dict') {
        // DICT portal requires admin/dict login
        router.replace('/admin/login' as any);
      } else {
        // Regular user portal: redirect to /auth if not on allowed entry routes
        if (currentSegment !== 'splash' && currentSegment !== 'auth' && currentSegment !== '(auth)' && currentSegment !== 'driver-login') {
          router.replace('/auth' as any);
        }
      }
    } else if (isAuthenticated) {
      // Authenticated access
      if (currentSegment === 'admin') {
        // Only allow users with admin role in /admin
        if (userRole !== 'admin') {
          router.replace('/home' as any);
        }
      } else if (currentSegment === 'dict') {
        // Only allow users with dict role in /dict
        if (userRole !== 'dict') {
          router.replace('/home' as any);
        }
      } else {
        // Regular user app: redirect splash / auth screens to home
        if (currentSegment === 'splash' || currentSegment === 'auth') {
          router.replace('/home' as any);
        }
      }
    }
  }, [userRole, isAuthenticated, loading, roleLoading, roleResolvedForUid, segments, router, user?.uid]);

  // Route-scoped global font: Poppins on admin/dict, Plus Jakarta Sans & Inter elsewhere
  useEffect(() => {
    const currentSegment = segments[0];
    const isAdminRoute = currentSegment === 'admin' || currentSegment === 'dict';

    const adminFont = Platform.select({
      web: "'Poppins', 'Plus Jakarta Sans', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      ios: 'Poppins',
      android: 'Poppins',
      default: 'System',
    }) as string;

    const modernFontStack = Platform.select({
      web: "'Plus Jakarta Sans', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
      ios: 'System',
      android: 'Roboto',
      default: 'System',
    }) as string;

    const targetFont = isAdminRoute ? adminFont : modernFontStack;

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
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
          text-rendering: optimizeLegibility;
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
      const defaultFont = "'Plus Jakarta Sans', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

      const style = document.createElement('style');
      style.textContent = `
        /* Apply font to text elements only — NOT to all elements,
           as that would override icon fonts (Ionicons, MaterialIcons, etc.)
           NOTE: no !important here — React Native Web's inline styles on
           icon <Text> components will naturally override this CSS rule. */
        body, button, input, select, textarea,
        p, span, div, h1, h2, h3, h4, h5, h6, a, label, li, td, th {
          font-family: ${defaultFont};
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
          text-rendering: optimizeLegibility;
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
