import { useAuthContext } from '@/components/AuthContext';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { db, storage } from '@/config/firebase';
import { Colors } from '@/constants/Colors';
import { useTheme } from '@/hooks/useTheme';
import { NotificationService } from '@/services/notificationService';
import { useRouter } from 'expo-router';
import { addDoc, collection, doc, getDoc, onSnapshot, orderBy, query, updateDoc, where } from 'firebase/firestore';
import { getDownloadURL, ref } from 'firebase/storage';
import React, { useEffect, useState } from 'react';
import { Image, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function HomePage() {
  const router = useRouter();
  const { theme } = useTheme();
  const colors = Colors[theme ?? 'light'];
  const { user } = useAuthContext();
  const [userProfile, setUserProfile] = useState<{
    displayName?: string;
    photoURL?: string;
  } | null>(null);
  const [announcements, setAnnouncements] = useState<{
    id: string;
    title: string;
    description: string;
    priority: 'Low' | 'Medium' | 'High' | 'Urgent';
    category: string;
    createdAt: any;
  }[]>([]);
  const [lastAnnouncementId, setLastAnnouncementId] = useState<string | null>(null);

  // Notifications inbox state
  const [notifications, setNotifications] = useState<Array<{ id: string; title: string; body: string; createdAt: any; read?: boolean }>>([]);
  const [showNotificationsModal, setShowNotificationsModal] = useState(false);
  const unreadCount = notifications.filter(n => !n.read).length;

  // Request notification permissions on mount
  useEffect(() => {
    const requestPermissions = async () => {
      try {
        await NotificationService.requestPermissions();
      } catch (error) {
        console.error('Error requesting notification permissions:', error);
      }
    };
    
    requestPermissions();
  }, []);

  // Resolve storage path to public URL if needed
  const resolvePhotoURL = async (maybePath?: string) => {
    try {
      if (!maybePath) return undefined;
      const isHttp = /^https?:\/\//i.test(maybePath);
      const isDataOrLocal = /^(data:|file:|content:|asset(s)?:\/\/|blob:|expo-file:)/i.test(maybePath);
      if (isHttp || isDataOrLocal) return maybePath;
      if (!storage) return undefined;
      const r = ref(storage, maybePath);
      return await getDownloadURL(r);
    } catch (e) {
      console.warn('Failed to resolve home photo URL:', e);
      return undefined;
    }
  };

  // Fetch user profile data from Firestore
  useEffect(() => {
    const fetchUserProfile = async () => {
      if (!user || !db) return;

      try {
        const userRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userRef);
        
        if (userSnap.exists()) {
          const userData = userSnap.data();
          const resolved = await resolvePhotoURL(userData.photoURL || user.photoURL);
          setUserProfile({
            displayName: userData.displayName || user.displayName || 'User',
            photoURL: resolved,
          });
        } else {
          // Fallback to auth data if Firestore document doesn't exist
          const resolved = await resolvePhotoURL(user.photoURL || undefined);
          setUserProfile({
            displayName: user.displayName || 'User',
            photoURL: resolved,
          });
        }
      } catch (error) {
        console.error('Error fetching user profile:', error);
        // Fallback to auth data on error
        const resolved = await resolvePhotoURL(user.photoURL || undefined);
        setUserProfile({
          displayName: user.displayName || 'User',
          photoURL: resolved,
        });
      }
    };

    fetchUserProfile();
  }, [user]);

  // Fetch announcements from Firestore
  useEffect(() => {
    if (!db) return;

    console.log('Setting up announcements listener for home...');
    
    const announcementsRef = collection(db, 'announcements');
    const q = query(
      announcementsRef, 
      where('isPublished', '==', true)
    );
    
    const unsubscribe = onSnapshot(q, 
      async (snapshot) => {
        console.log('Home announcements snapshot received:', snapshot.docs.length, 'documents');
        
        const announcementsData = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            title: data.title || '',
            description: data.description || '',
            priority: data.priority || 'Medium',
            category: data.category || 'General',
            createdAt: data.createdAt
          };
        });
        
        // Sort by creation date (newest first) and take only the first 2
        announcementsData.sort((a, b) => {
          const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
          const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
          return dateB.getTime() - dateA.getTime();
        });
        
        // Check for new announcements and send notifications
        if (announcementsData.length > 0) {
          const latestAnnouncement = announcementsData[0];
          if (lastAnnouncementId !== latestAnnouncement.id) {
            // New announcement detected, send notification
            try {
              await NotificationService.scheduleAnnouncementNotification(latestAnnouncement);
              setLastAnnouncementId(latestAnnouncement.id);
            } catch (error) {
              console.error('Error sending announcement notification:', error);
            }
          }
        }
        
        setAnnouncements(announcementsData.slice(0, 2)); // Show only latest 2 announcements
      },
      (error) => {
        console.error('Error fetching announcements for home:', error);
      }
    );

    return () => {
      console.log('Cleaning up home announcements listener');
      unsubscribe();
    };
  }, [lastAnnouncementId]);

  // Subscribe to user notifications (inbox)
  useEffect(() => {
    if (!db || !user?.uid) return;
    const q = query(
      collection(db, 'userNotifications'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );
    const unsub = onSnapshot(q, (snap) => {
      const items: Array<{ id: string; title: string; body: string; createdAt: any; read?: boolean }> = [];
      snap.forEach((d) => {
        const data: any = d.data();
        items.push({
          id: d.id,
          title: data.title || 'Notification',
          body: data.body || '',
          createdAt: data.createdAt,
          read: !!data.read,
        });
      });
      setNotifications(items);
    });
    return () => unsub();
  }, [user?.uid]);

  const markAsRead = async (id: string) => {
    try {
      if (!db) return;
      await updateDoc(doc(db, 'userNotifications', id), { read: true, readAt: new Date().toISOString() });
    } catch (e) {
      console.warn('Failed to mark notification read:', e);
    }
  };

  const markAllAsRead = async () => {
    try {
      for (const n of notifications) {
        if (!n.read) {
          await markAsRead(n.id);
        }
      }
    } catch (e) {
      console.warn('Failed to mark all as read:', e);
    }
  };

  // Test function to send fake notifications
  const sendTestNotifications = async () => {
    if (!db || !user?.uid) return;
    
    try {
      const testNotifications = [
        {
          title: "🚛 Pickup Reminder",
          body: "Your trash pickup is scheduled for tomorrow at 9:00 AM. Please have your bins ready!",
          userId: user.uid,
          type: "pickup_reminder",
          createdAt: new Date(),
          read: false
        },
        {
          title: "📢 New Announcement",
          body: "Important: Schedule changes for next week due to holiday. Check your updated pickup times.",
          userId: user.uid,
          type: "announcement",
          createdAt: new Date(),
          read: false
        },
        {
          title: "✅ Pickup Completed",
          body: "Your trash has been successfully collected today. Thank you for using our service!",
          userId: user.uid,
          type: "pickup_completed",
          createdAt: new Date(),
          read: false
        }
      ];

      for (const notification of testNotifications) {
        await addDoc(collection(db, 'userNotifications'), notification);
      }
      
      console.log('Test notifications sent successfully!');
    } catch (error) {
      console.error('Error sending test notifications:', error);
    }
  };

  const handleLogout = () => {
    // Navigate back to splash screen (logout)
    router.replace('/splash');
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'Urgent':
        return '#EF4444';
      case 'High':
        return '#F97316';
      case 'Medium':
        return '#EAB308';
      case 'Low':
        return '#22C55E';
      default:
        return '#6B7280';
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category.toLowerCase()) {
      case 'general':
        return '#22C55E'; // Green
      case 'schedule':
        return '#3B82F6'; // Blue
      case 'maintenance':
        return '#F59E0B'; // Orange
      case 'policy update':
        return '#8B5CF6'; // Purple
      case 'emergency':
        return '#EF4444'; // Red
      case 'service':
        return '#06B6D4'; // Cyan
      case 'weather':
        return '#84CC16'; // Lime
      case 'holiday':
        return '#F97316'; // Orange
      default:
        return '#6B7280'; // Gray
    }
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'Urgent':
        return 'exclamationmark.triangle.fill';
      case 'High':
        return 'exclamationmark.circle.fill';
      case 'Medium':
        return 'info.circle.fill';
      case 'Low':
        return 'checkmark.circle.fill';
      default:
        return 'circle.fill';
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category.toLowerCase()) {
      case 'general':
        return 'megaphone.fill';
      case 'schedule':
        return 'calendar';
      case 'maintenance':
        return 'wrench.and.screwdriver.fill';
      case 'policy update':
        return 'doc.text.fill';
      case 'emergency':
        return 'exclamationmark.triangle.fill';
      case 'service':
        return 'gearshape.fill';
      case 'weather':
        return 'cloud.fill';
      case 'holiday':
        return 'gift.fill';
      default:
        return 'info.circle.fill';
    }
  };

  const formatAnnouncementDate = (createdAt: any) => {
    if (!createdAt) return '';
    const dateObj = createdAt.toDate ? createdAt.toDate() : new Date(createdAt);
    return `${dateObj.toLocaleDateString()} ${dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header Section */}
      <View style={styles.header}>
        <View style={styles.profileSection}>
          <View style={[styles.profileIcon, { backgroundColor: colors.primary }]}>
            {userProfile?.photoURL ? (
              <Image 
                source={{ uri: userProfile.photoURL }} 
                style={styles.profileImage}
                resizeMode="cover"
              />
            ) : (
              <IconSymbol name="person.fill" size={24} color={colors.surface} />
            )}
          </View>
          <Text style={[styles.greeting, { color: colors.textPrimary }]}>
            Hello, {userProfile?.displayName?.split(' ')[0] || 'User'}!
          </Text>
        </View>
        
        <View style={styles.headerActions}>
          <TouchableOpacity 
            style={[styles.testButton, { backgroundColor: colors.primary, borderRadius: 20, width: 32, height: 32, alignItems: 'center', justifyContent: 'center' }]}
            onPress={sendTestNotifications}
          >
            <Text style={{ color: 'white', fontSize: 18, fontWeight: 'bold' }}>+</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.notificationButton} onPress={() => setShowNotificationsModal(true)}>
            <IconSymbol name="bell.badge.fill" size={24} color={colors.textSecondary} />
            {unreadCount > 0 && (
              <View style={[styles.notificationBadge, { backgroundColor: colors.error }]}>
                <Text style={[styles.notificationText, { color: colors.surface }]}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.settingsButton}
            onPress={() => router.push('/profile')}
          >
            <IconSymbol name="gear" size={24} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Main Content */}
      <View style={styles.content}>
        {/* Featured Image */}
        <View style={styles.featuredImageContainer}>
          <View style={[styles.featuredImage, { backgroundColor: colors.surface }]}>
            <Image
              source={require('../../assets/images/Dashboard_mobile.png')}
              style={styles.heroImage}
              resizeMode="cover"
            />
          </View>
        </View>

        {/* Informational Box */}
        <View style={[styles.infoBox, { backgroundColor: colors.primary }]}>
          <Text style={styles.infoText}>
            Compost your kitchen waste like vegetable peels and eggshells – your plants will love it!
          </Text>
        </View>

        {/* Announcements Section */}
        <View style={styles.announcementsSection}>
          <View style={[styles.sectionDivider, { backgroundColor: colors.textTertiary }]} />
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
            Latest Announcements
          </Text>
          
          {announcements.length === 0 ? (
            <View style={[styles.announcementCard, { backgroundColor: colors.surface }]}>
              <View style={styles.announcementLeft}>
                <IconSymbol name="megaphone" size={24} color={colors.textSecondary} />
                <View style={styles.announcementText}>
                  <Text style={[styles.announcementTitle, { color: colors.textPrimary }]}>
                    No announcements yet
                  </Text>
                  <Text style={[styles.announcementSubtitle, { color: colors.textSecondary }]}>
                    Check back later for updates
                  </Text>
                </View>
              </View>
            </View>
          ) : (
            announcements.map((announcement) => (
              <TouchableOpacity 
                key={announcement.id} 
                style={[styles.announcementCard, { backgroundColor: colors.surface }]}
                onPress={() => router.push({
                  pathname: '/(tabs)/announcements',
                  params: { openModal: 'true', announcementId: announcement.id }
                })}
                activeOpacity={0.7}
              >
                <View style={styles.announcementLeft}>
                  <IconSymbol 
                    name={getCategoryIcon(announcement.category)} 
                    size={24} 
                    color={getCategoryColor(announcement.category)} 
                  />
                  <View style={styles.announcementText}>
                    <Text style={[styles.announcementTitle, { color: colors.textPrimary }]}>
                      {announcement.title}
                    </Text>
                    <Text style={[styles.announcementSubtitle, { color: colors.textSecondary }]}>
                      {announcement.description.length > 50 
                        ? `${announcement.description.substring(0, 50)}...` 
                        : announcement.description}
                    </Text>
                    <Text style={[styles.announcementDate, { color: colors.textTertiary }]}>
                      {formatAnnouncementDate(announcement.createdAt)}
                    </Text>
                  </View>
                </View>
                <View style={styles.announcementRight}>
                  <Text style={[styles.nextPickupLabel, { color: colors.textSecondary }]}>
                    {announcement.priority}
                  </Text>
                  <Text style={[styles.nextPickupDate, { color: getCategoryColor(announcement.category) }]}>
                    {announcement.category}
                  </Text>
                </View>
              </TouchableOpacity>
            ))
          )}

          {/* View More Link */}
          <TouchableOpacity 
            style={styles.viewMoreButton}
            onPress={() => router.push('/(tabs)/announcements')}
          >
            <IconSymbol name="chevron.right" size={16} color={colors.primary} />
            <Text style={[styles.viewMoreText, { color: colors.primary }]}>
              View all announcements
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Notifications Modal */}
      <Modal
        transparent
        visible={showNotificationsModal}
        animationType="fade"
        onRequestClose={() => setShowNotificationsModal(false)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', alignItems: 'center', padding: 16 }}>
          <View style={{ width: '100%', maxWidth: 420, borderRadius: 12, backgroundColor: colors.surface, padding: 16 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <Text style={{ fontSize: 18, fontWeight: '700', color: colors.textPrimary }}>Notifications</Text>
              <TouchableOpacity onPress={() => setShowNotificationsModal(false)}>
                <IconSymbol name="xmark" size={20} color={colors.textTertiary} />
              </TouchableOpacity>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 8 }}>
              {unreadCount > 0 && (
                <TouchableOpacity onPress={markAllAsRead} style={{ paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8, backgroundColor: colors.secondary }}>
                  <Text style={{ color: colors.primary, fontWeight: '600' }}>Mark all as read</Text>
                </TouchableOpacity>
              )}
            </View>
            <ScrollView style={{ maxHeight: 400 }}>
              {notifications.length === 0 ? (
                <View style={{ padding: 16, alignItems: 'center' }}>
                  <Text style={{ color: colors.textSecondary }}>No notifications yet</Text>
                </View>
              ) : (
                notifications.map((n) => (
                  <TouchableOpacity key={n.id} onPress={() => markAsRead(n.id)} style={{ paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                    <Text style={{ color: colors.textPrimary, fontWeight: n.read ? '500' as any : '700' as any }}>{n.title}</Text>
                    {!!n.body && (
                      <Text style={{ color: colors.textSecondary, marginTop: 2 }}>{n.body}</Text>
                    )}
                    <Text style={{ color: colors.textTertiary, fontSize: 12, marginTop: 4 }}>
                      {(() => {
                        const d = n.createdAt?.toDate ? n.createdAt.toDate() : new Date(n.createdAt);
                        return isNaN(d?.getTime?.() || NaN) ? '' : `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
                      })()}
                    </Text>
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingTop: 60,
  },
  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  profileIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  profileImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  greeting: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  notificationButton: {
    position: 'relative',
  },
  notificationBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  testButton: {
    padding: 4,
  },
  settingsButton: {
    padding: 4,
  },
  content: {
    padding: 20,
    gap: 20,
  },
  featuredImageContainer: {
    alignItems: 'center',
  },
  featuredImage: {
    width: '100%',
    height: 200,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  heroImage: {
    width: '100%',
    height: '100%',
    borderRadius: 16,
  },
  aiIcon: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  aiText: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  infoBox: {
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  infoText: {
    color: 'white',
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22,
    fontWeight: '500',
  },
  announcementsSection: {
    gap: 16,
  },
  sectionDivider: {
    height: 1,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  announcementCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  announcementLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  announcementText: {
    gap: 4,
  },
  announcementTitle: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  announcementSubtitle: {
    fontSize: 14,
  },
  announcementDate: {
    fontSize: 12,
    marginTop: 2,
  },
  announcementRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  nextPickupLabel: {
    fontSize: 12,
  },
  nextPickupDate: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  viewMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    gap: 6,
  },
  viewMoreText: {
    fontSize: 14,
    fontWeight: '500',
    textDecorationLine: 'underline',
  },
});