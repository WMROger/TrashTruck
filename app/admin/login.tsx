import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { signInWithEmailAndPassword } from 'firebase/auth';
import React, { useState } from 'react';
import { Alert, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AdminButton from '../../components/admin/AdminButton';
import AdminInput from '../../components/admin/AdminInput';
import { auth } from '../../config/firebase';
import { adminStyles } from '../../styles/admin';

export default function AdminLogin() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [keepLoggedIn, setKeepLoggedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async () => {
    if (!username.trim() || !password.trim()) {
      Alert.alert('Error', 'Please enter both username and password');
      return;
    }

    setIsLoading(true);
    
    try {
      console.log('Admin login attempt:', { username, keepLoggedIn });
      
      // For admin login, we'll use email format (username@admin.com)
      const email = username.includes('@') ? username : `${username}@admin.com`;
      
      // Attempt to sign in with Firebase
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      console.log('Admin login successful:', user.email);
      
      // Check if user has admin privileges (you can add custom claims or role checking here)
      // For now, we'll assume any successful login is admin
      
      // Navigate to admin dashboard
      router.replace('/admin/dashboard');
      
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
      
      Alert.alert('Login Failed', errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={adminStyles.container}>
      <View style={adminStyles.mainCard}>
        {/* Left Panel - Illustration */}
        <View style={adminStyles.leftPanel}>
          <View style={adminStyles.illustration}>
            {/* Sky */}
            <View style={adminStyles.sky} />
            
            {/* Hills */}
            <View style={adminStyles.hills}>
              <View style={adminStyles.hill1} />
              <View style={adminStyles.hill2} />
            </View>
            
            {/* Trees */}
            <View style={adminStyles.trees}>
              <View style={adminStyles.tree1} />
              <View style={adminStyles.tree2} />
              <View style={adminStyles.tree3} />
            </View>
            
            {/* City Buildings */}
            <View style={adminStyles.cityBuildings}>
              <View style={adminStyles.building1} />
              <View style={adminStyles.building2} />
              <View style={adminStyles.building3} />
            </View>
            
            {/* Characters */}
            <View style={adminStyles.characters}>
              {/* Person 1 - Sweeping */}
              <View style={adminStyles.person1}>
                <View style={adminStyles.head1} />
                <View style={adminStyles.body1} />
                <View style={adminStyles.arm1} />
                <View style={adminStyles.broom} />
              </View>
              
              {/* Person 2 - Holding bag */}
              <View style={adminStyles.person2}>
                <View style={adminStyles.head2} />
                <View style={adminStyles.body2} />
                <View style={adminStyles.arm2} />
                <View style={adminStyles.bag} />
              </View>
              
              {/* Person 3 - Holding bottle */}
              <View style={adminStyles.person3}>
                <View style={adminStyles.head3} />
                <View style={adminStyles.body3} />
                <View style={adminStyles.arm3} />
                <View style={adminStyles.bottle} />
              </View>
            </View>
            
            {/* Trash Items */}
            <View style={adminStyles.trashItems}>
              <View style={adminStyles.bottle1} />
              <View style={adminStyles.paper1} />
              <View style={adminStyles.bottle2} />
            </View>
            
            {/* Trash Can */}
            <View style={adminStyles.trashCan}>
              <View style={adminStyles.canBody} />
              <View style={adminStyles.biohazardSymbol} />
            </View>
          </View>
        </View>

        {/* Right Panel - Login Form */}
        <View style={adminStyles.rightPanel}>
          {/* Back Button */}
          <TouchableOpacity 
            style={adminStyles.backButton} 
            onPress={() => router.back()}
            disabled={isLoading}
          >
            <Ionicons name="arrow-back" size={20} color="#666" />
            <Text style={adminStyles.backButtonText}>Back to App</Text>
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
    </SafeAreaView>
  );
}

 