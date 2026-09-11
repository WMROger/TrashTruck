import { useTheme } from '@/hooks/useTheme';
import { Tabs, useRouter } from 'expo-router';
import { collection, doc, onSnapshot, query, where, updateDoc, serverTimestamp } from 'firebase/firestore';
import React, { useEffect, useRef, useState } from 'react';
import { Platform, Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import NetInfo from '@react-native-community/netinfo';

import { useAuthContext } from '@/components/AuthContext';
import { CustomTabBar } from '@/components/CustomTabBar';
import { auth, db } from '@/config/firebase';
import { MaterialIcons, Feather } from '@expo/vector-icons';

import { locationService } from '@/services/locationService';
import { syncOfflineDriverActions } from '@/services/driverOfflineQueue';

export default function DriverLayout() {
  const { user, loading: authLoading } = useAuthContext();
  const router = useRouter();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [assignedTruckId, setAssignedTruckId] = useState<string | null>(null);
  const [activeRouteCount, setActiveRouteCount] = useState(0);
  const [activeScheduleIds, setActiveScheduleIds] = useState<string[]>([]);
  const [assignedBarangay, setAssignedBarangay] = useState<string>('');
  const [routePolyline, setRoutePolyline] = useState<{ latitude: number; longitude: number }[]>([]);

  // Fleet inventory unassigned notification state
  const [showUnassignedModal, setShowUnassignedModal] = useState(false);
  const [unassignedDetails, setUnassignedDetails] = useState<{
    truckPlate: string;
    unassignedBy: string;
    unassignedAt?: string;
  } | null>(null);
  const previousTruckIdRef = useRef<string | null>(null);
  const previousTruckPlateRef = useRef<string | null>(null);
  const isInitialSnapshotRef = useRef(true);

  // Check if user has driver role
  useEffect(() => {
    if (authLoading) return;
    const activeUid = user?.uid || auth.currentUser?.uid;
    if (!activeUid || !db) {
      setIsAuthorized(false);
      setIsLoading(false);
      router.replace('/auth');
      return;
    }

    const userRef = doc(db, 'users', activeUid);
    const unsub = onSnapshot(userRef, (snap) => {
      if (snap.exists()) {
        const userData = snap.data();
        if (userData.role !== 'driver' && userData.role !== 'admin') {
          // Redirect non-driver users away from driver interface to home
          setIsAuthorized(false);
          setIsLoading(false);
          router.replace('/(tabs)/home');
          return;
        }
        if (userData.disabled === true || userData.status === 'disabled') {
          setIsAuthorized(false);
          setIsLoading(false);
          router.replace('/auth');
          return;
        }

        const prevTruckId = previousTruckIdRef.current;
        const prevPlate = previousTruckPlateRef.current;
        const newTruckId = typeof userData.currentTruckId === 'string' ? userData.currentTruckId : null;
        const newPlate = typeof userData.currentTruckPlate === 'string' ? userData.currentTruckPlate : null;

        // 1. Check if admin explicitly set an unassignedNotice
        if (userData.unassignedNotice && userData.unassignedNotice.acknowledged === false) {
          setUnassignedDetails({
            truckPlate: userData.unassignedNotice.truckPlate || prevPlate || 'Assigned Truck',
            unassignedBy: userData.unassignedNotice.unassignedBy || 'CENRO Fleet Admin',
            unassignedAt: userData.unassignedNotice.unassignedAt,
          });
          setShowUnassignedModal(true);
        }
        // 2. Fallback detection: if driver was active on a truck in the previous tick and is now unassigned
        else if (!isInitialSnapshotRef.current && prevTruckId && !newTruckId && userData.dutyStatus === 'off_duty') {
          if (!userData.unassignedNotice || userData.unassignedNotice.acknowledged === false) {
            setUnassignedDetails({
              truckPlate: prevPlate || 'Assigned Truck',
              unassignedBy: 'CENRO Fleet Admin',
            });
            setShowUnassignedModal(true);
          }
        }

        previousTruckIdRef.current = newTruckId;
        previousTruckPlateRef.current = newPlate;
        isInitialSnapshotRef.current = false;

        setAssignedTruckId(newTruckId);
        setIsAuthorized(true);
      } else {
        setIsAuthorized(true);
      }
      setIsLoading(false);
    }, (error) => {
      if (error?.code !== 'permission-denied') {
        console.warn('DriverLayout: user profile listener error:', error);
      }
      setIsAuthorized(true);
      setIsLoading(false);
    });

    return () => unsub();
  }, [user?.uid, router]);

  const handleAcknowledgeUnassign = async () => {
    setShowUnassignedModal(false);
    const activeUid = user?.uid || auth.currentUser?.uid;
    if (activeUid && db) {
      await locationService.stopTracking(activeUid);
      await locationService.stopSimulation(activeUid);

      try {
        await updateDoc(doc(db, 'users', activeUid), {
          'unassignedNotice.acknowledged': true,
          updatedAt: serverTimestamp(),
        });
      } catch (e) {
        console.warn('Could not mark unassignedNotice acknowledged:', e);
      }
    }
    router.replace('/(driver)');
  };

  const handleSelectNewTruck = async () => {
    setShowUnassignedModal(false);
    const activeUid = user?.uid || auth.currentUser?.uid;
    if (activeUid && db) {
      await locationService.stopTracking(activeUid);
      await locationService.stopSimulation(activeUid);

      try {
        await updateDoc(doc(db, 'users', activeUid), {
          'unassignedNotice.acknowledged': true,
          updatedAt: serverTimestamp(),
        });
      } catch (e) {
        console.warn('Could not mark unassignedNotice acknowledged:', e);
      }
    }
    router.replace('/(driver)/select-truck');
  };

  useEffect(() => {
    if (!user?.uid || !db) return;
    const assignedQuery = query(collection(db, 'schedules'), where('assignedDriverId', '==', user.uid));
    const unsubscribeSchedules = onSnapshot(
      assignedQuery,
      snapshot => {
        const active = snapshot.docs.filter(schedule => !schedule.data().dieselClosedAt && ['pending', 'in-progress', 'in_progress'].includes(String(schedule.data().status)));
        const master = active.filter(schedule => schedule.data().isLiveDispatch);
        setActiveRouteCount(active.length);
        setActiveScheduleIds((master.length ? master : active).map(schedule => schedule.id));
        const targetSchedule = master[0] || active[0];
        const brgy = targetSchedule ? (targetSchedule.data().barangayName || targetSchedule.data().barangay || '') : '';
        setAssignedBarangay(brgy);
        const savedPolyline = active.find(schedule => Array.isArray(schedule.data().routeOptimization?.roadPolyline))?.data().routeOptimization?.roadPolyline || [];
        setRoutePolyline(savedPolyline.filter((point: any) => Number.isFinite(point?.latitude) && Number.isFinite(point?.longitude)));
      },
      error => {
        if (error?.code !== 'permission-denied') {
          console.warn('DriverLayout: schedules listener error:', error);
        }
      }
    );
    const unsubscribeNetwork = NetInfo.addEventListener(state => {
      if (state.isConnected && state.isInternetReachable !== false) syncOfflineDriverActions();
    });
    syncOfflineDriverActions();
    return () => {
      unsubscribeSchedules();
      unsubscribeNetwork();
    };
  }, [user?.uid]);

  // Start GPS Tracking
  useEffect(() => {
    if (user && !isLoading && isAuthorized && assignedTruckId && activeRouteCount > 0) {
      locationService.startTracking(user.uid, assignedTruckId, { activeScheduleIds, routePolyline, barangay: assignedBarangay });
    }
    return () => {
      if (user) {
        locationService.stopTracking(user.uid);
      }
    };
  }, [user, isLoading, isAuthorized, assignedTruckId, activeRouteCount, activeScheduleIds, routePolyline, assignedBarangay]);

  // Show loading while checking driver role
  if (isLoading || !isAuthorized) {
    return null; // Will redirect if needed
  }

  const activeColor = isDark ? '#86EFAC' : '#2E7D32'; 
  const inactiveColor = isDark ? '#9CA3AF' : '#757575';

  return (
    <>
      <Tabs
      initialRouteName="index"
      screenOptions={({ route, navigation }) => ({
        lazy: true,
        headerShown: false,
        tabBarActiveTintColor: activeColor,
        tabBarInactiveTintColor: inactiveColor,
        tabBarButton: (props) => {
          const state = navigation.getState();
          const currentRouteName = state.routes[state.index]?.name;
          const isFocused = currentRouteName === route.name;
          return <CustomTabBar {...props} isFocused={isFocused} />;
        },
        tabBarStyle: {
          backgroundColor: isDark ? '#1F2937' : '#FFFFFF',
          borderTopWidth: 1,
          borderTopColor: isDark ? '#111827' : '#E0E0E0',
          height: 80,
          paddingTop: 8,
          paddingBottom: Platform.OS === 'ios' ? 24 : 8,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          marginTop: 2,
        },
      })}>
      <Tabs.Screen name="diesel-log" options={{ href: null }} />
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="home" size={28} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="pages/DriverSchedulePage"
        options={{
          title: 'Schedule',
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="event" size={28} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="pages/DriverHistoryPage"
        options={{
          title: 'History',
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="history" size={28} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="inbox"
        options={{
          title: 'Inbox',
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="notifications" size={28} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="edit-profile"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="select-truck"
        options={{
          href: null,
          tabBarStyle: { display: 'none' },
        }}
      />
      <Tabs.Screen
        name="route-map"
        options={{
          href: null,
          tabBarStyle: { display: 'none' },
        }}
      />
    </Tabs>

    {/* ⚠️ CENRO FLEET INVENTORY UNASSIGNMENT POPUP MODAL */}
    <Modal
      visible={showUnassignedModal}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={handleAcknowledgeUnassign}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.modalCard, isDark && styles.modalCardDark]}>
          {/* Warning Icon Badge */}
          <View style={[styles.modalIconBadge, isDark && styles.modalIconBadgeDark]}>
            <MaterialIcons name="no-transfer" size={34} color="#DC2626" />
          </View>

          {/* Department Tag */}
          <View style={styles.modalDeptTag}>
            <View style={styles.modalDot} />
            <Text style={styles.modalDeptText}>CENRO FLEET DISPATCH NOTICE</Text>
          </View>

          {/* Modal Title */}
          <Text style={[styles.modalTitle, isDark && styles.textLight]}>
            Truck Assignment Removed
          </Text>

          {/* Description */}
          <Text style={[styles.modalDescription, isDark && styles.textMuted]}>
            You have been unassigned from your collection vehicle in CENRO Fleet Inventory. Your active shift and live GPS tracking have been concluded.
          </Text>

          {/* Vehicle Summary Box */}
          <View style={[styles.vehicleCard, isDark && styles.vehicleCardDark]}>
            <View style={styles.vehicleIconCircle}>
              <MaterialIcons name="local-shipping" size={20} color="#7C3AED" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.vehicleLabel, isDark && styles.textMuted]}>PREVIOUS TRUCK</Text>
              <Text style={[styles.vehiclePlate, isDark && styles.textLight]}>
                {unassignedDetails?.truckPlate || 'Assigned Vehicle'}
              </Text>
            </View>
            <View style={styles.statusBadge}>
              <Text style={styles.statusBadgeText}>UNASSIGNED</Text>
            </View>
          </View>

          <Text style={[styles.modalHint, isDark && styles.textMuted]}>
            If this was done in error, please contact dispatch. Otherwise, you can select an available truck to start a new shift.
          </Text>

          {/* Action Buttons */}
          <View style={styles.modalActions}>
            <TouchableOpacity
              style={styles.selectTruckBtn}
              onPress={handleSelectNewTruck}
              activeOpacity={0.85}
            >
              <MaterialIcons name="add-circle-outline" size={18} color="#FFFFFF" />
              <Text style={styles.selectTruckBtnText}>Select New Truck</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.ackBtn, isDark && styles.ackBtnDark]}
              onPress={handleAcknowledgeUnassign}
              activeOpacity={0.85}
            >
              <MaterialIcons name="check" size={18} color={isDark ? '#D1D5DB' : '#4B5563'} />
              <Text style={[styles.ackBtnText, isDark && styles.textLight]}>
                Acknowledge & Go Off-Duty
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  </>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  modalCardDark: {
    backgroundColor: '#1F2937',
    borderColor: '#374151',
  },
  modalIconBadge: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#FEE2E2',
    borderWidth: 2,
    borderColor: '#FCA5A5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  modalIconBadgeDark: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderColor: '#EF4444',
  },
  modalDeptTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(220, 38, 38, 0.1)',
    marginBottom: 10,
  },
  modalDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#DC2626',
  },
  modalDeptText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    color: '#DC2626',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 8,
  },
  modalDescription: {
    fontSize: 13,
    lineHeight: 19,
    color: '#4B5563',
    textAlign: 'center',
    marginBottom: 18,
  },
  vehicleCard: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 14,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 14,
  },
  vehicleCardDark: {
    backgroundColor: '#111827',
    borderColor: '#374151',
  },
  vehicleIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(124, 58, 237, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  vehicleLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
    color: '#6B7280',
  },
  vehiclePlate: {
    fontSize: 15,
    fontWeight: '800',
    color: '#111827',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#DC2626',
  },
  modalHint: {
    fontSize: 11,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 16,
  },
  modalActions: {
    width: '100%',
    gap: 10,
  },
  selectTruckBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#16A34A',
    paddingVertical: 13,
    borderRadius: 14,
    shadowColor: '#16A34A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  selectTruckBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  ackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    paddingVertical: 12,
    borderRadius: 14,
  },
  ackBtnDark: {
    backgroundColor: '#374151',
    borderColor: '#4B5563',
  },
  ackBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
  },
  textLight: {
    color: '#F9FAFB',
  },
  textMuted: {
    color: '#9CA3AF',
  },
});
