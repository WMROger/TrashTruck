import { useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function TestTabs() {
  const router = useRouter();

  const goToTabs = () => {
    router.replace('/(tabs)' as any);
  };

  const goToHome = () => {
    router.replace('/(tabs)/home' as any);
  };

  const goToExplore = () => {
    router.replace('/(tabs)/explore' as any);
  };

  const goToProfile = () => {
    router.replace('/(tabs)/profile' as any);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Tab Navigation Test</Text>
      
      <TouchableOpacity style={styles.button} onPress={goToTabs}>
        <Text style={styles.buttonText}>Go to Tabs (Main)</Text>
      </TouchableOpacity>
      
      <TouchableOpacity style={styles.button} onPress={goToHome}>
        <Text style={styles.buttonText}>Go to Home Tab</Text>
      </TouchableOpacity>
      
      <TouchableOpacity style={styles.button} onPress={goToExplore}>
        <Text style={styles.buttonText}>Go to Explore Tab</Text>
      </TouchableOpacity>
      
      <TouchableOpacity style={styles.button} onPress={goToProfile}>
        <Text style={styles.buttonText}>Go to Profile Tab</Text>
      </TouchableOpacity>
      
      <TouchableOpacity style={styles.button} onPress={() => router.replace('/splash')}>
        <Text style={styles.buttonText}>Back to Splash</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 30,
    color: '#333',
  },
  button: {
    backgroundColor: '#5B7C67',
    padding: 15,
    borderRadius: 8,
    marginVertical: 10,
    width: '80%',
    alignItems: 'center',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
}); 