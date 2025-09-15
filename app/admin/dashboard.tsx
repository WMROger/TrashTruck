import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { signOut } from 'firebase/auth';
import { collection, doc, getDoc, limit, onSnapshot, orderBy, query } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { Alert, Image, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthContext } from '../../components/AuthContext';
import { AdminSidebar, AnnouncementsTab, FeedbackTab, ReportsTab, ScheduleTab } from '../../components/admin';
import { auth, db } from '../../config/firebase';

export default function AdminDashboard() {
  const { user, isAuthenticated } = useAuthContext();
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [activeTab, setActiveTab] = useState('home');
  const [latestReportImages, setLatestReportImages] = useState<string[]>([]);
  const [latestFeedback, setLatestFeedback] = useState<{ userName: string; message: string; rating: string; createdAt?: any; photoURL?: string } | null>(null);
  const [feedbackStats, setFeedbackStats] = useState<{ loved: number; good: number; bad: number; terrible: number }>({ loved: 0, good: 0, bad: 0, terrible: 0 });
  const [historyCounts, setHistoryCounts] = useState<{ pickup: number; reports: number }>({ pickup: 0, reports: 0 });
  const [historyFilter, setHistoryFilter] = useState<'today' | 'week' | 'month'>('today');
  type Report = {
    id: string;
    title: string;
    description?: string;
    barangay: string;
    street: string;
    userEmail: string;
    status: string;
    createdAt: any;
  };
  const [resolvedReports, setResolvedReports] = useState<Report[]>([]);

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

  // Dashboard summaries: latest 3 report images and feedback snapshot
  useEffect(() => {
    if (!db) return;

    // Latest report images (summary thumbnails)
    const reportsRef = collection(db, 'reports');
    const reportsQuery = query(reportsRef, orderBy('createdAt', 'desc'), limit(3));
    const unsubReports = onSnapshot(reportsQuery, (snap) => {
      const images: string[] = [];
      snap.forEach((d) => {
        const data: any = d.data();
        if (data?.imageURL) images.push(data.imageURL);
      });
      setLatestReportImages(images);
    });

    // Feedback summary and latest feedback
    const feedbackRef = collection(db, 'feedback');
    const feedbackQuery = query(feedbackRef, orderBy('createdAt', 'desc'), limit(20));
    const unsubFeedback = onSnapshot(feedbackQuery, (snap) => {
      const items = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
      if (items.length > 0) {
        const lf = items[0];
        setLatestFeedback({
          userName: lf.userName || lf.userEmail?.split('@')[0] || 'User',
          message: lf.description || lf.message || '',
          rating: lf.rating || 'Good',
          createdAt: lf.createdAt,
          photoURL: lf.photoURL,
        });
      } else {
        setLatestFeedback(null);
      }
      const total = items.length || 1;
      const count = (label: string) => items.filter((i) => (i.rating || '').toLowerCase() === label.toLowerCase()).length;
      setFeedbackStats({
        loved: Math.round((count('Loved it') / total) * 100),
        good: Math.round((count('Good') / total) * 100),
        bad: Math.round((count('Bad') / total) * 100),
        terrible: Math.round((count('Terrible') / total) * 100),
      });
    });

    return () => {
      unsubReports();
      unsubFeedback();
    };
  }, []);

  // History counters (pickup completion and resolved trash reports) and list subscription
  useEffect(() => {
    if (!db) return;
    const schedulesRef = collection(db, 'schedules');
    const reportsRef = collection(db, 'reports');
    const unsubSched = onSnapshot(schedulesRef, (snap) => {
      const items = snap.docs.map((d) => d.data() as any);
      // Prefer explicit completed statuses if present, else count all
      const completed = items.filter((i) => {
        const s = (i.status || '').toString().toLowerCase();
        return s === 'completed' || s === 'resolved' || s === 'done';
      }).length;
      const pickup = completed > 0 ? completed : items.length;
      setHistoryCounts((prev) => ({ ...prev, pickup }));
    });
    const unsubRep = onSnapshot(reportsRef, (snap) => {
      const all = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as any[];
      const onlyResolved = all.filter((r) => (r.status || '').toString().toLowerCase() === 'resolved');
      setResolvedReports(
        onlyResolved.map((r) => ({
          id: r.id,
          title: r.title || 'Untitled',
          description: r.description || '',
          barangay: r.barangay || '',
          street: r.street || '',
          userEmail: r.userEmail || '',
          status: r.status || 'resolved',
          createdAt: r.createdAt,
        }))
      );
      setHistoryCounts((prev) => ({ ...prev, reports: onlyResolved.length }));
    });
    return () => { unsubSched(); unsubRep(); };
  }, []);

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
      

      {/* Trash Reports row */}
      <View style={styles.sectionBlock}>
        <Text style={styles.blockTitle}>Trash Reports</Text>
        <View style={styles.reportsRow}>
          {[0,1,2].map((idx) => (
            <View key={idx} style={styles.reportCard}>
              {latestReportImages[idx] && (
                <Image
                  source={{ uri: latestReportImages[idx] }}
                  style={styles.reportImage}
                  resizeMode="cover"
                />
              )}
            </View>
          ))}
        </View>
      </View>

      {/* Feedback and Ratings */}
      <View style={styles.sectionBlock}>
        <Text style={styles.blockTitle}>Feedback and Ratings</Text>
        <View style={styles.feedbackCard}> 
          <View style={styles.feedbackAvatar}>
            {latestFeedback?.photoURL ? (
              <Image source={{ uri: latestFeedback.photoURL }} style={styles.dashboardAvatar} />
            ) : (
              <View style={styles.avatarCircle} />
            )}
          </View>
          <View style={styles.feedbackContent}>
            <Text style={styles.feedbackQuote}>“{latestFeedback?.rating || 'Feedback'}”</Text>
            <Text style={styles.feedbackBody} numberOfLines={3}>
              {latestFeedback?.message || 'No feedback yet.'}
            </Text>
            <Text style={styles.feedbackMeta}>{latestFeedback?.userName || ''}</Text>
          </View>
        </View>

        {/* Feedback percentages */}
        <View style={{ marginTop: 10, gap: 6 }}>
          <Text style={styles.feedbackPercent}>😀 Loved it: {feedbackStats.loved}%</Text>
          <Text style={styles.feedbackPercent}>😊 Good: {feedbackStats.good}%</Text>
          <Text style={styles.feedbackPercent}>😐 Bad: {feedbackStats.bad}%</Text>
          <Text style={styles.feedbackPercent}>😠 Terrible: {feedbackStats.terrible}%</Text>
        </View>
      </View>
    </ScrollView>
  );

  const renderScheduleContent = () => <ScheduleTab />;

  const renderAnnouncementsContent = () => <AnnouncementsTab />;

  const renderReportsContent = () => <ReportsTab />;

  const formatSimpleDate = (value: any) => {
    try {
      const d = value?.toDate ? value.toDate() : new Date(value);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    } catch {
      return '';
    }
  };

  const getFilteredResolvedReports = () => {
    const now = new Date();
    const start = new Date(now);
    if (historyFilter === 'today') {
      start.setHours(0, 0, 0, 0);
    } else if (historyFilter === 'week') {
      const day = now.getDay();
      const diff = (day === 0 ? 6 : day - 1); // start Monday
      start.setDate(now.getDate() - diff);
      start.setHours(0, 0, 0, 0);
    } else if (historyFilter === 'month') {
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
    }

    const toMs = (v: any) => v?.toDate ? v.toDate().getTime() : new Date(v).getTime();

    return resolvedReports
      .filter((r) => {
        const t = toMs(r.createdAt);
        return !isNaN(t) && t >= start.getTime();
      })
      .sort((a, b) => (toMs(b.createdAt) - toMs(a.createdAt)));
  };

  const renderHistoryContent = () => (
    <ScrollView style={styles.content}>
      <View style={styles.historyContainer}>
        <View style={styles.historyHeaderRow}>
          <View>
            <Text style={styles.historyTitle}>History</Text>
            <Text style={styles.historySubtitle}>Showing your all histories with a clear view</Text>
          </View>
          <TouchableOpacity style={styles.filterButton} activeOpacity={0.8}>
            <Ionicons name="filter" size={16} color="#234033" />
            <Text style={styles.filterButtonText}>Filter</Text>
            <Ionicons name="chevron-down" size={16} color="#234033" />
          </TouchableOpacity>
        </View>
        <View style={styles.historyDivider} />

        <View style={styles.historyCardsRow}>
          <View style={[styles.historyCard, { backgroundColor: '#FFE7B3', borderColor: '#F7D78A' }]}>
            <Text style={styles.historyCardTitle}>Pickup Completion</Text>
            <Text style={[styles.historyCardNumber, { color: '#D97706' }]}>{historyCounts.pickup}</Text>
          </View>
          <View style={[styles.historyCard, { backgroundColor: '#FFD6D6', borderColor: '#F4B4B4' }]}>
            <Text style={styles.historyCardTitle}>Trash Reports</Text>
            <Text style={[styles.historyCardNumber, { color: '#DC2626' }]}>{historyCounts.reports}</Text>
          </View>
        </View>

        {/* Resolved Trash Reports List */}
        <View style={{ marginTop: 24 }}>
          <Text style={styles.blockTitle}>Trash Reports</Text>
          {/* Filter tabs */}
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
            {(['today','week','month'] as const).map((key) => (
              <TouchableOpacity
                key={key}
                style={[styles.historyFilterTab, historyFilter === key && styles.historyFilterTabActive]}
                onPress={() => setHistoryFilter(key)}
                activeOpacity={0.8}
              >
                <Text style={[styles.historyFilterTabText, historyFilter === key && styles.historyFilterTabTextActive]}>
                  {key === 'week' ? 'Weekly' : key === 'month' ? 'Monthly' : 'Today'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Table */}
          <View style={styles.historyTable}>
            <View style={[styles.historyTableRow, styles.historyTableHeader]}> 
              <Text style={[styles.historyTableCell, styles.colName, styles.historyTableHeaderText]}>Name</Text>
              <Text style={[styles.historyTableCell, styles.colBarangay, styles.historyTableHeaderText]}>Barangay</Text>
              <Text style={[styles.historyTableCell, styles.colStreet, styles.historyTableHeaderText]}>Street</Text>
              <Text style={[styles.historyTableCell, styles.colDate, styles.historyTableHeaderText]}>Date</Text>
              <Text style={[styles.historyTableCell, styles.colTitle, styles.historyTableHeaderText]}>Title</Text>
            </View>
            {getFilteredResolvedReports().map((r, idx) => (
              <View key={r.id} style={[styles.historyTableRow, idx % 2 === 0 ? styles.historyTableRowEven : styles.historyTableRowOdd]}>
                <Text style={[styles.historyTableCell, styles.colName]} numberOfLines={1}>{(r.userEmail || '').split('@')[0]}</Text>
                <Text style={[styles.historyTableCell, styles.colBarangay]} numberOfLines={1}>{r.barangay}</Text>
                <Text style={[styles.historyTableCell, styles.colStreet]} numberOfLines={1}>{r.street}</Text>
                <Text style={[styles.historyTableCell, styles.colDate]} numberOfLines={1}>{formatSimpleDate(r.createdAt)}</Text>
                <Text style={[styles.historyTableCell, styles.colTitle]} numberOfLines={1}>{r.title}</Text>
              </View>
            ))}
            {getFilteredResolvedReports().length === 0 && (
              <View style={{ padding: 16 }}>
                <Text style={{ color: '#234033' }}>No resolved reports in this period.</Text>
              </View>
            )}
          </View>
        </View>
      </View>
    </ScrollView>
  );

  const renderFeedbacksContent = () => <FeedbackTab />;

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
  historyContainer: {
    backgroundColor: '#EAF6E8',
    borderRadius: 20,
    padding: 20,
    borderWidth: 2,
    borderColor: '#BFD9C4',
  },
  historyHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  historyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#234033',
  },
  historySubtitle: {
    fontSize: 12,
    color: '#234033',
    marginTop: 6,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DDEEDB',
    borderWidth: 1,
    borderColor: '#C8D8CA',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    gap: 8,
  },
  filterButtonText: {
    color: '#234033',
    fontWeight: '600',
  },
  historyDivider: {
    height: 2,
    backgroundColor: '#234033',
    opacity: 0.5,
    marginTop: 12,
    marginBottom: 20,
  },
  historyCardsRow: {
    flexDirection: 'row',
    gap: 20,
  },
  historyCard: {
    flex: 1,
    borderRadius: 12,
    padding: 18,
    borderWidth: 2,
    minHeight: 280,
  },
  historyCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#234033',
    marginBottom: 10,
  },
  historyCardNumber: {
    fontSize: 36,
    top: 70,
    fontWeight: '800',
    textAlign: 'center',
  },
  historyFilterTab: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: '#DDEEDB',
    borderWidth: 1,
    borderColor: '#C8D8CA',
  },
  historyFilterTabActive: {
    backgroundColor: '#2E8B57',
    borderColor: '#2E8B57',
  },
  historyFilterTabText: {
    color: '#234033',
    fontWeight: '600',
  },
  historyFilterTabTextActive: {
    color: 'white',
  },
  historyTable: {
    backgroundColor: '#E3F0E3',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#8FB497',
    overflow: 'hidden',
  },
  historyTableHeader: {
    backgroundColor: '#D0E2D0',
  },
  historyTableRow: {
    flexDirection: 'row',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#C8D8CA',
  },
  historyTableRowEven: {
    backgroundColor: '#F3F7F3',
  },
  historyTableRowOdd: {
    backgroundColor: '#EAF6E8',
  },
  historyTableHeaderText: {
    fontWeight: '700',
    color: '#234033',
  },
  historyTableCell: {
    paddingHorizontal: 6,
    color: '#234033',
  },
  colName: { width: '18%', minWidth: 90 },
  colBarangay: { width: '22%', minWidth: 110 },
  colStreet: { width: '22%', minWidth: 110 },
  colDate: { width: '14%', minWidth: 90 },
  colTitle: { width: '24%', minWidth: 130 },
  headerCard: {
    backgroundColor: '#E3F0E3',
    borderRadius: 20,
    padding: 20,
    borderWidth: 2,
    borderColor: '#8FB497',
    marginBottom: 16,
  },
  headerCardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#242E21',
  },
  headerCardSubtitle: {
    fontSize: 12,
    color: '#242E21',
  },
  headerDivider: {
    height: 2,
    backgroundColor: '#242E21',
    width: '100%',
    marginVertical: 8,
    opacity: 0.7,
  },
  sectionBlock: {
    backgroundColor: '#E3F0E3',
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#8FB497',
    padding: 16,
    marginBottom: 16,
  },
  blockTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#242E21',
    marginBottom: 12,
  },
  reportsRow: {
    flexDirection: 'row',
    gap: 16,
    justifyContent: 'space-between',
  },
  reportCard: {
    flex: 1,
    height: 140,
    backgroundColor: '#D0E2D0',
    borderRadius: 16,
  },
  reportImage: {
    width: '100%',
    height: '100%',
    borderRadius: 16,
  },
  feedbackCard: {
    backgroundColor: '#DCEAD9',
    borderRadius: 16,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  feedbackAvatar: {
    width: 72,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#BFD3BF',
  },
  dashboardAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  feedbackContent: {
    flex: 1,
    paddingLeft: 8,
    gap: 6,
  },
  feedbackQuote: {
    fontSize: 14,
    fontWeight: '700',
    color: '#242E21',
  },
  feedbackBody: {
    fontSize: 12,
    color: '#242E21',
  },
  feedbackMeta: {
    fontSize: 10,
    color: '#4A5A49',
    textAlign: 'right',
  },
  feedbackPercent: {
    fontSize: 12,
    color: '#242E21',
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