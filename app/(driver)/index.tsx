import { useAuthContext } from '@/components/AuthContext';
import { auth, db } from '@/config/firebase';
import { Feather, MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import CompletePickupModal from '@/components/driver/CompletePickupModal';
import ReportIssueModal from '@/components/driver/ReportIssueModal';

interface NextPickup {
  id: string;
  street: string;
  wasteCategory: string;
  timeText: string;
  dateText: string;
  status: string;
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
  const [nextPickup, setNextPickup] = useState<NextPickup | null>(null);
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modal states
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [selectedPickupId, setSelectedPickupId] = useState<string | null>(null);

  useEffect(() => {
    if (!db || !auth?.currentUser) {
      setLoading(false);
      return;
    }

    const currentUser = auth.currentUser;
    const driverName = currentUser.displayName || currentUser.email || 'Unknown Driver';
    
    // Fetch Next Pickup
    const nextPickupQuery = query(collection(db, 'schedules'));
    const unsubscribeNextPickup = onSnapshot(nextPickupQuery, (snapshot) => {
      let todayPickups: NextPickup[] = [];
      const todayString = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
      
      snapshot.forEach((doc) => {
        const data = doc.data();
        
        const isDriverMatch = 
          data.driver === driverName ||
          data.driver === currentUser.email ||
          data.assignedDriverName === driverName ||
          data.assignedDriverId === currentUser.uid;
          
        if (isDriverMatch && (data.status === 'pending' || !data.status)) {
          if (data.dateText === todayString || data.dateText === 'Today') {
            todayPickups.push({
              id: doc.id,
              street: data.street || 'Unknown Street',
              wasteCategory: data.wasteCategory || 'General',
              timeText: data.timeText || 'Unknown Time',
              dateText: data.dateText || 'Unknown Date',
              status: data.status || 'pending'
            });
          }
        }
      });
      
      todayPickups.sort((a, b) => a.timeText.localeCompare(b.timeText));
      setNextPickup(todayPickups.length > 0 ? todayPickups[0] : null);
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
      
      setHistoryItems(historyList.slice(0, 5)); // Keep latest 5 for the horizontal scroll
      setLoading(false);
    });

    return () => {
      unsubscribeNextPickup();
      unsubscribeHistory();
    };
  }, [user]);

  const handleCompletePickup = () => {
    setShowCompleteModal(true);
  };

  const handleIssuePickup = () => {
    setShowIssueModal(true);
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
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color="#4E6C50" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <StatusBar barStyle="dark-content" backgroundColor="#F4FBF1" />
      
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.logoContainer}>
          <Image 
            source={{ uri: 'https://cdn-icons-png.flaticon.com/512/802/802251.png' }} // Placeholder logo
            style={styles.logoIcon}
            resizeMode="contain"
          />
          <Text style={styles.logoText}>TrashTrack</Text>
        </View>
        
        <View style={styles.headerRight}>
          <TouchableOpacity onPress={handleProfileSettings} style={styles.iconButton}>
            <Feather name="hexagon" size={20} color="#4E6C50" />
            <View style={styles.innerDot} />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleProfileSettings}>
            <Image source={{ uri: 'https://i.pravatar.cc/100?img=33' }} style={styles.avatar} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Welcome Message */}
      <View style={styles.welcomeSection}>
        <Text style={styles.welcomeText}>Good day and welcome back, {user?.displayName || 'Kalix'}</Text>
        <Text style={styles.statusText}>Ready to Work!</Text>
      </View>

      {/* Next Pickup */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Next Pickup</Text>
        <TouchableOpacity onPress={handleSeeAllSchedule}>
          <Text style={styles.seeAllText}>See all</Text>
        </TouchableOpacity>
      </View>

      {nextPickup ? (
        <View style={styles.pickupCard}>
          <Text style={styles.pickupBarangay}>Barangay Poblacion</Text>
          <View style={styles.pickupDetails}>
            <View style={styles.detailRow}>
              <View style={styles.dotRed} />
              <Text style={styles.detailText}>Street Name: {nextPickup.street}</Text>
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
            <TouchableOpacity style={styles.completeBtn} onPress={handleCompletePickup}>
              <Text style={styles.completeBtnText}>Complete</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.issueBtn} onPress={handleIssuePickup}>
              <Text style={styles.issueBtnText}>Issue</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View style={styles.emptyCard}>
          <Feather name="check-circle" size={48} color="#9CA3AF" />
          <Text style={styles.emptyText}>No pending pickups</Text>
          <Text style={styles.emptySubtext}>You're all caught up for today!</Text>
        </View>
      )}

      {/* Your History */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Your History</Text>
        <TouchableOpacity onPress={handleSeeAllHistory}>
          <Text style={styles.seeAllText}>See all</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.historyContainer}>
        {historyItems.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.historyScroll}>
            {historyItems.map((item, index) => (
              <View key={item.id} style={styles.historyCard}>
                <Image 
                  source={{ uri: item.completionImage || 'https://via.placeholder.com/150' }} 
                  style={styles.historyImage}
                />
                <View style={styles.historyContent}>
                  <Text style={styles.historyStreet} numberOfLines={1}>Street Name: {item.street}</Text>
                  <Text style={styles.historyType}>Type: {item.wasteCategory}</Text>
                  <View style={styles.completedBadge}>
                    <Text style={styles.completedBadgeText}>
                      {item.status === 'issue' ? 'Issue' : 'Completed'}
                    </Text>
                  </View>
                </View>
              </View>
            ))}
          </ScrollView>
        ) : (
          <View style={styles.emptyHistoryCard}>
            <Feather name="clock" size={32} color="#9CA3AF" />
            <Text style={styles.emptyText}>No history yet</Text>
          </View>
        )}
      </View>
      
      <View style={{ height: 100 }} />

      <CompletePickupModal 
        visible={showCompleteModal} 
        onClose={() => setShowCompleteModal(false)}
        onComplete={() => {
          setShowCompleteModal(false);
          console.log('Complete action');
        }}
      />
      
      <ReportIssueModal 
        visible={showIssueModal} 
        onClose={() => setShowIssueModal(false)}
        onSubmit={() => {
          setShowIssueModal(false);
          console.log('Submit issue action');
        }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F4FBF1',
    paddingHorizontal: 20,
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
    marginBottom: 30,
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoIcon: {
    width: 24,
    height: 24,
    marginRight: 6,
  },
  logoText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4E6C50',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  innerDot: {
    position: 'absolute',
    width: 6,
    height: 6,
    backgroundColor: '#4E6C50',
    borderRadius: 3,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: '#4E6C50',
  },
  welcomeSection: {
    marginBottom: 30,
  },
  welcomeText: {
    fontSize: 14,
    color: '#4B5563',
    marginBottom: 4,
  },
  statusText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#3B5241',
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
  pickupBarangay: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 16,
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
    fontSize: 12,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  historyType: {
    fontSize: 11,
    color: '#6B7280',
    marginBottom: 12,
  },
  completedBadge: {
    alignSelf: 'flex-end',
  },
  completedBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#9CA3AF',
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