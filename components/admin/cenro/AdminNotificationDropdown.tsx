import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { collection, query, orderBy, limit, onSnapshot, where } from 'firebase/firestore';
import { db } from '../../../config/firebase';

export interface AdminNotificationItem {
  id: string;
  type: 'report' | 'dispatch' | 'driver' | 'system' | 'override';
  title: string;
  subtitle: string;
  timestamp: any;
  targetTab: string;
  isRead?: boolean;
}

interface AdminNotificationDropdownProps {
  visible: boolean;
  onClose: () => void;
  onNavigateTab: (tabKey: string) => void;
  onUnreadCountChange?: (count: number) => void;
}

export default function AdminNotificationDropdown({
  visible,
  onClose,
  onNavigateTab,
  onUnreadCountChange,
}: AdminNotificationDropdownProps) {
  const [notifications, setNotifications] = useState<AdminNotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!db) {
      setLoading(false);
      return;
    }

    // 1. Listen to pending citizen reports
    const reportsQuery = query(
      collection(db, 'reports'),
      where('status', 'in', ['pending', 'PENDING']),
      limit(10)
    );

    // 2. Listen to recent client activity
    const activityQuery = query(
      collection(db, 'client_activity'),
      orderBy('timestamp', 'desc'),
      limit(15)
    );

    let rawReports: AdminNotificationItem[] = [];
    let rawActivity: AdminNotificationItem[] = [];

    const updateCombined = () => {
      const all = [...rawReports, ...rawActivity];
      all.sort((a, b) => {
        const timeA = a.timestamp?.toDate ? a.timestamp.toDate().getTime() : (a.timestamp ? new Date(a.timestamp).getTime() : 0);
        const timeB = b.timestamp?.toDate ? b.timestamp.toDate().getTime() : (b.timestamp ? new Date(b.timestamp).getTime() : 0);
        return timeB - timeA;
      });
      setNotifications(all);
      const unread = all.filter(n => !readIds.has(n.id)).length;
      onUnreadCountChange?.(unread);
      setLoading(false);
    };

    const unsubReports = onSnapshot(reportsQuery, (snap) => {
      rawReports = snap.docs.map(doc => {
        const data = doc.data();
        return {
          id: `rep_${doc.id}`,
          type: 'report',
          title: `New Report: ${data.barangay || 'Danao City'}`,
          subtitle: data.aiAnalysis?.wasteType || data.reportType || data.description || 'Pending waste inspection',
          timestamp: data.createdAt,
          targetTab: 'reports',
        };
      });
      updateCombined();
    }, (err) => {
      console.warn('Reports notif stream note:', err?.message);
      setLoading(false);
    });

    const unsubActivity = onSnapshot(activityQuery, (snap) => {
      rawActivity = snap.docs.map(doc => {
        const data = doc.data();
        let notifType: AdminNotificationItem['type'] = 'system';
        let targetTab = 'logs';

        const cat = (data.category || '').toLowerCase();
        const action = (data.action || '').toLowerCase();

        if (cat.includes('dispatch') || action.includes('dispatch') || action.includes('route')) {
          notifType = 'dispatch';
          targetTab = 'routes';
        } else if (cat.includes('driver') || action.includes('driver') || action.includes('shift')) {
          notifType = 'driver';
          targetTab = 'fleet';
        } else if (cat.includes('override')) {
          notifType = 'override';
          targetTab = 'overrides';
        } else if (cat.includes('report')) {
          notifType = 'report';
          targetTab = 'reports';
        }

        return {
          id: `act_${doc.id}`,
          type: notifType,
          title: data.action || 'System Event',
          subtitle: data.description || data.userEmail || data.actorEmail || 'Operational activity logged',
          timestamp: data.timestamp,
          targetTab,
        };
      });
      updateCombined();
    }, (err) => {
      console.warn('Activity notif stream note:', err?.message);
      setLoading(false);
    });

    return () => {
      unsubReports();
      unsubActivity();
    };
  }, []);

  const handleItemPress = (notif: AdminNotificationItem) => {
    setReadIds(prev => new Set(prev).add(notif.id));
    onNavigateTab(notif.targetTab);
    onClose();
  };

  const handleMarkAllAsRead = () => {
    const allIds = new Set(notifications.map(n => n.id));
    setReadIds(allIds);
    onUnreadCountChange?.(0);
  };

  const formatTime = (ts: any) => {
    if (!ts) return 'Just now';
    try {
      const d = ts?.toDate ? ts.toDate() : (ts instanceof Date ? ts : new Date(ts));
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return 'Recent';
    }
  };

  const getTypeBadge = (type: AdminNotificationItem['type']) => {
    switch (type) {
      case 'report':
        return { bg: '#FEF3C7', color: '#B45309', icon: 'report-problem', label: 'REPORT' };
      case 'dispatch':
        return { bg: '#DBEAFE', color: '#1E40AF', icon: 'navigation', label: 'DISPATCH' };
      case 'driver':
        return { bg: '#DCFCE7', color: '#166534', icon: 'local-shipping', label: 'FLEET' };
      case 'override':
        return { bg: '#FEE2E2', color: '#991B1B', icon: 'warning', label: 'OVERRIDE' };
      default:
        return { bg: '#F1F5F9', color: '#475569', icon: 'info', label: 'SYSTEM' };
    }
  };

  if (!visible) return null;

  return (
    <View style={styles.dropdownContainer}>
      {/* Top Banner */}
      <View style={styles.header}>
        <View style={styles.headerTitleRow}>
          <View style={styles.headerIconBox}>
            <MaterialIcons name="notifications-active" size={18} color="#10B981" />
          </View>
          <View>
            <Text style={styles.headerTitle}>CENRO NOTIFICATIONS</Text>
            <Text style={styles.headerSubtitle}>Real-time alerts, reports & dispatches</Text>
          </View>
        </View>
        <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
          <MaterialIcons name="close" size={18} color="#94A3B8" />
        </TouchableOpacity>
      </View>

      {/* Notifications Scroll Area */}
      <ScrollView style={styles.scrollArea} showsVerticalScrollIndicator={false}>
        {loading ? (
          <View style={styles.loadingState}>
            <ActivityIndicator size="small" color="#1B4D3E" />
            <Text style={styles.loadingText}>Fetching updates...</Text>
          </View>
        ) : notifications.length === 0 ? (
          <View style={styles.emptyState}>
            <MaterialIcons name="check-circle" size={38} color="#10B981" />
            <Text style={styles.emptyTitle}>All Clear</Text>
            <Text style={styles.emptyText}>No pending citizen reports or urgent alerts.</Text>
          </View>
        ) : (
          <View style={styles.contentList}>
            {notifications.map((item) => {
              const badge = getTypeBadge(item.type);
              const isRead = readIds.has(item.id);

              return (
                <TouchableOpacity
                  key={item.id}
                  style={[styles.notifCard, isRead && styles.notifCardRead]}
                  onPress={() => handleItemPress(item)}
                  activeOpacity={0.7}
                >
                  <View style={styles.cardHeader}>
                    <View style={[styles.typeBadge, { backgroundColor: badge.bg }]}>
                      <MaterialIcons name={badge.icon as any} size={12} color={badge.color} />
                      <Text style={[styles.typeBadgeText, { color: badge.color }]}>{badge.label}</Text>
                    </View>
                    <Text style={styles.timeText}>{formatTime(item.timestamp)}</Text>
                  </View>

                  <Text style={[styles.cardTitle, isRead && styles.cardTitleRead]}>
                    {item.title}
                  </Text>
                  <Text style={styles.cardSubtitle} numberOfLines={2}>
                    {item.subtitle}
                  </Text>

                  <View style={styles.actionRow}>
                    <Text style={styles.actionLink}>Open Tab →</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.markReadBtn}
          onPress={handleMarkAllAsRead}
          activeOpacity={0.7}
        >
          <MaterialIcons name="done-all" size={14} color="#64748B" />
          <Text style={styles.markReadBtnText}>Mark all as read</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.viewLogsBtn}
          onPress={() => {
            onNavigateTab('logs');
            onClose();
          }}
          activeOpacity={0.7}
        >
          <Text style={styles.viewLogsBtnText}>All Activity Logs →</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  dropdownContainer: {
    position: 'absolute',
    top: 60,
    right: 16,
    width: 360,
    maxHeight: 520,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 20,
    zIndex: 9999,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#1E293B',
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerIconBox: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.8,
    color: '#F8FAFC',
  },
  headerSubtitle: {
    fontSize: 10,
    color: '#94A3B8',
    marginTop: 1,
  },
  closeBtn: {
    padding: 6,
    borderRadius: 6,
    backgroundColor: '#334155',
  },
  scrollArea: {
    maxHeight: 380,
  },
  loadingState: {
    padding: 30,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  loadingText: {
    fontSize: 12,
    color: '#64748B',
  },
  contentList: {
    padding: 12,
    gap: 8,
  },
  emptyState: {
    padding: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
    marginTop: 8,
    marginBottom: 4,
  },
  emptyText: {
    fontSize: 11.5,
    color: '#64748B',
    textAlign: 'center',
  },
  notifCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 4,
  },
  notifCardRead: {
    backgroundColor: '#FFFFFF',
    borderColor: '#F1F5F9',
    opacity: 0.75,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  typeBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  timeText: {
    fontSize: 10,
    color: '#94A3B8',
    fontWeight: '600',
  },
  cardTitle: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#0F172A',
  },
  cardTitleRead: {
    color: '#475569',
    fontWeight: '600',
  },
  cardSubtitle: {
    fontSize: 11,
    color: '#64748B',
    lineHeight: 15,
  },
  actionRow: {
    marginTop: 4,
    alignItems: 'flex-end',
  },
  actionLink: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#1B4D3E',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
  },
  markReadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  markReadBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  viewLogsBtn: {
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  viewLogsBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1B4D3E',
  },
});
