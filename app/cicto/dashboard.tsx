import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Alert, Platform, useWindowDimensions, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { SafeAreaView } from 'react-native-safe-area-context';
import { auth, db } from '../../config/firebase';
import { useAuthContext } from '../../components/AuthContext';
import CictoSidebar from '../../components/admin/CictoSidebar';
import {
  CenroCommandTab,
  DataManagementTab,
  CictoDashboardTab,
  FleetOpsTab,
  RewardsTab,
  IdentityAccessTab,
  CictoAuditTrailTab,
  CictoLogoutModal,
  CictoNotificationDropdown,
} from '../../components/admin/cicto';
import { isCictoEmail, ensureCictoProfileInFirestore } from '../../constants/cictoConfig';
import { CictoNotification, subscribeToCictoNotifications } from '../../services/cictoAccountService';

export default function CictoDashboard() {
  const { user, loading: authLoading } = useAuthContext();
  const router = useRouter();
  const [isCictoAdmin, setIsCictoAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [notifications, setNotifications] = useState<CictoNotification[]>([]);
  const [showNotifDropdown, setShowNotifDropdown] = useState(false);
  const { width } = useWindowDimensions();
  const sidebarCollapsed = Platform.OS === 'web' && width < 980;
  
  useEffect(() => {
    const checkCictoAccess = async () => {
      if (authLoading) return;
      if (!user) {
        console.log('CICTO dashboard: No user found, redirecting to login');
        router.replace('/cicto' as any);
        return;
      }

      // Check if user has recognized CICTO email
      if (isCictoEmail(user.email)) {
        console.log('CICTO dashboard: Hardcoded CICTO identity recognized for:', user.email);
        await ensureCictoProfileInFirestore(user.uid, user.email || 'cicto@trashtrack.gov.ph', user.displayName || 'CICTO Super Admin');
        setIsCictoAdmin(true);
        setIsLoading(false);
        return;
      }

      if (db) {
        try {
          const userRef = doc(db, 'users', user.uid);
          const userSnap = await getDoc(userRef);
          
          if (userSnap.exists()) {
            const userData = userSnap.data();
            if (userData.role === 'cicto') {
              console.log('CICTO dashboard: CICTO role confirmed for:', user.email);
              setIsCictoAdmin(true);
              setIsLoading(false);
            } else {
              console.log('CICTO dashboard: User does not have cicto role:', user.email);
              Alert.alert('Access Denied', 'You do not have CICTO admin privileges.');
              await signOut(auth);
              router.replace('/cicto' as any);
            }
          } else {
            console.log('CICTO dashboard: User document not found');
            Alert.alert('Access Denied', 'User profile not found.');
            await signOut(auth);
            router.replace('/cicto' as any);
          }
        } catch (error) {
          console.error('CICTO dashboard: Error checking role:', error);
          Alert.alert('Error', 'Failed to verify privileges.');
          await signOut(auth);
          router.replace('/cicto' as any);
        }
      } else {
        Alert.alert('Access Unavailable', 'CICTO clearance cannot be verified because Firestore is unavailable.');
        try { await signOut(auth); } catch {}
        router.replace('/cicto' as any);
        setIsLoading(false);
      }
    };

    checkCictoAccess();
  }, [authLoading, router, user]);

  useEffect(() => {
    if (!isCictoAdmin) return;
    const unsubscribe = subscribeToCictoNotifications((notifs) => {
      setNotifications(notifs);
    });
    return () => unsubscribe();
  }, [isCictoAdmin]);

  const activeLogCount = notifications.filter((n) => n.status === 'active').length;

  const handleLogout = () => {
    setShowLogoutModal(true);
  };

  const handleConfirmLogout = async () => {
    try {
      await signOut(auth);
      setShowLogoutModal(false);
      router.replace('/cicto' as any);
    } catch (error) {
      console.error('CICTO logout error:', error);
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
        return <CictoDashboardTab onNavigateTab={setActiveTab} />;
      case 'data-management':
      case 'data-mgmt':
        return <DataManagementTab />;
      case 'fleet-ops':
        return <FleetOpsTab />;
      case 'cenro-command':
        return <CenroCommandTab />;
      case 'activity-logs':
      case 'audit-trail':
      case 'activity':
        return <CictoAuditTrailTab />;
      default:
        return <CictoDashboardTab onNavigateTab={setActiveTab} />;
    }
  };

  if (isLoading || authLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#374151" />
        <Text style={styles.loadingText}>Verifying CICTO clearance...</Text>
      </View>
    );
  }

  if (!isCictoAdmin) {
    return null;
  }

  return (
    <SafeAreaView style={styles.container} edges={['right', 'bottom', 'left']}>
      <View style={styles.dashboardLayout}>
        <CictoSidebar 
          activeTab={activeTab} 
          onTabChange={setActiveTab} 
          onLogout={handleLogout} 
          collapsed={sidebarCollapsed}
        />
        
        <View style={styles.mainContent}>
          {/* Header Bar */}
          <View style={styles.headerBar}>
            <Text style={styles.headerTitle}>TrashTrack CICTO Oversight Portal</Text>
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
          <CictoNotificationDropdown
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

      {/* CICTO Admin Logout Confirmation Modal */}
      <CictoLogoutModal
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
    zIndex: 10,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    letterSpacing: -0.5,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  bellBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  bellBtnActive: {
    backgroundColor: '#FEE2E2',
  },
  badgeContainer: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: '#DC2626',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  profileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 24,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  adminInfo: {
    alignItems: 'flex-end',
  },
  adminName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1F2937',
  },
  adminRole: {
    fontSize: 10,
    fontWeight: '600',
    color: '#0F766E',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  avatarPlaceholder: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#0F766E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  tabContent: {
    flex: 1,
    overflow: 'hidden',
  },
});
