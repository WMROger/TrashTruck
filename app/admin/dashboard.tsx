import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { Alert, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthContext } from '../../components/AuthContext';
import { AdminSidebar, AnnouncementsTab, ReportsTab, ScheduleTab } from '../../components/admin';
import { auth, db } from '../../config/firebase';

export default function AdminDashboard() {
  const { user, isAuthenticated } = useAuthContext();
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [activeTab, setActiveTab] = useState('home');

  useEffect(() => {
    const checkAdminAccess = async () => {
      // Check if user exists (don't use isAuthenticated for admin access)
      if (!user) {
        console.log('Admin dashboard: No user found, redirecting to login');
        router.replace('/admin/login');
        return;
      }

      // Verify admin role in Firestore
      if (db) {
        try {
          const userRef = doc(db, 'users', user.uid);
          const userSnap = await getDoc(userRef);
          
          if (userSnap.exists()) {
            const userData = userSnap.data();
            if (userData.role === 'admin') {
              console.log('Admin dashboard: Admin role confirmed for:', user.email);
              setIsAdmin(true);
              setIsLoading(false);
            } else {
              console.log('Admin dashboard: User does not have admin role:', user.email);
              Alert.alert('Access Denied', 'You do not have admin privileges.');
              await signOut(auth);
              router.replace('/admin/login');
            }
          } else {
            console.log('Admin dashboard: User document not found in Firestore');
            Alert.alert('Access Denied', 'User profile not found.');
            await signOut(auth);
            router.replace('/admin/login');
          }
        } catch (error) {
          console.error('Admin dashboard: Error checking admin role:', error);
          Alert.alert('Error', 'Failed to verify admin privileges.');
          await signOut(auth);
          router.replace('/admin/login');
        }
      } else {
        console.log('Admin dashboard: Firestore not available, proceeding with auth only');
        setIsAdmin(true);
        setIsLoading(false);
      }
    };

    checkAdminAccess();
  }, [user, router]);

  const handleLogout = async () => {
    console.log('Admin logout: Button pressed, showing confirmation modal');
    setShowLogoutModal(true);
  };

  const confirmLogout = async () => {
    try {
      console.log('Admin logout: Starting logout process...');
      setShowLogoutModal(false);
      await signOut(auth);
      console.log('Admin logout: Successfully logged out');
      setIsAdmin(false);
      router.replace('/admin/login');
    } catch (error) {
      console.error('Admin logout error:', error);
      Alert.alert('Logout Error', 'There was an issue logging out. Please try again.');
    }
  };

  const cancelLogout = () => {
    console.log('Admin logout: Cancelled by user');
    setShowLogoutModal(false);
  };

  // Show loading while checking admin access
  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Verifying admin access...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Show loading or redirect if not authenticated or not admin
  if (!user || !isAdmin) {
    return null; // Will redirect to login
  }

  const renderHomeContent = () => (
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
  );

  const renderScheduleContent = () => <ScheduleTab />;

  const renderAnnouncementsContent = () => <AnnouncementsTab />;

  const renderReportsContent = () => <ReportsTab />;

  const renderHistoryContent = () => (
    <ScrollView style={styles.content}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>History</Text>
        <Text style={styles.placeholderText}>History content will be implemented here</Text>
      </View>
    </ScrollView>
  );

  const renderFeedbacksContent = () => (
    <ScrollView style={styles.content}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Feedbacks</Text>
        <Text style={styles.placeholderText}>Feedbacks management content will be implemented here</Text>
      </View>
    </ScrollView>
  );

  const renderContent = () => {
    switch (activeTab) {
      case 'home':
        return renderHomeContent();
      case 'schedule':
        return renderScheduleContent();
      case 'announcements':
        return renderAnnouncementsContent();
      case 'reports':
        return renderReportsContent();
      case 'history':
        return renderHistoryContent();
      case 'feedbacks':
        return renderFeedbacksContent();
      default:
        return renderHomeContent();
    }
  };

  const handleTabPress = (tab: string) => {
    setActiveTab(tab);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <View>
            <Text style={styles.title}>TrashTrack</Text>
            <Text style={styles.subtitle}>Barangay Sambag 2, Cebu City</Text>
            <Text style={styles.userInfo}>Logged in as: {user?.email}</Text>
          </View>
          <TouchableOpacity 
            style={styles.logoutButton} 
            onPress={handleLogout}
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="log-out-outline" size={24} color="white" />
            <Text style={styles.logoutText}>Logout</Text>
          </TouchableOpacity>
        </View>
      </View>
      
      <View style={styles.mainContainer}>
        <AdminSidebar activeTab={activeTab} onTabPress={handleTabPress} />
        <View style={styles.contentContainer}>
          {renderContent()}
        </View>
      </View>

      <Modal
        visible={showLogoutModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowLogoutModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Logout</Text>
            <Text style={styles.modalMessage}>Are you sure you want to logout from admin panel?</Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.modalButton} onPress={confirmLogout}>
                <Text style={styles.modalButtonText}>Logout</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalButton} onPress={cancelLogout}>
                <Text style={styles.modalButtonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  mainContainer: {
    flexDirection: 'row',
    flex: 1,
  },
  contentContainer: {
    flex: 1,
    padding: 20,
  },
  content: {
    flex: 1,
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
  placeholderText: {
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
    padding: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
  },
  loadingText: {
    fontSize: 18,
    color: '#333',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 20,
    width: '80%',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  modalMessage: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
  },
  modalButton: {
    backgroundColor: '#FF6347',
    paddingVertical: 12,
    paddingHorizontal: 25,
    borderRadius: 8,
  },
  modalButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
}); 