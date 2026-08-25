import { useAuthContext } from '@/components/AuthContext';
import { auth, db } from '@/config/firebase';
import { Feather, MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { collection, onSnapshot, query, where, doc, getDoc, updateDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View, Modal } from 'react-native';

import CompletePickupModal from '@/components/driver/CompletePickupModal';
import ReportIssueModal from '@/components/driver/ReportIssueModal';
import { useTheme } from '@/hooks/useTheme';
import { locationService, SimulationState } from '@/services/locationService';
import MapView, { Marker, Polyline } from '@/components/MapView';
import { getBarangaySimulationRoute } from '@/constants/barangaySimulationRoutes';

interface NextPickup {
  id: string;
  street: string;
  wasteCategory: string;
  timeText: string;
  dateText: string;
  status: string;
  isLiveDispatch?: boolean;
  routeOrder?: number;
}

interface HistoryItem {
  id: string;
  street: string;
  wasteCategory: string;
  completedAt: any;
  status: string;
  completionImage?: string;
}

export default function DriverIndex() {
  const router = useRouter();
  const { user } = useAuthContext();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [nextPickup, setNextPickup] = useState<NextPickup | null>(null);
  const [liveDispatches, setLiveDispatches] = useState<NextPickup[]>([]);
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isShiftActive, setIsShiftActive] = useState(false);
  
  // Modal states
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [showEndShiftModal, setShowEndShiftModal] = useState(false);
  const [isEndingShift, setIsEndingShift] = useState(false);
  const [showActiveShiftModal, setShowActiveShiftModal] = useState(false);
  const [selectedPickupId, setSelectedPickupId] = useState<string | null>(null);
  const [activeToastAlert, setActiveToastAlert] = useState<{ id: string; title: string; message: string } | null>(null);

  // Current truck assignment
  const [currentTruck, setCurrentTruck] = useState<{ id: string; plateNumber: string; type: string } | null>(null);

  // Driver assigned barangay from Firestore
  const [assignedBarangay, setAssignedBarangay] = useState<string>('Poblacion');

  // GPS Simulation state
  const [simulationState, setSimulationState] = useState<SimulationState>(locationService.getSimulationState());

  // Real-time listener for newly injected route waypoints
  useEffect(() => {
    const activeUid = user?.uid || auth?.currentUser?.uid;
    if (!activeUid || !db) return;

    const notifsRef = collection(db, 'notifications');
    const qNotifs = query(
      notifsRef,
      where('userId', '==', activeUid),
      where('type', '==', 'route_waypoint_added'),
      where('read', '==', false)
    );

    const unsub = onSnapshot(qNotifs, (snap) => {
      if (!snap.empty) {
        const firstDoc = snap.docs[0];
        const data = firstDoc.data();
        setActiveToastAlert({
          id: firstDoc.id,
          title: data.title || '🚨 New Pickup Added to Route',
          message: data.message || 'A new verified citizen report was slotted into your route.',
        });
      }
    });

    return () => unsub();
  }, [user]);

  // Barangay Simulation Route Points for Mini-Map
  const barangayRoutePoints = React.useMemo(() => {
    return getBarangaySimulationRoute(assignedBarangay).map((pt) => ({
      latitude: pt.latitude,
      longitude: pt.longitude,
    }));
  }, [assignedBarangay]);

  // Current coordinate for the truck marker on the mini-map
  const currentTruckCoord = simulationState.currentCoordinate || (
    barangayRoutePoints[0] ? barangayRoutePoints[0] : { latitude: 10.5218, longitude: 124.0285 }
  );

  useEffect(() => {
    return locationService.onSimulationChange((state) => {
      setSimulationState({ ...state });
    });
  }, []);

  const handleToggleSimulation = async () => {
    const activeUser = user || auth?.currentUser;
    if (!activeUser) {
      Alert.alert('Authentication Required', 'Please sign in to run GPS simulation.');
      return;
    }

    if (simulationState.isActive) {
      await locationService.stopSimulation(activeUser.uid);
    } else {
      const truckId = currentTruck?.id || currentTruck?.plateNumber || 'TRUCK-DANAO-01';
      await locationService.startSimulation(activeUser.uid, truckId, assignedBarangay);
    }
  };

  useEffect(() => {
    if (!db || !auth?.currentUser) {
      setLoading(false);
      return;
    }

    const currentUser = auth.currentUser;
    // Fetch Next Pickup & Live Dispatches
    const nextPickupQuery = query(
      collection(db, 'schedules'),
      where('assignedDriverId', '==', currentUser.uid)
    );
    const unsubscribeNextPickup = onSnapshot(nextPickupQuery, (snapshot) => {
      let todayPickups: NextPickup[] = [];
      let liveDispatchesData: NextPickup[] = [];
      const todayString = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
      
      snapshot.forEach((doc) => {
        const data = doc.data();
        
        if (data.status === 'pending' || data.status === 'in_progress' || !data.status) {
          if (data.barangay && typeof data.barangay === 'string' && data.barangay.trim()) {
            setAssignedBarangay(data.barangay.trim());
          }
          if (data.isLiveDispatch) {
            liveDispatchesData.push({
              id: doc.id,
              street: data.street || 'Unknown Street',
              wasteCategory: data.wasteCategory || 'General',
              timeText: data.timeText || 'ASAP',
              dateText: data.dateText || 'Unknown Date',
              status: data.status || 'pending',
              isLiveDispatch: true,
              routeOrder: data.routeOrder || 0
            });
          } else if (data.dateText === todayString || data.dateText === 'Today') {
            todayPickups.push({
              id: doc.id,
              street: data.street || 'Unknown Street',
              wasteCategory: data.wasteCategory || 'General',
              timeText: data.timeText || 'Unknown Time',
              dateText: data.dateText || 'Unknown Date',
              status: data.status || 'pending',
              isLiveDispatch: false,
            });
          }
        }
      });
      
      todayPickups.sort((a, b) => a.timeText.localeCompare(b.timeText));
      setNextPickup(todayPickups.length > 0 ? todayPickups[0] : null);

      liveDispatchesData.sort((a, b) => (a.routeOrder || 0) - (b.routeOrder || 0));
      setLiveDispatches(liveDispatchesData);
    });

    // Fetch History
    const historyQuery = query(
      collection(db, 'schedules'),
      where('assignedDriverId', '==', currentUser.uid),
      where('status', 'in', ['completed', 'issue'])
    );

    const unsubscribeHistory = onSnapshot(historyQuery, (snapshot) => {
      const historyList: HistoryItem[] = [];
      
      snapshot.forEach((doc) => {
        const data = doc.data();
        
        const isIssue = data.status === 'issue';
          const combinedTimestamp = data.completedAt || data.issueReportedAt || new Date();
        historyList.push({
            id: doc.id,
            street: data.street || 'Unknown Street',
            wasteCategory: data.wasteCategory || 'General',
            completedAt: combinedTimestamp,
            status: isIssue ? 'issue' : 'completed',
            completionImage: (isIssue ? data.issueImage : data.completionImage) || null
        });
      });
      
      const toMillis = (ts: any) => ts?.toMillis ? ts.toMillis() : new Date(ts).getTime();
      historyList.sort((a, b) => toMillis(b.completedAt) - toMillis(a.completedAt));
      
      setHistoryItems(historyList.slice(0, 5));
      setLoading(false);
    });

    return () => {
      unsubscribeNextPickup();
      unsubscribeHistory();
    };
  }, [user]);

  // Listen for current user profile & truck assignment
  useEffect(() => {
    const currentUid = auth?.currentUser?.uid || user?.uid;
    if (!db || !currentUid) return;

    const unsubUser = onSnapshot(doc(db, 'users', currentUid), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        const b = (data.assignedBarangay || data.barangay || '').trim();
        if (b) {
          setAssignedBarangay(b);
        }
        if (data.currentTruckId) {
          // Listen to the truck document for real-time info
          const unsubTruck = onSnapshot(doc(db, 'trucks', data.currentTruckId), (truckSnap) => {
            if (truckSnap.exists()) {
              const truckData = truckSnap.data();
              setCurrentTruck({
                id: truckSnap.id,
                plateNumber: truckData.plateNumber || 'Unknown',
                type: truckData.type || 'Truck',
              });
              setIsShiftActive(true);
            } else {
              setCurrentTruck(null);
              setIsShiftActive(false);
            }
          });
          return () => unsubTruck();
        } else {
          setCurrentTruck(null);
          setIsShiftActive(false);
        }
      }
    });

    return () => unsubUser();
  }, [user?.uid, auth?.currentUser?.uid]);

  const handleCompletePickup = (id: string) => {
    setSelectedPickupId(id);
    setShowCompleteModal(true);
  };

  const handleIssuePickup = (id: string) => {
    setSelectedPickupId(id);
    setShowIssueModal(true);
  };

  const handleNavigate = (scheduleId: string) => {
    router.push({ pathname: '/(driver)/route-map', params: { scheduleId } });
  };

  const handleSeeAllSchedule = () => {
    router.push('/(driver)/pages/DriverSchedulePage');
  };

  const handleSeeAllHistory = () => {
    router.push('/(driver)/pages/DriverHistoryPage');
  };

  const handleEndShift = () => {
    setShowEndShiftModal(true);
  };

  const confirmEndShift = async () => {
    if (isEndingShift) return;
    setIsEndingShift(true);

    try {
      const activeUid = user?.uid || auth?.currentUser?.uid;
      if (activeUid && db) {
        // 1. Stop location simulation and tracking
        try {
          if (simulationState.isActive) {
            await locationService.stopSimulation(activeUid);
          }
          await locationService.stopTracking(activeUid);
        } catch (locErr) {
          console.warn('Error stopping location tracking on end shift:', locErr);
        }

        // 2. Identify truck to release
        let targetTruckId = currentTruck?.id;
        if (!targetTruckId) {
          try {
            const userSnap = await getDoc(doc(db, 'users', activeUid));
            targetTruckId = userSnap.data()?.currentTruckId;
          } catch {}
        }

        // 3. Release truck document in /trucks
        if (targetTruckId) {
          try {
            await updateDoc(doc(db, 'trucks', targetTruckId), {
              assignedDriverId: null,
              assignedDriverName: null,
              shiftStartedAt: null,
              updatedAt: serverTimestamp(),
            });
          } catch (truckErr) {
            console.warn('Could not release truck document on end shift:', truckErr);
          }
        }

        // 4. Update driver profile in /users to off-duty
        try {
          await updateDoc(doc(db, 'users', activeUid), {
            currentTruckId: null,
            currentTruckPlate: null,
            assignedTruck: null,
            status: 'off_duty',
            dutyStatus: 'off_duty',
            updatedAt: serverTimestamp(),
          });
        } catch (userErr) {
          console.warn('Could not update user profile on end shift:', userErr);
        }

        // 5. Update /truck_locations status
        try {
          await setDoc(doc(db, 'truck_locations', activeUid), {
            status: 'inactive',
            isBroadcasting: false,
            lastUpdate: serverTimestamp(),
          }, { merge: true });
        } catch (locErr) {
          console.warn('Could not update truck_locations on end shift:', locErr);
        }
      }

      setIsShiftActive(false);
      setCurrentTruck(null);
      setShowEndShiftModal(false);

      // Navigate back to user/home portal
      router.replace('/(tabs)/home');
    } catch (e: any) {
      console.error('End shift error:', e);
      Alert.alert('Error', e.message || 'Failed to end shift. Please try again.');
    } finally {
      setIsEndingShift(false);
    }
  };

  const handleBackToUserPortal = () => {
    if (currentTruck) {
      setShowActiveShiftModal(true);
      return;
    }
    router.replace('/(tabs)/home');
  };

  if (loading) {
    return (
      <View style={[styles.container, isDark && styles.containerDark, styles.center]}>
        <ActivityIndicator size="large" color={isDark ? "#86EFAC" : "#4E6C50"} />
      </View>
    );
  }

  return (
    <ScrollView style={[styles.container, isDark && styles.containerDark]} showsVerticalScrollIndicator={false}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={isDark ? "#111827" : "#F4FBF1"} />
      
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.logoContainer}>
          <Image 
            source={require('@/assets/images/trashtrack_logo_driver.png')}
            style={styles.logoIcon}
            resizeMode="contain"
          />
          <Text style={[styles.logoText, isDark && styles.textLight]}>TrashTrack</Text>
        </View>
        
        <View style={styles.headerRight}>
          <View style={[
            styles.driverStatusBadge,
            isShiftActive ? styles.driverStatusOnDuty : styles.driverStatusOffDuty,
            isDark && (isShiftActive ? styles.driverStatusOnDutyDark : styles.driverStatusOffDutyDark)
          ]}>
            <View style={[styles.driverStatusDot, { backgroundColor: isShiftActive ? '#22C55E' : '#9CA3AF' }]} />
            <Text style={[styles.driverStatusBadgeText, { color: isShiftActive ? (isDark ? '#86EFAC' : '#15803D') : (isDark ? '#D1D5DB' : '#6B7280') }]}>
              {isShiftActive ? 'ON DUTY' : 'OFF DUTY'}
            </Text>
          </View>
        </View>
      </View>

      {/* Real-Time AI Route Waypoint Alert Banner */}
      {activeToastAlert && (
        <View style={[styles.toastAlertCard, isDark && styles.toastAlertCardDark]}>
          <View style={styles.toastAlertIconWrapper}>
            <MaterialIcons name="navigation" size={20} color="#FFFFFF" />
          </View>
          <View style={styles.toastAlertTextWrapper}>
            <Text style={styles.toastAlertTitleText}>{activeToastAlert.title}</Text>
            <Text style={[styles.toastAlertMessageText, isDark && styles.textLight]} numberOfLines={2}>
              {activeToastAlert.message}
            </Text>
          </View>
          <View style={styles.toastAlertActionsRow}>
            <TouchableOpacity
              style={styles.toastAlertViewBtn}
              onPress={() => {
                if (db && activeToastAlert.id) {
                  updateDoc(doc(db, 'notifications', activeToastAlert.id), { read: true }).catch(() => {});
                }
                setActiveToastAlert(null);
                router.push('/(driver)/route-map');
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.toastAlertViewBtnText}>View Route</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.toastAlertDismissBtn}
              onPress={() => {
                if (db && activeToastAlert.id) {
                  updateDoc(doc(db, 'notifications', activeToastAlert.id), { read: true }).catch(() => {});
                }
                setActiveToastAlert(null);
              }}
              activeOpacity={0.7}
            >
              <MaterialIcons name="close" size={16} color={isDark ? '#9CA3AF' : '#6B7280'} />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Welcome & Shift Section */}
      <View style={[styles.welcomeSection, isDark && styles.cardDark]}>
        <View style={styles.welcomeLeft}>
          <Text style={[styles.welcomeText, isDark && styles.textMuted]}>Welcome back, {user?.displayName || 'Driver'}</Text>
          <Text style={[styles.statusText, { color: isShiftActive ? (isDark ? '#86EFAC' : '#2E8B57') : (isDark ? '#6B7280' : '#9CA3AF') }]}>
            {isShiftActive ? 'Active Shift' : 'Off Duty'}
          </Text>
          {currentTruck && (
            <View style={styles.truckBadgeRow}>
              <MaterialIcons name="local-shipping" size={14} color={isDark ? '#86EFAC' : '#2E8B57'} />
              <Text style={[styles.truckBadgeText, isDark && { color: '#86EFAC' }]}>{currentTruck.plateNumber} • {currentTruck.type}</Text>
            </View>
          )}
        </View>
        <View style={styles.shiftActions}>
          {isShiftActive && (
            <TouchableOpacity onPress={handleEndShift} style={styles.endShiftBtn}>
              <MaterialIcons name="power-settings-new" size={18} color="#DC2626" />
              <Text style={styles.endShiftText}>End Shift</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={handleBackToUserPortal} style={styles.backToPortalBtn}>
            <Feather name="arrow-left" size={16} color={isDark ? '#9CA3AF' : '#6B7280'} />
            <Text style={[styles.backToPortalText, isDark && { color: '#9CA3AF' }]}>User App</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Interactive Live Route Mini-Map Card - Active when Driver is ON DUTY with assigned truck */}
      {isShiftActive && !!currentTruck && (
        <View style={[styles.miniMapCard, isDark && styles.miniMapCardDark, simulationState.isActive && styles.miniMapCardActive]}>
          {/* Mini-Map Header Bar */}
          <View style={styles.miniMapHeader}>
            <View style={styles.miniMapHeaderLeft}>
              <View style={[styles.miniMapLivePill, isDark && styles.miniMapLivePillDark]}>
                <View style={[styles.miniMapLiveDot, simulationState.isActive && { backgroundColor: '#16A34A' }]} />
                <Text style={[styles.miniMapLiveText, isDark && { color: '#86EFAC' }]}>
                  {simulationState.isActive ? 'LIVE TELEMETRY' : 'ROUTE MAP'}
                </Text>
              </View>
              <Text style={[styles.miniMapTitle, isDark && styles.textLight]} numberOfLines={1}>
                Brgy. {assignedBarangay} Path
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.expandMapBtn, isDark && styles.expandMapBtnDark]}
              onPress={() => router.push('/(driver)/route-map')}
              activeOpacity={0.8}
            >
              <Feather name="maximize-2" size={13} color={isDark ? '#86EFAC' : '#166534'} />
              <Text style={[styles.expandMapBtnText, isDark && { color: '#86EFAC' }]}>Full Map</Text>
            </TouchableOpacity>
          </View>

          {/* Interactive Mini-Map Canvas */}
          <View style={[styles.mapCanvasContainer, isDark && styles.mapCanvasContainerDark]}>
            <MapView
              style={styles.miniMapCanvas}
              initialRegion={{
                latitude: currentTruckCoord.latitude,
                longitude: currentTruckCoord.longitude,
                latitudeDelta: 0.02,
                longitudeDelta: 0.02,
              }}
              showsCompass={false}
              showsMyLocationButton={false}
            >
              {barangayRoutePoints.length > 1 && (
                <Polyline
                  coordinates={barangayRoutePoints}
                  strokeColor="#2E8B57"
                  strokeWidth={4}
                />
              )}

              {currentTruckCoord && (
                <Marker coordinate={currentTruckCoord} anchor={{ x: 0.5, y: 0.5 }} title="Your Truck">
                  <View style={styles.truckMarkerContainer}>
                    <MaterialIcons name="local-shipping" size={15} color="#FFFFFF" />
                  </View>
                </Marker>
              )}
            </MapView>

            {/* Floating Live Telemetry Bar */}
            <View style={[styles.telemetryOverlay, isDark && styles.telemetryOverlayDark]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 }}>
                <MaterialIcons
                  name={simulationState.isActive ? 'navigation' : 'location-on'}
                  size={15}
                  color={isDark ? '#86EFAC' : '#16A34A'}
                />
                <Text style={[styles.telemetryStreetText, isDark && styles.textLight]} numberOfLines={1}>
                  {simulationState.isActive ? simulationState.locationName : `Sector: Brgy. ${assignedBarangay}`}
                </Text>
              </View>
              <View style={[styles.telemetrySpeedBox, isDark && styles.telemetrySpeedBoxDark]}>
                <Text style={[styles.telemetrySpeedVal, { color: simulationState.isActive ? (simulationState.currentSpeedKph >= 60 ? '#DC2626' : '#16A34A') : (isDark ? '#9CA3AF' : '#6B7280') }]}>
                  {simulationState.isActive ? `${simulationState.currentSpeedKph} km/h` : 'Standby'}
                </Text>
              </View>
            </View>
          </View>

          {/* Mini-Map Simulator & Telemetry Controls */}
          <View style={styles.miniMapFooter}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[styles.miniMapFooterLabel, isDark && styles.textMuted]} numberOfLines={1}>
                {simulationState.isActive ? `Streaming: ${simulationState.currentStep}/${simulationState.totalSteps} Waypoints` : `Truck: ${currentTruck.plateNumber}`}
              </Text>
              <Text style={[styles.miniMapFooterSub, isDark && styles.textLight]} numberOfLines={1}>
                {simulationState.isActive ? 'Real-time telemetry to dispatch' : 'GPS navigation active'}
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.simDriveBtn, simulationState.isActive ? styles.simDriveBtnStop : styles.simDriveBtnStart]}
              onPress={handleToggleSimulation}
              activeOpacity={0.85}
            >
              <MaterialIcons
                name={simulationState.isActive ? 'stop' : 'play-arrow'}
                size={16}
                color="#FFFFFF"
              />
              <Text style={styles.simDriveBtnText}>
                {simulationState.isActive ? 'Stop Drive' : 'Start Drive'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Live Dispatches (AI Optimized Routes) */}
      {isShiftActive && liveDispatches.length > 0 && (
        <View style={[styles.alertsContainer, isDark && styles.alertsContainerDark]}>
          <View style={styles.alertHeader}>
            <View style={styles.liveIndicator}>
              <View style={styles.pulsingDot} />
              <Text style={[styles.alertTitle, isDark && {color: '#C4B5FD'}]}>LIVE ROUTE DISPATCH ({liveDispatches.length})</Text>
            </View>
            <Text style={[styles.alertSubtitle, isDark && {color: '#A78BFA'}]}>AI Optimized Collection Path</Text>
          </View>
          
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false} 
            style={styles.alertsScroll}
            contentContainerStyle={{ paddingRight: 32 }}
          >
            {liveDispatches.map((dispatch, index) => (
              <View key={dispatch.id} style={[styles.alertCard, isDark && styles.alertCardDark]}>
                <View style={styles.alertRouteBadge}>
                  <Text style={styles.alertRouteNumber}>{index + 1}</Text>
                </View>
                <View style={styles.alertCardContent}>
                  <Text style={[styles.alertStreet, isDark && styles.textLight]} numberOfLines={1}>{dispatch.street}</Text>
                  <Text style={[styles.alertType, isDark && styles.textMuted]}>{dispatch.wasteCategory}</Text>
                  
                  <View style={styles.alertActions}>
                    <TouchableOpacity style={styles.navigateBtn} onPress={() => handleNavigate(dispatch.id)}>
                      <MaterialIcons name="navigation" size={14} color="#FFF" />
                      <Text style={styles.navigateBtnText}>Navigate</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.completeIconBtn} onPress={() => handleCompletePickup(dispatch.id)}>
                      <MaterialIcons name="check" size={16} color="#FFF" />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            ))}
          </ScrollView>
        </View>
      )}

      {isShiftActive && liveDispatches.length === 0 && (
        <View style={[styles.emptyAlertsCard, isDark && styles.emptyDashedDark]}>
          <MaterialIcons name="radar" size={24} color={isDark ? "#6B7280" : "#9CA3AF"} />
          <Text style={[styles.emptyAlertsText, isDark && styles.textMuted]}>Waiting for CENRO dispatch...</Text>
        </View>
      )}

      {!isShiftActive && (
        <View style={[styles.offlineCard, isDark && styles.emptyDashedDark]}>
          <View style={styles.offlineCardContent}>
            <Feather name="moon" size={24} color={isDark ? "#86EFAC" : "#4E6C50"} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.offlineTitle, isDark && styles.textLight]}>You are currently Off Duty</Text>
              <Text style={[styles.offlineText, isDark && styles.textMuted]}>
                You can review schedules & history below, or start a shift to begin collections.
              </Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.offlineStartShiftBtn}
            onPress={() => router.push('/(driver)/select-truck')}
            activeOpacity={0.85}
          >
            <MaterialIcons name="play-arrow" size={18} color="#FFFFFF" />
            <Text style={styles.offlineStartShiftBtnText}>Start Shift & Select Truck</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Next Scheduled Pickup */}
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, isDark && styles.textLight]}>Next Scheduled Pickup</Text>
        <TouchableOpacity onPress={handleSeeAllSchedule}>
          <Text style={[styles.seeAllText, isDark && {color: '#86EFAC'}]}>See all</Text>
        </TouchableOpacity>
      </View>

      {nextPickup ? (
        <View style={[styles.pickupCard, isDark && styles.pickupCardDark]}>
          <View style={styles.pickupCardHeader}>
            <Text style={styles.pickupBarangay}>Scheduled Collection</Text>
            <TouchableOpacity style={styles.navOutlineBtn} onPress={() => handleNavigate(nextPickup.id)}>
              <MaterialIcons name="directions" size={16} color="#FFF" />
            </TouchableOpacity>
          </View>

          <View style={styles.pickupDetails}>
            <View style={styles.detailRow}>
              <View style={styles.dotRed} />
              <Text style={styles.detailText}>Location: {nextPickup.street}</Text>
            </View>
            <View style={styles.detailRow}>
              <Feather name="clock" size={12} color="#E5E7EB" style={styles.detailIcon} />
              <Text style={styles.detailText}>Time: {nextPickup.timeText}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailTextType}>Type: {nextPickup.wasteCategory}</Text>
            </View>
          </View>
          
          <View style={styles.actionButtons}>
            <TouchableOpacity style={styles.completeBtn} onPress={() => handleCompletePickup(nextPickup.id)}>
              <Text style={styles.completeBtnText}>Complete</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.issueBtn} onPress={() => handleIssuePickup(nextPickup.id)}>
              <Text style={styles.issueBtnText}>Issue</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View style={[styles.emptyCard, isDark && styles.emptyDashedDark]}>
          <Feather name="check-circle" size={48} color={isDark ? "#4B5563" : "#9CA3AF"} />
          <Text style={[styles.emptyText, isDark && styles.textLight]}>No pending schedules</Text>
          <Text style={[styles.emptySubtext, isDark && styles.textMuted]}>You are all caught up for today!</Text>
        </View>
      )}

      {/* Your History */}
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, isDark && styles.textLight]}>Recent Activity</Text>
        <TouchableOpacity onPress={handleSeeAllHistory}>
          <Text style={[styles.seeAllText, isDark && {color: '#86EFAC'}]}>See all</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.historyContainer}>
        {historyItems.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.historyScroll}>
            {historyItems.map((item) => (
              <View key={item.id} style={[styles.historyCard, isDark && styles.cardDark]}>
                {item.completionImage ? (
                  <Image source={{ uri: item.completionImage }} style={styles.historyImage} />
                ) : (
                  <View style={[styles.historyImage, { alignItems: 'center', justifyContent: 'center', backgroundColor: '#E5E7EB' }]}>
                    <Feather name="image" size={24} color="#9CA3AF" />
                  </View>
                )}
                <View style={styles.historyContent}>
                  <Text style={[styles.historyStreet, isDark && styles.textLight]} numberOfLines={1}>{item.street}</Text>
                  <Text style={[styles.historyType, isDark && styles.textMuted]}>{item.wasteCategory}</Text>
                  <View style={[styles.completedBadge, isDark && {backgroundColor: '#374151'}]}>
                    <Text style={[styles.completedBadgeText, isDark && {color: '#D1D5DB'}]}>
                      {item.status === 'issue' ? 'Issue Reported' : 'Completed'}
                    </Text>
                  </View>
                </View>
              </View>
            ))}
          </ScrollView>
        ) : (
          <View style={[styles.emptyHistoryCard, isDark && styles.emptyDashedDark]}>
            <Feather name="clock" size={32} color={isDark ? "#4B5563" : "#D1D5DB"} />
            <Text style={[styles.emptyText, isDark && styles.textLight]}>No recent history</Text>
          </View>
        )}
      </View>

      <View style={{ height: 40 }} />

      {selectedPickupId && (
        <CompletePickupModal
          visible={showCompleteModal}
          scheduleId={selectedPickupId}
          onClose={() => setShowCompleteModal(false)}
          onSubmit={() => {
            setShowCompleteModal(false);
          }}
        />
      )}

      {selectedPickupId && (
        <ReportIssueModal
          visible={showIssueModal}
          scheduleId={selectedPickupId}
          onClose={() => setShowIssueModal(false)}
          onSubmit={() => {
            setShowIssueModal(false);
            console.log('Submit issue action for', selectedPickupId);
          }}
        />
      )}

      {/* ── End Shift Confirmation Modal ── */}
      <Modal
        visible={showEndShiftModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowEndShiftModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, isDark && styles.modalCardDark]}>
            <View style={[styles.modalIconCircle, { backgroundColor: '#FEE2E2', shadowColor: '#EF4444' }]}>
              <MaterialIcons name="power-settings-new" size={36} color="#DC2626" />
            </View>

            <Text style={[styles.modalTitle, isDark && styles.textLight]}>
              End Your Shift
            </Text>
            <Text style={[styles.modalSubtitle, isDark && styles.textMuted]}>
              Are you sure you want to end your shift{currentTruck ? ` and release ${currentTruck.plateNumber}` : ''}?
            </Text>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalCancelBtn, isDark && { backgroundColor: '#374151', borderColor: '#4B5563' }]}
                onPress={() => setShowEndShiftModal(false)}
                disabled={isEndingShift}
                activeOpacity={0.8}
              >
                <Text style={[styles.modalCancelText, isDark && { color: '#D1D5DB' }]}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalConfirmBtn, { backgroundColor: '#DC2626', shadowColor: '#DC2626' }, isEndingShift && { opacity: 0.7 }]}
                onPress={confirmEndShift}
                disabled={isEndingShift}
                activeOpacity={0.85}
              >
                {isEndingShift ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Text style={styles.modalConfirmText}>End Shift</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Active Shift Warning Modal ── */}
      <Modal
        visible={showActiveShiftModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowActiveShiftModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, isDark && styles.modalCardDark]}>
            <View style={[styles.modalIconCircle, { backgroundColor: '#FEF3C7', shadowColor: '#F59E0B' }]}>
              <MaterialIcons name="warning" size={36} color="#D97706" />
            </View>

            <Text style={[styles.modalTitle, isDark && styles.textLight]}>
              Active Shift
            </Text>
            <Text style={[styles.modalSubtitle, isDark && styles.textMuted]}>
              You need to end your shift before switching to the user app. End your shift first to release the truck.
            </Text>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalConfirmBtn, { backgroundColor: '#F59E0B', shadowColor: '#F59E0B' }]}
                onPress={() => setShowActiveShiftModal(false)}
                activeOpacity={0.85}
              >
                <Text style={styles.modalConfirmText}>Got it</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F4FBF1',
    paddingHorizontal: 20,
  },
  containerDark: {
    backgroundColor: '#111827',
  },
  textLight: {
    color: '#F9FAFB',
  },
  textMuted: {
    color: '#9CA3AF',
  },
  cardDark: {
    backgroundColor: '#1F2937',
    borderColor: '#374151',
  },
  emptyDashedDark: {
    backgroundColor: '#1F2937',
    borderColor: '#374151',
  },
  pickupCardDark: {
    backgroundColor: '#1C2920',
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 60,
    marginBottom: 20,
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoIcon: {
    width: 32,
    height: 32,
    marginRight: 8,
  },
  logoText: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1A3B2B',
    letterSpacing: -0.5,
  },
  driverModePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginTop: 2,
  },
  blueLiveDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#2563EB',
  },
  driverModePillText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#1D4ED8',
    letterSpacing: 0.3,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  residentSwitchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#DCFCE7',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 10,
  },
  residentSwitchBtnText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#065F46',
  },
  driverStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  driverStatusOnDuty: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  driverStatusOnDutyDark: {
    backgroundColor: '#064E3B',
    borderColor: '#059669',
  },
  driverStatusOffDuty: {
    backgroundColor: '#F3F4F6',
    borderColor: '#E5E7EB',
  },
  driverStatusOffDutyDark: {
    backgroundColor: '#374151',
    borderColor: '#4B5563',
  },
  driverStatusDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  driverStatusBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  welcomeSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
    backgroundColor: '#FFF',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  welcomeLeft: {
    flex: 1,
  },
  welcomeText: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 2,
  },
  statusText: {
    fontSize: 22,
    fontWeight: '800',
  },
  shiftToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  shiftToggleText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4B5563',
  },
  truckBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  truckBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2E8B57',
  },
  shiftActions: {
    alignItems: 'flex-end',
    gap: 8,
  },
  endShiftBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  endShiftText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#DC2626',
  },
  backToPortalBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  backToPortalText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6B7280',
  },
  
  // Alerts
  alertsContainer: {
    marginBottom: 24,
    backgroundColor: '#F5F3FF',
    borderRadius: 16,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: '#DDD6FE',
  },
  alertsContainerDark: {
    backgroundColor: '#1E1B4B', // Dark deep purple
    borderColor: '#4C1D95',
  },
  alertHeader: {
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pulsingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#8B5CF6',
  },
  alertTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#6D28D9',
    letterSpacing: 0.5,
  },
  alertSubtitle: {
    fontSize: 11,
    color: '#7C3AED',
    marginTop: 2,
    marginLeft: 16,
  },
  alertsScroll: {
    paddingLeft: 16,
  },
  alertCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    width: 240,
    marginRight: 12,
    flexDirection: 'row',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#C4B5FD',
    shadowColor: '#8B5CF6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  alertCardDark: {
    backgroundColor: '#2E1065',
    borderColor: '#5B21B6',
  },
  alertRouteBadge: {
    backgroundColor: '#8B5CF6',
    width: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  alertRouteNumber: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '800',
  },
  alertCardContent: {
    flex: 1,
    padding: 12,
  },
  alertStreet: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  alertType: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 12,
  },
  alertActions: {
    flexDirection: 'row',
    gap: 8,
  },
  navigateBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2563EB',
    paddingVertical: 6,
    borderRadius: 6,
    gap: 4,
  },
  navigateBtnText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '700',
  },
  completeIconBtn: {
    width: 32,
    backgroundColor: '#059669',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 6,
  },
  emptyAlertsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#F3F4F6',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderStyle: 'dashed',
  },
  emptyAlertsText: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '500',
  },
  offlineCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 16,
  },
  offlineCardContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  offlineTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 2,
  },
  offlineText: {
    fontSize: 13,
    color: '#4B5563',
    lineHeight: 18,
  },
  offlineStartShiftBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4E6C50',
    paddingVertical: 12,
    borderRadius: 12,
    gap: 6,
    shadowColor: '#4E6C50',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  offlineStartShiftBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },

  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  seeAllText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4E6C50',
  },
  pickupCard: {
    backgroundColor: '#58715B',
    borderRadius: 20,
    padding: 20,
    marginBottom: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  pickupCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  pickupBarangay: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  navOutlineBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pickupDetails: {
    marginBottom: 20,
    gap: 6,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dotRed: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#EF4444',
    marginRight: 8,
    marginLeft: 3,
  },
  detailIcon: {
    marginRight: 8,
  },
  detailText: {
    fontSize: 13,
    color: '#E5E7EB',
  },
  detailTextType: {
    fontSize: 13,
    color: '#E5E7EB',
    marginLeft: 14,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  completeBtn: {
    backgroundColor: '#95C596',
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 24,
  },
  completeBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  issueBtn: {
    backgroundColor: '#F59E0B',
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 24,
  },
  issueBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  historyContainer: {
    marginHorizontal: -20,
  },
  historyScroll: {
    paddingHorizontal: 20,
    gap: 16,
  },
  historyCard: {
    width: 240,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  historyImage: {
    width: '100%',
    height: 120,
  },
  historyContent: {
    padding: 16,
  },
  historyStreet: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  historyType: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 12,
  },
  completedBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  completedBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#6B7280',
  },
  emptyCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 20,
    padding: 32,
    marginBottom: 30,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderStyle: 'dashed',
  },
  emptyHistoryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    marginHorizontal: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderStyle: 'dashed',
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4B5563',
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#9CA3AF',
    marginTop: 4,
    textAlign: 'center',
  },
  
  // ── Modal Styles ──
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 28,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 15,
  },
  modalCardDark: {
    backgroundColor: '#111827',
  },
  modalIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  modalActions: {
    flexDirection: 'row',
    width: '100%',
    gap: 12,
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  modalCancelText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#4B5563',
  },
  modalConfirmBtn: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  modalConfirmText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  simCard: {
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 4,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
    overflow: 'hidden',
  },
  simCardDark: {
    backgroundColor: '#1F2937',
    borderColor: '#374151',
  },
  simCardActive: {
    borderColor: '#86EFAC',
    backgroundColor: '#F0FDF4',
  },
  simHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    flexWrap: 'wrap',
  },
  simIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  simIconBoxDark: {
    backgroundColor: '#064E3B',
  },
  simIconBoxActive: {
    backgroundColor: '#16A34A',
  },
  simTitle: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#0F172A',
    flexShrink: 1,
  },
  simSubtitle: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
    flexShrink: 1,
  },
  simLiveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 12,
  },
  simPulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#16A34A',
  },
  simLiveText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#15803D',
    letterSpacing: 0.5,
  },
  simBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  simBtnStart: {
    backgroundColor: '#2E8B57',
  },
  simBtnStop: {
    backgroundColor: '#DC2626',
  },
  simBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  simSectorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(226, 232, 240, 0.7)',
    flexWrap: 'wrap',
  },
  simSectorLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  simSectorBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    flexShrink: 1,
    maxWidth: '100%',
  },
  simSectorBtnDark: {
    backgroundColor: '#374151',
    borderColor: '#4B5563',
  },
  simSectorBtnDisabled: {
    opacity: 0.85,
  },
  simSectorBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0F172A',
    flexShrink: 1,
  },
  simProgressSection: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  simMetricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 6,
  },
  simMetricText: {
    fontSize: 11,
    color: '#64748B',
  },
  simMetricVal: {
    fontWeight: '800',
    color: '#0F172A',
  },
  simProgressBarTrack: {
    height: 5,
    backgroundColor: '#E2E8F0',
    borderRadius: 3,
    overflow: 'hidden',
  },
  simProgressBarFill: {
    height: '100%',
    backgroundColor: '#16A34A',
    borderRadius: 3,
  },
  miniMapCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  miniMapCardDark: {
    backgroundColor: '#1E293B',
    borderColor: '#334155',
  },
  miniMapCardActive: {
    borderColor: '#2E8B57',
  },
  miniMapHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  miniMapHeaderLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minWidth: 0,
    marginRight: 10,
  },
  miniMapLivePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 10,
  },
  miniMapLivePillDark: {
    backgroundColor: '#064E3B',
  },
  miniMapLiveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  miniMapLiveText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#059669',
    letterSpacing: 0.5,
  },
  miniMapTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1E293B',
    flexShrink: 1,
  },
  expandMapBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  expandMapBtnDark: {
    backgroundColor: '#064E3B',
    borderColor: '#059669',
  },
  expandMapBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#166534',
  },
  mapCanvasContainer: {
    height: 190,
    width: '100%',
    position: 'relative',
    backgroundColor: '#E2E8F0',
  },
  mapCanvasContainerDark: {
    backgroundColor: '#0F172A',
  },
  miniMapCanvas: {
    ...StyleSheet.absoluteFillObject,
  },
  truckMarkerContainer: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#2E8B57',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
  telemetryOverlay: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    right: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.94)',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(226, 232, 240, 0.8)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  telemetryOverlayDark: {
    backgroundColor: 'rgba(30, 41, 59, 0.94)',
    borderColor: 'rgba(51, 65, 85, 0.8)',
  },
  telemetryStreetText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1E293B',
    flexShrink: 1,
  },
  telemetrySpeedBox: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: 'rgba(241, 245, 249, 0.8)',
  },
  telemetrySpeedBoxDark: {
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
  },
  telemetrySpeedVal: {
    fontSize: 11,
    fontWeight: '900',
  },
  miniMapFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 12,
  },
  miniMapFooterLabel: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#64748B',
  },
  miniMapFooterSub: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1E293B',
    marginTop: 1,
  },
  simDriveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  simDriveBtnStart: {
    backgroundColor: '#2E8B57',
  },
  simDriveBtnStop: {
    backgroundColor: '#DC2626',
  },
  simDriveBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  toastAlertCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F766E',
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 14,
    padding: 12,
    gap: 10,
    shadowColor: '#0F766E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#14B8A6',
  },
  toastAlertCardDark: {
    backgroundColor: '#134E4A',
    borderColor: '#2DD4BF',
  },
  toastAlertIconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#0D9488',
    alignItems: 'center',
    justifyContent: 'center',
  },
  toastAlertTextWrapper: {
    flex: 1,
  },
  toastAlertTitleText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  toastAlertMessageText: {
    fontSize: 11.5,
    color: '#CCFBF1',
    marginTop: 2,
    lineHeight: 15,
  },
  toastAlertActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  toastAlertViewBtn: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  toastAlertViewBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0F766E',
  },
  toastAlertDismissBtn: {
    padding: 6,
  },
});
