import { useAuthContext } from "@/components/AuthContext";
import { IconSymbol } from "@/components/ui/IconSymbol";
import { db, storage } from "@/config/firebase";
import { Colors } from "@/constants/Colors";
import { useTheme } from "@/hooks/useTheme";
import { NotificationService } from "@/services/notificationService";
import { formatAdaptiveMassFromMetricTons } from "@/utils/wasteUnits";
import { MaterialIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { getDownloadURL, ref } from "firebase/storage";
import React, { useEffect, useState } from "react";
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Alert
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  markAsRead as markAsReadHelper,
  sendTestNotification as sendTestNotificationHelper
} from "./home.notifications";

export default function HomePage() {
  const router = useRouter();
  const { theme } = useTheme();
  const colors = Colors[theme ?? "light"];
  const insets = useSafeAreaInsets();
  const { user } = useAuthContext();
  const [userProfile, setUserProfile] = useState<{
    displayName?: string;
    photoURL?: string;
  } | null>(null);
  const [announcements, setAnnouncements] = useState<
    {
      id: string;
      title: string;
      description: string;
      priority: "Low" | "Medium" | "High" | "Urgent";
      category: string;
      createdAt: any;
    }[]
  >([]);
  const [lastAnnouncementId, setLastAnnouncementId] = useState<string | null>(
    null
  );
  const [announcementNotificationsEnabled, setAnnouncementNotificationsEnabled] = useState(false);

  useEffect(() => {
    if (!user?.uid || !db) return;
    getDoc(doc(db, 'user_settings', user.uid)).then(snapshot => {
      const preferences = snapshot.data()?.notificationPreferences;
      setAnnouncementNotificationsEnabled(preferences?.pushEnabled !== false && preferences?.announcements !== false);
    }).catch(() => setAnnouncementNotificationsEnabled(false));
  }, [user?.uid]);

  // Notifications inbox state
  const [notifications, setNotifications] = useState<
    {
      id: string;
      title: string;
      body: string;
      createdAt: any;
      read?: boolean;
      type?: string;
    }[]
  >([]);
  const [showNotificationsModal, setShowNotificationsModal] = useState(false);
  const [selectedNotification, setSelectedNotification] = useState<{
    id: string;
    title: string;
    body: string;
    createdAt: any;
    read?: boolean;
    type?: string;
  } | null>(null);
  const [showNotificationDetail, setShowNotificationDetail] = useState(false);
  const [currentNotificationType, setCurrentNotificationType] = useState(0); // 0, 1, 2 for cycling
  const unreadCount = notifications.filter((n) => !n.read).length;

  // Gamification states
  const [userReports, setUserReports] = useState<any[]>([]);
  const totalPoints = userReports.length * 50; // 50 points per report
  const trashCollectedTons = userReports.length * 0.0025; // Existing 2.5 kg-per-report estimate, normalized in metric tons.

  // Next Collection state
  const [userBarangay, setUserBarangay] = useState<string>('');
  const [nextCollection, setNextCollection] = useState<{
    dateLabel: string;
    timeText: string;
    wasteCategory: string;
  } | null>(null);

  // Driver role detection
  const [userRole, setUserRole] = useState<string | null>(null);
  const isDriver = userRole === 'driver';

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

  // Fetch user's barangay from profile
  useEffect(() => {
    if (!db || !user?.uid) return;
    const unsubUser = onSnapshot(doc(db, 'users', user.uid), (docSnap) => {
      if (docSnap.exists()) {
        setUserBarangay(docSnap.data().barangay || '');
      }
    });
    return () => unsubUser();
  }, [user]);

  // Compute next collection from barangay_schedules
  useEffect(() => {
    if (!db || !userBarangay) {
      setNextCollection(null);
      return;
    }

    const unsub = onSnapshot(collection(db, 'barangay_schedules'), (snap) => {
      const schedules: any[] = [];
      snap.forEach((d) => {
        const data = d.data();
        if (data.barangayName === userBarangay) {
          schedules.push({ id: d.id, ...data });
        }
      });

      if (schedules.length === 0) {
        setNextCollection(null);
        return;
      }

      const DOW_MAP = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      let closest: { date: Date; wasteCategory: string; timeText: string } | null = null;

      // Search the next 60 days for the closest scheduled collection
      for (let offset = 0; offset < 60; offset++) {
        const checkDate = new Date(today);
        checkDate.setDate(today.getDate() + offset);
        const dowStr = DOW_MAP[checkDate.getDay()];
        const key = `${checkDate.getFullYear()}-${(checkDate.getMonth() + 1).toString().padStart(2, '0')}-${checkDate.getDate().toString().padStart(2, '0')}`;

        for (const s of schedules) {
          let isMatch = s.days && s.days.includes(dowStr);
          let category = s.wasteCategory || 'BIODEGRADABLE';
          let time = 'Regular Hours';

          const specificMatch = (s.specificSchedules || []).find((ss: any) => {
            if (!ss.date) return false;
            const monthNames = ["January", "February", "March", "April", "May", "June",
              "July", "August", "September", "October", "November", "December"];
            const monthName = monthNames[checkDate.getMonth()];
            const shortMonthName = monthName.substring(0, 3);
            const monthDD = `${monthName} ${checkDate.getDate()}`;
            const shortMonthDD = `${shortMonthName} ${checkDate.getDate()}`;
            const mmdd = `${(checkDate.getMonth() + 1).toString().padStart(2, '0')}/${checkDate.getDate().toString().padStart(2, '0')}`;
            const dText = ss.date.trim().toLowerCase();
            return dText === mmdd.toLowerCase() ||
              dText === key.toLowerCase() ||
              dText === monthDD.toLowerCase() ||
              dText === shortMonthDD.toLowerCase();
          });

          if (specificMatch) {
            isMatch = true;
            category = specificMatch.category || category;
            time = specificMatch.time || time;
          }

          if (isMatch) {
            if (!closest) {
              closest = { date: checkDate, wasteCategory: category, timeText: time };
            }
            break;
          }
        }
        if (closest) break;
      }

      if (closest) {
        const c = closest as { date: Date; wasteCategory: string; timeText: string };
        const diffDays = Math.round((c.date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        let dateLabel = '';
        if (diffDays === 0) dateLabel = 'Today';
        else if (diffDays === 1) dateLabel = 'Tomorrow';
        else {
          dateLabel = c.date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
        }
        setNextCollection({ dateLabel, timeText: c.timeText, wasteCategory: c.wasteCategory });
      } else {
        setNextCollection(null);
      }
    });

    return () => unsub();
  }, [userBarangay]);

  // Resolve storage path to public URL if needed
  const resolvePhotoURL = async (maybePath?: string) => {
    try {
      if (!maybePath) return undefined;
      const isHttp = /^https?:\/\//i.test(maybePath);
      const isDataOrLocal =
        /^(data:|file:|content:|asset(s)?:\/\/|blob:|expo-file:)/i.test(
          maybePath
        );
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
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {
          const userData = userSnap.data();
          const resolved = await resolvePhotoURL(
            userData.photoURL || user.photoURL
          );
          setUserProfile({
            displayName: userData.displayName || user.displayName || "User",
            photoURL: resolved,
          });
          setUserRole(userData.role || null);
        } else {
          // Fallback to auth data if Firestore document doesn't exist
          const resolved = await resolvePhotoURL(user.photoURL || undefined);
          setUserProfile({
            displayName: user.displayName || "User",
            photoURL: resolved,
          });
        }
      } catch (error) {
        // Error fetching user profile
        // Fallback to auth data on error
        const resolved = await resolvePhotoURL(user.photoURL || undefined);
        setUserProfile({
          displayName: user.displayName || "User",
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

    const announcementsRef = collection(db, "announcements");
    const q = query(announcementsRef, where("isPublished", "==", true));

    const unsubscribe = onSnapshot(
      q,
      async (snapshot) => {
        // Home announcements snapshot received

        const announcementsData = snapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            title: data.title || "",
            description: data.description || "",
            priority: data.priority || "Medium",
            category: data.category || "General",
            createdAt: data.createdAt,
          };
        });

        // Sort by creation date (newest first) and take only the first 2
        announcementsData.sort((a, b) => {
          const dateA = a.createdAt?.toDate
            ? a.createdAt.toDate()
            : new Date(a.createdAt);
          const dateB = b.createdAt?.toDate
            ? b.createdAt.toDate()
            : new Date(b.createdAt);
          return dateB.getTime() - dateA.getTime();
        });

        // Check for new announcements and send notifications
        if (announcementsData.length > 0) {
          const latestAnnouncement = announcementsData[0];
          
          if (lastAnnouncementId === null) {
            // Initial load - don't spam a notification on login, just set the ID
            setLastAnnouncementId(latestAnnouncement.id);
          } else if (lastAnnouncementId !== latestAnnouncement.id) {
            if (announcementNotificationsEnabled) {
              try {
                await NotificationService.scheduleAnnouncementNotification(latestAnnouncement);
              } catch {
                // Keep the announcement visible even when local scheduling fails.
              }
            }
            setLastAnnouncementId(latestAnnouncement.id);
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
  }, [lastAnnouncementId, announcementNotificationsEnabled]);

  // Subscribe to user reports for gamification
  useEffect(() => {
    if (!db || !user?.uid) return;
    const q = query(
      collection(db, "reports"),
      where("userId", "==", user.uid)
    );
    const unsub = onSnapshot(q, (snap) => {
      const items: any[] = [];
      snap.forEach((d) => {
        items.push({ id: d.id, ...d.data() });
      });
      // Sort client-side to avoid Firebase composite index requirement
      items.sort((a, b) => {
        const dateA = new Date(a.createdAt).getTime();
        const dateB = new Date(b.createdAt).getTime();
        return dateB - dateA;
      });
      setUserReports(items);
    });
    return () => unsub();
  }, [user?.uid]);

  // Subscribe to user notifications (inbox)
  useEffect(() => {
    if (!db || !user?.uid) return;
    const q = query(
      collection(db, "userNotifications"),
      where("userId", "==", user.uid),
      orderBy("createdAt", "desc")
    );
    const unsub = onSnapshot(q, (snap) => {
      const items: {
        id: string;
        title: string;
        body: string;
        createdAt: any;
        read?: boolean;
        type?: string;
      }[] = [];
      snap.forEach((d) => {
        const data: any = d.data();
        items.push({
          id: d.id,
          title: data.title || "Notification",
          body: data.body || "",
          createdAt: data.createdAt,
          read: !!data.read,
          type: data.type || "general",
        });
      });
      setNotifications(items);
    });
    return () => unsub();
  }, [user?.uid]);

  const markAsRead = async (id: string) => {
    await markAsReadHelper(db, id);
  };

  const handleNotificationPress = (notification: {
    id: string;
    title: string;
    body: string;
    createdAt: any;
    read?: boolean;
    type?: string;
  }) => {
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
    const types = ["Pickup Reminder", "Announcement", "Pickup Completed"];
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
      console.warn("Failed to mark all as read:", e);
    }
  };

  // Test function to send one notification at a time, cycling through types
  const sendTestNotification = async () => {
    const next = await sendTestNotificationHelper(
      db,
      user,
      currentNotificationType
    );
    setCurrentNotificationType(next);
  };

  const handleLogout = () => {
    // Navigate back to splash screen (logout)
    router.replace("/splash");
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "Urgent":
        return "#EF4444";
      case "High":
        return "#F97316";
      case "Medium":
        return "#EAB308";
      case "Low":
        return "#22C55E";
      default:
        return "#6B7280";
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category.toLowerCase()) {
      case "general":
        return "#22C55E"; // Green
      case "schedule":
        return "#3B82F6"; // Blue
      case "maintenance":
        return "#F59E0B"; // Orange
      case "policy update":
        return "#8B5CF6"; // Purple
      case "emergency":
        return "#EF4444"; // Red
      case "service":
        return "#06B6D4"; // Cyan
      case "weather":
        return "#84CC16"; // Lime
      case "holiday":
        return "#F97316"; // Orange
      default:
        return "#6B7280"; // Gray
    }
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case "Urgent":
        return "alert-circle";
      case "High":
        return "warning";
      case "Medium":
        return "information-circle";
      case "Low":
        return "checkmark-circle";
      default:
        return "ellipse";
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category.toLowerCase()) {
      case "general":
        return "megaphone.fill";
      case "schedule":
        return "calendar";
      case "maintenance":
        return "wrench.and.screwdriver.fill";
      case "policy update":
        return "doc.text.fill";
      case "emergency":
        return "exclamationmark.triangle.fill";
      case "service":
        return "gearshape.fill";
      case "weather":
        return "cloud.fill";
      case "holiday":
        return "gift.fill";
      default:
        return "info.circle.fill";
    }
  };

  const formatAnnouncementDate = (createdAt: any) => {
    if (!createdAt) return "";
    const dateObj = createdAt.toDate ? createdAt.toDate() : new Date(createdAt);
    return `${dateObj.toLocaleDateString()} ${dateObj.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    })}`;
  };

  return (
    <View style={[styles.container, { backgroundColor: '#E8F5E9' }]}>
      {/* Header Section */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top + 10, 30) }]}>
        <View style={styles.profileSection}>
          <View style={[styles.profileIcon, { backgroundColor: '#C8E6C9' }]}>
            {userProfile?.photoURL ? (
              <Image
                source={{ uri: userProfile.photoURL }}
                style={styles.profileImage}
                resizeMode="cover"
              />
            ) : (
              <IconSymbol name="person.fill" size={24} color="#2E7D32" />
            )}
          </View>
          <Text style={[styles.greeting, { color: '#2E7D32' }]}>
            Welcome, {userProfile?.displayName?.split(" ")[0] || "User"}!
          </Text>
        </View>

        <View style={styles.headerActions}>
          <TouchableOpacity onPress={() => router.push("/settings")}>
            <IconSymbol name="gear" size={28} color="#78A578" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Main Content */}
      <ScrollView 
        style={{ flex: 1 }}
        contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom, 10) }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Your Eco Impact */}
        <View style={styles.ecoImpactContainer}>
          <Text style={styles.sectionTitleSmall}>Your Eco Impact</Text>
          <View style={styles.ecoImpactCard}>
            <View style={styles.pointsBadge}>
              <Text style={styles.pointsLabel}>POINTS</Text>
              <Text style={styles.pointsValue}>{totalPoints.toLocaleString()}</Text>
            </View>
            <View style={styles.levelRow}>
              <Text style={styles.levelText}>Level {Math.floor(totalPoints / 500) + 1}: {Math.floor(totalPoints / 500) >= 4 ? 'Green Guardian' : 'Eco Starter'}</Text>
              <Text style={styles.levelPercent}>{Math.min(100, Math.floor(((totalPoints % 500) / 500) * 100))}%</Text>
            </View>
            <View style={styles.progressBarBg}>
              <View style={[styles.progressBarFill, { width: `${Math.min(100, ((totalPoints % 500) / 500) * 100)}%` }]} />
            </View>

            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{formatAdaptiveMassFromMetricTons(trashCollectedTons)}</Text>
                <Text style={styles.statLabel}>Trash Collected</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{userReports.length}</Text>
                <Text style={styles.statLabel}>Reports</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Next Collection */}
        <View style={styles.nextCollectionCard}>
          <View style={styles.nextCollectionHeader}>
            <IconSymbol name="clock" size={20} color="white" />
            <Text style={styles.nextCollectionTitle}>Next Collection</Text>
          </View>
          {nextCollection ? (
            <>
              <Text style={styles.nextCollectionDate}>{nextCollection.dateLabel}</Text>
              <Text style={styles.nextCollectionTime}>{nextCollection.timeText}</Text>
              <View style={styles.nextCollectionDivider} />
              <View style={styles.nextCollectionFooter}>
                <IconSymbol name="arrow.triangle.2.circlepath" size={16} color="white" />
                <Text style={styles.nextCollectionFooterText}>{nextCollection.wasteCategory}</Text>
              </View>
            </>
          ) : (
            <>
              <Text style={styles.nextCollectionDate}>No upcoming collection</Text>
              <Text style={styles.nextCollectionTime}>Set your barangay in your profile</Text>
            </>
          )}
        </View>

        {/* Community Updates */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitleSmall}>Community Updates</Text>
          <TouchableOpacity onPress={() => router.push('/announcements')}>
            <Text style={styles.viewAllText}>View All</Text>
          </TouchableOpacity>
        </View>
        
        <View style={styles.updateCard}>
          <View style={[styles.updateIconBg, { backgroundColor: '#C8E6C9' }]}>
            <IconSymbol name="megaphone.fill" size={20} color="#2E7D32" />
          </View>
          <View style={styles.updateTextContent}>
            <Text style={styles.updateTitle}>Holiday Delay</Text>
            <Text style={styles.updateDesc}>Collection moved to Saturday due to the upcoming public holiday.</Text>
          </View>
        </View>
        
        <View style={styles.updateCard}>
          <View style={[styles.updateIconBg, { backgroundColor: '#FCE4EC' }]}>
            <IconSymbol name="leaf.fill" size={20} color="#880E4F" />
          </View>
          <View style={styles.updateTextContent}>
            <Text style={styles.updateTitle}>Free Compost Workshop</Text>
            <Text style={styles.updateDesc}>Join us this Sunday at the Community Center for a 2-hour session.</Text>
          </View>
        </View>

        {/* Driver Portal Button - Only for drivers */}
        {isDriver && (
          <TouchableOpacity
            style={styles.driverPortalCard}
            onPress={() => router.push('/(driver)/select-truck')}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={['#1B5E20', '#2E7D32', '#388E3C']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.driverPortalGradient}
            >
              <View style={styles.driverPortalIcon}>
                <MaterialIcons name="local-shipping" size={28} color="#FFFFFF" />
              </View>
              <View style={styles.driverPortalTextContainer}>
                <Text style={styles.driverPortalTitle}>Driver Portal</Text>
                <Text style={styles.driverPortalSubtitle}>Start your shift & select a truck</Text>
              </View>
              <MaterialIcons name="chevron-right" size={28} color="rgba(255,255,255,0.7)" />
            </LinearGradient>
          </TouchableOpacity>
        )}

        {/* Quick Actions */}
        <Text style={[styles.sectionTitleSmall, { marginTop: 10, textTransform: 'uppercase', color: '#78A578' }]}>Quick Actions</Text>
        
        <TouchableOpacity style={styles.quickActionCard} onPress={() => router.push('/report')}>
          <IconSymbol name="camera" size={20} color="#4A6741" />
          <Text style={styles.quickActionText}>Report a Pile</Text>
        </TouchableOpacity>

        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitleSmall}>Recent Reports</Text>
          <TouchableOpacity onPress={() => router.push('/my-reports')}>
            <Text style={styles.viewAllText}>View All</Text>
          </TouchableOpacity>
        </View>
        {userReports.length > 0 ? (
          userReports.slice(0, 3).map((report, index) => (
            <TouchableOpacity 
              key={report.id || index} 
              style={styles.updateCard}
              onPress={() => router.push('/my-reports')}
            >
              <View style={styles.updateIconBg}>
                <IconSymbol name={report.imageURL ? "camera.fill" : "doc.text"} size={20} color="#234033" />
              </View>
              <View style={styles.updateTextContent}>
                <Text style={styles.updateTitle}>{report.title || 'Trash Report'}</Text>
                <Text style={styles.updateDesc}>
                  {new Date(report.createdAt).toLocaleDateString()} • {report.barangay}
                </Text>
              </View>
            </TouchableOpacity>
          ))
        ) : (
          <TouchableOpacity style={styles.updateCard} onPress={() => router.push('/my-reports')}>
            <View style={styles.updateTextContent}>
              <Text style={styles.updateDesc}>No reports submitted yet.</Text>
            </View>
          </TouchableOpacity>
        )}
        
        <TouchableOpacity style={styles.quickActionCard} onPress={() => Alert.alert('Coming Soon', 'Redeem Points feature is not yet available.')}>
          <IconSymbol name="gift" size={20} color="#4A6741" />
          <Text style={styles.quickActionText}>Redeem Points</Text>
        </TouchableOpacity>

      </ScrollView>
      {/* Notifications Modal Removed to simplify file and focus on home layout */}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingTop: 30,
  },
  profileSection: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  profileIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  profileImage: {
    width: "100%",
    height: "100%",
  },
  greeting: {
    fontSize: 22,
    fontWeight: "800",
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  content: {
    padding: 20,
    gap: 16,
  },
  sectionTitleSmall: {
    fontSize: 16,
    fontWeight: "700",
    color: "#2E7D32",
    marginBottom: 4,
  },
  ecoImpactContainer: {
    marginBottom: 8,
  },
  ecoImpactCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  pointsBadge: {
    backgroundColor: '#C8E6C9',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  pointsLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: '#2E7D32',
    letterSpacing: 1,
  },
  pointsValue: {
    fontSize: 28,
    fontWeight: "900",
    color: '#1B5E20',
  },
  levelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  levelText: {
    fontSize: 13,
    color: '#4A6741',
    fontWeight: '500',
  },
  levelPercent: {
    fontSize: 12,
    color: '#2E7D32',
    fontWeight: '700',
  },
  progressBarBg: {
    height: 8,
    backgroundColor: '#F5F5F5',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#2E7D32',
    borderRadius: 4,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1B5E20',
  },
  statLabel: {
    fontSize: 12,
    color: '#4A6741',
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    height: '100%',
    backgroundColor: '#E0E0E0',
  },
  nextCollectionCard: {
    backgroundColor: '#4A6741',
    borderRadius: 16,
    padding: 20,
    marginBottom: 8,
  },
  nextCollectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  nextCollectionTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: '700',
  },
  nextCollectionDate: {
    color: '#E8F5E9',
    fontSize: 14,
  },
  nextCollectionTime: {
    color: 'white',
    fontSize: 26,
    fontWeight: '800',
    marginTop: 4,
  },
  nextCollectionDivider: {
    height: 1,
    fontSize: 11,
    fontWeight: "600",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    textAlign: "center",
    overflow: "hidden",
  },
  announcementTitle: {
    fontSize: 16,
    fontWeight: "bold",
  },
  announcementSubtitle: {
    fontSize: 14,
  },
  announcementDate: {
    fontSize: 12,
    marginTop: 2,
  },
  announcementRight: {
    alignItems: "flex-end",
    justifyContent: "center",
    flexShrink: 0,
    minWidth: 100,
  },
  nextPickupLabel: {
    fontSize: 12,
  },
  nextPickupDate: {
    fontSize: 18,
    fontWeight: "bold",
  },
  viewMoreButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    gap: 6,
  },
  viewMoreText: {
    fontSize: 14,
    fontWeight: "500",
    textDecorationLine: "underline",
  },
  // Community Updates Styles
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  viewAllText: {
    color: '#2E7D32',
    fontSize: 14,
    fontWeight: '600',
  },
  updateCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    alignItems: 'center',
    gap: 16,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  updateIconBg: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  updateTextContent: {
    flex: 1,
  },
  updateTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#234033',
    marginBottom: 4,
  },
  updateDesc: {
    fontSize: 13,
    color: '#4B5F4F',
    lineHeight: 18,
  },

  // Quick Actions Styles
  quickActionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    gap: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  quickActionText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#234033',
  },
  
  // Next Collection Footer
  nextCollectionFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
  },
  nextCollectionFooterText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
  },

  // Notification Detail Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  notificationDetailContainer: {
    width: "100%",
    height: "60%",
    maxWidth: 500,
    maxHeight: "90%",
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  notificationDetailHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  notificationDetailTitle: {
    fontSize: 18,
    fontWeight: "600",
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
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  notificationTypeText: {
    fontSize: 14,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  notificationDetailTitleText: {
    fontSize: 24,
    fontWeight: "bold",
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
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  notificationMetaText: {
    fontSize: 14,
  },
  notificationDetailActions: {
    padding: 20,
    borderTopWidth: 1,
    flexDirection: "row",
    gap: 8,
  },
  notificationActionButton: {
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
    flex: 1,
  },
  notificationActionText: {
    fontSize: 14,
    fontWeight: "600",
  },
  notificationTypeIndicator: {
    marginTop: 2,
    textAlign: "center",
    maxWidth: 60,
  },

  // Driver Portal Styles
  driverPortalCard: {
    borderRadius: 16,
    overflow: "hidden",
    marginTop: 8,
    marginBottom: 4,
    elevation: 6,
    shadowColor: "#1B5E20",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  driverPortalGradient: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 18,
    paddingHorizontal: 20,
    gap: 16,
  },
  driverPortalIcon: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  driverPortalTextContainer: {
    flex: 1,
  },
  driverPortalTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: 0.3,
  },
  driverPortalSubtitle: {
    fontSize: 13,
    color: "rgba(255,255,255,0.75)",
    marginTop: 2,
    fontWeight: "500",
  },
});
