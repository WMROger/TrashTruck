import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  useWindowDimensions,
  Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

interface DictLogoutModalProps {
  visible: boolean;
  userEmail?: string | null;
  userName?: string | null;
  onConfirm: () => Promise<void> | void;
  onCancel: () => void;
}

export default function DictLogoutModal({
  visible,
  userEmail,
  userName,
  onConfirm,
  onCancel,
}: DictLogoutModalProps) {
  const { width } = useWindowDimensions();
  const isMobile = width < 600;
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogoutPress = async () => {
    try {
      setIsLoggingOut(true);
      await onConfirm();
    } catch (error) {
      console.error('Logout error in modal:', error);
    } finally {
      setIsLoggingOut(false);
    }
  };

  const displayName = userName || userEmail?.split('@')[0] || 'Super Administrator';
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View style={styles.overlay}>
        <TouchableOpacity 
          style={styles.backdrop} 
          activeOpacity={1} 
          onPress={isLoggingOut ? undefined : onCancel} 
        />

        <View style={[styles.modalCard, isMobile && styles.modalCardMobile]}>
          {/* Top Decorative Border Accent */}
          <View style={styles.accentBar} />

          {/* Close button */}
          <TouchableOpacity 
            style={styles.closeBtn} 
            onPress={onCancel}
            disabled={isLoggingOut}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <MaterialIcons name="close" size={20} color="#94A3B8" />
          </TouchableOpacity>

          <View style={styles.contentContainer}>
            {/* Shield / Logout Icon Badge */}
            <View style={styles.iconWrapper}>
              <View style={styles.iconOuterRing}>
                <View style={styles.iconInner}>
                  <MaterialIcons name="logout" size={28} color="#DC2626" />
                </View>
              </View>
            </View>

            {/* Title & Subtitle */}
            <Text style={styles.modalTitle}>Sign Out of DICT Portal</Text>
            <Text style={styles.modalSubtitle}>
              Department of Information and Communications Technology
            </Text>

            {/* User Session Profile Card */}
            <View style={styles.sessionCard}>
              <View style={styles.userAvatar}>
                <Text style={styles.userAvatarText}>{initial}</Text>
              </View>
              <View style={styles.userInfo}>
                <View style={styles.roleBadgeRow}>
                  <View style={styles.roleBadge}>
                    <View style={styles.roleDot} />
                    <Text style={styles.roleBadgeText}>DICT SUPER ADMIN</Text>
                  </View>
                </View>
                <Text style={styles.userName} numberOfLines={1}>{displayName}</Text>
                {!!userEmail && (
                  <Text style={styles.userEmail} numberOfLines={1}>{userEmail}</Text>
                )}
              </View>
            </View>

            {/* Security Notice Box */}
            <View style={styles.securityNotice}>
              <MaterialIcons name="verified-user" size={18} color="#4F46E5" style={{ marginTop: 2 }} />
              <View style={{ flex: 1 }}>
                <Text style={styles.securityTitle}>Secure Session Termination</Text>
                <Text style={styles.securityDesc}>
                  Signing out will invalidate your current session and require re-authentication to access oversight logs and municipal controls.
                </Text>
              </View>
            </View>

            {/* Actions */}
            <View style={[styles.actionsRow, isMobile && styles.actionsRowMobile]}>
              <TouchableOpacity
                style={[styles.cancelBtn, isMobile && { width: '100%' }]}
                onPress={onCancel}
                disabled={isLoggingOut}
                activeOpacity={0.8}
              >
                <Text style={styles.cancelBtnText}>Stay Signed In</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.confirmBtn, isMobile && { width: '100%' }]}
                onPress={handleLogoutPress}
                disabled={isLoggingOut}
                activeOpacity={0.85}
              >
                {isLoggingOut ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <MaterialIcons name="logout" size={18} color="#FFFFFF" />
                    <Text style={styles.confirmBtnText}>Sign Out</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    ...(Platform.OS === 'web' ? { backdropFilter: 'blur(4px)' } : {}),
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  modalCard: {
    width: '100%',
    maxWidth: 480,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.15,
    shadowRadius: 28,
    elevation: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    position: 'relative',
  },
  modalCardMobile: {
    maxWidth: '100%',
    borderRadius: 16,
  },
  accentBar: {
    height: 4,
    width: '100%',
    backgroundColor: '#4F46E5', // DICT Indigo accent
  },
  closeBtn: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  contentContainer: {
    padding: 28,
    alignItems: 'center',
  },
  iconWrapper: {
    marginBottom: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconOuterRing: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#FEF2F2',
    borderWidth: 6,
    borderColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconInner: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  modalSubtitle: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 20,
    fontWeight: '500',
  },
  sessionCard: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    marginBottom: 16,
    gap: 12,
  },
  userAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
  },
  userAvatarText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 18,
  },
  userInfo: {
    flex: 1,
  },
  roleBadgeRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: '#C7D2FE',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  roleDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#4F46E5',
  },
  roleBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#4338CA',
    letterSpacing: 0.5,
  },
  userName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  userEmail: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 1,
  },
  securityNotice: {
    width: '100%',
    flexDirection: 'row',
    backgroundColor: '#F0FDF4',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#DCFCE7',
    padding: 12,
    gap: 10,
    marginBottom: 24,
  },
  securityTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#166534',
  },
  securityDesc: {
    fontSize: 11,
    color: '#15803D',
    lineHeight: 16,
    marginTop: 2,
  },
  actionsRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  actionsRowMobile: {
    flexDirection: 'column-reverse',
    gap: 10,
  },
  cancelBtn: {
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
  },
  confirmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 11,
    borderRadius: 10,
    backgroundColor: '#DC2626',
    shadowColor: '#DC2626',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  confirmBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
