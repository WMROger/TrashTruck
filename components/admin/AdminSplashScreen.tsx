import { useRouter } from 'expo-router';
import React from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function AdminSplashScreen() {
  const router = useRouter();

  const handleAdminLogin = () => {
    router.replace('/admin/login');
  };

  const handleBackToApp = () => {
    router.replace('/');
  };

  return (
    <View style={styles.container}>

      {/* Logo in top-left */}
      <View style={styles.logoContainer}>
        <Image
          source={require('@/assets/images/trashtrack_logo_driver.png')}
          style={styles.logo}
          resizeMode="contain"
        />
      </View>

      {/* Main content */}
      <View style={styles.contentContainer}>
        <Text style={styles.title}>TrashTrack</Text>
        <Text style={styles.subtitle}>
          Admin Portal for Comprehensive{'\n'}
          Waste Management Oversight
        </Text>
      </View>

      {/* Background Image */}
      <Image
        source={require('@/assets/images/splash_admin_bg.png')}
        style={styles.backgroundImage}
        resizeMode="cover"
      />

      {/* Illustration */}
      <View style={styles.illustrationContainer}>
        <Image
          source={require('@/assets/images/splash_admin.png')}
          style={styles.illustrationImage}
          resizeMode="contain"
        />
      </View>

      {/* Sign In Button */}
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={styles.signInButton}
          onPress={handleAdminLogin}
          activeOpacity={0.8}
        >
          <Text style={styles.signInButtonText}>Admin Sign In</Text>
        </TouchableOpacity>

        
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ECFEE5', // Light green background like the design
  },
  // Background image
  backgroundImage: {
    position: 'absolute',
    top: '10%',
    left: '20%',
    right: '5%',
    bottom: '10%',
    width: '75.5%',
    height: '100%',
  },
  // Logo container
  logoContainer: {
    position: 'absolute',
    top: 40,
    left: 50,
    zIndex: 10,
  },
  logo: {
    width: 240,
    height: 240,
  },
  // Main content
  contentContainer: {
    position: 'absolute',
    top: 240,
    left: 90,
    zIndex: 5,
  },
  title: {
    fontSize: 64,
    fontWeight: 'bold',
    color: '#2D5A3D', // Dark green color from design
    marginBottom: 20,
  },
  subtitle: {
    fontSize: 22,
    color: '#2D5A3D',
    fontWeight: '400',
    lineHeight: 28,
    maxWidth: 400,
  },
  // Illustration container
  illustrationContainer: {
    position: 'absolute',
    right: '15%',
    top: '15%',
    bottom: '10%',
    width: 650,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
    
  },
  illustrationImage: {
    width: '100%',
    height: '100%',
    maxWidth: 650,
    maxHeight: 500,
  },
  // Button container
  buttonContainer: {
    position: 'absolute',
    bottom: 80,
    left: 90,
    zIndex: 10,
  },
  signInButton: {
    backgroundColor: '#4E6C50', // Dark green button like design
    borderRadius: 25,
    paddingVertical: 12,
    paddingHorizontal: 30,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  signInButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 24,
    textAlign: 'center',
  },
  
  
});
