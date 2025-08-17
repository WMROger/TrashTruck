import { useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function AuthScreen() {
  const router = useRouter();

  const handleLogin = () => {
    router.push('/(auth)/login');
  };

  const handleSignUp = () => {
    router.push('/(auth)/signup');
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Welcome to TrashTrack</Text>
        <Text style={styles.subtitle}>Choose how you'd like to get started</Text>
        
        <View style={styles.buttonGroup}>
          <TouchableOpacity 
            style={styles.primaryButton}
            onPress={handleLogin}
          >
            <Text style={styles.primaryButtonText}>Login</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.secondaryButton}
            onPress={handleSignUp}
          >
            <Text style={styles.secondaryButtonText}>Create an account</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.backButton} 
            onPress={() => router.replace('/splash')}
          >
            <Text style={styles.backButtonText}>Back to Splash</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#E8F5E8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#5B7C67',
    textAlign: 'center',
    marginBottom: 16,
  },
  subtitle: {
    fontSize: 18,
    color: '#666',
    textAlign: 'center',
    marginBottom: 48,
  },
  buttonGroup: {
    width: '100%',
    alignItems: 'center',
    gap: 16,
  },
  primaryButton: {
    backgroundColor: '#5B7C67',
    borderRadius: 8,
    paddingVertical: 16,
    paddingHorizontal: 32,
    width: '100%',
    alignItems: 'center',
  },
  primaryButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  secondaryButton: {
    borderColor: '#5B7C67',
    borderWidth: 2,
    borderRadius: 8,
    paddingVertical: 16,
    paddingHorizontal: 32,
    width: '100%',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  secondaryButtonText: {
    color: '#5B7C67',
    fontWeight: 'bold',
    fontSize: 16,
  },
  backButton: {
    marginTop: 32,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  backButtonText: {
    color: '#666',
    fontSize: 14,
    textDecorationLine: 'underline',
  },
}); 