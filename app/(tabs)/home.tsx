import { useAuthContext } from '@/components/AuthContext';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { db, storage } from '@/config/firebase';
import { Colors } from '@/constants/Colors';
import { useTheme } from '@/hooks/useTheme';
import { NotificationService } from '@/services/notificationService';
import { useRouter } from 'expo-router';
import { collection, doc, getDoc, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { getDownloadURL, ref } from 'firebase/storage';
import React, { useEffect, useState } from 'react';
import { Image, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { getNotificationColor, getNotificationIcon, getNotificationTypeLabel, markAsRead as markAsReadHelper, sendTestNotification as sendTestNotificationHelper } from './home.notifications';

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
  const [notifications, setNotifications] = useState<Array<{ id: string; title: string; body: string; createdAt: any; read?: boolean; type?: string }>>([]);
  const [showNotificationsModal, setShowNotificationsModal] = useState(false);
  const [selectedNotification, setSelectedNotification] = useState<{ id: string; title: string; body: string; createdAt: any; read?: boolean; type?: string } | null>(null);
  const [showNotificationDetail, setShowNotificationDetail] = useState(false);
  const [currentNotificationType, setCurrentNotificationType] = useState(0); // 0, 1, 2 for cycling
  const unreadCount = notifications.filter(n => !n.read).length;

  // Request notification permissions on mount
  useEffect(() => {
    const requestPermissions = async () => {
      try {
        await NotificationService.requestPermissions();
      } catch (error) {
        // Error requesting notification permissions
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
      // Failed to resolve home photo URL
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
        // Error fetching user profile
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

    // Setting up announcements listener for home
    
    const announcementsRef = collection(db, 'announcements');
    const q = query(
      announcementsRef, 
      where('isPublished', '==', true)
    );
    
    const unsubscribe = onSnapshot(q, 
      async (snapshot) => {
        // Home announcements snapshot received
        
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
              // Error sending announcement notification
            }
          }
        }
        
        setAnnouncements(announcementsData.slice(0, 2)); // Show only latest 2 announcements
      },
      (error) => {
        // Error fetching announcements for home
      }
    );

    return () => {
      // Cleaning up home announcements listener
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
      const items: Array<{ id: string; title: string; body: string; createdAt: any; read?: boolean; type?: string }> = [];
      snap.forEach((d) => {
        const data: any = d.data();
        items.push({
          id: d.id,
          title: data.title || 'Notification',
          body: data.body || '',
          createdAt: data.createdAt,
          read: !!data.read,
          type: data.type || 'general',
        });
      });
      setNotifications(items);
    });
    return () => unsub();
  }, [user?.uid]);

  const markAsRead = async (id: string) => {
    await markAsReadHelper(db, id);
  };

  const handleNotificationPress = (notification: { id: string; title: string; body: string; createdAt: any; read?: boolean; type?: string }) => {
    // Notification pressed
    setSelectedNotification(notification);
    setShowNotificationsModal(false); // Close the notifications list first
    setShowNotificationDetail(true);
    // Mark as read when opened
    if (!notification.read) {
      markAsRead(notification.id);
    }
  };

  const handleCloseNotificationDetail = () => {
    setShowNotificationDetail(false);
    setSelectedNotification(null);
  };

  const getCurrentNotificationTypeName = () => {
    const types = ['Pickup Reminder', 'Announcement', 'Pickup Completed'];
    return types[currentNotificationType];
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

  // Test function to send one notification at a time, cycling through types
  const sendTestNotification = async () => {
    const next = await sendTestNotificationHelper(db, user, currentNotificationType);
    setCurrentNotificationType(next);
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

  // Notification helpers imported from './home.notifications'

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
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
          <View style={{ alignItems: 'center' }}>
            <TouchableOpacity 
              style={[styles.testButton, { backgroundColor: colors.primary, borderRadius: 20, width: 32, height: 32, alignItems: 'center', justifyContent: 'center' }]}
              onPress={sendTestNotification}
            >
              <Text style={{ color: 'white', fontSize: 18, fontWeight: 'bold' }}>+</Text>
            </TouchableOpacity>
            <Text style={[styles.notificationTypeIndicator, { color: colors.textTertiary, fontSize: 10 }]}>
              {getCurrentNotificationTypeName()}
            </Text>
          </View>
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
                  <TouchableOpacity key={n.id} onPress={() => handleNotificationPress(n)} style={{ paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: colors.textPrimary, fontWeight: n.read ? '500' as any : '700' as any }}>{n.title}</Text>
                        {!!n.body && (
                          <Text style={{ color: colors.textSecondary, marginTop: 2 }} numberOfLines={2}>{n.body}</Text>
                        )}
                        <Text style={{ color: colors.textTertiary, fontSize: 12, marginTop: 4 }}>
                          {(() => {
                            const d = n.createdAt?.toDate ? n.createdAt.toDate() : new Date(n.createdAt);
                            return isNaN(d?.getTime?.() || NaN) ? '' : `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
                          })()}
                        </Text>
                      </View>
                      <IconSymbol name="chevron.right" size={16} color={colors.textTertiary} />
                    </View>
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Notification Detail Modal */}
      <Modal
        visible={showNotificationDetail}
        transparent
        animationType="slide"
        onRequestClose={handleCloseNotificationDetail}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.notificationDetailContainer, { backgroundColor: colors.surface }]}>
            <View style={[styles.notificationDetailHeader, { borderBottomColor: colors.border }]}>
              <TouchableOpacity 
                style={styles.closeButton}
                onPress={handleCloseNotificationDetail}
              >
                <IconSymbol name="xmark" size={24} color={colors.textPrimary} />
              </TouchableOpacity>
              <Text style={[styles.notificationDetailTitle, { color: colors.textPrimary }]}>
                Notification Details
              </Text>
              <View style={styles.headerSpacer} />
            </View>

            {selectedNotification && (
              <ScrollView style={styles.notificationDetailContent}>
                <View style={styles.notificationDetailCard}>
                  <View style={styles.notificationTypeContainer}>
                    <IconSymbol 
                      name={getNotificationIcon(selectedNotification.type || 'general')} 
                      size={24} 
                      color={getNotificationColor(selectedNotification.type || 'general')} 
                    />
                    <Text style={[styles.notificationTypeText, { color: getNotificationColor(selectedNotification.type || 'general') }]}>
                      {getNotificationTypeLabel(selectedNotification.type || 'general')}
                    </Text>
                  </View>

                  <Text style={[styles.notificationDetailTitleText, { color: colors.textPrimary }]}>
                    {selectedNotification.title}
                  </Text>

                  <Text style={[styles.notificationDetailBody, { color: colors.textSecondary }]}>
                    {selectedNotification.body}
                  </Text>

                  <View style={[styles.notificationDetailMeta, { backgroundColor: colors.background }]}>
                    <View style={styles.notificationMetaRow}>
                      <IconSymbol name="clock" size={16} color={colors.textTertiary} />
                      <Text style={[styles.notificationMetaText, { color: colors.textTertiary }]}>
                        {(() => {
                          const d = selectedNotification.createdAt?.toDate ? selectedNotification.createdAt.toDate() : new Date(selectedNotification.createdAt);
                          return isNaN(d?.getTime?.() || NaN) ? 'Unknown time' : `${d.toLocaleDateString()} at ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
                        })()}
                      </Text>
                    </View>
                    
                    <View style={styles.notificationMetaRow}>
                      <IconSymbol name="checkmark.circle" size={16} color={selectedNotification.read ? colors.primary : colors.textTertiary} />
                      <Text style={[styles.notificationMetaText, { color: selectedNotification.read ? colors.primary : colors.textTertiary }]}>
                        {selectedNotification.read ? 'Read' : 'Unread'}
                      </Text>
                    </View>
                  </View>
                </View>
              </ScrollView>
            )}

            <View style={[styles.notificationDetailActions, { borderTopColor: colors.border }]}>
              <TouchableOpacity 
                style={[styles.notificationActionButton, { backgroundColor: colors.background, borderColor: colors.border, borderWidth: 1, marginRight: 8 }]}
                onPress={() => {
                  handleCloseNotificationDetail();
                  setShowNotificationsModal(true);
                }}
              >
                <Text style={[styles.notificationActionText, { color: colors.textPrimary }]}>
                  Back to Notifications
                </Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.notificationActionButton, { backgroundColor: colors.primary, flex: 1 }]}
                onPress={handleCloseNotificationDetail}
              >
                <Text style={[styles.notificationActionText, { color: colors.surface }]}>
                  Close
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    height: '100%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingTop: 30,
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
  // Notification Detail Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  notificationDetailContainer: {
    width: '100%',
    height: '60%',
    maxWidth: 500,
    maxHeight: '90%',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  notificationDetailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  notificationDetailTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  closeButton: {
    padding: 8,
  },
  headerSpacer: {
    width: 40,
  },
  notificationDetailContent: {
    flex: 1,
    padding: 20,
  },
  notificationDetailCard: {
    gap: 20,
  },
  notificationTypeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  notificationTypeText: {
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  notificationDetailTitleText: {
    fontSize: 24,
    fontWeight: 'bold',
    lineHeight: 32,
  },
  notificationDetailBody: {
    fontSize: 18,
    lineHeight: 28,
    marginTop: 8,
  },
  notificationDetailMeta: {
    padding: 16,
    borderRadius: 8,
    gap: 12,
    marginTop: 8,
  },
  notificationMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  notificationMetaText: {
    fontSize: 14,
  },
  notificationDetailActions: {
    padding: 20,
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: 8,
  },
  notificationActionButton: {
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    flex: 1,
  },
  notificationActionText: {
    fontSize: 14,
    fontWeight: '600',
  },
  notificationTypeIndicator: {
    marginTop: 2,
    textAlign: 'center',
    maxWidth: 60,
  },
});