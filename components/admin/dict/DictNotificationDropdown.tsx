import React, { useState } from 'react';
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
import { DictNotification, dismissDictNotification, clearAllDictNotifications } from '../../../services/dictAccountService';

interface DictNotificationDropdownProps {
  visible: boolean;
  notifications: DictNotification[];
  onClose: () => void;
  onSelectOtp?: (pin: string) => void;
}

export default function DictNotificationDropdown({
  visible,
  notifications,
  onClose,
  onSelectOtp,
}: DictNotificationDropdownProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isClearing, setIsClearing] = useState(false);

  if (!visible) return null;

  const handleCopyPin = async (notifId: string, pin?: string) => {
    if (!pin) return;
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(pin);
      } else if (typeof document !== 'undefined') {
        const input = document.createElement('textarea');
        input.value = pin;
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        document.body.removeChild(input);
      }
      setCopiedId(notifId);
      if (onSelectOtp) onSelectOtp(pin);
      setTimeout(() => setCopiedId(null), 3000);
    } catch (err) {
      console.warn('Copy pin note:', err);
      setCopiedId(notifId);
      if (onSelectOtp) onSelectOtp(pin);
      setTimeout(() => setCopiedId(null), 3000);
    }
  };

  const handleDismiss = async (id: string) => {
    await dismissDictNotification(id);
  };

  const handleClearHistory = async () => {
    setIsClearing(true);
    await clearAllDictNotifications();
    setIsClearing(false);
  };

  const formatTime = (ts: any) => {
    if (!ts) return 'Just now';
    try {
      const d = ts?.toDate ? ts.toDate() : (ts instanceof Date ? ts : new Date(ts));
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ', ' + d.toLocaleDateString();
    } catch {
      return 'Recent';
    }
  };

  return (
    <View style={styles.dropdownContainer}>
      {/* Top Banner */}
      <View style={styles.header}>
        <View style={styles.headerTitleRow}>
          <View style={styles.headerIconBox}>
            <MaterialIcons name="history" size={18} color="#EF4444" />
          </View>
          <View>
            <Text style={styles.headerTitle}>DICT AUDIT & ACTIVITY LOGS</Text>
            <Text style={styles.headerSubtitle}>Permanent deletions & security events</Text>
          </View>
        </View>
        <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
          <MaterialIcons name="close" size={18} color="#6B7280" />
        </TouchableOpacity>
      </View>

      {/* Notifications Scroll Area */}
      <ScrollView style={styles.scrollArea} showsVerticalScrollIndicator={false}>
        {notifications.length === 0 ? (
          <View style={styles.emptyState}>
            <MaterialIcons name="verified-user" size={38} color="#10B981" />
            <Text style={styles.emptyTitle}>No Activity Logs</Text>
            <Text style={styles.emptyText}>
              When accounts are deleted or provisioned in the directory, permanent security audit entries will appear here in real-time.
            </Text>
          </View>
        ) : (
          <View style={styles.contentList}>
            {notifications.map((notif) => {
              return (
                <View key={notif.id} style={styles.otpCard}>
                  <View style={styles.otpCardHeader}>
                    <View style={styles.urgentBadge}>
                      <MaterialIcons name="delete" size={12} color="#DC2626" />
                      <Text style={styles.urgentText}>ACCOUNT PURGED</Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => handleDismiss(notif.id)}
                      style={styles.dismissBtn}
                      activeOpacity={0.7}
                    >
                      <MaterialIcons name="close" size={14} color="#9CA3AF" />
                    </TouchableOpacity>
                  </View>

                  <Text style={styles.cardTitle}>{notif.title}</Text>
                  
                  {Boolean(notif.description) && (
                    <Text style={styles.logDescription}>{notif.description}</Text>
                  )}

                  {Boolean(notif.targetUser) && (
                    <View style={styles.targetInfoBox}>
                      <View style={styles.targetRow}>
                        <Text style={styles.targetLabel}>Target Account:</Text>
                        <Text style={styles.targetValueName} numberOfLines={1}>
                          {notif.targetUser?.email}
                        </Text>
                      </View>
                    </View>
                  )}

                  <View style={styles.otpFooter}>
                    <View style={styles.footerTimeRow}>
                      <MaterialIcons name="schedule" size={12} color="#6B7280" />
                      <Text style={styles.footerTimeText}>{formatTime(notif.createdAt)}</Text>
                    </View>
                    <Text style={styles.footerActorText}>
                      by {notif.actorEmail || 'DICT Super Admin'}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Footer */}
      {notifications.length > 0 && (
        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.clearBtn}
            onPress={handleClearHistory}
            disabled={isClearing}
            activeOpacity={0.7}
          >
            {isClearing ? (
              <ActivityIndicator size="small" color="#6B7280" />
            ) : (
              <>
                <MaterialIcons name="delete-sweep" size={14} color="#6B7280" />
                <Text style={styles.clearBtnText}>Clear Activity Logs</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  dropdownContainer: {
    position: 'absolute',
    top: 65,
    right: 20,
    width: 380,
    maxHeight: 520,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
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
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
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
    maxHeight: 400,
  },
  contentList: {
    padding: 14,
    gap: 12,
  },
  emptyState: {
    padding: 30,
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1F2937',
    marginTop: 10,
    marginBottom: 6,
  },
  emptyText: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 18,
  },
  otpCard: {
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#FECACA',
    padding: 14,
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
  },
  otpCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  urgentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  pulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#DC2626',
  },
  urgentText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#991B1B',
    letterSpacing: 0.5,
  },
  dismissBtn: {
    padding: 4,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#7F1D1D',
    marginBottom: 8,
  },
  targetInfoBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: '#FEE2E2',
    marginBottom: 10,
    gap: 4,
  },
  targetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  targetLabel: {
    fontSize: 11,
    color: '#6B7280',
    fontWeight: '600',
  },
  targetValueName: {
    fontSize: 11,
    color: '#111827',
    fontWeight: '700',
    flex: 1,
    textAlign: 'right',
    marginLeft: 8,
  },
  logDescription: {
    fontSize: 11,
    color: '#4B5563',
    lineHeight: 16,
    marginBottom: 8,
  },
  targetRoleBadge: {
    fontSize: 9,
    fontWeight: '800',
    color: '#1E40AF',
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  pinContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFF1F2',
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#FDA4AF',
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
  },
  pinTextBox: {
    flex: 1,
  },
  pinLabel: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
    color: '#9F1239',
    marginBottom: 2,
  },
  pinCode: {
    fontSize: 22,
    fontWeight: '900',
    fontFamily: Platform.OS === 'web' ? 'monospace' : undefined,
    color: '#881337',
    letterSpacing: 4,
  },
  copyPinBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FFE4E6',
    borderWidth: 1,
    borderColor: '#FDA4AF',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
  },
  copyPinBtnSuccess: {
    backgroundColor: '#10B981',
    borderColor: '#059669',
  },
  copyPinBtnText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#881337',
    letterSpacing: 0.5,
  },
  otpFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#FEE2E2',
  },
  footerTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  footerTimeText: {
    fontSize: 10,
    color: '#6B7280',
    fontWeight: '600',
  },
  footerActorText: {
    fontSize: 10,
    color: '#6B7280',
    fontStyle: 'italic',
  },
  expiryNote: {
    fontSize: 10,
    color: '#B45309',
    fontWeight: '600',
  },
  pastSection: {
    marginTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    paddingTop: 10,
    gap: 6,
  },
  pastSectionTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: '#9CA3AF',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  pastCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 6,
    backgroundColor: '#F9FAFB',
  },
  pastCardTitle: {
    fontSize: 11,
    color: '#4B5563',
    fontWeight: '600',
    maxWidth: 240,
  },
  pastStatusText: {
    fontSize: 10,
    color: '#6B7280',
    fontWeight: '700',
  },
  footer: {
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
  },
  clearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: '#E5E7EB',
  },
  clearBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#374151',
  },
});
