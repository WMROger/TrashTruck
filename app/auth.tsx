import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function AuthenticationPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async () => {
    setIsLoading(true);
    try {
      // Simulate login process
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Navigate to main app (tabs)
      router.replace('/(tabs)' as any);
    } catch (error) {
      Alert.alert('Error', 'Login failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignUp = async () => {
    setIsLoading(true);
    try {
      // Simulate signup process
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Navigate to main app (tabs)
      router.replace('/(tabs)' as any);
    } catch (error) {
      Alert.alert('Error', 'Sign up failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackToSplash = () => {
    router.replace('/splash');
  };

  return (
    <View style={styles.container}>
      <Image
        source={require('@/assets/images/splash-icon.png')} 
        style={styles.backgroundImage}
        contentFit="cover"
        blurRadius={1}
      />
      <View style={styles.overlay} />
      <View style={styles.content}>
        <Text style={styles.slogan}>Know the Waste, Clean with Haste.</Text>
        <Image
          source={require('@/assets/images/icon.png')} 
          style={styles.logo}
        />
        <View style={styles.buttonGroup}>
          <TouchableOpacity 
            style={[styles.primaryButton, isLoading && styles.disabledButton]} 
            onPress={handleLogin}
            disabled={isLoading}
          >
            <Text style={styles.primaryButtonText}>
              {isLoading ? 'Logging in...' : 'Login'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.secondaryButton, isLoading && styles.disabledButton]} 
            onPress={handleSignUp}
            disabled={isLoading}
          >
            <Text style={styles.secondaryButtonText}>
              {isLoading ? 'Signing up...' : 'Create an account'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.backButton} onPress={handleBackToSplash}>
            <Text style={styles.backButtonText}>Back to Splash</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.backButton} onPress={() => router.replace('/test-tabs')}>
            <Text style={styles.backButtonText}>Test Tabs</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#101010',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backgroundImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
    zIndex: 0,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.5)',
    zIndex: 1,
  },
  content: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 180,
    zIndex: 2,
  },
  slogan: {
    color: '#5B7C67',
    fontSize: 32,
    fontWeight: 'bold',
    textAlign: 'left',
    alignSelf: 'flex-start',
    marginLeft: 32,
    marginBottom: 24,
  },
  logo: {
    width: 260,
    height: 100,
    resizeMode: 'contain',
    marginBottom: 32,
  },
  buttonGroup: {
    width: '100%',
    alignItems: 'center',
    gap: 16,
  },
  primaryButton: {
    backgroundColor: '#A9D6B5',
    borderRadius: 8,
    paddingVertical: 14,
    paddingHorizontal: 32,
    width: '80%',
    alignItems: 'center',
    marginBottom: 0,
  },
  primaryButtonText: {
    color: '#222',
    fontWeight: 'bold',
    fontSize: 16,
  },
  secondaryButton: {
    borderColor: '#A9D6B5',
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 14,
    paddingHorizontal: 32,
    width: '80%',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  secondaryButtonText: {
    color: '#222',
    fontWeight: 'bold',
    fontSize: 16,
  },
  disabledButton: {
    opacity: 0.6,
  },
  backButton: {
    marginTop: 16,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  backButtonText: {
    color: '#666',
    fontSize: 14,
    textDecorationLine: 'underline',
  },
}); 