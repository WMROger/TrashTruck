import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Modal,
  Alert,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import {
  collection,
  query,
  onSnapshot,
  doc,
  updateDoc,
  serverTimestamp,
  orderBy,
  limit,
} from 'firebase/firestore';
import { auth, db } from '@/config/firebase';
import { provisionCenroOnSpark } from '@/services/cenroProvisioningService';
import {
  requestAccountDeletionOtp,
  confirmAccountDeletion,
  isUserInactive6Months,
  getInactivityDurationString,
  deactivateResidentAccount,
  reactivateResidentAccount,
  batchDeactivateStaleResidents,
} from '@/services/cictoAccountService';
import {
  isCictoEmail,
  ensureCictoProfileInFirestore,
} from '@/constants/cictoConfig';

interface UserData {
  id: string;
  email: string;
  displayName: string;
  role: string;
  verified: boolean;
  employeeId?: string;
  department?: string;
  designation?: string;
  phoneNumber?: string;
  status?: string;
  disabled?: boolean;
  lastLogin?: any;
  createdAt?: any;
}

export default function IdentityAccessTab() {
  const { width } = useWindowDimensions();
  const isMobile = width < 768;

  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Modal states
  const [selectedUser, setSelectedUser] = useState<UserData | null>(null);
  const [isCenroModalOpen, setIsCenroModalOpen] = useState(false);
  const [cenroEmail, setCenroEmail] = useState('');
  const [cenroPassword, setCenroPassword] = useState('');
  const [cenroDepartment, setCenroDepartment] = useState('Waste Management Operations');
  const [cenroDesignation, setCenroDesignation] = useState('CENRO Field Officer');
  const [cenroContact, setCenroContact] = useState('');
  const [showCenroPassword, setShowCenroPassword] = useState(false);
  const [copiedPassword, setCopiedPassword] = useState(false);
  const [isSubmittingCenro, setIsSubmittingCenro] = useState(false);
  const [isDeptDropdownOpen, setIsDeptDropdownOpen] = useState(false);
  const [isDesigDropdownOpen, setIsDesigDropdownOpen] = useState(false);

  const CENRO_DEPARTMENTS = [
    'Waste Management Operations',
    'Environmental Quality Division',
    'Solid Waste Collection & Transport',
    'Pollution Control & Monitoring',
    'Natural Resources & Conservation',
    'General Administration & Records',
  ];

  const CENRO_DESIGNATIONS = [
    'CENRO Field Officer',
    'Operations Head / Supervisor',
    'Logistics & Fleet Dispatcher',
    'Environmental Inspector',
    'Enforcement & Compliance Officer',
    'Administrative Officer',
  ];

  const generateSecureTemporaryPassword = () => {
    const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const small = 'abcdefghijkmnpqrstuvwxyz';
    const nums = '23456789';
    const syms = '!@#$%';
    
    let p = 'CENRO-';
    p += letters.charAt(Math.floor(Math.random() * letters.length));
    p += small.charAt(Math.floor(Math.random() * small.length));
    p += nums.charAt(Math.floor(Math.random() * nums.length));
    p += syms.charAt(Math.floor(Math.random() * syms.length));
    const all = letters + small + nums;
    for (let i = 0; i < 4; i++) {
      p += all.charAt(Math.floor(Math.random() * all.length));
    }
    return p;
  };

  const handleOpenProvisionModal = () => {
    setCenroPassword(generateSecureTemporaryPassword());
    setCenroEmail('');
    setCopiedPassword(false);
    setIsCenroModalOpen(true);
  };

  const handleCopyPassword = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(cenroPassword);
    }
    setCopiedPassword(true);
    setTimeout(() => setCopiedPassword(false), 2000);
  };

  const handleRegeneratePassword = () => {
    setCenroPassword(generateSecureTemporaryPassword());
    setCopiedPassword(false);
  };

  // Deletion with OTP modal state
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [targetUserToDelete, setTargetUserToDelete] = useState<UserData | null>(null);
  const [deleteStep, setDeleteStep] = useState<'confirm' | 'otp'>('confirm');
  const [deleteOtpInput, setDeleteOtpInput] = useState('');
  const [deleteRequestId, setDeleteRequestId] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (!db) return;
    setLoading(true);

    const q = query(collection(db, 'users'), limit(300));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: UserData[] = snapshot.docs
          .map((docSnap) => ({
            id: docSnap.id,
            ...(docSnap.data() as any),
          }))
          .filter((u) => u.role !== 'dict');
        setUsers(list);
        setLoading(false);
      },
      (err) => {
        console.warn('Users listener error:', err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const matchesSearch =
        !searchQuery ||
        u.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.displayName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.employeeId?.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesRole =
        roleFilter === 'all' ||
        (roleFilter === 'cicto' && (u.role === 'cicto' || isCictoEmail(u.email))) ||
        (roleFilter === 'admin' && (u.role === 'admin' || u.role === 'cenro')) ||
        u.role === roleFilter;

      const isInactive = isUserInactive6Months(u) || u.disabled === true || u.status === 'inactive';
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' && !isInactive) ||
        (statusFilter === 'inactive' && isInactive);

      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [users, searchQuery, roleFilter, statusFilter]);

  const handleOpenDelete = (user: UserData) => {
    if (user.role === 'cicto' || isCictoEmail(user.email)) {
      Alert.alert('Protected Account', 'CICTO Super Administrator accounts cannot be deleted.');
      return;
    }
    setTargetUserToDelete(user);
    setDeleteStep('confirm');
    setDeleteOtpInput('');
    setDeleteRequestId('');
    setDeleteModalVisible(true);
  };

  const handleRequestDeletionOtp = async () => {
    if (!targetUserToDelete) return;
    setIsDeleting(true);
    try {
      const res = await requestAccountDeletionOtp(targetUserToDelete);
      setDeleteRequestId(res.requestId);
      setDeleteStep('otp');
      Alert.alert(
        'Security PIN Dispatched',
        `An authorization PIN has been generated. Check the CICTO Security Notification Bell in the top header.`
      );
    } catch (err: any) {
      Alert.alert('PIN Generation Failed', err?.message || 'Could not generate deletion PIN.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleConfirmDeletion = async () => {
    if (!targetUserToDelete || !deleteRequestId || !deleteOtpInput.trim()) {
      Alert.alert('Validation Error', 'Please enter the 6-digit authorization PIN.');
      return;
    }
    setIsDeleting(true);
    try {
      const res = await confirmAccountDeletion({
        requestId: deleteRequestId,
        pin: deleteOtpInput.trim(),
        targetUid: targetUserToDelete.id,
        targetEmail: targetUserToDelete.email,
      });
      setDeleteModalVisible(false);
      Alert.alert('Account Deleted', res.message);
    } catch (err: any) {
      Alert.alert('Deletion Failed', err?.message || 'Invalid authorization PIN or error deleting account.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleProvisionCenro = async () => {
    if (!cenroEmail.trim() || !cenroPassword.trim()) {
      Alert.alert('Validation Error', 'Email and temporary password are required.');
      return;
    }
    setIsSubmittingCenro(true);
    try {
      if (auth.currentUser && isCictoEmail(auth.currentUser.email)) {
        await ensureCictoProfileInFirestore(auth.currentUser.uid, auth.currentUser.email);
      }
      const targetEmpId = `CENRO-${Math.floor(1000 + Math.random() * 9000)}`;
      await provisionCenroOnSpark({
        mode: 'create',
        email: cenroEmail.trim().toLowerCase(),
        password: cenroPassword.trim(),
        fullName: 'CENRO Administrator',
        contactInfo: cenroContact.trim() ? `+63 ${cenroContact.trim()}` : '',
        employeeId: targetEmpId,
        department: cenroDepartment,
        designation: cenroDesignation,
      });
      setIsCenroModalOpen(false);
      setCenroEmail('');
      setCenroPassword('');
      Alert.alert('Success', `CENRO Admin account provisioned for ${cenroEmail} (Employee ID: ${targetEmpId}).`);
    } catch (err: any) {
      Alert.alert('Provisioning Error', err?.message || 'Failed to provision CENRO account.');
    } finally {
      setIsSubmittingCenro(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>CICTO / USER GOVERNANCE & ACCESS CONTROL</Text>
          <Text style={styles.title}>Identity & Access Management</Text>
          <Text style={styles.sub}>
            Super-administrative authority over user roles, CENRO admin provisioning, and directory life-cycle.
          </Text>
        </View>
        <TouchableOpacity
          style={styles.provisionBtn}
          onPress={handleOpenProvisionModal}
          activeOpacity={0.8}
        >
          <MaterialIcons name="person-add" size={18} color="#FFFFFF" />
          <Text style={styles.provisionBtnText}>Provision CENRO Admin</Text>
        </TouchableOpacity>
      </View>

      {/* Filter and Search Bar */}
      <View style={styles.filterBar}>
        <View style={styles.searchBox}>
          <MaterialIcons name="search" size={18} color="#94A3B8" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by name, email, or employee ID..."
            placeholderTextColor="#94A3B8"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
        <View style={styles.filterGroup}>
          {[
            { id: 'all', label: 'ALL' },
            { id: 'user', label: 'RESIDENTS' },
            { id: 'driver', label: 'DRIVERS' },
            { id: 'admin', label: 'CENRO' },
            { id: 'cicto', label: 'CICTO' },
          ].map((r) => (
            <TouchableOpacity
              key={r.id}
              style={[styles.filterChip, roleFilter === r.id && styles.filterChipActive]}
              onPress={() => setRoleFilter(r.id)}
            >
              <Text style={[styles.filterChipText, roleFilter === r.id && styles.filterChipTextActive]}>
                {r.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Users Table */}
      <View style={styles.tableCard}>
        <View style={styles.tableHead}>
          <Text style={[styles.th, { flex: 2 }]}>USER / EMAIL</Text>
          <Text style={[styles.th, { width: 120 }]}>ROLE</Text>
          <Text style={[styles.th, { width: 110 }]}>STATUS</Text>
          <Text style={[styles.th, { width: 100, textAlign: 'right' }]}>ACTIONS</Text>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color="#0D9488" style={{ padding: 40 }} />
        ) : filteredUsers.length === 0 ? (
          <Text style={styles.emptyText}>No users found matching current filters.</Text>
        ) : (
          filteredUsers.map((user) => {
            const isProtected = user.role === 'cicto' || isCictoEmail(user.email);
            const isInactive = isUserInactive6Months(user) || user.disabled === true || user.status === 'inactive';
            const isCenroAdmin = user.role === 'admin' || user.role === 'cenro';

            return (
              <View key={user.id} style={styles.tableRow}>
                <View style={[styles.userCell, { flex: 2 }]}>
                  <Text style={styles.userName}>{user.displayName || user.email?.split('@')[0]}</Text>
                  <Text style={styles.userEmail}>{user.email}</Text>
                  {user.employeeId && (
                    <Text style={styles.empIdBadge}>ID: {user.employeeId}</Text>
                  )}
                </View>

                <View style={{ width: 120 }}>
                  <View
                    style={[
                      styles.roleBadge,
                      isProtected
                        ? styles.roleBadgeCicto
                        : isCenroAdmin
                        ? styles.roleBadgeAdmin
                        : user.role === 'driver'
                        ? styles.roleBadgeDriver
                        : styles.roleBadgeUser,
                    ]}
                  >
                    <Text
                      style={[
                        styles.roleBadgeText,
                        isProtected
                          ? styles.roleBadgeTextCicto
                          : isCenroAdmin
                          ? styles.roleBadgeTextAdmin
                          : user.role === 'driver'
                          ? styles.roleBadgeTextDriver
                          : styles.roleBadgeTextUser,
                      ]}
                    >
                      {isProtected ? 'CICTO ADMIN' : isCenroAdmin ? 'CENRO' : user.role ? user.role.toUpperCase() : 'RESIDENT'}
                    </Text>
                  </View>
                </View>

                <View style={{ width: 110 }}>
                  <View style={styles.statusPill}>
                    <View
                      style={[
                        styles.statusDot,
                        { backgroundColor: isInactive ? '#EF4444' : '#10B981' },
                      ]}
                    />
                    <Text style={styles.statusText}>{isInactive ? 'INACTIVE' : 'ACTIVE'}</Text>
                  </View>
                </View>

                <View style={{ width: 100, flexDirection: 'row', justifyContent: 'flex-end', gap: 6 }}>
                  {!isProtected && (
                    <TouchableOpacity
                      style={styles.deleteBtn}
                      onPress={() => handleOpenDelete(user)}
                    >
                      <MaterialIcons name="delete-outline" size={18} color="#EF4444" />
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          })
        )}
      </View>

      {/* Provision CENRO Modal */}
      <Modal visible={isCenroModalOpen} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeaderRow}>
              <View style={styles.modalHeaderIconBadge}>
                <MaterialIcons name="admin-panel-settings" size={24} color="#0D9488" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>Provision CENRO Administrator</Text>
                <Text style={styles.modalSub}>
                  Create official municipal administrative credentials for solid waste and fleet operations.
                </Text>
              </View>
              <TouchableOpacity
                style={styles.modalCloseIconBtn}
                onPress={() => setIsCenroModalOpen(false)}
                disabled={isSubmittingCenro}
              >
                <MaterialIcons name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>OFFICIAL EMAIL ADDRESS *</Text>
              <View style={styles.inputWithIcon}>
                <MaterialIcons name="email" size={18} color="#94A3B8" style={styles.inputLeftIcon} />
                <TextInput
                  style={styles.modalInputWithIcon}
                  placeholder="e.g. cenro.officer@danao.gov.ph"
                  placeholderTextColor="#94A3B8"
                  value={cenroEmail}
                  onChangeText={setCenroEmail}
                  autoCapitalize="none"
                />
              </View>
            </View>

            <View style={styles.formGroup}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={styles.formLabel}>AUTO-GENERATED TEMPORARY PASSWORD (LOCKED)</Text>
                <TouchableOpacity
                  onPress={handleRegeneratePassword}
                  style={styles.regenerateBtn}
                  activeOpacity={0.7}
                >
                  <MaterialIcons name="refresh" size={14} color="#0D9488" />
                  <Text style={styles.regenerateText}>Regenerate</Text>
                </TouchableOpacity>
              </View>
              <View style={[styles.inputWithIcon, styles.readOnlyInputBox]}>
                <MaterialIcons name="lock" size={18} color="#0D9488" style={styles.inputLeftIcon} />
                <TextInput
                  style={[styles.modalInputWithIcon, styles.readOnlyText]}
                  value={cenroPassword}
                  editable={false}
                  selectTextOnFocus
                  secureTextEntry={!showCenroPassword}
                />
                <TouchableOpacity
                  onPress={() => setShowCenroPassword(p => !p)}
                  style={styles.inputRightAction}
                >
                  <MaterialIcons
                    name={showCenroPassword ? 'visibility-off' : 'visibility'}
                    size={18}
                    color="#64748B"
                  />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleCopyPassword}
                  style={[styles.copyBtn, copiedPassword && styles.copyBtnSuccess]}
                  activeOpacity={0.7}
                >
                  <MaterialIcons
                    name={copiedPassword ? 'check' : 'content-copy'}
                    size={15}
                    color={copiedPassword ? '#166534' : '#0D9488'}
                  />
                  <Text style={[styles.copyBtnText, copiedPassword && styles.copyBtnTextSuccess]}>
                    {copiedPassword ? 'Copied!' : 'Copy'}
                  </Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.formHelper}>
                🔒 This secure password is automatically created. The officer must change it on first login.
              </Text>
            </View>

            <View style={[styles.formRow, (isDeptDropdownOpen || isDesigDropdownOpen) && { zIndex: 1000, elevation: 1000, position: 'relative' }]}>
              {/* Department Dropdown */}
              <View style={[styles.formGroup, { flex: 1, position: 'relative', zIndex: isDeptDropdownOpen ? 1000 : 10 }]}>
                <Text style={styles.formLabel}>DEPARTMENT</Text>
                <TouchableOpacity
                  style={[styles.dropdownBtn, isDeptDropdownOpen && styles.dropdownBtnActive]}
                  onPress={() => {
                    setIsDeptDropdownOpen(!isDeptDropdownOpen);
                    setIsDesigDropdownOpen(false);
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={styles.dropdownBtnText} numberOfLines={1}>
                    {cenroDepartment || 'Select Department'}
                  </Text>
                  <MaterialIcons
                    name={isDeptDropdownOpen ? 'keyboard-arrow-up' : 'keyboard-arrow-down'}
                    size={20}
                    color="#64748B"
                  />
                </TouchableOpacity>

                {isDeptDropdownOpen && (
                  <View style={styles.dropdownMenu}>
                    <ScrollView style={{ maxHeight: 180 }} nestedScrollEnabled>
                      {CENRO_DEPARTMENTS.map((dept) => {
                        const isSelected = cenroDepartment === dept;
                        return (
                          <TouchableOpacity
                            key={dept}
                            style={[styles.dropdownMenuItem, isSelected && styles.dropdownMenuItemSelected]}
                            onPress={() => {
                              setCenroDepartment(dept);
                              setIsDeptDropdownOpen(false);
                            }}
                          >
                            <Text style={[styles.dropdownMenuItemText, isSelected && styles.dropdownMenuItemTextSelected]}>
                              {dept}
                            </Text>
                            {isSelected && (
                              <MaterialIcons name="check" size={16} color="#0D9488" />
                            )}
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  </View>
                )}
              </View>

              {/* Designation Dropdown */}
              <View style={[styles.formGroup, { flex: 1, position: 'relative', zIndex: isDesigDropdownOpen ? 1000 : 10 }]}>
                <Text style={styles.formLabel}>DESIGNATION</Text>
                <TouchableOpacity
                  style={[styles.dropdownBtn, isDesigDropdownOpen && styles.dropdownBtnActive]}
                  onPress={() => {
                    setIsDesigDropdownOpen(!isDesigDropdownOpen);
                    setIsDeptDropdownOpen(false);
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={styles.dropdownBtnText} numberOfLines={1}>
                    {cenroDesignation || 'Select Designation'}
                  </Text>
                  <MaterialIcons
                    name={isDesigDropdownOpen ? 'keyboard-arrow-up' : 'keyboard-arrow-down'}
                    size={20}
                    color="#64748B"
                  />
                </TouchableOpacity>

                {isDesigDropdownOpen && (
                  <View style={styles.dropdownMenu}>
                    <ScrollView style={{ maxHeight: 180 }} nestedScrollEnabled>
                      {CENRO_DESIGNATIONS.map((desig) => {
                        const isSelected = cenroDesignation === desig;
                        return (
                          <TouchableOpacity
                            key={desig}
                            style={[styles.dropdownMenuItem, isSelected && styles.dropdownMenuItemSelected]}
                            onPress={() => {
                              setCenroDesignation(desig);
                              setIsDesigDropdownOpen(false);
                            }}
                          >
                            <Text style={[styles.dropdownMenuItemText, isSelected && styles.dropdownMenuItemTextSelected]}>
                              {desig}
                            </Text>
                            {isSelected && (
                              <MaterialIcons name="check" size={16} color="#0D9488" />
                            )}
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  </View>
                )}
              </View>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancel}
                onPress={() => setIsCenroModalOpen(false)}
                disabled={isSubmittingCenro}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalConfirm, isSubmittingCenro && { opacity: 0.7 }]}
                onPress={handleProvisionCenro}
                disabled={isSubmittingCenro}
              >
                {isSubmittingCenro ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalConfirmText}>✨ Provision Account</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Deletion OTP Modal */}
      <Modal visible={deleteModalVisible} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.deleteHeaderIcon}>
              <MaterialIcons name="warning" size={28} color="#DC2626" />
            </View>
            <Text style={styles.modalTitle}>Security Account Deletion</Text>
            <Text style={styles.modalSub}>
              Permanently delete <Text style={{ fontWeight: '800' }}>{targetUserToDelete?.email}</Text> from Authentication and Firestore.
            </Text>

            {deleteStep === 'confirm' ? (
              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.modalCancel}
                  onPress={() => setDeleteModalVisible(false)}
                  disabled={isDeleting}
                >
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalConfirm, { backgroundColor: '#DC2626' }]}
                  onPress={handleRequestDeletionOtp}
                  disabled={isDeleting}
                >
                  <Text style={styles.modalConfirmText}>
                    {isDeleting ? 'Generating PIN...' : 'Request Authorization PIN'}
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View>
                <Text style={styles.otpLabel}>Enter 6-Digit Authorization PIN:</Text>
                <TextInput
                  style={[styles.modalInput, styles.otpInput]}
                  placeholder="000000"
                  value={deleteOtpInput}
                  onChangeText={setDeleteOtpInput}
                  keyboardType="numeric"
                  maxLength={6}
                />
                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={styles.modalCancel}
                    onPress={() => setDeleteModalVisible(false)}
                    disabled={isDeleting}
                  >
                    <Text style={styles.modalCancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalConfirm, { backgroundColor: '#DC2626' }]}
                    onPress={handleConfirmDeletion}
                    disabled={isDeleting}
                  >
                    <Text style={styles.modalConfirmText}>
                      {isDeleting ? 'Deleting...' : 'Confirm Deletion'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  content: { padding: 28 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
    gap: 16,
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: '900',
    color: '#0D9488',
    letterSpacing: 1.1,
  },
  title: {
    fontSize: 26,
    fontWeight: '900',
    color: '#0F172A',
    marginTop: 4,
  },
  sub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 4,
    maxWidth: 600,
  },
  provisionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#0D9488',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  provisionBtnText: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  filterBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  searchBox: {
    flex: 1,
    minWidth: 260,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 12.5,
    color: '#0F172A',
    padding: 0,
  },
  filterGroup: {
    flexDirection: 'row',
    gap: 6,
  },
  filterChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#F1F5F9',
  },
  filterChipActive: {
    backgroundColor: '#0D9488',
  },
  filterChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
  },
  tableCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    overflow: 'hidden',
  },
  tableHead: {
    flexDirection: 'row',
    padding: 14,
    backgroundColor: '#F8FAFC',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  th: {
    fontSize: 9.5,
    fontWeight: '900',
    color: '#64748B',
    letterSpacing: 0.8,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  userCell: {
    gap: 2,
  },
  userName: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  userEmail: {
    fontSize: 11.5,
    color: '#64748B',
  },
  empIdBadge: {
    fontSize: 10,
    color: '#0D9488',
    fontWeight: '700',
  },
  roleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  roleBadgeCicto: { backgroundColor: '#F0FDFA' },
  roleBadgeAdmin: { backgroundColor: '#F0FDF4' },
  roleBadgeDriver: { backgroundColor: '#FEF3C7' },
  roleBadgeUser: { backgroundColor: '#F1F5F9' },
  roleBadgeText: { fontSize: 10, fontWeight: '800' },
  roleBadgeTextCicto: { color: '#0F766E' },
  roleBadgeTextAdmin: { color: '#166534' },
  roleBadgeTextDriver: { color: '#B45309' },
  roleBadgeTextUser: { color: '#475569' },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#475569',
  },
  deleteBtn: {
    padding: 6,
  },
  emptyText: {
    padding: 30,
    textAlign: 'center',
    color: '#94A3B8',
    fontStyle: 'italic',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 480,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    gap: 16,
    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
    overflow: 'visible',
  },
  modalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  modalHeaderIconBadge: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#F0FDFA',
    borderWidth: 1,
    borderColor: '#CCFBF1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCloseIconBtn: {
    padding: 4,
  },
  deleteHeaderIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FEF2F2',
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
  },
  modalTitle: {
    fontSize: 16.5,
    fontWeight: '800',
    color: '#0F172A',
  },
  modalSub: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 17,
    marginTop: 2,
  },
  formGroup: {
    gap: 6,
  },
  formLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#475569',
    letterSpacing: 0.5,
  },
  formHelper: {
    fontSize: 11,
    color: '#64748B',
    fontStyle: 'italic',
  },
  formRow: {
    flexDirection: 'row',
    gap: 12,
  },
  inputWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 12,
  },
  inputLeftIcon: {
    marginRight: 8,
  },
  inputRightAction: {
    padding: 6,
  },
  modalInputWithIcon: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 13,
    color: '#0F172A',
  },
  modalInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: '#0F172A',
  },
  otpLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    marginTop: 4,
    marginBottom: 4,
  },
  otpInput: {
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 4,
    textAlign: 'center',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
    zIndex: 1,
  },
  modalCancel: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
  },
  modalConfirm: {
    flex: 1.3,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#0D9488',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 4px 6px -1px rgba(13, 148, 136, 0.25)',
  },
  modalConfirmText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  regenerateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 6,
    backgroundColor: '#F0FDFA',
  },
  regenerateText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0D9488',
  },
  readOnlyInputBox: {
    backgroundColor: '#F1F5F9',
    borderColor: '#CBD5E1',
  },
  readOnlyText: {
    fontWeight: '700',
    letterSpacing: 1,
    color: '#0F172A',
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    backgroundColor: '#CCFBF1',
    marginLeft: 4,
  },
  copyBtnSuccess: {
    backgroundColor: '#DCFCE7',
  },
  copyBtnText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#0D9488',
  },
  copyBtnTextSuccess: {
    color: '#166534',
  },
  dropdownBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 42,
  },
  dropdownBtnActive: {
    borderColor: '#0D9488',
    backgroundColor: '#FFFFFF',
    boxShadow: '0 0 0 2px rgba(13, 148, 136, 0.15)',
  },
  dropdownBtnText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#0F172A',
    flex: 1,
    marginRight: 6,
  },
  dropdownMenu: {
    position: 'absolute',
    top: 66,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.1)',
    zIndex: 99999,
    elevation: 9999,
    overflow: 'hidden',
  },
  dropdownMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  dropdownMenuItemSelected: {
    backgroundColor: '#F0FDFA',
  },
  dropdownMenuItemText: {
    fontSize: 12,
    color: '#334155',
    fontWeight: '500',
    flex: 1,
  },
  dropdownMenuItemTextSelected: {
    color: '#0D9488',
    fontWeight: '700',
  },
});
