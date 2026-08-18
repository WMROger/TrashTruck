import { auth, db } from '@/config/firebase';
import { DANAO_CITY_BARANGAYS, mergeDanaoBarangays } from '@/constants/danaoBarangays';
import { signInWithFacebook, signInWithGoogle } from '@/config/socialAuth';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { createUserWithEmailAndPassword, sendEmailVerification, signOut } from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import DropDownPicker from 'react-native-dropdown-picker';
import ErrorModal from './ErrorModal';
import TermsAndConsentModal, { LegalTabType } from './TermsAndConsentModal';
import { sendResidentWelcomeEmail } from '@/services/emailNotificationService';

export default function SignupScreen() {
  const router = useRouter();
  const [lastName, setLastName] = useState('');
  const [firstName, setFirstName] = useState('');
  const [middleInitial, setMiddleInitial] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [selectedBarangay, setSelectedBarangay] = useState('');
  const [barangayOpen, setBarangayOpen] = useState(false);
  const [availableBarangays, setAvailableBarangays] = useState<string[]>([...DANAO_CITY_BARANGAYS]);

  const getFormattedFullName = () => {
    const fn = firstName.trim();
    const mi = middleInitial.trim() ? `${middleInitial.trim().replace(/\.$/, '')}. ` : '';
    const ln = lastName.trim();
    return `${fn} ${mi}${ln}`.trim() || `${ln}, ${fn}`.trim();
  };
  
  React.useEffect(() => {
    const fetchBarangays = async () => {
      try {
        const { collection, getDocs } = require('firebase/firestore');
        const snap = await getDocs(collection(db, 'barangay_schedules'));
        const barangayNames = new Set<string>();
        snap.forEach((doc: any) => {
          const data = doc.data();
          if (data.barangayName) {
            barangayNames.add(data.barangayName);
          }
        });
        setAvailableBarangays(mergeDanaoBarangays(Array.from(barangayNames)));
      } catch (err) {
        console.error('Error fetching available barangays:', err);
      }
    };
    fetchBarangays();
  }, []);
  const [consent, setConsent] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<{[key: string]: string}>({});
  const [errorModal, setErrorModal] = useState({
    visible: false,
    title: 'Error',
    message: '',
    type: 'error' as 'error' | 'warning' | 'info' | 'success',
  });
  const [legalModal, setLegalModal] = useState<{
    visible: boolean;
    tab: LegalTabType;
  }>({
    visible: false,
    tab: 'consent',
  });

  const openLegalModal = (tab: LegalTabType) => {
    setLegalModal({ visible: true, tab });
  };

  const closeLegalModal = () => {
    setLegalModal(prev => ({ ...prev, visible: false }));
  };

  // Email validation
  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  // Clear specific error
  const clearError = (field: string) => {
    setErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[field];
      return newErrors;
    });
  };

  // Show error modal
  const showError = (message: string, title = 'Error', type: 'error' | 'warning' | 'info' | 'success' = 'error') => {
    setErrorModal({
      visible: true,
      title,
      message,
      type,
    });
  };

  // Close error modal
  const closeErrorModal = () => {
    setErrorModal(prev => ({ ...prev, visible: false }));
  };

  // Password strength validation and character analysis
  const validatePasswordStrength = (password: string) => {
    const uppercaseCount = (password.match(/[A-Z]/g) || []).length;
    const lowercaseCount = (password.match(/[a-z]/g) || []).length;
    const lettersCount = uppercaseCount + lowercaseCount;
    const numbersCount = (password.match(/[0-9]/g) || []).length;
    const specialCharsCount = (password.match(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/g) || []).length;

    const requirements = {
      length: password.length >= 8,
      uppercase: uppercaseCount >= 1,
      lowercase: lowercaseCount >= 1,
      number: numbersCount >= 1,
      special: specialCharsCount >= 1,
    };
    
    const isValid = Object.values(requirements).every(req => req);
    const strength = Object.values(requirements).filter(req => req).length;
    
    return {
      requirements,
      isValid,
      strength,
      uppercaseCount,
      lowercaseCount,
      lettersCount,
      numbersCount,
      specialCharsCount,
      length: password.length,
    };
  };

  const getPasswordStrengthText = (strength: number) => {
    switch (strength) {
      case 0:
      case 1:
        return { text: 'WEAK', color: '#EF4444' };
      case 2:
        return { text: 'FAIR', color: '#F97316' };
      case 3:
        return { text: 'MEDIUM', color: '#EAB308' };
      case 4:
        return { text: 'GOOD', color: '#3B82F6' };
      case 5:
        return { text: 'STRONG', color: '#22C55E' };
      default:
        return { text: 'WEAK', color: '#EF4444' };
    }
  };

  const upsertUserProfile = async (provider: string, displayNameParam?: string) => {
    try {
      if (!auth || !db) return;
      const currentUser = auth.currentUser;
      if (!currentUser) return;
      // Ensure fresh auth token is available to Firestore right after signup
      try {
        await currentUser.getIdToken(true);
      } catch {}
      const rawEmail = (currentUser.email || email || '').trim().toLowerCase();
      const userId = currentUser.uid; // Firestore rules expect userId to equal auth.uid
      const userRef = doc(db, 'users', userId);
      const snap = await getDoc(userRef);
      const computedName = getFormattedFullName();
      const finalDisplayName = displayNameParam || currentUser.displayName || computedName || '';

      const baseData: Record<string, any> = {
        uid: currentUser.uid,
        email: rawEmail || '',
        displayName: finalDisplayName,
        name: finalDisplayName,
        photoURL: currentUser.photoURL || '',
        verified: currentUser.emailVerified === true,
        role: 'user',
        provider,
        barangay: selectedBarangay,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      const fullData: Record<string, any> = {
        ...baseData,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        middleInitial: middleInitial.trim().toUpperCase(),
      };

      const writeAttempt = async (data: any) => {
        if (!snap.exists()) {
          await setDoc(userRef, data);
        } else {
          await setDoc(userRef, data, { merge: true });
        }
      };

      try {
        await writeAttempt(fullData);
      } catch (err: any) {
        if (err?.code === 'permission-denied' || /permission/i.test(String(err?.message))) {
          try {
            // Retry with base schema in case cloud firestore rules restrict keys strictly
            await currentUser.getIdToken(true);
            await writeAttempt(baseData);
          } catch (retryErr) {
            console.warn('Base profile write failed after permission error:', retryErr);
          }
        } else {
          console.error('Failed to write user profile:', err);
        }
      }
    } catch (e) {
      console.error('Failed to upsert user profile:', e);
    }
  };

  const handleSignUp = async () => {
    // Clear previous errors
    setErrors({});

    // Validate Last Name
    if (!lastName.trim()) {
      showError('Please enter your last name');
      return;
    }

    // Validate First Name
    if (!firstName.trim()) {
      showError('Please enter your first name');
      return;
    }

    if (!selectedBarangay) {
      showError('Please select your Danao City barangay');
      return;
    }

    // Validate email
    if (!email) {
      showError('Please enter your email address');
      return;
    }
    if (!validateEmail(email)) {
      showError('Please enter a valid email address');
      return;
    }

    // Validate password
    if (!password) {
      showError('Please enter a password');
      return;
    }

    const passwordValidation = validatePasswordStrength(password);
    if (!passwordValidation.isValid) {
      showError('Password must contain at least 8 characters, 1 uppercase letter, 1 lowercase letter, 1 number, and 1 special character');
      return;
    }

    if (!consent) {
      showError('You must provide informed consent to register.');
      return;
    }

    setIsLoading(true);
    try {
      // Use Firebase authentication
      if (auth) {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        console.log('User created successfully:', user.email);
        
        // Update user profile with formatted full name
        const formattedName = getFormattedFullName();
        const { updateProfile } = require('firebase/auth');
        await updateProfile(user, { displayName: formattedName });

        await upsertUserProfile('password', formattedName);
        
        // Dispatch branded welcome email via Google Apps Script Webhook
        try {
          await sendResidentWelcomeEmail({
            toEmail: email,
            residentName: formattedName,
            barangay: selectedBarangay,
          });
        } catch (mailErr) {
          console.warn('Could not dispatch resident welcome email via webhook:', mailErr);
        }

        // Send email verification and redirect to login
        try {
          await sendEmailVerification(user);
          Alert.alert(
            'Verify your email',
            'We\'ve sent a verification link to your email. Please verify your email before logging in.'
          );
        } catch (verifyError: any) {
          console.error('Email verification error:', verifyError);
          Alert.alert('Verification Email Error', 'We could not send a verification email. You can request it again from the login screen.');
        }
        
        // Sign out and redirect to login
        try {
          await signOut(auth);
        } catch {}
        router.replace('/(auth)/login' as any);
      } else {
        throw new Error('Firebase authentication is unavailable. Check the app configuration and connection.');
      }
    } catch (error: any) {
      console.log('Signup failed:', error.code);
      let errorMessage = 'Sign up failed. Please try again.';
      
      if (error.code === 'auth/email-already-in-use') {
        errorMessage = 'An account with this email already exists.';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'Invalid email address.';
      } else if (error.code === 'auth/weak-password') {
        errorMessage = 'Password is too weak. Please choose a stronger password.';
      } else if (error.code === 'auth/network-request-failed') {
        errorMessage = 'Network error. Please check your internet connection.';
      } else if (error.code === 'auth/too-many-requests') {
        errorMessage = 'Too many attempts. Please try again later.';
      }
      
      showError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignUp = async () => {
    try {
      setIsLoading(true);
      const result = await signInWithGoogle();
      
      if (result.success) {
        await upsertUserProfile('google');
        console.log('Google signup successful');
        router.replace('/(tabs)' as any);
      } else {
        Alert.alert('Google Sign Up Error', result.error || 'Failed to sign up with Google. Please try again.');
      }
    } catch (error: any) {
      console.log('Google signup failed:', error.code);
      Alert.alert('Google Sign Up Error', 'Failed to sign up with Google. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFacebookSignUp = async () => {
    try {
      setIsLoading(true);
      const result = await signInWithFacebook();
      
      if (result.success) {
        await upsertUserProfile('facebook');
        console.log('Facebook signup successful');
        router.replace('/(tabs)' as any);
      } else {
        Alert.alert('Facebook Sign Up Error', result.error || 'Failed to sign up with Facebook. Please try again.');
      }
    } catch (error: any) {
      console.log('Facebook signup failed:', error.code);
      Alert.alert('Facebook Sign Up Error', 'Failed to sign up with Facebook. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = () => {
    router.push('/(auth)/login');
  };

  const handleBack = () => {
    router.back();
  };

  return (
    <LinearGradient
      colors={['#C1E1C1', '#F5F5F5']}
      style={styles.container}
    >
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
          <ScrollView
            contentContainerStyle={{ flexGrow: 1, paddingBottom: 40 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled={true}
          >
            {/* Header */}
            <View style={styles.header}>
              <TouchableOpacity style={styles.backButton} onPress={handleBack}>
                <Ionicons name="arrow-back-circle-outline" size={32} color="#6B705C" />
              </TouchableOpacity>
            </View>

            {/* Content Card Overlay */}
            <View style={styles.contentCard}>
              <Ionicons name="leaf" size={100} color="#F2F8F2" style={styles.leafWatermark} />
              
              <Text style={styles.title}>Create Account</Text>
              <Text style={styles.subtitle}>
                Join our mission to keep the neighborhood clean and earn rewards for sustainable waste disposal.
              </Text>

              <View style={styles.formContainer}>
                {/* Last Name */}
                <View style={styles.inputContainer}>
                  <Text style={styles.inputLabel}>
                    Last Name <Text style={styles.requiredAsterisk}>*</Text>
                  </Text>
                  <View style={styles.inputWrapper}>
                    <Ionicons name="person-outline" size={20} color="#999" style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="e.g. Dela Cruz"
                      placeholderTextColor="#999"
                      value={lastName}
                      onChangeText={setLastName}
                      autoCapitalize="words"
                    />
                  </View>
                </View>

                {/* First Name & Middle Initial */}
                <View style={styles.nameRow}>
                  <View style={[styles.inputContainer, { flex: 2.5, marginBottom: 0 }]}>
                    <Text style={styles.inputLabel}>
                      First Name <Text style={styles.requiredAsterisk}>*</Text>
                    </Text>
                    <View style={styles.inputWrapper}>
                      <Ionicons name="person-outline" size={20} color="#999" style={styles.inputIcon} />
                      <TextInput
                        style={styles.input}
                        placeholder="e.g. Juan"
                        placeholderTextColor="#999"
                        value={firstName}
                        onChangeText={setFirstName}
                        autoCapitalize="words"
                      />
                    </View>
                  </View>

                  <View style={[styles.inputContainer, { flex: 1, marginBottom: 0 }]}>
                    <Text style={styles.inputLabel}>M.I.</Text>
                    <View style={styles.inputWrapper}>
                      <TextInput
                        style={[styles.input, { textAlign: 'center' }]}
                        placeholder="A."
                        placeholderTextColor="#999"
                        value={middleInitial}
                        onChangeText={(val) => setMiddleInitial(val.toUpperCase().slice(0, 3))}
                        autoCapitalize="characters"
                        maxLength={3}
                      />
                    </View>
                  </View>
                </View>

                {/* Barangay */}
                <View style={[styles.inputContainer, { zIndex: 1000 }]}>
                  <Text style={styles.inputLabel}>
                    Barangay (Danao City) <Text style={styles.requiredAsterisk}>*</Text>
                  </Text>
                  <View style={[styles.inputWrapper, { padding: 0, borderWidth: 0 }]}>
                    <DropDownPicker
                      open={barangayOpen}
                      value={selectedBarangay}
                      items={availableBarangays.map(b => ({ label: b, value: b }))}
                      setOpen={setBarangayOpen}
                      setValue={setSelectedBarangay}
                      placeholder="Select a barangay"
                      placeholderStyle={{ color: '#999' }}
                      style={{
                        backgroundColor: '#F9FAFB',
                        borderWidth: 1,
                        borderColor: '#E5E7EB',
                        minHeight: 50,
                        borderRadius: 12,
                        paddingLeft: 44,
                      }}
                      dropDownContainerStyle={{
                        backgroundColor: '#F9FAFB',
                        borderColor: '#E5E7EB',
                        borderRadius: 12,
                      }}
                      textStyle={{
                        fontSize: 15,
                        color: '#333'
                      }}
                      zIndex={1000}
                      listMode={Platform.OS === 'web' ? 'FLATLIST' : 'SCROLLVIEW'}
                      scrollViewProps={{
                        nestedScrollEnabled: true,
                      }}
                    />
                    <View style={{ position: 'absolute', left: 16, top: 15, zIndex: 1001 }}>
                      <Ionicons name="location-outline" size={20} color="#999" />
                    </View>
                  </View>
                </View>

                {/* Email Address */}
                <View style={styles.inputContainer}>
                  <Text style={styles.inputLabel}>
                    Email Address <Text style={styles.requiredAsterisk}>*</Text>
                  </Text>
                  <View style={[styles.inputWrapper, email.length > 0 && !validateEmail(email) && styles.inputError]}>
                    <Ionicons name="mail-outline" size={20} color="#999" style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="john@example.com"
                      placeholderTextColor="#999"
                      value={email}
                      onChangeText={(text) => {
                        setEmail(text);
                        if (text.length > 0 && !validateEmail(text)) {
                          setErrors(prev => ({ ...prev, email: 'Invalid email format' }));
                        } else {
                          clearError('email');
                        }
                      }}
                      keyboardType="email-address"
                      autoCapitalize="none"
                    />
                  </View>
                  {errors.email && (
                    <View style={styles.errorContainer}>
                      <Ionicons name="alert-circle" size={16} color="#EF4444" />
                      <Text style={styles.errorText}>{errors.email}</Text>
                    </View>
                  )}
                </View>

                {/* Secure Password */}
                <View style={styles.inputContainer}>
                  <Text style={styles.inputLabel}>
                    Secure Password <Text style={styles.requiredAsterisk}>*</Text>
                  </Text>
                  <View style={styles.inputWrapper}>
                    <Ionicons name="lock-closed-outline" size={20} color="#999" style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="••••••••"
                      placeholderTextColor="#999"
                      value={password}
                      onChangeText={setPassword}
                      secureTextEntry={!showPassword}
                    />
                    <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeButton}>
                      <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={20} color="#999" />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Password Strength & Verification Helper */}
                {password.length > 0 && (() => {
                  const analysis = validatePasswordStrength(password);
                  const strengthInfo = getPasswordStrengthText(analysis.strength);
                  return (
                    <View style={styles.passwordVerificationWrapper}>
                      {/* Strength Bar */}
                      <View style={styles.passwordStrengthRow}>
                        <View style={styles.passwordStrengthBar}>
                          <View
                            style={[
                              styles.passwordStrengthFill,
                              {
                                width: `${(analysis.strength / 5) * 100}%`,
                                backgroundColor: strengthInfo.color,
                              },
                            ]}
                          />
                        </View>
                        <Text style={[styles.passwordStrengthText, { color: strengthInfo.color }]}>
                          {strengthInfo.text}
                        </Text>
                      </View>

                      {/* Verification Card */}
                      <View style={styles.verificationCard}>
                        {/* Live Character Count Summary Badges */}
                        <View style={styles.charCountRow}>
                          <View style={[styles.charBadge, analysis.lettersCount > 0 && styles.charBadgeActive]}>
                            <Text style={[styles.charBadgeText, analysis.lettersCount > 0 && styles.charBadgeTextActive]}>
                              {analysis.lettersCount} {analysis.lettersCount === 1 ? 'Letter' : 'Letters'}
                            </Text>
                          </View>
                          <View style={[styles.charBadge, analysis.numbersCount > 0 && styles.charBadgeActive]}>
                            <Text style={[styles.charBadgeText, analysis.numbersCount > 0 && styles.charBadgeTextActive]}>
                              {analysis.numbersCount} {analysis.numbersCount === 1 ? 'Number' : 'Numbers'}
                            </Text>
                          </View>
                          <View style={[styles.charBadge, analysis.specialCharsCount > 0 && styles.charBadgeActive]}>
                            <Text style={[styles.charBadgeText, analysis.specialCharsCount > 0 && styles.charBadgeTextActive]}>
                              {analysis.specialCharsCount} Special {analysis.specialCharsCount === 1 ? 'Char' : 'Chars'}
                            </Text>
                          </View>
                        </View>

                        {/* Requirements List */}
                        <View style={styles.reqList}>
                          <View style={styles.reqItem}>
                            <Ionicons
                              name={analysis.requirements.length ? "checkmark-circle" : "ellipse-outline"}
                              size={15}
                              color={analysis.requirements.length ? "#22C55E" : "#9CA3AF"}
                            />
                            <Text style={[styles.reqItemText, analysis.requirements.length && styles.reqItemTextMet]}>
                              At least 8 characters ({analysis.length}/8)
                            </Text>
                          </View>

                          <View style={styles.reqItem}>
                            <Ionicons
                              name={analysis.requirements.uppercase ? "checkmark-circle" : "ellipse-outline"}
                              size={15}
                              color={analysis.requirements.uppercase ? "#22C55E" : "#9CA3AF"}
                            />
                            <Text style={[styles.reqItemText, analysis.requirements.uppercase && styles.reqItemTextMet]}>
                              At least 1 uppercase letter (A-Z)
                            </Text>
                          </View>

                          <View style={styles.reqItem}>
                            <Ionicons
                              name={analysis.requirements.lowercase ? "checkmark-circle" : "ellipse-outline"}
                              size={15}
                              color={analysis.requirements.lowercase ? "#22C55E" : "#9CA3AF"}
                            />
                            <Text style={[styles.reqItemText, analysis.requirements.lowercase && styles.reqItemTextMet]}>
                              At least 1 lowercase letter (a-z)
                            </Text>
                          </View>

                          <View style={styles.reqItem}>
                            <Ionicons
                              name={analysis.requirements.number ? "checkmark-circle" : "ellipse-outline"}
                              size={15}
                              color={analysis.requirements.number ? "#22C55E" : "#9CA3AF"}
                            />
                            <Text style={[styles.reqItemText, analysis.requirements.number && styles.reqItemTextMet]}>
                              At least 1 number (0-9)
                            </Text>
                          </View>

                          <View style={styles.reqItem}>
                            <Ionicons
                              name={analysis.requirements.special ? "checkmark-circle" : "ellipse-outline"}
                              size={15}
                              color={analysis.requirements.special ? "#22C55E" : "#9CA3AF"}
                            />
                            <Text style={[styles.reqItemText, analysis.requirements.special && styles.reqItemTextMet]}>
                              At least 1 special character (!@#$%^&*...)
                            </Text>
                          </View>
                        </View>
                      </View>
                    </View>
                  );
                })()}

                {/* Consent Checkbox */}
                <View style={styles.consentContainer}>
                  <TouchableOpacity
                    style={[styles.checkbox, consent && styles.checkboxChecked]}
                    onPress={() => setConsent(!consent)}
                    activeOpacity={0.8}
                  >
                    {consent && <Ionicons name="checkmark" size={14} color="white" />}
                  </TouchableOpacity>
                  <Text style={styles.consentText}>
                    I provide my{' '}
                    <Text
                      style={styles.linkText}
                      onPress={() => openLegalModal('consent')}
                    >
                      Informed Consent
                    </Text>{' '}
                    for TrashTrack to process my personal data to facilitate waste collection services. I have read and agree to the{' '}
                    <Text
                      style={styles.linkText}
                      onPress={() => openLegalModal('privacy')}
                    >
                      Data Privacy Terms
                    </Text>
                    . <Text style={styles.requiredAsterisk}>*</Text>
                  </Text>
                </View>

                {/* Sign Up Button */}
                <TouchableOpacity 
                  style={[styles.primaryButton, isLoading && styles.disabledButton]}
                  onPress={handleSignUp}
                  disabled={isLoading}
                >
                  <Text style={styles.primaryButtonText}>
                    {isLoading ? 'Signing up...' : 'Create Account'}
                  </Text>
                </TouchableOpacity>

                {/* Separator */}
                <View style={styles.separatorContainer}>
                  <View style={styles.separatorLine} />
                  <Text style={styles.separatorText}>OR CONTINUE WITH</Text>
                  <View style={styles.separatorLine} />
                </View>

                {/* Social Buttons (Side by side) */}
                <View style={styles.socialButtonsRow}>
                  <TouchableOpacity style={styles.socialButtonHalf} onPress={handleGoogleSignUp} disabled={isLoading}>
                    <View style={styles.socialIconCircle}>
                      <Text style={{fontWeight: 'bold', color: '#DB4437'}}>G</Text>
                    </View>
                    <Text style={styles.socialButtonText}>Google</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.socialButtonHalf} onPress={handleFacebookSignUp} disabled={isLoading}>
                    <Ionicons name="logo-facebook" size={18} color="#1877F2" style={{marginRight: 6}} />
                    <Text style={styles.socialButtonText}>Facebook</Text>
                  </TouchableOpacity>
                </View>

                {/* Login Link */}
                <View style={styles.loginContainer}>
                  <Text style={styles.loginText}>Already have an account? </Text>
                  <TouchableOpacity onPress={handleLogin}>
                    <Text style={styles.loginLink}>Login</Text>
                  </TouchableOpacity>
                </View>

              </View>
            </View>
          </ScrollView>

          {/* Error Modal */}
          <ErrorModal
            visible={errorModal.visible}
            title={errorModal.title}
            message={errorModal.message}
            type={errorModal.type}
            onClose={closeErrorModal}
            autoClose={true}
            autoCloseDelay={4000}
          />

          {/* Terms & Consent Modal */}
          <TermsAndConsentModal
            visible={legalModal.visible}
            initialTab={legalModal.tab}
            onClose={closeLegalModal}
            onAccept={() => {
              setConsent(true);
              closeLegalModal();
            }}
          />
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 40,
    paddingBottom: 10,
    zIndex: 1,
  },
  backButton: {
    padding: 4,
  },
  contentCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 20,
    borderRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
    position: 'relative',
    overflow: 'hidden',
  },
  leafWatermark: {
    position: 'absolute',
    top: -10,
    right: -10,
    transform: [{ rotate: '15deg' }],
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#4A6B48', // Darker green
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 13,
    color: '#666',
    lineHeight: 18,
    marginBottom: 24,
    paddingRight: 20,
  },
  formContainer: {
    // Form wrapper
  },
  inputContainer: {
    marginBottom: 16,
  },
  nameRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#333',
    marginBottom: 8,
  },
  requiredAsterisk: {
    color: '#EF4444',
    fontWeight: '700',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FAFAFA', // Very light grey/white background inside card
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingHorizontal: 12,
  },
  inputIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 15,
    color: '#333',
  },
  eyeButton: {
    padding: 4,
  },
  inputError: {
    borderColor: '#EF4444',
  },
  passwordVerificationWrapper: {
    marginTop: 4,
    marginBottom: 8,
  },
  passwordStrengthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 12,
  },
  passwordStrengthBar: {
    flex: 1,
    height: 5,
    backgroundColor: '#E5E7EB',
    borderRadius: 3,
    overflow: 'hidden',
  },
  passwordStrengthFill: {
    height: '100%',
    borderRadius: 3,
  },
  passwordStrengthText: {
    fontSize: 11,
    fontWeight: '700',
    minWidth: 55,
    textAlign: 'right',
  },
  verificationCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 10,
  },
  charCountRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  charBadge: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  charBadgeActive: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  charBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#9CA3AF',
  },
  charBadgeTextActive: {
    color: '#059669',
  },
  reqList: {
    gap: 5,
  },
  reqItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  reqItemText: {
    fontSize: 12,
    color: '#6B7280',
  },
  reqItemTextMet: {
    color: '#1F2937',
    fontWeight: '600',
  },
  consentContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 8,
    marginBottom: 24,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 1.5,
    borderColor: '#CCC',
    borderRadius: 4,
    marginRight: 12,
    marginTop: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#5C7C54',
    borderColor: '#5C7C54',
  },
  consentText: {
    flex: 1,
    fontSize: 12,
    color: '#555',
    lineHeight: 18,
  },
  linkText: {
    color: '#709A67', // Green link text
    textDecorationLine: 'underline',
  },
  primaryButton: {
    backgroundColor: '#5C7C54',
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 24,
  },
  primaryButtonText: {
    color: 'white',
    fontSize: 15,
    fontWeight: '700',
  },
  disabledButton: {
    opacity: 0.6,
  },
  separatorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  separatorLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E5E7EB',
  },
  separatorText: {
    marginHorizontal: 12,
    fontSize: 11,
    fontWeight: '600',
    color: '#A3A3A3',
    letterSpacing: 1,
  },
  socialButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 24,
  },
  socialButtonHalf: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  socialIconCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },
  socialButtonText: {
    fontSize: 13,
    color: '#333',
    fontWeight: '600',
  },
  loginContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loginText: {
    fontSize: 13,
    color: '#666',
  },
  loginLink: {
    fontSize: 13,
    color: '#4A76FF',
    fontWeight: '600',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  errorText: {
    fontSize: 12,
    color: '#EF4444',
    marginLeft: 6,
    fontWeight: '500',
  },
});
