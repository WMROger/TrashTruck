import { useAuthContext } from '@/components/AuthContext';
import DriverProfilePage from '@/components/driver/DriverProfilePage';
import { auth, db } from '@/config/firebase';
import { Colors } from '@/constants/Colors';
import { useTheme } from '@/hooks/useTheme';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

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
  const { theme } = useTheme();
  const colors = Colors[theme ?? 'light'];
  const [nextPickup, setNextPickup] = useState<NextPickup | null>(null);
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [showProfile, setShowProfile] = useState(false);

  // Fetch driver data
  useEffect(() => {
    if (!db || !auth?.currentUser) {
      setLoading(false);
      return;
    }

    const currentUser = auth.currentUser;
    const driverName = currentUser.displayName || currentUser.email || 'Unknown Driver';
    
    // Fetch next pickup (pending status for today) - use same approach as schedule page
    const today = new Date();
    const todayString = today.toISOString().split('T')[0]; // Format: YYYY-MM-DD
    
    // Get all schedules first, then filter manually (same as schedule page)
    const nextPickupQuery = query(collection(db, 'schedules'));

    const unsubscribeNextPickup = onSnapshot(nextPickupQuery, (snapshot) => {
      console.log('=== HOME PAGE DEBUG ===');
      console.log('Total schedules in database:', snapshot.docs.length);
      console.log('Current driver:', driverName);
      console.log('Current user email:', currentUser.email);
      console.log('Current user UID:', currentUser.uid);
      console.log('Today string:', todayString);
      console.log('Today date:', today.toLocaleDateString());
      let todayPickups: NextPickup[] = [];
      
      snapshot.forEach((doc) => {
        const data = doc.data();
        console.log('--- Checking Schedule ---');
        console.log('Schedule ID:', doc.id);
        console.log('Street:', data.street);
        console.log('Status:', data.status);
        console.log('Date Text:', data.dateText);
        console.log('Driver fields:', {
          driver: data.driver,
          assignedDriverName: data.assignedDriverName,
          assignedDriverId: data.assignedDriverId,
          driverName: data.driverName
        });
        
        // Check if this schedule is assigned to current driver
        const isDriverMatch = 
          data.driver === driverName ||
          data.driver === currentUser.email ||
          data.assignedDriverName === driverName ||
          data.assignedDriverName === currentUser.email ||
          data.assignedDriverId === currentUser.uid ||
          data.driverName === driverName ||
          data.driverName === currentUser.email;
          
        console.log('Driver match result:', isDriverMatch);
        console.log('Driver match details:', {
          'data.driver === driverName': data.driver === driverName,
          'data.driver === currentUser.email': data.driver === currentUser.email,
          'data.assignedDriverName === driverName': data.assignedDriverName === driverName,
          'data.assignedDriverName === currentUser.email': data.assignedDriverName === currentUser.email,
          'data.assignedDriverId === currentUser.uid': data.assignedDriverId === currentUser.uid,
          'data.driverName === driverName': data.driverName === driverName,
          'data.driverName === currentUser.email': data.driverName === currentUser.email
        });
          
        if (isDriverMatch && (data.status === 'pending' || data.status === undefined || data.status === '')) {
          // Check if this is today's schedule - use more flexible date matching
          const scheduleDate = data.dateText || data.date;
          
          // More flexible date matching - check if it's today
          const isToday = scheduleDate && (
            scheduleDate.includes(todayString) ||
            scheduleDate.includes(today.toLocaleDateString()) ||
            scheduleDate.includes(today.toDateString()) ||
            scheduleDate.includes(`${today.getMonth() + 1}/${today.getDate()}/${today.getFullYear()}`) ||
            scheduleDate.includes(`${today.getDate()}/${today.getMonth() + 1}/${today.getFullYear()}`) ||
            // Handle "October 19, 2025" format
            scheduleDate.includes(`October ${today.getDate()}, ${today.getFullYear()}`) ||
            scheduleDate.includes(`Oct ${today.getDate()}, ${today.getFullYear()}`) ||
            // Also check if the date is close to today (within 1 day)
            (() => {
              try {
                const scheduleDateObj = new Date(scheduleDate);
                const todayObj = new Date();
                const diffTime = Math.abs(scheduleDateObj.getTime() - todayObj.getTime());
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                return diffDays <= 1;
              } catch {
                return false;
              }
            })()
          );
          
          console.log('Date check details:', {
            scheduleDate,
            todayString,
            'today.toLocaleDateString()': today.toLocaleDateString(),
            'today.toDateString()': today.toDateString(),
            isToday,
            status: data.status
          });
          console.log('Date matching results:', {
            'scheduleDate.includes(todayString)': scheduleDate && scheduleDate.includes(todayString),
            'scheduleDate.includes(today.toLocaleDateString())': scheduleDate && scheduleDate.includes(today.toLocaleDateString()),
            'scheduleDate.includes(today.toDateString())': scheduleDate && scheduleDate.includes(today.toDateString()),
            'scheduleDate.includes(October format)': scheduleDate && scheduleDate.includes(`October ${today.getDate()}, ${today.getFullYear()}`),
            'Date object comparison': (() => {
              try {
                const scheduleDateObj = new Date(scheduleDate);
                const todayObj = new Date();
                const diffTime = Math.abs(scheduleDateObj.getTime() - todayObj.getTime());
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                return diffDays <= 1;
              } catch {
                return false;
              }
            })()
          });
          
          if (isToday) {
            console.log('🎉 FOUND TODAY\'S PICKUP!', {
              street: data.street,
              date: data.dateText,
              status: data.status,
              driver: data.driver
            });
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
      
      // Sort by time and get the next one
      todayPickups.sort((a, b) => {
        // Simple time comparison (you might want to improve this)
        return a.timeText.localeCompare(b.timeText);
      });
      
      const nextPickup = todayPickups.length > 0 ? todayPickups[0] : null;
      console.log('Today\'s pickups found:', todayPickups.length, 'Next pickup:', nextPickup);
      setNextPickup(nextPickup);
    });

    // Fetch recent history (completed status, limit to 2 most recent)
    const historyQuery = query(
      collection(db, 'schedules'),
      where('status', '==', 'completed')
    );

    const unsubscribeHistory = onSnapshot(historyQuery, (snapshot) => {
      const historyList: HistoryItem[] = [];
      
      snapshot.forEach((doc) => {
        const data = doc.data();
        
        // Check if this schedule is assigned to current driver
        const isDriverMatch = 
          data.driver === driverName ||
          data.driver === currentUser.email ||
          data.assignedDriverName === driverName ||
          data.assignedDriverName === currentUser.email ||
          data.assignedDriverId === currentUser.uid ||
          data.driverName === driverName ||
          data.driverName === currentUser.email;
          
        if (isDriverMatch) {
          historyList.push({
            id: doc.id,
            street: data.street || 'Unknown Street',
            wasteCategory: data.wasteCategory || 'General',
            completedAt: data.completedAt,
            status: data.status || 'completed',
            completionImage: data.completionImage || null
          });
        }
      });
      
      // Sort by completion date and take only 2 most recent
      historyList.sort((a, b) => {
        if (a.completedAt && b.completedAt) {
          return b.completedAt.toDate().getTime() - a.completedAt.toDate().getTime();
        }
        return 0;
      });
      
      setHistoryItems(historyList.slice(0, 2));
      setLoading(false);
    });

    return () => {
      unsubscribeNextPickup();
      unsubscribeHistory();
    };
  }, [user]);

  // Handle complete/issue from Home by opening the same modal on Schedule page
  const handleCompletePickup = async () => {
    if (!nextPickup) return;
    setProcessing(true);
    try {
      // Navigate to Schedule page and auto-open the Complete modal for this pickup
      router.push({ pathname: '/(driver)/pages/DriverSchedulePage', params: { open: 'complete', pickupId: nextPickup.id } });
    } finally {
      setProcessing(false);
    }
  };

  const handleIssuePickup = async () => {
    if (!nextPickup) return;
    setProcessing(true);
    try {
      // Navigate to Schedule page and auto-open the Issue modal for this pickup
      router.push({ pathname: '/(driver)/pages/DriverSchedulePage', params: { open: 'issue', pickupId: nextPickup.id } });
    } finally {
      setProcessing(false);
    }
  };

  // Navigate to schedule page
  const handleSeeAllSchedule = () => {
    router.push('/(driver)/pages/DriverSchedulePage');
  };

  // Navigate to history page
  const handleSeeAllHistory = () => {
    router.push('/(driver)/pages/DriverHistoryPage');
  };

  // Navigate to driver settings/profile
  const handleDriverSettings = () => {
    setShowProfile(true);
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading driver data...</Text>
      </View>
    );
  }

  if (showProfile) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.profileHeader, { backgroundColor: colors.background }]}>
          <TouchableOpacity 
            style={styles.backButton} 
            onPress={() => setShowProfile(false)}
          >
            <MaterialIcons name="arrow-back" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={[styles.profileHeaderTitle, { color: colors.textPrimary }]}>Driver Profile</Text>
          <View style={styles.profileHeaderSpacer} />
        </View>
        <DriverProfilePage />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={theme === 'dark' ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />
      
      {/* Header with TrashTrack Logo */}
      <View style={styles.header}>
        <View style={styles.logoContainer}>
          <Image 
            source={require('../../assets/images/trashtrack_logo_driver.png')} 
            style={styles.logoImage}
            resizeMode="contain"
          />
        </View>
        
        <TouchableOpacity style={[styles.profileButton, { backgroundColor: colors.surfaceVariant }]} onPress={handleDriverSettings}>
          <MaterialIcons name="person" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
      </View>

      {/* Welcome Message */}
      <View style={styles.welcomeSection}>
        <Text style={[styles.welcomeText, { color: colors.textSecondary }]}>Good day and welcome back, {user?.displayName || 'Driver'}</Text>
        <Text style={[styles.statusText, { color: colors.textPrimary }]}>Ready to Work!</Text>
      </View>

      {/* Next Pickup Section */}
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Next Pickup</Text>
        <TouchableOpacity onPress={handleSeeAllSchedule}>
          <Text style={[styles.seeAllText, { color: colors.primary }]}>See all</Text>
        </TouchableOpacity>
      </View>

      {nextPickup ? (
        <View style={[styles.nextPickupCard, { backgroundColor: colors.primary }]}>
          <Text style={[styles.pickupLocation, { color: colors.surface }]}>{nextPickup.street}</Text>
          <View style={styles.pickupDetails}>
            <View style={styles.detailRow}>
              <MaterialIcons name="location-on" size={16} color={colors.surface} />
              <Text style={[styles.detailText, { color: colors.surface }]}>Street: {nextPickup.street}</Text>
            </View>
            <View style={styles.detailRow}>
              <MaterialIcons name="access-time" size={16} color={colors.surface} />
              <Text style={[styles.detailText, { color: colors.surface }]}>Time: {nextPickup.timeText}</Text>
            </View>
            <View style={styles.detailRow}>
              <MaterialIcons name="recycling" size={16} color={colors.surface} />
              <Text style={[styles.detailText, { color: colors.surface }]}>Type: {nextPickup.wasteCategory}</Text>
            </View>
          </View>
          
          <View style={styles.actionButtons}>
            <TouchableOpacity 
              style={[styles.completeButton, processing && styles.disabledButton, { backgroundColor: colors.surface }]} 
              onPress={handleCompletePickup}
              disabled={processing}
            >
              {processing ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Text style={[styles.completeButtonText, { color: colors.primary }]}>Complete</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.issueButton, processing && styles.disabledButton, { backgroundColor: colors.warning }]} 
              onPress={handleIssuePickup}
              disabled={processing}
            >
              {processing ? (
                <ActivityIndicator size="small" color={colors.surface} />
              ) : (
                <Text style={[styles.issueButtonText, { color: colors.surface }]}>Issue</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View style={[styles.noPickupCard, { backgroundColor: colors.surfaceVariant }]}>
          <MaterialIcons name="check-circle" size={48} color={colors.primary} />
          <Text style={[styles.noPickupText, { color: colors.primary }]}>No pending pickups</Text>
          <Text style={[styles.noPickupSubtext, { color: colors.textSecondary }]}>You're all caught up!</Text>
          <Text style={[styles.debugText, { color: colors.textTertiary }]}>Debug: Loading={loading.toString()}, NextPickup={nextPickup ? 'Found' : 'None'}, Today={new Date().toLocaleDateString()}</Text>
        </View>
      )}

      {/* Your History Section */}
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Your History</Text>
        <TouchableOpacity onPress={handleSeeAllHistory}>
          <Text style={[styles.seeAllText, { color: colors.primary }]}>See all</Text>
        </TouchableOpacity>
      </View>

      {historyItems.length > 0 ? (
        <View style={styles.historyCards}>
          {historyItems.map((item, index) => (
            <View key={item.id} style={[styles.historyCard, { backgroundColor: colors.surface }]}>
              <View style={[styles.historyImage, { backgroundColor: colors.surfaceVariant }]}>
                {item.completionImage ? (
                  <Image 
                    source={{ uri: item.completionImage }} 
                    style={styles.historyImageContent}
                    resizeMode="cover"
                  />
                ) : (
                  <MaterialIcons name="recycling" size={40} color={colors.primary} />
                )}
              </View>
              <Text style={[styles.historyStreet, { color: colors.textSecondary }]}>Street: {item.street}</Text>
              <Text style={[styles.historyType, { color: colors.textSecondary }]}>Type: {item.wasteCategory}</Text>
              <Text style={[styles.completedLabel, { color: colors.success }]}>Completed</Text>
            </View>
          ))}
        </View>
      ) : (
        <View style={[styles.noHistoryCard, { backgroundColor: colors.surfaceVariant }]}>
          <MaterialIcons name="history" size={48} color={colors.textTertiary} />
          <Text style={[styles.noHistoryText, { color: colors.textSecondary }]}>No completed pickups yet</Text>
          <Text style={[styles.noHistorySubtext, { color: colors.textTertiary }]}>Your completed pickups will appear here</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 40,
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  logoContainer: {
    flex: 1,
    alignItems: 'flex-start',
  },
  logoImage: {
    width: 120,
    height: 60,
    left:-30,
  },
  profileButton: {
    padding: 8,
    borderRadius: 20,
  },
  welcomeSection: {
    marginBottom: 30,
  },
  welcomeText: {
    fontSize: 16,
    marginBottom: 4,
  },
  statusText: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  seeAllText: {
    fontSize: 14,
    fontWeight: '600',
  },
  nextPickupCard: {
    borderRadius: 12,
    padding: 20,
    marginBottom: 30,
  },
  pickupLocation: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  pickupDetails: {
    marginBottom: 20,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  detailText: {
    fontSize: 14,
    marginLeft: 8,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  completeButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    flex: 1,
    alignItems: 'center',
  },
  completeButtonText: {
    fontWeight: '600',
    fontSize: 14,
  },
  issueButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    flex: 1,
    alignItems: 'center',
  },
  issueButtonText: {
    fontWeight: '600',
    fontSize: 14,
  },
  historyCards: {
    flexDirection: 'row',
    gap: 12,
  },
  historyCard: {
    borderRadius: 12,
    padding: 16,
    flex: 1,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  historyImage: {
    height: 80,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    overflow: 'hidden',
  },
  historyImageContent: {
    width: '100%',
    height: '100%',
  },
  historyStreet: {
    fontSize: 12,
    marginBottom: 4,
  },
  historyType: {
    fontSize: 12,
    marginBottom: 8,
  },
  completedLabel: {
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'right',
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  disabledButton: {
    opacity: 0.6,
  },
  noPickupCard: {
    borderRadius: 12,
    padding: 40,
    alignItems: 'center',
    marginBottom: 30,
  },
  noPickupText: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
  },
  noPickupSubtext: {
    fontSize: 14,
    textAlign: 'center',
  },
  noHistoryCard: {
    borderRadius: 12,
    padding: 40,
    alignItems: 'center',
    marginBottom: 20,
  },
  noHistoryText: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  noHistorySubtext: {
    fontSize: 14,
    textAlign: 'center',
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 0,
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  backButton: {
    padding: 8,
  },
  profileHeaderTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  profileHeaderSpacer: {
    width: 40,
  },
  debugText: {
    fontSize: 10,
    textAlign: 'center',
    marginTop: 8,
  },
});