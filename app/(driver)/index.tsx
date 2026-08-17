import { useAuthContext } from '@/components/AuthContext';
import { auth, db } from '@/config/firebase';
import { Feather, MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { collection, onSnapshot, query, where, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View, Modal } from 'react-native';

import CompletePickupModal from '@/components/driver/CompletePickupModal';
import ReportIssueModal from '@/components/driver/ReportIssueModal';
import { useTheme } from '@/hooks/useTheme';

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
  const [showActiveShiftModal, setShowActiveShiftModal] = useState(false);
  const [selectedPickupId, setSelectedPickupId] = useState<string | null>(null);

  // Current truck assignment
  const [currentTruck, setCurrentTruck] = useState<{ id: string; plateNumber: string; type: string } | null>(null);

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
        
        if (data.status === 'pending' || !data.status) {
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

  // Listen for current truck assignment
  useEffect(() => {
    if (!db || !user?.uid) return;

    const unsubUser = onSnapshot(doc(db, 'users', user.uid), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
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
  }, [user]);

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

  const handleProfileSettings = () => {
    router.push('/(driver)/profile');
  };

  const handleEndShift = () => {
    setShowEndShiftModal(true);
  };

  const confirmEndShift = async () => {
    try {
      if (currentTruck && user?.uid) {
        // Unassign driver from truck
        await updateDoc(doc(db, 'trucks', currentTruck.id), {
          assignedDriverId: null,
          assignedDriverName: null,
          shiftStartedAt: null,
          updatedAt: serverTimestamp(),
        });
        // Clear truck from user profile
        await updateDoc(doc(db, 'users', user.uid), {
          currentTruckId: null,
          currentTruckPlate: null,
        });
      }
      setIsShiftActive(false);
      setCurrentTruck(null);
      setShowEndShiftModal(false);
      // Navigate back to user portal
      router.replace('/(tabs)/home');
    } catch (e) {
      console.error('End shift error:', e);
      Alert.alert('Error', 'Failed to end shift. Please try again.');
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
          <TouchableOpacity onPress={handleProfileSettings}>
            <Image source={{ uri: user?.photoURL || 'https://i.pravatar.cc/100?img=33' }} style={styles.avatar} />
          </TouchableOpacity>
        </View>
      </View>

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
                activeOpacity={0.8}
              >
                <Text style={[styles.modalCancelText, isDark && { color: '#D1D5DB' }]}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalConfirmBtn, { backgroundColor: '#DC2626', shadowColor: '#DC2626' }]}
                onPress={confirmEndShift}
                activeOpacity={0.85}
              >
                <Text style={styles.modalConfirmText}>End Shift</Text>
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
    fontSize: 22,
    fontWeight: '800',
    color: '#1A3B2B',
    letterSpacing: -0.5,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: '#4E6C50',
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
});
