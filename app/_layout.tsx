import { AuthProvider, useAuthContext } from '@/components/AuthContext';
import RequireChangePasswordModal from '@/components/RequireChangePasswordModal';
import { db } from '@/config/firebase';
import { ThemeProvider } from '@/hooks/useTheme';
import '@/services/notificationService';
import { getTransitionConfig } from '@/utils/transitions';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFonts } from 'expo-font';
import { Stack, useRouter, useSegments } from 'expo-router';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { LogBox, Platform } from 'react-native';
import { isCictoEmail, ensureCictoProfileInFirestore } from '@/constants/cictoConfig';

LogBox.ignoreLogs([
  'You are initializing Firebase Auth for React Native without providing AsyncStorage',
  'expo-notifications: Android Push notifications',
  '`expo-notifications` functionality is not fully supported in Expo Go',
  'SafeAreaView has been deprecated',
  'TouchableMixin is deprecated',
  'Invalid DOM property `transform-origin`',
  'Unknown event handler property `onStartShouldSetResponder`',
  'Unknown event handler property `onResponderGrant`',
  'Unknown event handler property `onResponderMove`',
  'Unknown event handler property `onResponderRelease`',
  'Unknown event handler property `onResponderTerminate`',
  'Unknown event handler property `onResponderTerminationRequest`',
]);

// Filter out benign React DOM web warnings caused by third-party react-native-chart-kit SVG elements
if (Platform.OS === 'web' && typeof window !== 'undefined') {
  const isBenignWarning = (args: any[]) => {
    const text = args.map(a => (typeof a === 'string' ? a : (a?.message || ''))).join(' ');
    return (
      text.includes('transform-origin') ||
      text.includes('onResponder') ||
      text.includes('onStartShouldSetResponder') ||
      text.includes('onPressIn') ||
      text.includes('TouchableMixin') ||
      text.includes('pointerEvents is deprecated') ||
      text.includes('useNativeDriver` is not supported')
    );
  };

  const originalConsoleError = console.error;
  console.error = (...args: any[]) => {
    if (isBenignWarning(args)) return;
    originalConsoleError(...args);
  };

  const originalConsoleWarn = console.warn;
  console.warn = (...args: any[]) => {
    if (isBenignWarning(args)) return;
    originalConsoleWarn(...args);
  };
}

