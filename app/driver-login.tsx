import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Dimensions, Image, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

const { width } = Dimensions.get('window');

export default function DriverLoginScreen() {
  const router = useRouter();
  const [fullName, setFullName] = useState('');
  const [employeeId, setEmployeeId] = useState('');

  const handleLogin = () => {
    // For now, bypass real authentication and route directly to driver home
    console.log('Driver Login:', fullName, employeeId);
    router.replace('/(driver)');
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F4FBF1" />
      
      {/* Back Button */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <MaterialIcons name="arrow-back" size={24} color="#4E6C50" />
        </TouchableOpacity>
      </View>

      {/* Truck Image & Badge */}
      <View style={styles.heroSection}>
        {/* We use a placeholder truck for now, you can replace with your actual asset */}
        <Image 
          source={{ uri: 'https://cdn-icons-png.flaticon.com/512/3063/3063822.png' }} 
          style={styles.truckImage} 
          resizeMode="contain" 
        />
        <View style={styles.badge}>
          <Text style={styles.badgeText}>ACTIVE SHIFT DEPLOYMENT</Text>
        </View>
      </View>

      {/* Login Card */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View>
            <Text style={styles.cardTitle}>Login Account</Text>
            <Text style={styles.cardSubtitle}>Enter credentials to begin vehicle{"\n"}assignment.</Text>
          </View>
          <MaterialIcons name="eco" size={40} color="#E8F5E9" style={styles.leafIcon} />
        </View>

        {/* Inputs */}
        <View style={styles.inputSection}>
          <Text style={styles.inputLabel}>FULL NAME</Text>
          <View style={styles.inputContainer}>
            <MaterialIcons name="person-outline" size={20} color="#9CA3AF" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="John Doe"
              placeholderTextColor="#9CA3AF"
              value={fullName}
              onChangeText={setFullName}
            />
          </View>

          <Text style={styles.inputLabel}>EMPLOYEE ID</Text>
          <View style={styles.inputContainer}>
            <MaterialIcons name="badge" size={20} color="#9CA3AF" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="CENRO-2024-XXXX"
              placeholderTextColor="#9CA3AF"
              value={employeeId}
              onChangeText={setEmployeeId}
              autoCapitalize="characters"
            />
          </View>
        </View>

        {/* Login Button */}
        <TouchableOpacity 
          style={styles.loginButton} 
          onPress={handleLogin}
          activeOpacity={0.8}
        >
          <Text style={styles.loginButtonText}>Login</Text>
        </TouchableOpacity>
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>OFFICIAL CITY GOVERNMENT PORTAL © 2024</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F4FBF1', // Very light green background
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 50, // For status bar
    paddingBottom: 10,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#4E6C50',
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroSection: {
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 30,
    position: 'relative',
    height: 200,
  },
  truckImage: {
    width: width * 0.8,
    height: 180,
  },
  badge: {
    position: 'absolute',
    bottom: -10,
    left: 40,
    backgroundColor: '#86B588',
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  card: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 20,
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 18,
  },
  leafIcon: {
    opacity: 0.8,
  },
  inputSection: {
    gap: 16,
    marginBottom: 24,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4B5563',
    marginBottom: -8, // Tweak spacing
    marginLeft: 4,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 50,
    backgroundColor: '#FAFAFA',
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: '#1F2937',
  },
  loginButton: {
    backgroundColor: '#4E6C50',
    borderRadius: 12,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loginButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 10,
    color: '#9CA3AF',
    letterSpacing: 0.5,
    fontWeight: '600',
  },
});
