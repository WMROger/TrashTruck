import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { signOut } from 'firebase/auth';
import React, { useEffect } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthContext } from '../../components/AuthContext';
import { auth } from '../../config/firebase';

export default function AdminDashboard() {
  const { user, isAuthenticated } = useAuthContext();
  const router = useRouter();

  useEffect(() => {
    // Check if user is authenticated
    if (!isAuthenticated) {
      console.log('Admin dashboard: User not authenticated, redirecting to login');
      router.replace('/admin/login');
      return;
    }

    console.log('Admin dashboard: User authenticated:', user?.email);
  }, [isAuthenticated, user, router]);

  const handleLogout = async () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout from admin panel?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            try {
              console.log('Admin logout: Starting logout process...');
              await signOut(auth);
              console.log('Admin logout: Successfully logged out');
              router.replace('/admin/login');
            } catch (error) {
              console.error('Admin logout error:', error);
              Alert.alert('Logout Error', 'There was an issue logging out. Please try again.');
            }
          },
        },
      ]
    );
  };

  // Show loading or redirect if not authenticated
  if (!isAuthenticated) {
    return null; // Will redirect to login
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <View>
            <Text style={styles.title}>Admin Dashboard</Text>
            <Text style={styles.subtitle}>TrashTruck Management System</Text>
            <Text style={styles.userInfo}>Logged in as: {user?.email}</Text>
          </View>
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={24} color="white" />
            <Text style={styles.logoutText}>Logout</Text>
          </TouchableOpacity>
        </View>
      </View>
      
      <ScrollView style={styles.content}>
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Ionicons name="trash" size={32} color="#2E8B57" />
            <Text style={styles.statNumber}>1,234</Text>
            <Text style={styles.statLabel}>Collections Today</Text>
          </View>
          
          <View style={styles.statCard}>
            <Ionicons name="car" size={32} color="#4169E1" />
            <Text style={styles.statNumber}>45</Text>
            <Text style={styles.statLabel}>Active Trucks</Text>
          </View>
          
          <View style={styles.statCard}>
            <Ionicons name="people" size={32} color="#FF6347" />
            <Text style={styles.statNumber}>89</Text>
            <Text style={styles.statLabel}>Staff Online</Text>
          </View>
          
          <View style={styles.statCard}>
            <Ionicons name="checkmark-circle" size={32} color="#32CD32" />
            <Text style={styles.statNumber}>98%</Text>
            <Text style={styles.statLabel}>Completion Rate</Text>
          </View>
        </View>
        
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Activity</Text>
          <View style={styles.activityItem}>
            <Ionicons name="time" size={20} color="#666" />
            <Text style={styles.activityText}>Truck #12 completed route in Downtown</Text>
            <Text style={styles.activityTime}>2 minutes ago</Text>
          </View>
          <View style={styles.activityItem}>
            <Ionicons name="alert" size={20} color="#FF6347" />
            <Text style={styles.activityText}>Maintenance alert: Truck #8 needs service</Text>
            <Text style={styles.activityTime}>15 minutes ago</Text>
          </View>
          <View style={styles.activityItem}>
            <Ionicons name="checkmark" size={20} color="#32CD32" />
            <Text style={styles.activityText}>New route assigned to Truck #15</Text>
            <Text style={styles.activityTime}>1 hour ago</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    backgroundColor: '#2E8B57',
    padding: 20,
    paddingTop: 40,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 16,
    color: '#E8F5E8',
  },
  userInfo: {
    fontSize: 14,
    color: '#E8F5E8',
    marginTop: 5,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF6347',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginTop: 10,
  },
  logoutText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 10,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  statsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 30,
  },
  statCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    width: '48%',
    marginBottom: 15,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 10,
  },
  statLabel: {
    fontSize: 14,
    color: '#666',
    marginTop: 5,
    textAlign: 'center',
  },
  section: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  activityText: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    marginLeft: 12,
  },
  activityTime: {
    fontSize: 12,
    color: '#999',
  },
}); 