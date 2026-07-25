import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Alert, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { SafeAreaView } from 'react-native-safe-area-context';
import { auth, db } from '../../config/firebase';
import { useAuthContext } from '../../components/AuthContext';
import DictSidebar from '../../components/admin/DictSidebar';
import { RewardsTab, IdentityAccessTab } from '../../components/admin/dict';

export default function DictDashboard() {
  const { user } = useAuthContext();
  const router = useRouter();
  const [isDictAdmin, setIsDictAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('identity-access'); // Defaulting to identity-access for dict admins
  
  useEffect(() => {
    const checkDictAccess = async () => {
      if (!user) {
        console.log('DICT dashboard: No user found, redirecting to login');
        router.replace('/admin/login');
        return;
      }

      if (db) {
        try {
          const userRef = doc(db, 'users', user.uid);
          const userSnap = await getDoc(userRef);
          
          if (userSnap.exists()) {
            const userData = userSnap.data();
            if (userData.role === 'dict') {
              console.log('DICT dashboard: DICT role confirmed for:', user.email);
              setIsDictAdmin(true);
              setIsLoading(false);
            } else {
              console.log('DICT dashboard: User does not have dict role:', user.email);
              Alert.alert('Access Denied', 'You do not have DICT admin privileges.');
              await signOut(auth);
              router.replace('/admin/login');
            }
          } else {
            console.log('DICT dashboard: User document not found');
            Alert.alert('Access Denied', 'User profile not found.');
            await signOut(auth);
            router.replace('/admin/login');
          }
        } catch (error) {
          console.error('DICT dashboard: Error checking role:', error);
          Alert.alert('Error', 'Failed to verify privileges.');
          await signOut(auth);
          router.replace('/admin/login');
        }
      } else {
        // Fallback for development without Firestore
        setIsDictAdmin(true);
        setIsLoading(false);
      }
    };

    checkDictAccess();
  }, [user]);

  const handleLogout = async () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to log out?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Logout', 
          style: 'destructive',
          onPress: async () => {
            try {
              await signOut(auth);
              router.replace('/admin/login');
            } catch (error) {
              console.error('Logout error:', error);
            }
          }
        }
      ]
    );
  };

  const renderActiveTab = () => {
    switch (activeTab) {
      case 'rewards':
        return <RewardsTab />;
      case 'identity-access':
        return <IdentityAccessTab />;
      // TODO: Add other tabs here as they are built
      case 'dashboard':
      case 'data-management':
      case 'fleet-ops':
      case 'cenro-command':
      default:
        return (
          <View style={styles.placeholderContainer}>
            <Text style={styles.placeholderText}>
              {activeTab.replace('-', ' ').toUpperCase()} Tab (Under Construction)
            </Text>
          </View>
        );
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#374151" />
        <Text style={styles.loadingText}>Verifying DICT clearance...</Text>
      </View>
    );
  }

  if (!isDictAdmin) {
    return null;
  }

  return (
    <SafeAreaView style={styles.container} edges={['right', 'bottom', 'left']}>
      <View style={styles.dashboardLayout}>
        <DictSidebar 
          activeTab={activeTab} 
          onTabChange={setActiveTab} 
          onLogout={handleLogout} 
        />
        
        <View style={styles.mainContent}>
          {/* Header Bar */}
          <View style={styles.headerBar}>
            <Text style={styles.headerTitle}>CENRO Civic Steward</Text>
            <View style={styles.headerRight}>
              <View style={styles.adminInfo}>
                <Text style={styles.adminName}>{user?.displayName || user?.email?.split('@')[0] || 'SUPER ADMIN'}</Text>
                <Text style={styles.adminRole}>Administrator Console</Text>
              </View>
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarText}>{(user?.displayName || user?.email || 'A').charAt(0).toUpperCase()}</Text>
              </View>
            </View>
          </View>

          {/* Tab Content */}
          <View style={styles.tabContent}>
            {renderActiveTab()}
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  dashboardLayout: {
    flex: 1,
    flexDirection: 'row',
  },
  mainContent: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    ...(Platform.OS === 'web' ? { marginLeft: 280 } : {}), // Margin for fixed sidebar on web
  },
  headerBar: {
    height: 70,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#374151',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  adminInfo: {
    alignItems: 'flex-end',
  },
  adminName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#111827',
  },
  adminRole: {
    fontSize: 11,
    color: '#6B7280',
  },
  avatarPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#4B6354',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 16,
  },
  tabContent: {
    flex: 1,
  },
  placeholderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    fontSize: 16,
    color: '#9CA3AF',
    fontWeight: '500',
  }
});
