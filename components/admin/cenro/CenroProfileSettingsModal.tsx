import { MaterialIcons } from '@expo/vector-icons';
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword } from 'firebase/auth';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { auth } from '../../../config/firebase';

interface CenroProfileSettingsModalProps {
  visible: boolean;
  onClose: () => void;
  onLogout?: () => void;
}

export default function CenroProfileSettingsModal({
  visible,
  onClose,
  onLogout,
}: CenroProfileSettingsModalProps) {
  const user = auth?.currentUser;

  // Password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Password visibility
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Status & Feedback
  const [isUpdating, setIsUpdating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const resetForm = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setErrorMessage(null);
    setSuccessMessage(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  // Password strength check
  const hasMinLength = newPassword.length >= 8;
  const hasUpper = /[A-Z]/.test(newPassword);
  const hasLower = /[a-z]/.test(newPassword);
  const hasNumber = /[0-9]/.test(newPassword);
  const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(newPassword);
  const isPasswordValid = hasMinLength && hasUpper && hasLower && hasNumber && hasSpecial;

  const handleUpdatePassword = async () => {
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!user || !user.email) {
      setErrorMessage('No authenticated administrator session found.');
      return;
    }

    if (!currentPassword) {
      setErrorMessage('Please enter your current password.');
      return;
    }

    if (!newPassword) {
      setErrorMessage('Please enter a new password.');
      return;
    }

    if (!isPasswordValid) {
      setErrorMessage('New password must meet all 5 security requirements below.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage('New password and confirmation password do not match.');
      return;
    }

    if (newPassword === currentPassword) {
      setErrorMessage('New password must be different from your current password.');
      return;
    }

    setIsUpdating(true);
    try {
      // 1. Re-authenticate admin with current password
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);

      // 2. Update to new password
      await updatePassword(user, newPassword);

      setSuccessMessage('Password updated successfully! Your CENRO account is now secured.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      console.error('CENRO password update error:', error);
      if (error?.code === 'auth/wrong-password' || error?.code === 'auth/invalid-credential') {
        setErrorMessage('Incorrect current password. Please recheck your temporary credentials.');
      } else if (error?.code === 'auth/requires-recent-login') {
        setErrorMessage('Session expired. Please log out and sign in again to change password.');
      } else if (error?.code === 'auth/weak-password') {
        setErrorMessage('Password is too weak. Please use a stronger combination.');
      } else {
        setErrorMessage(error?.message || 'Failed to update password. Please try again.');
      }
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalCard}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerIconCircle}>
              <MaterialIcons name="security" size={24} color="#1B4D3E" />
            </View>
            <View style={styles.headerTextContainer}>
              <Text style={styles.headerTitle}>Profile & Security Settings</Text>
              <Text style={styles.headerSubtitle}>CENRO Administrator Governance</Text>
            </View>
            <TouchableOpacity onPress={handleClose} style={styles.closeBtn} activeOpacity={0.7}>
              <MaterialIcons name="close" size={22} color="#6B7280" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scrollBody} showsVerticalScrollIndicator={false}>
            {/* Admin Profile Overview Card */}
            <View style={styles.profileCard}>
              <View style={styles.profileHeaderRow}>
                <View style={styles.avatarCircle}>
                  <MaterialIcons name="admin-panel-settings" size={32} color="#1B4D3E" />
                </View>
                <View style={{ flex: 1, marginLeft: 14 }}>
                  <Text style={styles.adminName}>
                    {user?.displayName || 'CENRO Administrator'}
                  </Text>
                  <Text style={styles.adminEmail}>{user?.email || 'admin@trashtrack.gov.ph'}</Text>
                  <View style={styles.badgeRow}>
                    <View style={styles.dictBadge}>
                      <Text style={styles.dictBadgeText}>✓ DICT VERIFIED</Text>
                    </View>
                    <View style={styles.roleBadge}>
                      <Text style={styles.roleBadgeText}>CENRO OFFICER</Text>
                    </View>
                  </View>
                </View>
              </View>

              <View style={styles.infoDivider} />

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Department:</Text>
                <Text style={styles.infoValue}>City Environment & Natural Resources Office</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Jurisdiction:</Text>
                <Text style={styles.infoValue}>Danao City, Cebu • Region VII</Text>
              </View>
            </View>

            {/* Password Management Card */}
            <View style={styles.sectionCard}>
              <View style={styles.sectionTitleRow}>
                <MaterialIcons name="lock" size={20} color="#1B4D3E" />
                <Text style={styles.sectionTitle}>Change Administrator Password</Text>
              </View>
              <Text style={styles.sectionDesc}>
                Update the temporary password issued during onboarding to an executive, high-security password.
              </Text>

              {/* Success Banner */}
              {successMessage && (
                <View style={styles.successBanner}>
                  <MaterialIcons name="check-circle" size={20} color="#059669" />
                  <Text style={styles.successText}>{successMessage}</Text>
                </View>
              )}

              {/* Error Banner */}
              {errorMessage && (
                <View style={styles.errorBanner}>
                  <MaterialIcons name="error" size={20} color="#DC2626" />
                  <Text style={styles.errorText}>{errorMessage}</Text>
                </View>
              )}

              {/* Current Password */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>
                  Current / Temporary Password <Text style={styles.requiredAsterisk}>*</Text>
                </Text>
                <View style={styles.inputWrapper}>
                  <MaterialIcons name="vpn-key" size={18} color="#9CA3AF" style={styles.inputIcon} />
                  <TextInput
                    style={styles.textInput}
                    placeholder="Enter current password"
                    placeholderTextColor="#9CA3AF"
                    secureTextEntry={!showCurrentPassword}
                    value={currentPassword}
                    onChangeText={setCurrentPassword}
                    autoCapitalize="none"
                  />
                  <TouchableOpacity
                    onPress={() => setShowCurrentPassword(!showCurrentPassword)}
                    style={styles.eyeBtn}
                  >
                    <MaterialIcons
                      name={showCurrentPassword ? 'visibility-off' : 'visibility'}
                      size={20}
                      color="#6B7280"
                    />
                  </TouchableOpacity>
                </View>
              </View>

              {/* New Password */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>
                  New Password <Text style={styles.requiredAsterisk}>*</Text>
                </Text>
                <View style={styles.inputWrapper}>
                  <MaterialIcons name="lock-outline" size={18} color="#9CA3AF" style={styles.inputIcon} />
                  <TextInput
                    style={styles.textInput}
                    placeholder="Enter new strong password"
                    placeholderTextColor="#9CA3AF"
                    secureTextEntry={!showNewPassword}
                    value={newPassword}
                    onChangeText={setNewPassword}
                    autoCapitalize="none"
                  />
                  <TouchableOpacity
                    onPress={() => setShowNewPassword(!showNewPassword)}
                    style={styles.eyeBtn}
                  >
                    <MaterialIcons
                      name={showNewPassword ? 'visibility-off' : 'visibility'}
                      size={20}
                      color="#6B7280"
                    />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Requirements checklist */}
              {newPassword.length > 0 && (
                <View style={styles.checklistCard}>
                  <Text style={styles.checklistTitle}>PASSWORD REQUIREMENTS:</Text>
                  <View style={styles.checkItem}>
                    <MaterialIcons
                      name={hasMinLength ? 'check-circle' : 'radio-button-unchecked'}
                      size={16}
                      color={hasMinLength ? '#059669' : '#9CA3AF'}
                    />
                    <Text style={[styles.checkText, hasMinLength && styles.checkTextActive]}>
                      At least 8 characters
                    </Text>
                  </View>
                  <View style={styles.checkItem}>
                    <MaterialIcons
                      name={hasUpper ? 'check-circle' : 'radio-button-unchecked'}
                      size={16}
                      color={hasUpper ? '#059669' : '#9CA3AF'}
                    />
                    <Text style={[styles.checkText, hasUpper && styles.checkTextActive]}>
                      At least 1 uppercase letter (A-Z)
                    </Text>
                  </View>
                  <View style={styles.checkItem}>
                    <MaterialIcons
                      name={hasLower ? 'check-circle' : 'radio-button-unchecked'}
                      size={16}
                      color={hasLower ? '#059669' : '#9CA3AF'}
                    />
                    <Text style={[styles.checkText, hasLower && styles.checkTextActive]}>
                      At least 1 lowercase letter (a-z)
                    </Text>
                  </View>
                  <View style={styles.checkItem}>
                    <MaterialIcons
                      name={hasNumber ? 'check-circle' : 'radio-button-unchecked'}
                      size={16}
                      color={hasNumber ? '#059669' : '#9CA3AF'}
                    />
                    <Text style={[styles.checkText, hasNumber && styles.checkTextActive]}>
                      At least 1 number (0-9)
                    </Text>
                  </View>
                  <View style={styles.checkItem}>
                    <MaterialIcons
                      name={hasSpecial ? 'check-circle' : 'radio-button-unchecked'}
                      size={16}
                      color={hasSpecial ? '#059669' : '#9CA3AF'}
                    />
                    <Text style={[styles.checkText, hasSpecial && styles.checkTextActive]}>
                      At least 1 special character (!@#$%^&*)
                    </Text>
                  </View>
                </View>
              )}

              {/* Confirm Password */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>
                  Confirm New Password <Text style={styles.requiredAsterisk}>*</Text>
                </Text>
                <View style={styles.inputWrapper}>
                  <MaterialIcons name="lock" size={18} color="#9CA3AF" style={styles.inputIcon} />
                  <TextInput
                    style={styles.textInput}
                    placeholder="Re-enter new password"
                    placeholderTextColor="#9CA3AF"
                    secureTextEntry={!showConfirmPassword}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    autoCapitalize="none"
                  />
                  <TouchableOpacity
                    onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                    style={styles.eyeBtn}
                  >
                    <MaterialIcons
                      name={showConfirmPassword ? 'visibility-off' : 'visibility'}
                      size={20}
                      color="#6B7280"
                    />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Submit Button */}
              <TouchableOpacity
                style={[
                  styles.submitBtn,
                  (!currentPassword || !newPassword || !confirmPassword || isUpdating) && styles.submitBtnDisabled,
                ]}
                onPress={handleUpdatePassword}
                disabled={!currentPassword || !newPassword || !confirmPassword || isUpdating}
                activeOpacity={0.8}
              >
                {isUpdating ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <MaterialIcons name="verified-user" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
                    <Text style={styles.submitBtnText}>Update & Save Password</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            {/* Session Management */}
            {onLogout && (
              <View style={styles.logoutCard}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.logoutTitle}>End Admin Session</Text>
                  <Text style={styles.logoutDesc}>Sign out of CENRO City Government Portal</Text>
                </View>
                <TouchableOpacity
                  style={styles.logoutBtn}
                  onPress={() => {
                    handleClose();
                    onLogout();
                  }}
                  activeOpacity={0.7}
                >
                  <MaterialIcons name="logout" size={16} color="#DC2626" style={{ marginRight: 6 }} />
                  <Text style={styles.logoutBtnText}>Sign Out</Text>
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>
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
  },
  modalCard: {
    width: '100%',
    maxWidth: 540,
    maxHeight: '90%',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 10,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 22,
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    backgroundColor: '#FAFDFB',
  },
  headerIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#D1FAE5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTextContainer: {
    flex: 1,
    marginLeft: 14,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#059669',
    fontWeight: '600',
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
    borderRadius: 8,
  },
  scrollBody: {
    padding: 20,
  },
  profileCard: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
  },
  profileHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#D1FAE5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  adminName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  adminEmail: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
  },
  dictBadge: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  dictBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#065F46',
  },
  roleBadge: {
    backgroundColor: '#E0F2FE',
    borderColor: '#BAE6FD',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  roleBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#0369A1',
  },
  infoDivider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 12,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  infoLabel: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#64748B',
  },
  infoValue: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#1E293B',
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    padding: 18,
    marginBottom: 16,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  sectionDesc: {
    fontSize: 12.5,
    color: '#64748B',
    lineHeight: 18,
    marginBottom: 16,
  },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    padding: 12,
    borderRadius: 10,
    marginBottom: 14,
  },
  successText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: '#065F46',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    padding: 12,
    borderRadius: 10,
    marginBottom: 14,
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: '#991B1B',
  },
  inputGroup: {
    marginBottom: 14,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 6,
  },
  requiredAsterisk: {
    color: '#DC2626',
    fontWeight: '800',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 12,
  },
  inputIcon: {
    marginRight: 8,
  },
  textInput: {
    flex: 1,
    height: 44,
    fontSize: 14,
    color: '#0F172A',
    ...Platform.select({
      web: { outlineStyle: 'none' } as any,
    }),
  },
  eyeBtn: {
    padding: 6,
  },
  checklistCard: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
  },
  checklistTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  checkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginVertical: 2,
  },
  checkText: {
    fontSize: 12,
    color: '#94A3B8',
  },
  checkTextActive: {
    color: '#059669',
    fontWeight: '600',
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1B4D3E',
    height: 48,
    borderRadius: 10,
    marginTop: 6,
    shadowColor: '#1B4D3E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  submitBtnDisabled: {
    backgroundColor: '#94A3B8',
    shadowOpacity: 0,
    elevation: 0,
  },
  submitBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  logoutCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFF1F2',
    borderWidth: 1,
    borderColor: '#FFE4E6',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  logoutTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#9F1239',
  },
  logoutDesc: {
    fontSize: 11.5,
    color: '#BE123C',
    marginTop: 2,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#FECDD3',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  logoutBtnText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#DC2626',
  },
});
