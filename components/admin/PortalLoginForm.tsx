import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import {
  browserLocalPersistence,
  browserSessionPersistence,
  onAuthStateChanged,
  sendEmailVerification,
  setPersistence,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import {
  ImageBackground,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AdminButton from './AdminButton';
import AdminInput from './AdminInput';
import AgencySign from './AgencySign';
import ErrorModal from '../ErrorModal';
import { auth, db } from '../../config/firebase';
import {
  isDictIdentifier,
  isDictEmail,
  loginOrBootstrapDictAccount,
  ensureDictProfileInFirestore,
} from '../../constants/dictConfig';

interface PortalLoginFormProps {
  portal: 'cenro' | 'dict';
}

export default function PortalLoginForm({ portal }: PortalLoginFormProps) {
  const isDict = portal === 'dict';
  const router = useRouter();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [keepLoggedIn, setKeepLoggedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorModal, setErrorModal] = useState({
    visible: false,
    title: 'Error',
    message: '',
    type: 'error' as 'error' | 'warning' | 'info' | 'success',
  });

  // If already authenticated with the correct role, redirect immediately via onAuthStateChanged
  useEffect(() => {
    if (!auth || !db) return;

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) return;

      if (isDictEmail(currentUser.email)) {
        router.replace('/dict/dashboard');
        return;
      }

      try {
        const userRef = doc(db, 'users', currentUser.uid);
        const snap = await getDoc(userRef);
        if (snap.exists()) {
          const role = snap.data().role;
          const isCenro = role === 'admin' || role === 'cenro' || role === 'coordinator' || role === 'cenro_officer';
          const isDictAdmin = role === 'dict' || role === 'dict_admin';

          if (isDict && isDictAdmin) {
            router.replace('/dict/dashboard');
          } else if (!isDict && isCenro) {
            router.replace('/admin/dashboard');
          }
        }
      } catch (err) {
        console.warn('Session verification warning in login form:', err);
      }
    });

    return () => unsubscribe();
  }, [isDict, router]);

  const showError = (
    message: string,
    title = 'Error',
    type: 'error' | 'warning' | 'info' | 'success' = 'error',
  ) => {
    setErrorModal({
      visible: true,
      title,
      message,
      type,
    });
  };

  const closeErrorModal = () => {
    setErrorModal(prev => ({ ...prev, visible: false }));
  };

  const handleLogin = async () => {
    if (!username.trim() || !password.trim()) {
      showError('Please enter both username and password', 'Validation Error', 'warning');
      return;
    }

    setIsLoading(true);

    try {
      if (isDict) {
        // --- DICT PORTAL AUTHENTICATION ---
        await setPersistence(
          auth,
          keepLoggedIn ? browserLocalPersistence : browserSessionPersistence,
        );
        const dictUser = await loginOrBootstrapDictAccount(username, password);
        console.log('DICT authentication successful for:', dictUser.email);
        router.replace('/dict/dashboard');
        return;
      } else {
        // --- CENRO PORTAL AUTHENTICATION ---
        const email = username.includes('@')
          ? username.trim().toLowerCase()
          : `${username.trim().toLowerCase()}@admin.com`;

        await setPersistence(
          auth,
          keepLoggedIn ? browserLocalPersistence : browserSessionPersistence,
        );
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        const userIsDict = isDictEmail(user.email);

        if (db) {
          if (userIsDict) {
            await ensureDictProfileInFirestore(
              user.uid,
              user.email || 'dict@trashtrack.gov.ph',
              user.displayName || 'DICT Super Admin',
            );
            router.replace('/dict/dashboard');
            return;
          }

          const userRef = doc(db, 'users', user.uid);
          const userSnap = await getDoc(userRef);

          if (userSnap.exists()) {
            const userData = userSnap.data();
            const userRole = userData.role;

            // Check if temporary access code/password has expired (5-minute limit)
            const nowMillis = Date.now();
            const expiresAtMillis = userData.temporaryPasswordExpiresAt?.toMillis
              ? userData.temporaryPasswordExpiresAt.toMillis()
              : (userData.temporaryPasswordExpiresAt ? new Date(userData.temporaryPasswordExpiresAt).getTime() : null);

            if (userData.mustChangePassword === true && expiresAtMillis && nowMillis > expiresAtMillis) {
              await signOut(auth);
              showError(
                'Your temporary access code/password has expired (valid for 5 minutes). Please contact your DICT administrator to re-provision credentials.',
                'Access Code Expired',
                'error'
              );
              return;
            }

            const isCenroAdmin = userRole === 'admin' || userRole === 'cenro' || userRole === 'coordinator' || userRole === 'cenro_officer';
            const isDictAdmin = userRole === 'dict' || userRole === 'dict_admin';

            if (isCenroAdmin) {
              router.replace('/admin/dashboard');
              return;
            } else if (isDictAdmin) {
              router.replace('/dict/dashboard');
              return;
            } else if (userRole === 'driver') {
              await signOut(auth);
              showError('Driver accounts must use the driver portal.', 'Wrong Portal', 'warning');
              return;
            } else if (userRole === 'user') {
              await signOut(auth);
              showError('This account is registered as a Resident. To access CENRO, create or elevate the account in the DICT Identity & Access dashboard.', 'Resident Account', 'warning');
              return;
            } else {
              await signOut(auth);
              showError('You do not have administrative privileges for this portal.', 'Access Denied', 'error');
              return;
            }
          } else {
            await signOut(auth);
            showError('User profile not found in database.', 'Access Denied', 'error');
            return;
          }
        } else {
          await signOut(auth);
          showError('Authentication service is currently unavailable.', 'Access Error', 'error');
        }
      }
    } catch (error: any) {
      console.error('Portal login error:', error);

      let errorMessage = 'Login failed. Please verify your credentials and try again.';
      if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential') {
        errorMessage = isDict
          ? 'DICT Administrator credentials incorrect.'
          : 'CENRO Admin account not found or password incorrect.';
      } else if (error.code === 'auth/wrong-password') {
        errorMessage = 'Incorrect password.';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'Invalid email address format.';
      } else if (error.code === 'auth/too-many-requests') {
        errorMessage = 'Too many failed login attempts. Please wait a moment and try again.';
      }

      showError(errorMessage, 'Authentication Failed', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0F172A' }}>
      <ImageBackground
        source={require('@/assets/images/admin_login_bg_professional.jpg')}
        style={styles.fullScreenBackground}
        resizeMode="cover"
      >
        <View style={styles.backdropDimmer}>
          <ScrollView
            contentContainerStyle={styles.overlay}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
          <View style={styles.floatingCardContainer}>
            {/* Top Republic Ribbon */}
            <View style={[styles.govRibbonBar, isDict ? styles.govRibbonBarDict : styles.govRibbonBarCenro]}>
              <View style={styles.govRibbonFlagRow}>
                <View style={[styles.flagDot, { backgroundColor: '#0038A8' }]} />
                <View style={[styles.flagDot, { backgroundColor: '#CE1126' }]} />
                <View style={[styles.flagDot, { backgroundColor: '#FCD116' }]} />
                <Text style={[styles.govRibbonText, isDict ? styles.govRibbonTextDict : styles.govRibbonTextCenro]}>
                  {isDict
                    ? 'GOV.PH • REPUBLIC OF THE PHILIPPINES • DICT REGION VII'
                    : 'LGU DANAO • CITY ENVIRONMENT AND NATURAL RESOURCES'}
                </Text>
              </View>
            </View>

            <View
              style={[
                styles.loginFloatingCard,
                isDict ? styles.dictCardAccent : styles.cenroCardAccent,
              ]}
            >
              {/* Minimalist Agency Seal / Sign */}
              <AgencySign type={portal} size="medium" />

              {/* Dynamic Welcome Heading */}
              <View style={styles.headingWrapper}>
                <Text style={[styles.welcomeText, isDict ? styles.dictWelcomeText : styles.cenroWelcomeText]}>
                  {isDict ? 'Welcome back, DICT Admin' : 'Welcome back, CENRO Admin'}
                </Text>
                <Text style={styles.portalSubtitle}>
                  {isDict
                    ? 'Enter your DICT administrative credentials to access system oversight, audits, and user governance.'
                    : 'Enter your CENRO administrator credentials to access waste operations and fleet dispatch.'}
                </Text>
              </View>

              {/* Login Form */}
              <View style={styles.form}>
                <AdminInput
                  placeholder={isDict ? 'DICT Username or Email' : 'CENRO Username or Email'}
                  value={username}
                  onChangeText={setUsername}
                  icon="person"
                  editable={!isLoading}
                />

                <AdminInput
                  placeholder="Password"
                  value={password}
                  onChangeText={setPassword}
                  icon="lock"
                  secureTextEntry={!showPassword}
                  editable={!isLoading}
                  rightComponent={
                    <TouchableOpacity
                      onPress={() => setShowPassword(!showPassword)}
                      style={{ padding: 6 }}
                    >
                      <MaterialIcons
                        name={showPassword ? 'visibility-off' : 'visibility'}
                        size={20}
                        color="#94A3B8"
                      />
                    </TouchableOpacity>
                  }
                />

                {/* Form Options */}
                <View style={styles.formOptions}>
                  <TouchableOpacity
                    style={styles.rememberOption}
                    onPress={() => setKeepLoggedIn(!keepLoggedIn)}
                    disabled={isLoading}
                    activeOpacity={0.7}
                  >
                    <View
                      style={[
                        styles.checkbox,
                        keepLoggedIn && (isDict ? styles.checkboxCheckedDict : styles.checkboxCheckedCenro),
                      ]}
                    >
                      {keepLoggedIn && <MaterialIcons name="check" size={14} color="#FFFFFF" />}
                    </View>
                    <Text style={styles.checkboxLabel}>Keep me signed in</Text>
                  </TouchableOpacity>

                  <View style={styles.encryptionPill}>
                    <MaterialIcons name="lock" size={11} color="#0D9488" />
                    <Text style={styles.encryptionPillText}>256-Bit SSL</Text>
                  </View>
                </View>

                {/* Login Action Button */}
                <AdminButton
                  title={
                    isLoading
                      ? 'Authenticating...'
                      : isDict
                      ? 'Sign In to DICT Portal'
                      : 'Sign In to CENRO Portal'
                  }
                  colorScheme={isDict ? 'teal' : 'green'}
                  onPress={handleLogin}
                  disabled={isLoading}
                />

                {/* Portal Security Footnote */}
                <View style={styles.securityFootnote}>
                  <MaterialIcons name="verified-user" size={13} color="#64748B" />
                  <Text style={styles.securityFootnoteText}>
                    {isDict
                      ? 'Protected under DICT Administrative Oversight & Governance Framework'
                      : 'City Environment and Natural Resources Office • Danao City Official Portal'}
                  </Text>
                </View>
              </View>
            </View>
          </View>
        </ScrollView>
        </View>
      </ImageBackground>

      {/* Error Modal */}
      <ErrorModal
        visible={errorModal.visible}
        title={errorModal.title}
        message={errorModal.message}
        type={errorModal.type}
        onClose={closeErrorModal}
        autoClose={true}
        autoCloseDelay={4500}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fullScreenBackground: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  backdropDimmer: {
    flex: 1,
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
  },
  overlay: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    minHeight: '100%',
  },
  floatingCardContainer: {
    width: '100%',
    maxWidth: 510,
    alignSelf: 'center',
  },
  govRibbonBar: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: -1,
  },
  govRibbonBarDict: {
    backgroundColor: '#042F2E',
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: '#115E59',
  },
  govRibbonBarCenro: {
    backgroundColor: '#064E3B',
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: '#059669',
  },
  govRibbonFlagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  flagDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  govRibbonText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  govRibbonTextDict: {
    color: '#CCFBF1',
  },
  govRibbonTextCenro: {
    color: '#D1FAE5',
  },
  loginFloatingCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.98)',
    width: '100%',
    padding: 30,
    borderRadius: 24,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    borderWidth: 1.5,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.12,
    shadowRadius: 32,
    elevation: 10,
  },
  cenroCardAccent: {
    borderColor: '#D1FAE5',
  },
  dictCardAccent: {
    borderColor: '#CCFBF1',
  },
  headingWrapper: {
    marginBottom: 20,
  },
  welcomeText: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  cenroWelcomeText: {
    color: '#1B4D3E',
  },
  dictWelcomeText: {
    color: '#0F172A',
  },
  portalSubtitle: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 18,
  },
  form: {
    width: '100%',
  },
  formOptions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 22,
    marginTop: 4,
  },
  rememberOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: 5,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  checkboxCheckedCenro: {
    backgroundColor: '#059669',
    borderColor: '#059669',
  },
  checkboxCheckedDict: {
    backgroundColor: '#0D9488',
    borderColor: '#0D9488',
  },
  checkboxLabel: {
    fontSize: 13,
    color: '#475569',
    fontWeight: '500',
  },
  encryptionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F0FDFA',
    borderWidth: 1,
    borderColor: '#CCFBF1',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  encryptionPillText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#0F766E',
  },
  securityFootnote: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    marginTop: 20,
  },
  securityFootnoteText: {
    fontSize: 11,
    color: '#94A3B8',
    textAlign: 'center',
  },
});
