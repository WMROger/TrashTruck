import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import React, { useState } from 'react';
import { ImageBackground, Platform, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AdminButton from '../../components/admin/AdminButton';
import AdminInput from '../../components/admin/AdminInput';
import ErrorModal from '../../components/ErrorModal';
import { auth, db } from '../../config/firebase';
import { adminStyles } from '../../styles/admin';

export default function AdminLogin() {
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
    if (Platform.OS !== 'web') {
      showError('Admin access is restricted to the desktop website. Please log in on a computer.', 'Restricted Access', 'warning');
      return;
    }

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
          } else if (userRole === 'dict') {
            console.log('DICT role confirmed, redirecting to dict dashboard');
            router.replace('/dict/dashboard');
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
    <SafeAreaView style={{ flex: 1 }}>
      <ImageBackground
        source={require('@/assets/images/admin_login_bg.png')}
        style={adminStyles.fullScreenBackground}
        resizeMode="cover"
      >
        <View style={adminStyles.overlay}>
          {/* Right-aligned Floating Card */}
          <View style={adminStyles.floatingCardContainer}>
          <View style={adminStyles.loginFloatingCard as any}>
            {/* Back Button */}
            <TouchableOpacity 
              style={adminStyles.backButton} 
            onPress={() => router.replace('/admin/splash')}
            disabled={isLoading}
          >
            <MaterialIcons name="arrow-back" size={20} color="#333" />
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
              icon="lock"
              secureTextEntry={!showPassword}
              editable={!isLoading}
              rightComponent={
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={{ padding: 5 }}>
                  <MaterialIcons name={showPassword ? "visibility-off" : "visibility"} size={20} color="#999" />
                </TouchableOpacity>
              }
            />
            
            {/* Form Options */}
            <View style={[adminStyles.checkboxContainer, { justifyContent: 'space-between', alignItems: 'center' }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <TouchableOpacity
                  style={[adminStyles.checkbox, keepLoggedIn && adminStyles.checkboxChecked]}
                  onPress={() => setKeepLoggedIn(!keepLoggedIn)}
                  disabled={isLoading}
                >
                  {keepLoggedIn && <MaterialIcons name="check" size={16} color="white" />}
                </TouchableOpacity>
                <Text style={adminStyles.checkboxText}>Keep me logged in</Text>
              </View>
              <TouchableOpacity>
                <Text style={adminStyles.forgotPasswordText}>Forgot password?</Text>
              </TouchableOpacity>
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
        autoCloseDelay={4000}
      />
    </SafeAreaView>
  );
}

 