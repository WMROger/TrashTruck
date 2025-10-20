import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { signOut } from 'firebase/auth';
import { collection, doc, getDoc, getDocs, limit, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { Alert, Animated, Image, Modal, ScrollView, Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthContext } from '../../components/AuthContext';
import { AdminSidebar, AnnouncementsTab, FeedbackTab, HistoryTab, ManageAccountsTab, ReportsTab, ScheduleTab } from '../../components/admin';
import { auth, db } from '../../config/firebase';

export default function AdminDashboard() {
  const { user, isAuthenticated } = useAuthContext();
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [activeTab, setActiveTab] = useState('home');
  const [isTabLoading, setIsTabLoading] = useState(false);
  const spinValue = new Animated.Value(0);
  const [latestReportImages, setLatestReportImages] = useState<string[]>([]);
  const [latestFeedback, setLatestFeedback] = useState<{ userName: string; message: string; rating: string; createdAt?: any; photoURL?: string } | null>(null);
  const [feedbackStats, setFeedbackStats] = useState<{ loved: number; good: number; bad: number; terrible: number }>({ loved: 0, good: 0, bad: 0, terrible: 0 });
  const [historyCounts, setHistoryCounts] = useState<{ pickup: number; reports: number }>({ pickup: 0, reports: 0 });
  const [historyFilter, setHistoryFilter] = useState<'today' | 'week' | 'month'>('today');
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [isImagePreviewVisible, setIsImagePreviewVisible] = useState(false);
  // History view/state
  const [historyView, setHistoryView] = useState<'pickup' | 'reports'>('reports');
  const [historyData, setHistoryData] = useState<Report[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyType, setHistoryType] = useState<'pickup' | 'reports'>('reports');
  const [historyReports, setHistoryReports] = useState<Report[]>([]);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyTotalPages, setHistoryTotalPages] = useState(1);
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
    const reportsQuery = query(reportsRef, orderBy('createdAt', 'desc'), limit(12));
    const unsubReports = onSnapshot(reportsQuery, (snap) => {
      const images: string[] = [];
      snap.forEach((d) => {
        const data: any = d.data();
        if (data?.imageURL) images.push(data.imageURL);
      });
      setLatestReportImages(images.slice(0, 3));
    });

    // Feedback summary and latest feedback
    const feedbackRef = collection(db, 'feedback');
    const feedbackQuery = query(feedbackRef, orderBy('createdAt', 'desc'), limit(20));
    const unsubFeedback = onSnapshot(feedbackQuery, async (snap) => {
      const items = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
      
      // Process feedbacks and fetch user data
      const processFeedbacks = async () => {
        const userCacheById = new Map<string, any>();
        const userCacheByEmail = new Map<string, any>();
        
        // Resolve storage path to download URL if needed
        const resolvePhotoURL = async (maybePath?: string) => {
          try {
            if (!maybePath) return undefined;
            const isHttp = /^https?:\/\//i.test(maybePath);
            if (isHttp) return maybePath;
            const { getDownloadURL, ref } = await import('firebase/storage');
            const { storage } = await import('../../config/firebase');
            if (!storage) return undefined;
            const r = ref(storage, maybePath);
            return await getDownloadURL(r);
          } catch (e) {
            console.warn('Dashboard: Failed to resolve photo URL:', e);
            return undefined;
          }
        };
        
        if (items.length > 0) {
          const lf = items[0];
          let userName = 'User';
          let userEmail = '';
          let photoURL: string | undefined = undefined;
          
          // Fetch user data from users collection
          try {
            // 1) Try by userId
            if (lf.userId) {
              let userData = userCacheById.get(lf.userId);
              if (!userData) {
                const userDoc = await getDoc(doc(db, 'users', lf.userId));
                if (userDoc.exists()) userData = userDoc.data();
                if (userData) userCacheById.set(lf.userId, userData);
              }
              if (userData) {
                userName = userData.displayName || userData.email?.split('@')[0] || 'User';
                userEmail = userData.email || lf.userEmail || '';
                photoURL = await resolvePhotoURL(userData.photoURL || userData.avatar || undefined);
              }
            }

            // 2) If still missing, try by email
            if (!userEmail) {
              const emailKey = (lf.userEmail || '').toLowerCase();
              if (emailKey) {
                let userData = userCacheByEmail.get(emailKey);
                if (!userData) {
                  const usersRef = collection(db, 'users');
                  const qUsers = query(usersRef, where('email', '==', lf.userEmail));
                  const snapUsers = await getDocs(qUsers);
                  if (!snapUsers.empty) userData = snapUsers.docs[0].data();
                  if (userData) userCacheByEmail.set(emailKey, userData);
                }
                if (userData) {
                  userName = userData.displayName || userData.email?.split('@')[0] || userName;
                  userEmail = userData.email || lf.userEmail || userEmail;
                  if (!photoURL) photoURL = await resolvePhotoURL(userData.photoURL || userData.avatar || undefined);
                }
              }
            }

            // 3) Fallbacks from feedback document itself
            if (!userEmail) userEmail = lf.userEmail || '';
            if (!userName) userName = userEmail?.split('@')[0] || 'User';
            if (!photoURL && (lf.photoURL || lf.avatar)) {
              photoURL = await resolvePhotoURL(lf.photoURL || lf.avatar);
            }
          } catch (error) {
            console.error('Error enriching user data in dashboard:', error);
            userName = lf.userEmail?.split('@')[0] || 'User';
            userEmail = lf.userEmail || '';
          }
          
          setLatestFeedback({
            userName: userName,
            message: lf.description || lf.message || '',
            rating: lf.rating || 'Good',
            createdAt: lf.createdAt,
            photoURL: photoURL,
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
      };
      
      processFeedbacks();
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

  // Load inline history on first render
  useEffect(() => {
    fetchInlineHistory(historyView);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // Export functions
  const exportToCSV = async (reports: Report[]) => {
    try {
      const csvHeaders = 'Name,Barangay,Street,Date,Title,Status\n';
      const csvData = reports.map(report => {
        const date = report.createdAt?.toDate ? report.createdAt.toDate().toLocaleDateString() : 'N/A';
        return `"${report.userEmail}","${report.barangay}","${report.street}","${date}","${report.title}","${report.status}"`;
      }).join('\n');
      
      const csvContent = csvHeaders + csvData;
      
      await Share.share({
        message: csvContent,
        title: 'Trash Reports Export',
      });
    } catch (error) {
      Alert.alert('Export Error', 'Failed to export data');
    }
  };

  const exportToExcel = async (reports: Report[]) => {
    try {
      // For now, we'll export as CSV since Excel export requires additional libraries
      // In a real app, you'd use a library like xlsx
      await exportToCSV(reports);
    } catch (error) {
      Alert.alert('Export Error', 'Failed to export data');
    }
  };

  // History modal functions
  const openHistoryModal = (type: 'pickup' | 'reports') => {
    setHistoryType(type);
    setShowHistoryModal(true);
    setHistoryPage(1);
    fetchHistoryData(type, 1);
  };

  // Inline history panel fetcher (for switching bottom list without modal)
  const fetchInlineHistory = async (type: 'pickup' | 'reports') => {
    if (!db) return;
    setIsHistoryLoading(true);
    try {
      const collectionName = type === 'pickup' ? 'pickupHistory' : 'reports';
      const collectionRef = collection(db, collectionName);

      const now = new Date();
      let startDate: Date;
      switch (historyFilter) {
        case 'today':
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          break;
        case 'week':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'month':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          break;
        default:
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      }

      const q = query(
        collectionRef,
        where('createdAt', '>=', startDate),
        orderBy('createdAt', 'desc'),
        limit(50)
      );
      const snap = await getDocs(q);
      const data = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as any[];

      const mapped: Report[] = data.map((r) => ({
        id: r.id,
        title: r.title || 'Untitled',
        description: r.description || '',
        barangay: r.barangay || '',
        street: r.street || '',
        userEmail: r.userEmail || '',
        status: r.status || (type === 'pickup' ? 'completed' : 'pending'),
        createdAt: r.createdAt,
      }));
      setHistoryData(mapped);
    } catch (e) {
      console.warn('Failed to fetch inline history:', e);
      setHistoryData([]);
    } finally {
      setIsHistoryLoading(false);
    }
  };

  const fetchHistoryData = async (type: 'pickup' | 'reports', page: number) => {
    if (!db) return;
    
    try {
      const itemsPerPage = 10;
      
      let collectionName = 'reports';
      if (type === 'pickup') {
        collectionName = 'pickupHistory';
      }
      
      const collectionRef = collection(db, collectionName);
      
      // Apply date filter
      const now = new Date();
      let startDate: Date;
      
      switch (historyFilter) {
        case 'today':
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          break;
        case 'week':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'month':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          break;
        default:
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      }
      
      const q = query(collectionRef, 
        where('createdAt', '>=', startDate),
        orderBy('createdAt', 'desc'), 
        limit(itemsPerPage)
      );
      
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Report[];
      
      setHistoryReports(data);
      
      // Calculate total pages (simplified - in real app you'd get total count)
      setHistoryTotalPages(Math.ceil(data.length / itemsPerPage));
      
    } catch (error) {
      console.error('Error fetching history data:', error);
      Alert.alert('Error', 'Failed to fetch history data');
    }
  };

  const handleHistoryPageChange = (newPage: number) => {
    setHistoryPage(newPage);
    fetchHistoryData(historyType, newPage);
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
            <TouchableOpacity
              key={idx}
              style={styles.reportCard}
              activeOpacity={0.85}
              onPress={() => {
                if (latestReportImages[idx]) {
                  setImagePreviewUrl(latestReportImages[idx]);
                  setIsImagePreviewVisible(true);
                }
              }}
            >
              {latestReportImages[idx] ? (
                <Image
                  source={{ uri: latestReportImages[idx] }}
                  style={styles.reportImage}
                  resizeMode="cover"
                />
              ) : null}
            </TouchableOpacity>
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
      if (!value) return '';
      
      let d: Date;
      if (value?.toDate) {
        d = value.toDate();
      } else if (typeof value === 'string') {
        // Handle different string formats more safely
        if (value.match(/^[A-Za-z]+\s+\d{1,2},\s*\d{4}$/)) {
          // Handle "September 20, 2025" format - try multiple approaches
          try {
            // First try standard parsing
            d = new Date(value);
            if (isNaN(d.getTime())) {
              // If that fails, try manual parsing
              const match = value.match(/^([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})$/);
              if (match) {
                const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                  'July', 'August', 'September', 'October', 'November', 'December'];
                const monthIndex = monthNames.indexOf(match[1]);
                if (monthIndex !== -1) {
                  d = new Date(parseInt(match[3]), monthIndex, parseInt(match[2]));
                } else {
                  console.warn('Unknown month name in date:', value);
                  return '';
                }
              }
            }
            if (isNaN(d.getTime())) {
              console.warn('Could not parse date format:', value);
              return '';
            }
          } catch (error) {
            console.warn('Error parsing date string:', value, error);
            return '';
          }
        } else {
          d = new Date(value);
        }
      } else {
        d = new Date(value);
      }
      
      if (isNaN(d.getTime())) {
        console.error('Invalid date:', value);
        return '';
      }
      
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    } catch (error) {
      console.error('Error formatting date:', value, error);
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

  const renderHistoryContent = () => <HistoryTab />;

  const renderFeedbacksContent = () => <FeedbackTab />;
  const renderManageAccountsContent = () => <ManageAccountsTab />;

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
      case 'accounts':
        return renderManageAccountsContent();
      default:
        return renderHomeContent();
    }
  };

  const handleTabPress = (tab: string) => {
    if (tab === activeTab) return; // Don't show loader if clicking the same tab
    
    setIsTabLoading(true);
    setActiveTab(tab);
    
    // Start spinner animation
    spinValue.setValue(0);
    Animated.loop(
      Animated.timing(spinValue, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      })
    ).start();
    
    // Simulate loading time for better UX
    setTimeout(() => {
      setIsTabLoading(false);
    }, 300);
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
            <MaterialIcons name="logout" size={24} color="white" />
            <Text style={styles.logoutText}>Logout</Text>
          </TouchableOpacity>
        </View>
      </View>
      
      <View style={styles.mainContainer}>
        <AdminSidebar activeTab={activeTab} onTabPress={handleTabPress} />
        <View style={styles.contentContainer}>
          {isTabLoading ? (
            <View style={styles.tabLoaderContainer}>
              <View style={styles.tabLoader}>
                <Animated.View 
                  style={[
                    styles.loaderSpinner,
                    {
                      transform: [{
                        rotate: spinValue.interpolate({
                          inputRange: [0, 1],
                          outputRange: ['0deg', '360deg'],
                        })
                      }]
                    }
                  ]} 
                />
                <Text style={styles.loaderText}>Loading...</Text>
              </View>
            </View>
          ) : (
            renderContent()
          )}
        </View>
      </View>

      <Modal
        visible={showLogoutModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowLogoutModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.logoutModalContainer}>
            {/* Header with Icon */}
            <View style={styles.logoutModalHeader}>
              <View style={styles.logoutIconContainer}>
                <Text style={styles.logoutIconText}>🚪</Text>
              </View>
              <Text style={styles.logoutModalTitle}>Confirm Logout</Text>
              <Text style={styles.logoutModalSubtitle}>Admin Panel</Text>
            </View>
            
            {/* Content */}
            <View style={styles.logoutModalContent}>
              <Text style={styles.logoutModalMessage}>
                Are you sure you want to logout from the admin panel? You'll need to sign in again to access administrative features.
              </Text>
            </View>
            
            {/* Actions */}
            <View style={styles.logoutModalActions}>
              <TouchableOpacity 
                style={styles.logoutCancelButton} 
                onPress={cancelLogout}
                activeOpacity={0.8}
              >
                <Text style={styles.logoutCancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.logoutConfirmButton} 
                onPress={confirmLogout}
                activeOpacity={0.8}
              >
                <Text style={styles.logoutConfirmButtonText}>Logout</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Image Preview Modal */}
      <Modal
        visible={isImagePreviewVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsImagePreviewVisible(false)}
      >
        <View style={styles.imagePreviewOverlay}>
          <View style={styles.imagePreviewContainer}>
            <ScrollView
              contentContainerStyle={styles.imagePreviewScroll}
              maximumZoomScale={3}
              minimumZoomScale={1}
              centerContent
            >
              {imagePreviewUrl ? (
                <Image
                  source={{ uri: imagePreviewUrl }}
                  style={styles.imagePreview}
                  resizeMode="contain"
                />
              ) : null}
            </ScrollView>
            <TouchableOpacity style={styles.imagePreviewClose} onPress={() => setIsImagePreviewVisible(false)}>
              <MaterialIcons name="close" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* History Modal */}
      <Modal
        visible={showHistoryModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowHistoryModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.historyModalContent}>
            <View style={styles.historyModalHeader}>
              <Text style={styles.historyModalTitle}>
                {historyType === 'pickup' ? 'Pickup Completion History' : 'Trash Reports History'}
              </Text>
              <TouchableOpacity 
                onPress={() => setShowHistoryModal(false)}
                style={styles.historyModalClose}
              >
                <MaterialIcons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            {/* Filter buttons */}
            <View style={styles.historyFilterButtons}>
              <TouchableOpacity 
                style={[styles.historyFilterButton, historyFilter === 'today' && styles.historyFilterButtonActive]}
                onPress={() => {
                  setHistoryFilter('today');
                  fetchHistoryData(historyType, 1);
                }}
              >
                <Text style={[styles.historyFilterButtonText, historyFilter === 'today' && styles.historyFilterButtonTextActive]}>Today</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.historyFilterButton, historyFilter === 'week' && styles.historyFilterButtonActive]}
                onPress={() => {
                  setHistoryFilter('week');
                  fetchHistoryData(historyType, 1);
                }}
              >
                <Text style={[styles.historyFilterButtonText, historyFilter === 'week' && styles.historyFilterButtonTextActive]}>Weekly</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.historyFilterButton, historyFilter === 'month' && styles.historyFilterButtonActive]}
                onPress={() => {
                  setHistoryFilter('month');
                  fetchHistoryData(historyType, 1);
                }}
              >
                <Text style={[styles.historyFilterButtonText, historyFilter === 'month' && styles.historyFilterButtonTextActive]}>Monthly</Text>
              </TouchableOpacity>
            </View>

            {/* Export buttons */}
            <View style={styles.exportButtons}>
              <TouchableOpacity 
                style={styles.exportButton}
                onPress={() => exportToCSV(historyReports)}
              >
                <MaterialIcons name="download" size={16} color="#fff" />
                <Text style={styles.exportButtonText}>Export CSV</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.exportButton}
                onPress={() => exportToExcel(historyReports)}
              >
                <MaterialIcons name="description" size={16} color="#fff" />
                <Text style={styles.exportButtonText}>Export Excel</Text>
              </TouchableOpacity>
            </View>

            {/* History list */}
            <ScrollView style={styles.historyList}>
              {historyReports.map((report, index) => (
                <View key={report.id || index} style={styles.historyItem}>
                  <View style={styles.historyItemContent}>
                    <Text style={styles.historyItemName}>{report.userEmail}</Text>
                    <Text style={styles.historyItemLocation}>{report.barangay}, {report.street}</Text>
                    <Text style={styles.historyItemDate}>
                      {report.createdAt?.toDate ? report.createdAt.toDate().toLocaleDateString() : 'N/A'}
                    </Text>
                    <Text style={styles.historyItemTitle}>{report.title}</Text>
                    <Text style={[styles.historyItemStatus, { color: report.status === 'resolved' ? '#10B981' : '#F59E0B' }]}>
                      {report.status}
                    </Text>
                  </View>
                </View>
              ))}
            </ScrollView>

            {/* Pagination */}
            <View style={styles.historyPagination}>
              <TouchableOpacity 
                style={[styles.paginationButton, historyPage === 1 && styles.paginationButtonDisabled]}
                onPress={() => handleHistoryPageChange(historyPage - 1)}
                disabled={historyPage === 1}
              >
                <Text style={[styles.paginationButtonText, historyPage === 1 && styles.paginationButtonTextDisabled]}>Previous</Text>
              </TouchableOpacity>
              
              <Text style={styles.paginationInfo}>
                Page {historyPage} of {historyTotalPages}
              </Text>
              
              <TouchableOpacity 
                style={[styles.paginationButton, historyPage === historyTotalPages && styles.paginationButtonDisabled]}
                onPress={() => handleHistoryPageChange(historyPage + 1)}
                disabled={historyPage === historyTotalPages}
              >
                <Text style={[styles.paginationButtonText, historyPage === historyTotalPages && styles.paginationButtonTextDisabled]}>Next</Text>
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
  // Beautiful Logout Modal Styles
  logoutModalContainer: {
    backgroundColor: '#fff',
    borderRadius: 20,
    width: '90%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 15,
    overflow: 'hidden',
  },
  logoutModalHeader: {
    backgroundColor: '#F8F9FA',
    paddingVertical: 24,
    paddingHorizontal: 20,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E9ECEF',
  },
  logoutIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FFE4E1',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    shadowColor: '#FF6B6B',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  logoutIconText: {
    fontSize: 28,
  },
  logoutModalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#2C3E50',
    marginBottom: 4,
    textAlign: 'center',
  },
  logoutModalSubtitle: {
    fontSize: 14,
    color: '#6C757D',
    fontWeight: '500',
    textAlign: 'center',
  },
  logoutModalContent: {
    padding: 24,
  },
  logoutModalMessage: {
    fontSize: 16,
    color: '#495057',
    lineHeight: 24,
    textAlign: 'center',
  },
  logoutModalActions: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingBottom: 20,
    gap: 12,
  },
  logoutCancelButton: {
    flex: 1,
    backgroundColor: '#F8F9FA',
    borderWidth: 2,
    borderColor: '#DEE2E6',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutCancelButtonText: {
    color: '#6C757D',
    fontSize: 16,
    fontWeight: '600',
  },
  logoutConfirmButton: {
    flex: 1,
    backgroundColor: '#DC3545',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#DC3545',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  logoutConfirmButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  // Tab Loader Styles
  tabLoaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
  },
  tabLoader: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#fff',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
  },
  loaderSpinner: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 4,
    borderColor: '#E3F0E3',
    borderTopColor: '#2E8B57',
    marginBottom: 16,
    // Animation will be handled by React Native's built-in animation
  },
  loaderText: {
    fontSize: 16,
    color: '#6C757D',
    fontWeight: '500',
  },
  imagePreviewOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  imagePreviewContainer: {
    width: '100%',
    maxWidth: 900,
    maxHeight: '90%',
    borderRadius: 12,
    overflow: 'hidden',
  },
  imagePreviewScroll: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 300,
  },
  imagePreview: {
    width: '100%',
    height: '100%',
  },
  imagePreviewClose: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 16,
    padding: 6,
  },
  // History modal styles
  historyModalContent: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    margin: 20,
    maxHeight: '90%',
    minHeight: '60%',
  },
  historyModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  historyModalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  historyModalClose: {
    padding: 8,
  },
  historyFilterButtons: {
    flexDirection: 'row',
    marginBottom: 20,
    gap: 10,
  },
  historyFilterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  historyFilterButtonActive: {
    backgroundColor: '#234033',
    borderColor: '#234033',
  },
  historyFilterButtonText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  historyFilterButtonTextActive: {
    color: 'white',
  },
  exportButtons: {
    flexDirection: 'row',
    marginBottom: 20,
    gap: 10,
  },
  exportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#234033',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    gap: 8,
  },
  exportButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
  },
  historyList: {
    flex: 1,
    marginBottom: 20,
  },
  historyItem: {
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#234033',
  },
  historyItemContent: {
    gap: 4,
  },
  historyItemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  historyItemLocation: {
    fontSize: 14,
    color: '#666',
  },
  historyItemDate: {
    fontSize: 12,
    color: '#999',
  },
  historyItemTitle: {
    fontSize: 14,
    color: '#333',
    marginTop: 4,
  },
  historyItemStatus: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 4,
  },
  historyPagination: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  paginationButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#234033',
    borderRadius: 6,
  },
  paginationButtonDisabled: {
    backgroundColor: '#E5E7EB',
  },
  paginationButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
  },
  paginationButtonTextDisabled: {
    color: '#999',
  },
  paginationInfo: {
    fontSize: 14,
    color: '#666',
  },
  exportSmallButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#234033',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  exportSmallButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
}); 