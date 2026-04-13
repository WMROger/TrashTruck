import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import React, { useState } from 'react';
import { Image, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AdminButton from '../../components/admin/AdminButton';
import AdminInput from '../../components/admin/AdminInput';
import ErrorModal from '../../components/ErrorModal';
import { auth, db } from '../../config/firebase';
import { adminStyles } from '../../styles/admin';

export default function AdminLogin() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [keepLoggedIn, setKeepLoggedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorModal, setErrorModal] = useState({
    visible: false,
    title: 'Error',
    message: '',
    type: 'error' as 'error' | 'warning' | 'info' | 'success',
  });
  const router = useRouter();

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

  const handleLogin = async () => {
    if (!username.trim() || !password.trim()) {
      showError('Please enter both username and password', 'Validation Error', 'warning');
      return;
    }

    setIsLoading(true);
    
    try {
      console.log('Admin login attempt:', { username });
      
      // Use the entered email directly
      const email = username.includes('@') ? username : `${username}@admin.com`;
      
      // Attempt to sign in with Firebase
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      console.log('Admin login successful:', user.email);
      
      // Check if user has admin role in Firestore
      if (db) {
        const userRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userRef);
        
        if (userSnap.exists()) {
          const userData = userSnap.data();
          const userRole = userData.role;
          
          if (userRole === 'admin') {
            console.log('Admin role confirmed, redirecting to dashboard');
            router.replace('/admin/dashboard');
            return;
          } else if (userRole === 'driver') {
            console.log('Driver trying to login on admin portal');
            try { await signOut(auth); } catch {}
            showError('Driver accounts must use the driver login portal. Please go to the main login page.', 'Wrong Login Portal', 'warning');
            return;
          } else if (userRole === 'user') {
            console.log('Regular user trying to login on admin portal');
            try { await signOut(auth); } catch {}
            showError('Regular user accounts must use the main login portal. Please go to the main login page.', 'Wrong Login Portal', 'warning');
            return;
          } else {
            console.log('User does not have admin role');
            showError('You do not have admin privileges.', 'Access Denied', 'error');
            return;
          }
        } else {
          console.log('User document not found in Firestore');
          showError('User profile not found.', 'Access Denied', 'error');
          return;
        }
      } else {
        console.log('Firestore not available, proceeding with auth only');
        router.replace('/admin/dashboard');
      }
      
    } catch (error: any) {
      console.error('Admin login error:', error);
      
      let errorMessage = 'Login failed. Please try again.';
      
      if (error.code === 'auth/user-not-found') {
        errorMessage = 'Admin account not found.';
      } else if (error.code === 'auth/wrong-password') {
        errorMessage = 'Incorrect password.';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'Invalid email format.';
      } else if (error.code === 'auth/too-many-requests') {
        errorMessage = 'Too many failed attempts. Please try again later.';
      }
      
      showError(errorMessage, 'Login Failed', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={adminStyles.container}>
      <View style={adminStyles.mainCard}>
        {/* Left Panel - Illustration */}
        <View style={adminStyles.leftPanel}>
          <Image
            source={require('@/assets/images/admin_login_bg.png')}
            style={adminStyles.backgroundImage}
            resizeMode="cover"
          />
        </View>

        {/* Right Panel - Login Form */}
        <View style={adminStyles.rightPanel}>
          {/* Back Button */}
          <TouchableOpacity 
            style={adminStyles.backButton} 
            onPress={() => router.replace('/admin/splash')}
            disabled={isLoading}
          >
            <Ionicons name="arrow-back" size={20} color="#666" />
            <Text style={adminStyles.backButtonText}>Back to Admin Portal</Text>
          </TouchableOpacity>

          <Text style={adminStyles.welcomeText}>Welcome back, Admin</Text>
          
          <View style={adminStyles.form}>
            {/* Username Field */}
            <AdminInput
              placeholder="Username or Email"
              value={username}
              onChangeText={setUsername}
              icon="person"
              editable={!isLoading}
            />
            
            {/* Password Field */}
            <AdminInput
              placeholder="Password"
              value={password}
              onChangeText={setPassword}
              icon="key"
              secureTextEntry
              editable={!isLoading}
              rightComponent={
                <TouchableOpacity style={adminStyles.forgotPassword}>
                  <Text style={adminStyles.forgotPasswordText}>Forgot password?</Text>
                </TouchableOpacity>
              }
            />
            
            {/* Keep me logged in checkbox */}
            <View style={adminStyles.checkboxContainer}>
              <TouchableOpacity
                style={[adminStyles.checkbox, keepLoggedIn && adminStyles.checkboxChecked]}
                onPress={() => setKeepLoggedIn(!keepLoggedIn)}
                disabled={isLoading}
              >
                {keepLoggedIn && <Ionicons name="checkmark" size={16} color="white" />}
              </TouchableOpacity>
              <Text style={adminStyles.checkboxText}>Keep me logged in</Text>
            </View>
            
            {/* Login Button */}
            <AdminButton 
              title={isLoading ? "Logging in..." : "Login"} 
              onPress={handleLogin}
              disabled={isLoading}
            />
          </View>
        </View>
      </View>

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
    </SafeAreaView>
  );
}

 