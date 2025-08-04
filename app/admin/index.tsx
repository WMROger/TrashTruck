import { Ionicons } from '@expo/vector-icons';
import { Link } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function AdminIndex() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Admin Portal</Text>
        <Text style={styles.subtitle}>Choose your preferred interface</Text>
        
        <View style={styles.buttonContainer}>
          
          
          <Link href="/admin/login-mobile-vertical" asChild>
            <TouchableOpacity style={styles.button}>
              <Ionicons name="phone-portrait-outline" size={32} color="#2E8B57" />
              <Text style={styles.buttonText}>Mobile Vertical</Text>
              <Text style={styles.buttonSubtext}>Stacked layout</Text>
            </TouchableOpacity>
          </Link>
          
          <Link href="/admin/login-desktop" asChild>
            <TouchableOpacity style={styles.button}>
              <Ionicons name="desktop" size={32} color="#2E8B57" />
              <Text style={styles.buttonText}>Desktop Version</Text>
              <Text style={styles.buttonSubtext}>Optimized for desktop screens</Text>
            </TouchableOpacity>
          </Link>
          
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#E8F5E8',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  title: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#2E8B57',
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 18,
    color: '#666',
    marginBottom: 60,
    textAlign: 'center',
  },
  buttonContainer: {
    width: '100%',
    maxWidth: 600,
    gap: 20,
  },
  button: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 30,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2E8B57',
    marginTop: 12,
    marginBottom: 4,
  },
  buttonSubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
}); 