function RootLayoutNav() {
  const { loading, isAuthenticated, user } = useAuthContext();
  const segments = useSegments();
  const router = useRouter();
  const [userRole, setUserRole] = useState<string | null>(null);
  const [roleLoading, setRoleLoading] = useState(false);
  const [roleResolvedForUid, setRoleResolvedForUid] = useState<string | null>(null);
  const [mustChangePassword, setMustChangePassword] = useState(false);

  // Listen for mustChangePassword and 24-hour snooze time limit on authenticated user profile
  useEffect(() => {
    if (!user?.uid || !db) {
      setMustChangePassword(false);
      return;
    }

    const evaluatePasswordRequirement = async (data: any) => {
      if (data?.mustChangePassword === true) {
        const now = Date.now();
        let isSnoozed = false;

        // 1. Check Firestore snooze timestamp
        const firestoreSnooze = typeof data?.passwordChangeSnoozedUntil === 'number'
          ? data.passwordChangeSnoozedUntil
          : (data?.passwordChangeSnoozedUntil?.toMillis ? data.passwordChangeSnoozedUntil.toMillis() : null);

        if (firestoreSnooze && now < firestoreSnooze) {
          isSnoozed = true;
        }

        // 2. Check local device snooze fallback
        if (!isSnoozed) {
          try {
            const localSnoozeStr = await AsyncStorage.getItem(`@trashtrack_pwd_snooze_${user.uid}`);
            if (localSnoozeStr) {
              const localSnooze = parseInt(localSnoozeStr, 10);
              if (localSnooze && now < localSnooze) {
                isSnoozed = true;
              }
            }
          } catch {}
        }

        setMustChangePassword(!isSnoozed);
      } else {
        setMustChangePassword(false);
      }
    };

    const userRef = doc(db, 'users', user.uid);
    const unsub = onSnapshot(userRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        evaluatePasswordRequirement(data);
      } else {
        setMustChangePassword(false);
      }
    }, (err) => {
      if (err?.code !== 'permission-denied') {
        console.warn('RootLayoutNav: user profile listener error:', err);
      }
    });
    return () => unsub();
  }, [user?.uid]);

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
        if (isCictoEmail(user.email)) {
          await ensureCictoProfileInFirestore(user.uid, user.email || 'cicto@trashtrack.gov.ph', user.displayName || 'CICTO Super Admin');
          setUserRole('cicto');
        } else {
          const userRef = doc(db, 'users', user.uid);
          const userSnap = await getDoc(userRef);
          setUserRole(userSnap.exists() ? String(userSnap.data().role || 'user') : 'user');
        }
      } catch (error) {
        console.error('Error checking user role:', error);
        setUserRole(isCictoEmail(user.email) ? 'cicto' : 'user');
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

    const segmentStr = String(currentSegment || '');
    if (!isAuthenticated) {
      // Unauthenticated access
      if (
        segmentStr === 'admin' ||
        segmentStr.toLowerCase() === 'cenro' ||
        segmentStr.toLowerCase() === 'cicto'
      ) {
        // Allow unauthenticated portal access to login screens
      } else {
        // Regular user portal: redirect to /auth if not on allowed entry routes
        if (currentSegment !== 'splash' && currentSegment !== 'auth' && currentSegment !== '(auth)' && currentSegment !== 'driver-login') {
          router.replace('/auth' as any);
        }
      }
    } else if (isAuthenticated) {
      const isCenroAdmin =
        userRole === 'admin' ||
        userRole === 'cenro' ||
        userRole === 'coordinator' ||
        userRole === 'cenro_officer';
      const isCictoAdmin =
        userRole === 'cicto' ||
        userRole === 'cicto_admin';

      // Authenticated access
      if (segmentStr === 'admin' || segmentStr.toLowerCase() === 'cenro') {
        if (segments[1] === 'dashboard') {
          if (!isCenroAdmin) {
            router.replace('/cenro' as any);
          }
        } else if (isCenroAdmin && (segmentStr.toLowerCase() === 'cenro' || segments[1] === 'login' || !segments[1])) {
          router.replace('/admin/dashboard' as any);
        }
      } else if (segmentStr.toLowerCase() === 'cicto') {
        if (segments[1] === 'dashboard') {
          if (!isCictoAdmin) {
            router.replace('/cicto' as any);
          }
        } else if (isCictoAdmin && (segments.length === 1 || segments[1] === 'login')) {
          router.replace('/cicto/dashboard' as any);
        }
      } else {
        // Route according to user role
        if (userRole === 'driver') {
          if (
            currentSegment === 'splash' ||
            currentSegment === 'auth' ||
            currentSegment === '(auth)' ||
            currentSegment === 'driver-login' ||
            !currentSegment
          ) {
            router.replace('/(driver)' as any);
          }
        } else if (isCenroAdmin) {
          if (
            currentSegment === 'splash' ||
            currentSegment === 'auth' ||
            currentSegment === '(auth)' ||
            currentSegment === 'driver-login'
          ) {
            router.replace('/admin/dashboard' as any);
          }
        } else if (isCictoAdmin) {
          if (
            currentSegment === 'splash' ||
            currentSegment === 'auth' ||
            currentSegment === '(auth)' ||
            currentSegment === 'driver-login'
          ) {
            router.replace('/cicto/dashboard' as any);
          }
        } else {
          // Resident user
          if (
            currentSegment === 'splash' ||
            currentSegment === 'auth' ||
            currentSegment === '(auth)' ||
            currentSegment === 'driver-login'
          ) {
            router.replace('/home' as any);
          }
        }
      }
    }
  }, [userRole, isAuthenticated, loading, roleLoading, roleResolvedForUid, segments, router, user?.uid]);

  // Route-scoped global font: Poppins on admin/cicto/cenro, Plus Jakarta Sans & Inter elsewhere
  useEffect(() => {
    const segmentStr = String(segments[0] || '').toLowerCase();
    const isAdminRoute =
      segmentStr === 'admin' ||
      segmentStr === 'cicto' ||
      segmentStr === 'cenro';

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
    <>
      <Stack 
        initialRouteName="splash"
      screenOptions={{
        headerShown: false,
        ...getTransitionConfig('slideFromRight'),
      }}
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
        name="cenro" 
        options={{ 
          headerShown: false,
          ...getTransitionConfig('admin'),
        }} 
      />
      <Stack.Screen 
        name="CENRO" 
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
        name="cicto"
        options={{
          headerShown: false,
          ...getTransitionConfig('admin'),
        }}
      />
      <Stack.Screen
        name="CICTO"
        options={{
          headerShown: false,
          ...getTransitionConfig('admin'),
        }}
      />
      <Stack.Screen 
        name="+not-found" 
        options={{
          headerShown: false,
          ...getTransitionConfig('fade'),
        }} 
      />
    </Stack>
    <RequireChangePasswordModal
      visible={mustChangePassword}
      user={user}
      onSuccess={() => setMustChangePassword(false)}
      onSnooze={() => setMustChangePassword(false)}
    />
    </>
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
