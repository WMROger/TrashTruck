import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Alert, Platform, useWindowDimensions, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { SafeAreaView } from 'react-native-safe-area-context';
import { auth, db } from '../../config/firebase';
import { useAuthContext } from '../../components/AuthContext';
import DictSidebar from '../../components/admin/DictSidebar';
import { CenroCommandTab, DataManagementTab, DictDashboardTab, FleetOpsTab, RewardsTab, IdentityAccessTab, DictLogoutModal, DictNotificationDropdown } from '../../components/admin/dict';
import { isDictEmail, ensureDictProfileInFirestore } from '../../constants/dictConfig';
import { DictNotification, subscribeToDictNotifications } from '../../services/dictAccountService';

export default function DictDashboard() {
  const { user, loading: authLoading } = useAuthContext();
  const router = useRouter();
  const [isDictAdmin, setIsDictAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [notifications, setNotifications] = useState<DictNotification[]>([]);
  const [showNotifDropdown, setShowNotifDropdown] = useState(false);
  const { width } = useWindowDimensions();
  const sidebarCollapsed = Platform.OS === 'web' && width < 980;
  
  useEffect(() => {
    const checkDictAccess = async () => {
      if (authLoading) return;
      if (!user) {
        console.log('DICT dashboard: No user found, redirecting to login');
        router.replace('/dict');
        return;
      }

      // Check if user has recognized DICT email
      if (isDictEmail(user.email)) {
        console.log('DICT dashboard: Hardcoded DICT identity recognized for:', user.email);
        await ensureDictProfileInFirestore(user.uid, user.email || 'dict@trashtrack.gov.ph', user.displayName || 'DICT Super Admin');
        setIsDictAdmin(true);
        setIsLoading(false);
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
              router.replace('/dict');
            }
          } else {
            console.log('DICT dashboard: User document not found');
            Alert.alert('Access Denied', 'User profile not found.');
            await signOut(auth);
            router.replace('/dict');
          }
        } catch (error) {
          console.error('DICT dashboard: Error checking role:', error);
          Alert.alert('Error', 'Failed to verify privileges.');
          await signOut(auth);
          router.replace('/dict');
        }
      } else {
        Alert.alert('Access Unavailable', 'DICT clearance cannot be verified because Firestore is unavailable.');
        try { await signOut(auth); } catch {}
        router.replace('/dict');
        setIsLoading(false);
      }
    };

    checkDictAccess();
  }, [authLoading, router, user]);

  useEffect(() => {
    if (!isDictAdmin) return;
    const unsubscribe = subscribeToDictNotifications((notifs) => {
      setNotifications(notifs);
    });
    return () => unsubscribe();
  }, [isDictAdmin]);

  const activeLogCount = notifications.filter((n) => n.status === 'active').length;

  const handleLogout = () => {
    setShowLogoutModal(true);
  };

  const handleConfirmLogout = async () => {
    try {
      await signOut(auth);
      setShowLogoutModal(false);
      router.replace('/dict');
    } catch (error) {
      console.error('DICT logout error:', error);
      Alert.alert('Logout Error', 'Failed to sign out. Please try again.');
    }
  };

  const renderActiveTab = () => {
    switch (activeTab) {
      case 'rewards':
        return <RewardsTab />;
      case 'identity-access':
        return <IdentityAccessTab />;
      case 'dashboard':
        return <DictDashboardTab />;
      case 'data-management':
        return <DataManagementTab />;
      case 'fleet-ops':
        return <FleetOpsTab />;
      case 'cenro-command':
        return <CenroCommandTab />;
      default:
        return <DictDashboardTab />;
    }
  };

  if (isLoading || authLoading) {
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
          collapsed={sidebarCollapsed}
        />
        
        <View style={[styles.mainContent, Platform.OS === 'web' ? { marginLeft: sidebarCollapsed ? 80 : 280 } : null]}>
          {/* Header Bar */}
          <View style={styles.headerBar}>
            <Text style={styles.headerTitle}>TrashTrack DICT Oversight Portal</Text>
            <View style={styles.headerRight}>
              {/* Notification Bell Button */}
              <TouchableOpacity
                style={[styles.bellBtn, activeLogCount > 0 && styles.bellBtnActive]}
                onPress={() => setShowNotifDropdown(!showNotifDropdown)}
                activeOpacity={0.7}
              >
                <MaterialIcons
                  name={activeLogCount > 0 ? "notifications-active" : "notifications-none"}
                  size={22}
                  color={activeLogCount > 0 ? "#DC2626" : "#4B5563"}
                />
                {activeLogCount > 0 ? (
                  <View style={styles.badgeContainer}>
                    <Text style={styles.badgeText}>{activeLogCount}</Text>
                  </View>
                ) : null}
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.profileBtn} 
                onPress={handleLogout}
                activeOpacity={0.8}
              >
                <View style={styles.adminInfo}>
                  <Text style={styles.adminName}>{user?.displayName || user?.email?.split('@')[0] || 'SUPER ADMIN'}</Text>
                  <Text style={styles.adminRole}>Administrator Console</Text>
                </View>
                <View style={styles.avatarPlaceholder}>
                  <Text style={styles.avatarText}>{(user?.displayName || user?.email || 'A').charAt(0).toUpperCase()}</Text>
                </View>
              </TouchableOpacity>
            </View>
          </View>

          {/* Notification Dropdown Panel */}
          <DictNotificationDropdown
            visible={showNotifDropdown}
            notifications={notifications}
            onClose={() => setShowNotifDropdown(false)}
          />

          {/* Tab Content */}
          <View style={styles.tabContent}>
            {renderActiveTab()}
          </View>
        </View>
      </View>

      {/* DICT Admin Logout Confirmation Modal */}
      <DictLogoutModal
        visible={showLogoutModal}
        userEmail={user?.email}
        userName={user?.displayName}
        onConfirm={handleConfirmLogout}
        onCancel={() => setShowLogoutModal(false)}
      />
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
  bellBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  bellBtnActive: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  badgeContainer: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#DC2626',
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  profileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
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
