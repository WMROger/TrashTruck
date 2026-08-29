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
  const [isSubmittingCenro, setIsSubmittingCenro] = useState(false);

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
          onPress={() => setIsCenroModalOpen(true)}
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
            <Text style={styles.modalTitle}>Provision CENRO Administrator</Text>
            <Text style={styles.modalSub}>
              Create official CENRO administrative credentials for municipal waste and fleet operations.
            </Text>

            <TextInput
              style={styles.modalInput}
              placeholder="CENRO Admin Email (e.g. cenro.officer@danao.gov.ph)"
              value={cenroEmail}
              onChangeText={setCenroEmail}
              autoCapitalize="none"
            />
            <TextInput
              style={styles.modalInput}
              placeholder="Temporary Access Password (5-min expiration)"
              value={cenroPassword}
              onChangeText={setCenroPassword}
              secureTextEntry
            />
            <TextInput
              style={styles.modalInput}
              placeholder="Department"
              value={cenroDepartment}
              onChangeText={setCenroDepartment}
            />
            <TextInput
              style={styles.modalInput}
              placeholder="Designation"
              value={cenroDesignation}
              onChangeText={setCenroDesignation}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancel}
                onPress={() => setIsCenroModalOpen(false)}
                disabled={isSubmittingCenro}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalConfirm}
                onPress={handleProvisionCenro}
                disabled={isSubmittingCenro}
              >
                <Text style={styles.modalConfirmText}>
                  {isSubmittingCenro ? 'Provisioning...' : 'Provision Account'}
                </Text>
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
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 24,
    gap: 12,
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
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
  },
  modalSub: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 17,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    padding: 10,
    fontSize: 12.5,
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
  },
  modalCancel: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#475569',
  },
  modalConfirm: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#0D9488',
    alignItems: 'center',
  },
  modalConfirmText: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
