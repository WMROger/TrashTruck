import { useAuthContext } from '@/components/AuthContext';
import { auth, db } from '@/config/firebase';
import { Feather, MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { collection, onSnapshot, query, where, orderBy, limit } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View, Switch, Linking } from 'react-native';

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
  const [selectedPickupId, setSelectedPickupId] = useState<string | null>(null);

  useEffect(() => {
    if (!db || !auth?.currentUser) {
      setLoading(false);
      return;
    }

    const currentUser = auth.currentUser;
    const driverName = currentUser.displayName || currentUser.email || 'Unknown Driver';
    
    // Fetch Next Pickup & Live Dispatches
    const nextPickupQuery = query(collection(db, 'schedules'));
    const unsubscribeNextPickup = onSnapshot(nextPickupQuery, (snapshot) => {
      let todayPickups: NextPickup[] = [];
      let liveDispatchesData: NextPickup[] = [];
      const todayString = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
      
      snapshot.forEach((doc) => {
        const data = doc.data();
        
        const isDriverMatch = 
          data.driver === driverName ||
          data.driver === currentUser.email ||
          data.assignedDriverName === driverName ||
          data.assignedDriverId === currentUser.uid;
          
        if (isDriverMatch && (data.status === 'pending' || !data.status)) {
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
      where('status', 'in', ['completed', 'issue'])
    );

    const unsubscribeHistory = onSnapshot(historyQuery, (snapshot) => {
      const historyList: HistoryItem[] = [];
      
      snapshot.forEach((doc) => {
        const data = doc.data();
        
        const isDriverMatch = 
          data.driver === driverName ||
          data.driver === currentUser.email ||
          data.assignedDriverName === driverName ||
          data.assignedDriverId === currentUser.uid;
          
        if (isDriverMatch) {
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
        }
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

  const handleCompletePickup = (id: string) => {
    setSelectedPickupId(id);
    setShowCompleteModal(true);
  };

  const handleIssuePickup = (id: string) => {
    setSelectedPickupId(id);
    setShowIssueModal(true);
  };

  const handleNavigate = (street: string) => {
    const queryStr = encodeURIComponent(`${street}, Philippines`);
    const url = `https://www.google.com/maps/search/?api=1&query=${queryStr}`;
    Linking.openURL(url).catch(err => console.error("An error occurred", err));
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
          <Text style={[styles.welcomeText, isDark && styles.textMuted]}>Welcome back, {user?.displayName || 'Louisse Natasha'}</Text>
          <Text style={[styles.statusText, { color: isShiftActive ? (isDark ? '#86EFAC' : '#2E8B57') : (isDark ? '#6B7280' : '#9CA3AF') }]}>
            {isShiftActive ? 'Active Shift' : 'Off Duty'}
          </Text>
        </View>
        <View style={styles.shiftToggle}>
          <Text style={[styles.shiftToggleText, isDark && styles.textLight]}>{isShiftActive ? 'ON' : 'OFF'}</Text>
          <Switch 
            value={isShiftActive} 
            onValueChange={setIsShiftActive}
            trackColor={{ false: isDark ? '#374151' : '#D1D5DB', true: isDark ? '#166534' : '#95C596' }}
            thumbColor={isShiftActive ? (isDark ? '#22C55E' : '#2E8B57') : (isDark ? '#9CA3AF' : '#F3F4F6')}
          />
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
                    <TouchableOpacity style={styles.navigateBtn} onPress={() => handleNavigate(dispatch.street)}>
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
          <Feather name="moon" size={24} color={isDark ? "#6B7280" : "#6B7280"} />
          <Text style={[styles.offlineText, isDark && styles.textMuted]}>Start your shift to receive live routes.</Text>
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
            <TouchableOpacity style={styles.navOutlineBtn} onPress={() => handleNavigate(nextPickup.street)}>
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
                <Image 
                  source={{ uri: item.completionImage || 'https://images.unsplash.com/photo-1532996122724-e3c354a0b15b?auto=format&fit=crop&w=400&q=80' }} 
                  style={styles.historyImage} 
                />
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    padding: 24,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  offlineText: {
    fontSize: 13,
    color: '#4B5563',
    fontWeight: '500',
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
});