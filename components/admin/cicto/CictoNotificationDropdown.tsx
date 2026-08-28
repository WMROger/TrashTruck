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
import {
  CictoNotification,
  dismissCictoNotification,
  clearAllCictoNotifications,
} from '@/services/cictoAccountService';

interface CictoNotificationDropdownProps {
  visible: boolean;
  notifications: CictoNotification[];
  onClose: () => void;
  onSelectOtp?: (pin: string) => void;
}


export default function CictoNotificationDropdown({
  visible,
  notifications,
  onClose,
  onSelectOtp,
}: CictoNotificationDropdownProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isClearing, setIsClearing] = useState(false);

  if (!visible) return null;

  const handleCopyPin = async (notifId: string, pin?: string) => {
    if (!pin) return;
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(pin);
      }
      setCopiedId(notifId);
      if (onSelectOtp) onSelectOtp(pin);
      setTimeout(() => setCopiedId(null), 3000);
    } catch (err) {
      setCopiedId(notifId);
      if (onSelectOtp) onSelectOtp(pin);
      setTimeout(() => setCopiedId(null), 3000);
    }
  };

  const handleDismiss = async (id: string) => {
    await dismissCictoNotification(id);
  };

  const handleClearHistory = async () => {
    setIsClearing(true);
    await clearAllCictoNotifications();
    setIsClearing(false);
  };

  const activeNotifs = notifications.filter((n) => n.status !== 'dismissed');

  return (
    <View style={styles.dropdownContainer}>
      <View style={styles.dropdownHeader}>
        <View style={styles.headerTitleRow}>
          <MaterialIcons name="security" size={16} color="#0D9488" />
          <Text style={styles.dropdownTitle}>CICTO Security & Oversight Feed</Text>
        </View>
        <View style={styles.headerActionRow}>
          {activeNotifs.length > 0 && (
            <TouchableOpacity
              onPress={handleClearHistory}
              disabled={isClearing}
              style={styles.clearBtn}
            >
              <Text style={styles.clearBtnText}>Clear All</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <MaterialIcons name="close" size={16} color="#64748B" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.listScroll} showsVerticalScrollIndicator={true}>
        {activeNotifs.length === 0 ? (
          <View style={styles.emptyWrap}>
            <MaterialIcons name="notifications-none" size={32} color="#CBD5E1" />
            <Text style={styles.emptyText}>No active security alerts</Text>
            <Text style={styles.emptySub}>
              Real-time account deletion authorizations and system notices appear here.
            </Text>
          </View>
        ) : (
          activeNotifs.map((notif) => {
            const isOtp = notif.type === 'admin_created' || !!notif.requestId;
            const isDeleted = notif.type === 'account_deleted';

            return (
              <View key={notif.id} style={styles.notifItem}>
                <View style={styles.notifIconWrap}>
                  <MaterialIcons
                    name={isDeleted ? 'delete' : isOtp ? 'vpn-key' : 'notifications'}
                    size={18}
                    color={isDeleted ? '#EF4444' : '#0D9488'}
                  />
                </View>
                <View style={styles.notifContent}>
                  <View style={styles.notifTitleRow}>
                    <Text style={styles.notifTitle}>{notif.title}</Text>
                    <TouchableOpacity
                      onPress={() => handleDismiss(notif.id)}
                      style={styles.dismissBtn}
                    >
                      <MaterialIcons name="close" size={12} color="#94A3B8" />
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.notifDesc}>{notif.description}</Text>
                  <Text style={styles.notifTime}>
                    {notif.createdAt?.toDate
                      ? notif.createdAt.toDate().toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : 'Recently'}
                  </Text>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}


const styles = StyleSheet.create({
  dropdownContainer: {
    position: 'absolute',
    top: 56,
    right: 16,
    width: 380,
    maxHeight: 460,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 18,
    elevation: 8,
    zIndex: 9999,
    overflow: 'hidden',
  },
  dropdownHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    backgroundColor: '#FAFAFA',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dropdownTitle: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#0F172A',
  },
  headerActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  clearBtn: {
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  clearBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0D9488',
  },
  closeBtn: {
    padding: 2,
  },
  listScroll: {
    maxHeight: 380,
  },
  emptyWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 36,
    paddingHorizontal: 20,
    gap: 6,
  },
  emptyText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
  },
  emptySub: {
    fontSize: 11,
    color: '#94A3B8',
    textAlign: 'center',
  },
  notifItem: {
    flexDirection: 'row',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    gap: 10,
  },
  notifIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#F0FDFA',
    justifyContent: 'center',
    alignItems: 'center',
  },
  notifContent: {
    flex: 1,
  },
  notifTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  notifTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0F172A',
  },
  dismissBtn: {
    padding: 2,
  },
  notifDesc: {
    fontSize: 11,
    color: '#64748B',
    lineHeight: 15,
  },
  notifTime: {
    fontSize: 9.5,
    color: '#94A3B8',
    marginTop: 4,
  },
});
