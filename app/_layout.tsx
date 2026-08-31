import { AuthProvider, useAuthContext } from '@/components/AuthContext';
import RequireChangePasswordModal from '@/components/RequireChangePasswordModal';
import { db } from '@/config/firebase';
import { ThemeProvider } from '@/hooks/useTheme';
import '@/services/notificationService';
import { getTransitionConfig } from '@/utils/transitions';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFonts } from 'expo-font';
import { Stack, useRouter, useSegments } from 'expo-router';
import { doc, getDoc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { LogBox, Platform } from 'react-native';
import { isCictoEmail, ensureCictoProfileInFirestore } from '@/constants/cictoConfig';
import * as SplashScreen from 'expo-splash-screen';

SplashScreen.preventAutoHideAsync().catch(() => {});

async function ensureCenroProfileInFirestore(
  uid: string,
  email: string,
  displayName: string = 'CENRO Admin',
): Promise<void> {
  if (!db) return;
  try {
    const userRef = doc(db, 'users', uid);
    await setDoc(
      userRef,
      {
        uid,
        email,
        displayName,
        name: displayName,
        role: 'admin',
        verified: true,
        status: 'active',
        department: 'City Environment and Natural Resources Office (CENRO Danao)',
        agency: 'CENRO Danao City',
        updatedAt: serverTimestamp(),
        lastLogin: serverTimestamp(),
      },
      { merge: true },
    );
  } catch (error) {
    console.warn('Could not auto-heal CENRO profile in layout:', error);
  }
}

LogBox.ignoreLogs([
  'You are initializing Firebase Auth for React Native without providing AsyncStorage',
  'expo-notifications: Android Push notifications',
  '`expo-notifications` functionality is not fully supported in Expo Go',
  'setBackgroundColorAsync is not supported with edge-to-edge enabled',
  '`setBackgroundColorAsync` is not supported with edge-to-edge enabled',
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
  const [isLayoutMounted, setIsLayoutMounted] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [roleLoading, setRoleLoading] = useState(false);
  const [roleResolvedForUid, setRoleResolvedForUid] = useState<string | null>(null);
  const [mustChangePassword, setMustChangePassword] = useState(false);

  const [loaded, fontError] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  useEffect(() => {
    setIsLayoutMounted(true);
  }, []);

  useEffect(() => {
    if (loaded || fontError) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [loaded, fontError]);

  // Listen for mustChangePassword and 24-hour snooze time limit on authenticated user profile
  useEffect(() => {
    if (!user?.uid || !db) {
      setMustChangePassword(false);
      return;
    }

    const evaluatePasswordRequirement = (data: any) => {
      if (data?.mustChangePassword === true) {
        const now = Date.now();
        let isSnoozed = false;

        // Verified Firestore server-side snooze timestamp
        const firestoreSnooze = typeof data?.passwordChangeSnoozedUntil === 'number'
          ? data.passwordChangeSnoozedUntil
          : (data?.passwordChangeSnoozedUntil?.toMillis ? data.passwordChangeSnoozedUntil.toMillis() : null);

        if (firestoreSnooze && now < firestoreSnooze) {
          isSnoozed = true;
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

  const [driverHasShift, setDriverHasShift] = useState(false);

  // Resolve user role for access control
  useEffect(() => {
    let isMounted = true;
    if (!user || !db) {
      setUserRole(null);
      setDriverHasShift(false);
      setRoleResolvedForUid(null);
      setRoleLoading(false);
      return;
    }

    setRoleLoading(true);
    const userRef = doc(db, 'users', user.uid);
    const unsub = onSnapshot(userRef, (userSnap) => {
      if (!isMounted) return;
      if (isCictoEmail(user.email)) {
        setUserRole('cicto');
        setDriverHasShift(false);
        if (!userSnap.exists()) {
          ensureCictoProfileInFirestore(user.uid, user.email || 'cicto@trashtrack.gov.ph', user.displayName || 'CICTO Super Admin');
        }
      } else if (userSnap.exists()) {
        const data = userSnap.data();
        const r = String(data?.role || 'user');
        setUserRole(r);
        const hasShift = data?.dutyStatus === 'on_duty' || data?.status === 'on_duty' || !!data?.currentTruckId;
        setDriverHasShift(hasShift);
      } else {
        const emailLower = (user.email || '').toLowerCase();
        const isKnownAdmin = emailLower.startsWith('admin@') || emailLower.startsWith('cenro@') || emailLower.includes('admin') || emailLower.includes('cenro');
        if (isKnownAdmin) {
          setUserRole('admin');
          ensureCenroProfileInFirestore(user.uid, user.email || 'admin@admin.com', user.displayName || 'CENRO Admin');
        } else {
          setUserRole('user');
        }
        setDriverHasShift(false);
      }
      setRoleResolvedForUid(user.uid);
      setRoleLoading(false);
    }, (error) => {
      if (!isMounted) return;
      console.warn('Error checking user role:', error);
      setUserRole(isCictoEmail(user.email) ? 'cicto' : 'user');
      setDriverHasShift(false);
      setRoleResolvedForUid(user.uid);
      setRoleLoading(false);
    });

    return () => {
      isMounted = false;
      unsub();
    };
  }, [user?.uid]);

  useEffect(() => {
    if (!isLayoutMounted || (!loaded && !fontError) || loading || (user && (roleLoading || roleResolvedForUid !== user?.uid))) return;

    const segmentList = segments as string[];
    const currentSegment = segmentList[0];
    const secondSegment = segmentList[1];

    // Never hijack the (auth)/loading screen — it runs its own sign-in flow
    // with progress animation and navigates when complete.
    if (currentSegment === '(auth)' && secondSegment === 'loading') return;

    const segmentStr = String(currentSegment || '');
    if (!isAuthenticated) {
      // Unauthenticated access
      if (
        !currentSegment ||
        segmentStr === 'admin' ||
        segmentStr.toLowerCase() === 'cenro' ||
        segmentStr.toLowerCase() === 'cicto' ||
        segmentStr === 'splash' ||
        segmentStr === 'auth' ||
        segmentStr === '(auth)' ||
        segmentStr === 'driver-login'
      ) {
        // Allow unauthenticated portal access to login screens
      } else {
        // Regular user portal: redirect to /auth if on a protected route
        router.replace('/auth' as any);
      }
    } else if (isAuthenticated) {
      const emailLower = (user?.email || '').toLowerCase();
      const isCenroAdmin =
        userRole === 'admin' ||
        userRole === 'cenro' ||
        userRole === 'coordinator' ||
        userRole === 'cenro_officer' ||
        emailLower.startsWith('admin@') ||
        emailLower.startsWith('cenro@') ||
        emailLower.includes('admin') ||
        emailLower.includes('cenro') ||
        emailLower.includes('coord');
      const isCictoAdmin =
        userRole === 'cicto' ||
        userRole === 'cicto_admin' ||
        isCictoEmail(emailLower);

      // Authenticated access
      if (segmentStr === 'admin' || segmentStr.toLowerCase() === 'cenro') {
        if (secondSegment === 'dashboard') {
          if (!isCenroAdmin) {
            router.replace('/cenro' as any);
          }
        } else if (isCenroAdmin && (segmentStr.toLowerCase() === 'cenro' || secondSegment === 'login' || secondSegment === 'index' || !secondSegment)) {
          router.replace('/admin/dashboard' as any);
        }
      } else if (segmentStr.toLowerCase() === 'cicto') {
        if (secondSegment === 'dashboard') {
          if (!isCictoAdmin) {
            router.replace('/cicto' as any);
          }
        } else if (isCictoAdmin && (segmentList.length === 1 || secondSegment === 'login' || secondSegment === 'index' || !secondSegment)) {
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
            (!currentSegment && segmentList.length === 0)
          ) {
            if (driverHasShift) {
              router.replace('/(driver)' as any);
            } else {
              router.replace('/(tabs)/home' as any);
            }
          } else if (currentSegment === '(tabs)' && driverHasShift) {
            // Keep on-duty driver in driver portal to complete their active shift
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
            router.replace('/(tabs)/home' as any);
          }
        }
      }
    }
  }, [userRole, driverHasShift, isAuthenticated, loading, roleLoading, roleResolvedForUid, segments, router, user?.uid]);

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
