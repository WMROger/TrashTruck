import React, { useState, useEffect, useMemo, useRef } from 'react';
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
import { DANAO_CITY_BARANGAYS } from '@/constants/danaoBarangays';

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
  barangay?: string;
  assignedBarangay?: string;
  location?: string;
  address?: string;
  barangayUpdatedAt?: any;
}

export default function IdentityAccessTab() {
  const { width } = useWindowDimensions();
  const isMobile = width < 768;

  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [barangayFilter, setBarangayFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Barangay dropdown state for filter bar
  const [isBarangayDropdownOpen, setIsBarangayDropdownOpen] = useState(false);
  const [barangayDropdownSearch, setBarangayDropdownSearch] = useState('');

  // Status dropdown state
  const [isStatusDropdownOpen, setIsStatusDropdownOpen] = useState(false);

  // Dropdown container ref for web click-outside detection
  const barangayFilterRef = useRef<View>(null);
  const statusFilterRef = useRef<View>(null);

  // Provision CENRO Modal states
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

  // Edit User / Assign Barangay Modal states
  const [isEditUserModalOpen, setIsEditUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserData | null>(null);
  const [selectedBarangayForUser, setSelectedBarangayForUser] = useState('');
  const [isUpdatingBarangay, setIsUpdatingBarangay] = useState(false);
  const [isEditModalBrgyDropdownOpen, setIsEditModalBrgyDropdownOpen] = useState(false);
  const [editModalBrgySearch, setEditModalBrgySearch] = useState('');

  // Batch action state
  const [isBatchDeactivating, setIsBatchDeactivating] = useState(false);

  // Deletion with OTP modal state
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [targetUserToDelete, setTargetUserToDelete] = useState<UserData | null>(null);
  const [deleteStep, setDeleteStep] = useState<'confirm' | 'otp'>('confirm');
  const [deleteOtpInput, setDeleteOtpInput] = useState('');
  const [deleteRequestId, setDeleteRequestId] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  // Web click-outside listener for filter dropdowns (non-blocking)
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;

    const handleDocumentClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target) return;

      if (
        isBarangayDropdownOpen &&
        barangayFilterRef.current &&
        !(barangayFilterRef.current as any).contains?.(target)
      ) {
        setIsBarangayDropdownOpen(false);
      }

      if (
        isStatusDropdownOpen &&
        statusFilterRef.current &&
        !(statusFilterRef.current as any).contains?.(target)
      ) {
        setIsStatusDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleDocumentClick);
    return () => {
      document.removeEventListener('mousedown', handleDocumentClick);
    };
  }, [isBarangayDropdownOpen, isStatusDropdownOpen]);

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

  useEffect(() => {
    if (!db) return;
    setLoading(true);

    const q = query(collection(db, 'users'), limit(500));
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

  // Compute counts per role
  const roleCounts = useMemo(() => {
    const all = users.length;
    const residents = users.filter((u) => u.role === 'user' || !u.role).length;
    const drivers = users.filter((u) => u.role === 'driver').length;
    const cenro = users.filter((u) => u.role === 'admin' || u.role === 'cenro').length;
    const cicto = users.filter((u) => u.role === 'cicto' || isCictoEmail(u.email)).length;
    return { all, residents, drivers, cenro, cicto };
  }, [users]);

  // Compute counts per barangay (for the 42 official Danao City barangays)
  const barangayCounts = useMemo(() => {
    const counts: Record<string, number> = { all: users.length, unassigned: 0 };
    DANAO_CITY_BARANGAYS.forEach((b) => {
      counts[b] = 0;
    });

    users.forEach((u) => {
      const rawB = (u.barangay || u.assignedBarangay || '').trim();
      if (!rawB) {
        counts.unassigned += 1;
      } else {
        const matched = DANAO_CITY_BARANGAYS.find(
          (dbName) => dbName.toLowerCase() === rawB.toLowerCase()
        );
        if (matched) {
          counts[matched] = (counts[matched] || 0) + 1;
        } else {
          counts[rawB] = (counts[rawB] || 0) + 1;
        }
      }
    });

    return counts;
  }, [users]);

  // Filtered list of 42 barangays for dropdown search
  const filteredBarangayList = useMemo(() => {
    const q = barangayDropdownSearch.trim().toLowerCase();
    if (!q) return DANAO_CITY_BARANGAYS;
    return DANAO_CITY_BARANGAYS.filter((b) => b.toLowerCase().includes(q));
  }, [barangayDropdownSearch]);

  // Filtered users
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const q = searchQuery.toLowerCase().trim();
      const userBarangay = (u.barangay || u.assignedBarangay || '').trim();

      const matchesSearch =
        !q ||
        u.email?.toLowerCase().includes(q) ||
        u.displayName?.toLowerCase().includes(q) ||
        u.employeeId?.toLowerCase().includes(q) ||
        u.phoneNumber?.toLowerCase().includes(q) ||
        userBarangay.toLowerCase().includes(q);

      const matchesRole =
        roleFilter === 'all' ||
        (roleFilter === 'cicto' && (u.role === 'cicto' || isCictoEmail(u.email))) ||
        (roleFilter === 'admin' && (u.role === 'admin' || u.role === 'cenro')) ||
        (roleFilter === 'driver' && u.role === 'driver') ||
        (roleFilter === 'user' && (u.role === 'user' || !u.role));

      const matchesBarangay =
        barangayFilter === 'all' ||
        (barangayFilter === 'unassigned' && !userBarangay) ||
        userBarangay.toLowerCase() === barangayFilter.toLowerCase();

      const isInactive = isUserInactive6Months(u) || u.disabled === true || u.status === 'inactive';
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' && !isInactive) ||
        (statusFilter === 'inactive' && isInactive);

      return matchesSearch && matchesRole && matchesBarangay && matchesStatus;
    });
  }, [users, searchQuery, roleFilter, barangayFilter, statusFilter]);

  // Stale resident count
  const staleResidentCount = useMemo(() => {
    return users.filter(
      (u) =>
        (u.role === 'user' || !u.role) &&
        u.disabled !== true &&
        u.status !== 'inactive' &&
        isUserInactive6Months(u)
    ).length;
  }, [users]);

  const handleResetFilters = () => {
    setSearchQuery('');
    setRoleFilter('all');
    setBarangayFilter('all');
    setStatusFilter('all');
    setIsBarangayDropdownOpen(false);
    setIsStatusDropdownOpen(false);
  };

  const handleOpenEditUser = (user: UserData) => {
    setEditingUser(user);
    setSelectedBarangayForUser((user.barangay || user.assignedBarangay || '').trim());
    setIsEditModalBrgyDropdownOpen(false);
    setEditModalBrgySearch('');
    setIsEditUserModalOpen(true);
  };

  const handleSaveUserBarangay = async () => {
    if (!editingUser || !db) return;
    setIsUpdatingBarangay(true);
    try {
      const userRef = doc(db, 'users', editingUser.id);
      await updateDoc(userRef, {
        barangay: selectedBarangayForUser.trim(),
        barangayUpdatedAt: serverTimestamp(),
      });

      // Audit trail entry
      try {
        const { addDoc } = await import('firebase/firestore');
        await addDoc(collection(db, 'client_activity'), {
          event: 'user.barangay_reassigned',
          targetType: 'user',
          targetId: editingUser.id,
          actorEmail: auth.currentUser?.email || 'cicto@trashtrack.gov.ph',
          metadata: {
            previousBarangay: editingUser.barangay || 'Unassigned',
            newBarangay: selectedBarangayForUser.trim(),
            userEmail: editingUser.email,
          },
          createdAt: serverTimestamp(),
        });
      } catch {}

      setIsEditUserModalOpen(false);
      Alert.alert(
        'Barangay Updated',
        `Registered sector for ${editingUser.displayName || editingUser.email} updated to Brgy. ${selectedBarangayForUser || 'Unassigned'}.`
      );
    } catch (err: any) {
      Alert.alert('Update Failed', err?.message || 'Failed to update barangay preference.');
    } finally {
      setIsUpdatingBarangay(false);
    }
  };

  const handleToggleResidentStatus = async (user: UserData) => {
    const isInactive = isUserInactive6Months(user) || user.disabled === true || user.status === 'inactive';
    try {
      if (isInactive) {
        const res = await reactivateResidentAccount(user.id, user.email);
        Alert.alert('Reactivated', res.message);
      } else {
        const res = await deactivateResidentAccount(user.id, user.email, 'Admin Manual Directive');
        Alert.alert('Deactivated', res.message);
      }
    } catch (err: any) {
      Alert.alert('Action Failed', err?.message || 'Failed to toggle account status.');
    }
  };

  const handleBatchDeactivateStale = async () => {
    if (staleResidentCount === 0) {
      Alert.alert('Directory Up to Date', 'No active residents found with >= 6 months of inactivity.');
      return;
    }

    Alert.alert(
      'Batch Deactivate Stale Residents',
      `Found ${staleResidentCount} resident account(s) with >= 6 months of inactivity. Do you want to deactivate them now?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: `Deactivate (${staleResidentCount})`,
          style: 'destructive',
          onPress: async () => {
            setIsBatchDeactivating(true);
            try {
              const res = await batchDeactivateStaleResidents(users);
              Alert.alert('Batch Complete', `Successfully deactivated ${res.count} stale resident account(s).`);
            } catch (err: any) {
              Alert.alert('Batch Failed', err?.message || 'Failed to batch deactivate.');
            } finally {
              setIsBatchDeactivating(false);
            }
          },
        },
      ]
    );
  };

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

  const hasActiveFilters =
    searchQuery.trim() !== '' ||
    roleFilter !== 'all' ||
    barangayFilter !== 'all' ||
    statusFilter !== 'all';

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <View style={styles.eyebrowRow}>
            <MaterialIcons name="security" size={14} color="#0D9488" />
            <Text style={styles.eyebrow}>CICTO / USER GOVERNANCE & ACCESS CONTROL</Text>
          </View>
          <Text style={styles.title}>Identity & Access Management</Text>
          <Text style={styles.sub}>
            Super-administrative oversight across 42 Danao City barangays, resident directory life-cycle, and municipal role governance.
          </Text>
        </View>

        <View style={styles.headerActions}>
          {staleResidentCount > 0 && (
            <TouchableOpacity
              style={styles.staleCleanBtn}
              onPress={handleBatchDeactivateStale}
              disabled={isBatchDeactivating}
              activeOpacity={0.8}
            >
              <MaterialIcons name="auto-fix-high" size={16} color="#DC2626" />
              <Text style={styles.staleCleanBtnText}>
                {isBatchDeactivating ? 'Cleaning...' : `Deactivate Stale (${staleResidentCount})`}
              </Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.provisionBtn}
            onPress={handleOpenProvisionModal}
            activeOpacity={0.8}
          >
            <MaterialIcons name="person-add" size={18} color="#FFFFFF" />
            <Text style={styles.provisionBtnText}>Provision CENRO Admin</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Filter and Search Bar */}
      <View style={[styles.filterSection, (isBarangayDropdownOpen || isStatusDropdownOpen) && { zIndex: 9999, elevation: 9999 }]}>
        {/* Top Filter Controls: Search + 42-Barangay Dropdown + Status Selector */}
        <View style={[styles.filterBar, (isBarangayDropdownOpen || isStatusDropdownOpen) && { zIndex: 9999, elevation: 9999 }]}>
          {/* General Search Input */}
          <View style={styles.searchBox}>
            <MaterialIcons name="search" size={18} color="#94A3B8" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search by name, email, employee ID, or barangay..."
              placeholderTextColor="#94A3B8"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.trim() !== '' && (
              <TouchableOpacity onPress={() => setSearchQuery('')} style={{ padding: 4 }}>
                <MaterialIcons name="close" size={16} color="#94A3B8" />
              </TouchableOpacity>
            )}
          </View>

          {/* Searchable 42-Barangay Filter Dropdown */}
          <View
            ref={barangayFilterRef}
            style={[styles.dropdownContainer, { zIndex: isBarangayDropdownOpen ? 10000 : 20, elevation: isBarangayDropdownOpen ? 10000 : 20 }]}
          >
            <TouchableOpacity
              style={[
                styles.filterDropdownBtn,
                barangayFilter !== 'all' && styles.filterDropdownBtnActive,
                isBarangayDropdownOpen && styles.filterDropdownBtnOpen,
              ]}
              onPress={() => {
                setIsBarangayDropdownOpen(!isBarangayDropdownOpen);
                setIsStatusDropdownOpen(false);
              }}
              activeOpacity={0.8}
            >
              <View style={styles.dropdownBtnInner}>
                <MaterialIcons
                  name="location-on"
                  size={16}
                  color={barangayFilter !== 'all' ? '#0D9488' : '#64748B'}
                />
                <Text
                  style={[
                    styles.filterDropdownText,
                    barangayFilter !== 'all' && styles.filterDropdownTextActive,
                  ]}
                  numberOfLines={1}
                >
                  {barangayFilter === 'all'
                    ? `All Barangays (42)`
                    : barangayFilter === 'unassigned'
                    ? `Unassigned (${barangayCounts.unassigned || 0})`
                    : `${barangayFilter} (${barangayCounts[barangayFilter] || 0})`}
                </Text>
              </View>
              <MaterialIcons
                name={isBarangayDropdownOpen ? 'keyboard-arrow-up' : 'keyboard-arrow-down'}
                size={18}
                color={barangayFilter !== 'all' ? '#0D9488' : '#64748B'}
              />
            </TouchableOpacity>

            {/* Dropdown Menu with Search inside for 42 Barangays */}
            {isBarangayDropdownOpen && (
              <View style={styles.barangayDropdownMenu}>
                {/* Search Bar inside Barangay Dropdown */}
                <View style={styles.dropdownSearchBox}>
                  <MaterialIcons name="search" size={16} color="#0D9488" />
                  <TextInput
                    style={styles.dropdownSearchInput}
                    placeholder="Search 42 barangays..."
                    placeholderTextColor="#94A3B8"
                    value={barangayDropdownSearch}
                    onChangeText={setBarangayDropdownSearch}
                    autoFocus
                  />
                  {barangayDropdownSearch.trim() !== '' && (
                    <TouchableOpacity onPress={() => setBarangayDropdownSearch('')}>
                      <MaterialIcons name="close" size={14} color="#94A3B8" />
                    </TouchableOpacity>
                  )}
                </View>

                {/* Scrollable list of 42 barangays */}
                <ScrollView
                  style={styles.barangayDropdownScroll}
                  contentContainerStyle={{ flexGrow: 1, paddingBottom: 8 }}
                  nestedScrollEnabled={true}
                  showsVerticalScrollIndicator={true}
                  keyboardShouldPersistTaps="handled"
                >
                  {/* Option: All Barangays */}
                  <TouchableOpacity
                    style={[
                      styles.barangayDropdownItem,
                      barangayFilter === 'all' && styles.barangayDropdownItemSelected,
                    ]}
                    onPress={() => {
                      setBarangayFilter('all');
                      setIsBarangayDropdownOpen(false);
                      setBarangayDropdownSearch('');
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                      <MaterialIcons
                        name="public"
                        size={16}
                        color={barangayFilter === 'all' ? '#0D9488' : '#64748B'}
                      />
                      <Text
                        style={[
                          styles.barangayDropdownItemText,
                          barangayFilter === 'all' && styles.barangayDropdownItemTextSelected,
                        ]}
                      >
                        All 42 Barangays
                      </Text>
                    </View>
                    <View style={styles.countBadge}>
                      <Text style={styles.countBadgeText}>{users.length}</Text>
                    </View>
                  </TouchableOpacity>

                  {/* Option: Unassigned */}
                  <TouchableOpacity
                    style={[
                      styles.barangayDropdownItem,
                      barangayFilter === 'unassigned' && styles.barangayDropdownItemSelected,
                    ]}
                    onPress={() => {
                      setBarangayFilter('unassigned');
                      setIsBarangayDropdownOpen(false);
                      setBarangayDropdownSearch('');
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                      <MaterialIcons
                        name="help-outline"
                        size={16}
                        color={barangayFilter === 'unassigned' ? '#0D9488' : '#64748B'}
                      />
                      <Text
                        style={[
                          styles.barangayDropdownItemText,
                          barangayFilter === 'unassigned' && styles.barangayDropdownItemTextSelected,
                        ]}
                      >
                        Unassigned / Not Set
                      </Text>
                    </View>
                    <View style={[styles.countBadge, { backgroundColor: '#F1F5F9' }]}>
                      <Text style={styles.countBadgeText}>{barangayCounts.unassigned || 0}</Text>
                    </View>
                  </TouchableOpacity>

                  <View style={styles.dropdownDivider} />

                  {/* 42 Danao City Barangays */}
                  {filteredBarangayList.map((bName) => {
                    const isSelected = barangayFilter.toLowerCase() === bName.toLowerCase();
                    const count = barangayCounts[bName] || 0;

                    return (
                      <TouchableOpacity
                        key={bName}
                        style={[
                          styles.barangayDropdownItem,
                          isSelected && styles.barangayDropdownItemSelected,
                        ]}
                        onPress={() => {
                          setBarangayFilter(bName);
                          setIsBarangayDropdownOpen(false);
                          setBarangayDropdownSearch('');
                        }}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                          <MaterialIcons
                            name="location-on"
                            size={15}
                            color={isSelected ? '#0D9488' : '#94A3B8'}
                          />
                          <Text
                            style={[
                              styles.barangayDropdownItemText,
                              isSelected && styles.barangayDropdownItemTextSelected,
                            ]}
                          >
                            {bName}
                          </Text>
                        </View>
                        <View
                          style={[
                            styles.countBadge,
                            count > 0 && { backgroundColor: isSelected ? '#0D9488' : '#CCFBF1' },
                          ]}
                        >
                          <Text
                            style={[
                              styles.countBadgeText,
                              count > 0 && { color: isSelected ? '#FFFFFF' : '#0F766E', fontWeight: '800' },
                            ]}
                          >
                            {count}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}

                  {filteredBarangayList.length === 0 && (
                    <Text style={styles.noDropdownMatchText}>No barangays match "{barangayDropdownSearch}".</Text>
                  )}
                </ScrollView>
              </View>
            )}
          </View>

          {/* Status Filter Dropdown */}
          <View
            ref={statusFilterRef}
            style={[styles.dropdownContainer, { zIndex: isStatusDropdownOpen ? 10000 : 15, elevation: isStatusDropdownOpen ? 10000 : 15 }]}
          >
            <TouchableOpacity
              style={[
                styles.filterDropdownBtn,
                statusFilter !== 'all' && styles.filterDropdownBtnActive,
                isStatusDropdownOpen && styles.filterDropdownBtnOpen,
              ]}
              onPress={() => {
                setIsStatusDropdownOpen(!isStatusDropdownOpen);
                setIsBarangayDropdownOpen(false);
              }}
              activeOpacity={0.8}
            >
              <View style={styles.dropdownBtnInner}>
                <MaterialIcons
                  name="filter-alt"
                  size={16}
                  color={statusFilter !== 'all' ? '#0D9488' : '#64748B'}
                />
                <Text
                  style={[
                    styles.filterDropdownText,
                    statusFilter !== 'all' && styles.filterDropdownTextActive,
                  ]}
                >
                  {statusFilter === 'all'
                    ? 'All Statuses'
                    : statusFilter === 'active'
                    ? 'Active Only'
                    : 'Inactive (6+ Mo)'}
                </Text>
              </View>
              <MaterialIcons
                name={isStatusDropdownOpen ? 'keyboard-arrow-up' : 'keyboard-arrow-down'}
                size={18}
                color={statusFilter !== 'all' ? '#0D9488' : '#64748B'}
              />
            </TouchableOpacity>

            {isStatusDropdownOpen && (
              <View style={[styles.barangayDropdownMenu, { width: 170 }]}>
                {[
                  { id: 'all', label: 'All Statuses', icon: 'list' },
                  { id: 'active', label: 'Active Only', icon: 'check-circle' },
                  { id: 'inactive', label: 'Inactive (6+ Mo)', icon: 'pause-circle-filled' },
                ].map((s) => (
                  <TouchableOpacity
                    key={s.id}
                    style={[
                      styles.barangayDropdownItem,
                      statusFilter === s.id && styles.barangayDropdownItemSelected,
                    ]}
                    onPress={() => {
                      setStatusFilter(s.id);
                      setIsStatusDropdownOpen(false);
                    }}
                  >
                    <MaterialIcons
                      name={s.icon as any}
                      size={15}
                      color={statusFilter === s.id ? '#0D9488' : '#64748B'}
                    />
                    <Text
                      style={[
                        styles.barangayDropdownItemText,
                        statusFilter === s.id && styles.barangayDropdownItemTextSelected,
                      ]}
                    >
                      {s.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        </View>

        {/* Role Tabs Row */}
        <View style={styles.roleTabsRow}>
          <View style={styles.filterGroup}>
            {[
              { id: 'all', label: 'ALL', count: roleCounts.all },
              { id: 'user', label: 'RESIDENTS', count: roleCounts.residents },
              { id: 'driver', label: 'DRIVERS', count: roleCounts.drivers },
              { id: 'admin', label: 'CENRO', count: roleCounts.cenro },
              { id: 'cicto', label: 'CICTO', count: roleCounts.cicto },
            ].map((r) => {
              const isActive = roleFilter === r.id;
              return (
                <TouchableOpacity
                  key={r.id}
                  style={[styles.filterChip, isActive && styles.filterChipActive]}
                  onPress={() => setRoleFilter(r.id)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.filterChipText, isActive && styles.filterChipTextActive]}>
                    {r.label}
                  </Text>
                  <View
                    style={[
                      styles.roleChipBadge,
                      isActive && styles.roleChipBadgeActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.roleChipBadgeText,
                        isActive && styles.roleChipBadgeTextActive,
                      ]}
                    >
                      {r.count}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Active Filter Summary Bar */}
        {hasActiveFilters && (
          <View style={styles.activeFilterBar}>
            <View style={styles.activeFilterTags}>
              <Text style={styles.activeFilterLabel}>FILTERING:</Text>
              {roleFilter !== 'all' && (
                <View style={styles.activeTag}>
                  <Text style={styles.activeTagText}>
                    Role: {roleFilter === 'user' ? 'Residents' : roleFilter.toUpperCase()}
                  </Text>
                  <TouchableOpacity onPress={() => setRoleFilter('all')}>
                    <MaterialIcons name="close" size={13} color="#0F766E" />
                  </TouchableOpacity>
                </View>
              )}
              {barangayFilter !== 'all' && (
                <View style={styles.activeTag}>
                  <Text style={styles.activeTagText}>
                    Barangay: {barangayFilter === 'unassigned' ? 'Unassigned' : barangayFilter}
                  </Text>
                  <TouchableOpacity onPress={() => setBarangayFilter('all')}>
                    <MaterialIcons name="close" size={13} color="#0F766E" />
                  </TouchableOpacity>
                </View>
              )}
              {statusFilter !== 'all' && (
                <View style={styles.activeTag}>
                  <Text style={styles.activeTagText}>
                    Status: {statusFilter.toUpperCase()}
                  </Text>
                  <TouchableOpacity onPress={() => setStatusFilter('all')}>
                    <MaterialIcons name="close" size={13} color="#0F766E" />
                  </TouchableOpacity>
                </View>
              )}
              {searchQuery.trim() !== '' && (
                <View style={styles.activeTag}>
                  <Text style={styles.activeTagText}>Search: "{searchQuery}"</Text>
                  <TouchableOpacity onPress={() => setSearchQuery('')}>
                    <MaterialIcons name="close" size={13} color="#0F766E" />
                  </TouchableOpacity>
                </View>
              )}
            </View>

            <TouchableOpacity style={styles.clearAllBtn} onPress={handleResetFilters}>
              <MaterialIcons name="refresh" size={14} color="#64748B" />
              <Text style={styles.clearAllBtnText}>Reset All</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Directory Summary Counter */}
      <View style={styles.resultsSummaryRow}>
        <Text style={styles.resultsSummaryText}>
          Showing <Text style={{ fontWeight: '800', color: '#0F172A' }}>{filteredUsers.length}</Text> of{' '}
          <Text style={{ fontWeight: '800', color: '#0F172A' }}>{users.length}</Text> total accounts
          {barangayFilter !== 'all' && ` in Brgy. ${barangayFilter}`}
        </Text>
      </View>

      {/* Users Table */}
      <View style={styles.tableCard}>
        <View style={styles.tableHead}>
          <Text style={[styles.th, { flex: 2 }]}>USER / CONTACT</Text>
          <Text style={[styles.th, { width: 140 }]}>BARANGAY</Text>
          <Text style={[styles.th, { width: 110 }]}>ROLE</Text>
          <Text style={[styles.th, { width: 110 }]}>STATUS</Text>
          <Text style={[styles.th, { width: 120, textAlign: 'right' }]}>ACTIONS</Text>
        </View>

        {loading ? (
          <View style={styles.loaderContainer}>
            <ActivityIndicator size="large" color="#0D9488" />
            <Text style={styles.loaderText}>Loading identity directory...</Text>
          </View>
        ) : filteredUsers.length === 0 ? (
          <View style={styles.emptyContainer}>
            <MaterialIcons name="person-search" size={48} color="#CBD5E1" />
            <Text style={styles.emptyTitle}>No matching accounts found</Text>
            <Text style={styles.emptySub}>
              Try clearing your filters or selecting a different barangay sector.
            </Text>
            {hasActiveFilters && (
              <TouchableOpacity style={styles.emptyResetBtn} onPress={handleResetFilters}>
                <Text style={styles.emptyResetBtnText}>Reset Filters</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          filteredUsers.map((user) => {
            const isProtected = user.role === 'cicto' || isCictoEmail(user.email);
            const isInactive = isUserInactive6Months(user) || user.disabled === true || user.status === 'inactive';
            const isCenroAdmin = user.role === 'admin' || user.role === 'cenro';
            const isResident = user.role === 'user' || !user.role;
            const userBarangay = (user.barangay || user.assignedBarangay || '').trim();

            return (
              <View key={user.id} style={styles.tableRow}>
                {/* User / Email / Contact Info */}
                <View style={[styles.userCell, { flex: 2 }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <View style={[styles.userAvatar, isProtected && styles.userAvatarCicto]}>
                      <Text style={[styles.userAvatarText, isProtected && styles.userAvatarTextCicto]}>
                        {(user.displayName || user.email || 'U').charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.userName} numberOfLines={1}>
                        {user.displayName || user.email?.split('@')[0]}
                      </Text>
                      <Text style={styles.userEmail} numberOfLines={1}>
                        {user.email}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.userSubInfoRow}>
                    {user.employeeId && (
                      <View style={styles.empIdBadge}>
                        <Text style={styles.empIdBadgeText}>ID: {user.employeeId}</Text>
                      </View>
                    )}
                    {user.phoneNumber && (
                      <Text style={styles.phoneText}>📞 {user.phoneNumber}</Text>
                    )}
                  </View>
                </View>

                {/* Barangay Badge */}
                <View style={{ width: 140 }}>
                  {userBarangay ? (
                    <TouchableOpacity
                      style={styles.barangayBadge}
                      onPress={() => setBarangayFilter(userBarangay)}
                      activeOpacity={0.7}
                    >
                      <MaterialIcons name="location-on" size={13} color="#0D9488" />
                      <Text style={styles.barangayBadgeText} numberOfLines={1}>
                        {userBarangay}
                      </Text>
                    </TouchableOpacity>
                  ) : (
                    <View style={styles.barangayUnassignedBadge}>
                      <MaterialIcons name="help-outline" size={12} color="#94A3B8" />
                      <Text style={styles.barangayUnassignedText}>Unassigned</Text>
                    </View>
                  )}
                </View>

                {/* Role Badge */}
                <View style={{ width: 110 }}>
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
                      {isProtected
                        ? 'CICTO ADMIN'
                        : isCenroAdmin
                        ? 'CENRO'
                        : user.role === 'driver'
                        ? 'DRIVER'
                        : 'RESIDENT'}
                    </Text>
                  </View>
                </View>

                {/* Status & Inactivity */}
                <View style={{ width: 110 }}>
                  <View style={styles.statusPill}>
                    <View
                      style={[
                        styles.statusDot,
                        { backgroundColor: isInactive ? '#EF4444' : '#10B981' },
                      ]}
                    />
                    <Text
                      style={[
                        styles.statusText,
                        { color: isInactive ? '#DC2626' : '#15803D' },
                      ]}
                    >
                      {isInactive ? 'INACTIVE' : 'ACTIVE'}
                    </Text>
                  </View>
                  {isInactive && isResident && (
                    <Text style={styles.inactivitySubText} numberOfLines={1}>
                      {getInactivityDurationString(user)}
                    </Text>
                  )}
                </View>

                {/* Action Buttons */}
                <View style={styles.actionsCell}>
                  {/* Reassign Barangay / Details Button */}
                  <TouchableOpacity
                    style={styles.actionIconBtn}
                    onPress={() => handleOpenEditUser(user)}
                    accessibilityLabel="Edit Barangay"
                  >
                    <MaterialIcons name="edit-location-alt" size={18} color="#0D9488" />
                  </TouchableOpacity>

                  {/* Toggle Active/Inactive (Residents only) */}
                  {isResident && !isProtected && (
                    <TouchableOpacity
                      style={[styles.actionIconBtn, isInactive ? styles.actionIconBtnReactivate : styles.actionIconBtnDeactivate]}
                      onPress={() => handleToggleResidentStatus(user)}
                      accessibilityLabel={isInactive ? 'Reactivate resident' : 'Deactivate resident'}
                    >
                      <MaterialIcons
                        name={isInactive ? 'play-arrow' : 'pause'}
                        size={17}
                        color={isInactive ? '#15803D' : '#D97706'}
                      />
                    </TouchableOpacity>
                  )}

                  {/* Delete Button (protected for CICTO) */}
                  {!isProtected && (
                    <TouchableOpacity
                      style={[styles.actionIconBtn, styles.actionIconBtnDelete]}
                      onPress={() => handleOpenDelete(user)}
                      accessibilityLabel="Delete Account"
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

      {/* Edit Resident / Assign Barangay Modal */}
      <Modal visible={isEditUserModalOpen} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeaderRow}>
              <View style={styles.modalHeaderIconBadge}>
                <MaterialIcons name="location-city" size={24} color="#0D9488" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>User Sector & Profile</Text>
                <Text style={styles.modalSub}>
                  Assign or change registered Danao City Barangay sector for this account.
                </Text>
              </View>
              <TouchableOpacity
                style={styles.modalCloseIconBtn}
                onPress={() => setIsEditUserModalOpen(false)}
                disabled={isUpdatingBarangay}
              >
                <MaterialIcons name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            {editingUser && (
              <View style={styles.userInfoBox}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={styles.userInfoBoxName}>{editingUser.displayName || 'Unnamed User'}</Text>
                  <View style={styles.roleBadgeUser}>
                    <Text style={styles.roleBadgeTextUser}>
                      {editingUser.role ? editingUser.role.toUpperCase() : 'RESIDENT'}
                    </Text>
                  </View>
                </View>
                <Text style={styles.userInfoBoxEmail}>{editingUser.email}</Text>
                {editingUser.employeeId && (
                  <Text style={styles.userInfoBoxEmpId}>Employee ID: {editingUser.employeeId}</Text>
                )}
              </View>
            )}

            {/* Barangay Selector for 42 Barangays */}
            <View style={[styles.formGroup, { zIndex: 1000, position: 'relative' }]}>
              <Text style={styles.formLabel}>ASSIGNED BARANGAY (42 DANAO BARANGAYS) *</Text>
              <TouchableOpacity
                style={[
                  styles.dropdownBtn,
                  isEditModalBrgyDropdownOpen && styles.dropdownBtnActive,
                ]}
                onPress={() => setIsEditModalBrgyDropdownOpen(!isEditModalBrgyDropdownOpen)}
                activeOpacity={0.8}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                  <MaterialIcons name="location-on" size={18} color="#0D9488" />
                  <Text style={styles.dropdownBtnText} numberOfLines={1}>
                    {selectedBarangayForUser || 'Select Danao City Barangay'}
                  </Text>
                </View>
                <MaterialIcons
                  name={isEditModalBrgyDropdownOpen ? 'keyboard-arrow-up' : 'keyboard-arrow-down'}
                  size={20}
                  color="#64748B"
                />
              </TouchableOpacity>

              {isEditModalBrgyDropdownOpen && (
                <View style={styles.dropdownMenu}>
                  <View style={styles.dropdownSearchBox}>
                    <MaterialIcons name="search" size={16} color="#0D9488" />
                    <TextInput
                      style={styles.dropdownSearchInput}
                      placeholder="Type to filter barangays..."
                      placeholderTextColor="#94A3B8"
                      value={editModalBrgySearch}
                      onChangeText={setEditModalBrgySearch}
                      autoFocus
                    />
                    {editModalBrgySearch.trim() !== '' && (
                      <TouchableOpacity onPress={() => setEditModalBrgySearch('')}>
                        <MaterialIcons name="close" size={14} color="#94A3B8" />
                      </TouchableOpacity>
                    )}
                  </View>

                  <ScrollView
                    style={{ maxHeight: 220, ...(Platform.OS === 'web' ? ({ overflowY: 'auto' } as any) : {}) }}
                    contentContainerStyle={{ flexGrow: 1, paddingBottom: 6 }}
                    nestedScrollEnabled
                    showsVerticalScrollIndicator={true}
                    keyboardShouldPersistTaps="handled"
                  >
                    {/* Option to clear / unassign */}
                    <TouchableOpacity
                      style={[
                        styles.dropdownMenuItem,
                        !selectedBarangayForUser && styles.dropdownMenuItemSelected,
                      ]}
                      onPress={() => {
                        setSelectedBarangayForUser('');
                        setIsEditModalBrgyDropdownOpen(false);
                      }}
                    >
                      <Text style={styles.dropdownMenuItemText}>-- None (Unassigned) --</Text>
                      {!selectedBarangayForUser && (
                        <MaterialIcons name="check" size={16} color="#0D9488" />
                      )}
                    </TouchableOpacity>

                    {DANAO_CITY_BARANGAYS.filter((b) =>
                      b.toLowerCase().includes(editModalBrgySearch.trim().toLowerCase())
                    ).map((b) => {
                      const isSelected = selectedBarangayForUser === b;
                      return (
                        <TouchableOpacity
                          key={b}
                          style={[
                            styles.dropdownMenuItem,
                            isSelected && styles.dropdownMenuItemSelected,
                          ]}
                          onPress={() => {
                            setSelectedBarangayForUser(b);
                            setIsEditModalBrgyDropdownOpen(false);
                          }}
                        >
                          <Text
                            style={[
                              styles.dropdownMenuItemText,
                              isSelected && styles.dropdownMenuItemTextSelected,
                            ]}
                          >
                            {b}
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

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancel}
                onPress={() => setIsEditUserModalOpen(false)}
                disabled={isUpdatingBarangay}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalConfirm, isUpdatingBarangay && { opacity: 0.7 }]}
                onPress={handleSaveUserBarangay}
                disabled={isUpdatingBarangay}
              >
                {isUpdatingBarangay ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalConfirmText}>Save Changes</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

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
                  onPress={() => setShowCenroPassword((p) => !p)}
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
                    <ScrollView
                      style={{ maxHeight: 180, ...(Platform.OS === 'web' ? ({ overflowY: 'auto' } as any) : {}) }}
                      nestedScrollEnabled
                      showsVerticalScrollIndicator={true}
                      keyboardShouldPersistTaps="handled"
                    >
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
                    <ScrollView
                      style={{ maxHeight: 180, ...(Platform.OS === 'web' ? ({ overflowY: 'auto' } as any) : {}) }}
                      nestedScrollEnabled
                      showsVerticalScrollIndicator={true}
                      keyboardShouldPersistTaps="handled"
                    >
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
  content: { padding: 28, paddingBottom: 60 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
    gap: 16,
    flexWrap: 'wrap',
  },
  eyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
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
    maxWidth: 620,
    lineHeight: 18,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  staleCleanBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
  },
  staleCleanBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#DC2626',
  },
  provisionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#0D9488',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    boxShadow: '0 4px 6px -1px rgba(13, 148, 136, 0.25)',
  },
  provisionBtnText: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  filterSection: {
    marginBottom: 16,
    gap: 12,
    position: 'relative',
  },
  filterBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    alignItems: 'center',
    position: 'relative',
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
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : {}),
  },
  dropdownContainer: {
    position: 'relative',
  },
  filterDropdownBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    minWidth: 190,
    gap: 8,
  },
  filterDropdownBtnActive: {
    borderColor: '#0D9488',
    backgroundColor: '#F0FDFA',
  },
  filterDropdownBtnOpen: {
    borderColor: '#0D9488',
    boxShadow: '0 0 0 2px rgba(13, 148, 136, 0.15)',
  },
  dropdownBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  filterDropdownText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
    flex: 1,
  },
  filterDropdownTextActive: {
    color: '#0F766E',
    fontWeight: '800',
  },
  barangayDropdownMenu: {
    position: 'absolute',
    top: 44,
    left: 0,
    width: 270,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.1)',
    zIndex: 99999,
    elevation: 99999,
    overflow: 'hidden',
  },
  dropdownSearchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    backgroundColor: '#F8FAFC',
    gap: 6,
  },
  dropdownSearchInput: {
    flex: 1,
    fontSize: 12,
    color: '#0F172A',
    padding: 0,
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : {}),
  },
  barangayDropdownScroll: {
    maxHeight: 280,
    ...(Platform.OS === 'web'
      ? ({
          overflowY: 'auto',
          WebkitOverflowScrolling: 'touch',
        } as any)
      : {}),
  },
  barangayDropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
  },
  barangayDropdownItemSelected: {
    backgroundColor: '#F0FDFA',
  },
  barangayDropdownItemText: {
    fontSize: 12,
    color: '#334155',
    fontWeight: '500',
  },
  barangayDropdownItemTextSelected: {
    color: '#0D9488',
    fontWeight: '800',
  },
  dropdownDivider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 4,
  },
  countBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: '#F1F5F9',
  },
  countBadgeText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#64748B',
  },
  noDropdownMatchText: {
    padding: 16,
    textAlign: 'center',
    color: '#94A3B8',
    fontSize: 11.5,
    fontStyle: 'italic',
  },
  roleTabsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterGroup: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  filterChipActive: {
    backgroundColor: '#0D9488',
    borderColor: '#0D9488',
  },
  filterChipText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#64748B',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
  },
  roleChipBadge: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 5,
    backgroundColor: '#F1F5F9',
  },
  roleChipBadgeActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  roleChipBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
  },
  roleChipBadgeTextActive: {
    color: '#FFFFFF',
  },
  activeFilterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F0FDFA',
    borderWidth: 1,
    borderColor: '#CCFBF1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
    flexWrap: 'wrap',
  },
  activeFilterTags: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  activeFilterLabel: {
    fontSize: 10,
    fontWeight: '900',
    color: '#0F766E',
    letterSpacing: 0.8,
  },
  activeTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#CCFBF1',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  activeTagText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0F766E',
  },
  clearAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  clearAllBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  resultsSummaryRow: {
    marginBottom: 8,
    zIndex: 1,
  },
  resultsSummaryText: {
    fontSize: 11.5,
    color: '#64748B',
  },
  tableCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    overflow: 'hidden',
    zIndex: 1,
  },
  tableHead: {
    flexDirection: 'row',
    alignItems: 'center',
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
    gap: 4,
  },
  userAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  userAvatarCicto: {
    backgroundColor: '#CCFBF1',
  },
  userAvatarText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#475569',
  },
  userAvatarTextCicto: {
    color: '#0F766E',
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
  userSubInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginLeft: 40,
  },
  empIdBadge: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    backgroundColor: '#F0FDFA',
    borderWidth: 1,
    borderColor: '#CCFBF1',
  },
  empIdBadgeText: {
    fontSize: 9.5,
    color: '#0D9488',
    fontWeight: '800',
  },
  phoneText: {
    fontSize: 10.5,
    color: '#64748B',
  },
  barangayBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F0FDFA',
    borderWidth: 1,
    borderColor: '#CCFBF1',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
    maxWidth: 130,
  },
  barangayBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0F766E',
  },
  barangayUnassignedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  barangayUnassignedText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#94A3B8',
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
    fontWeight: '800',
  },
  inactivitySubText: {
    fontSize: 9.5,
    color: '#94A3B8',
    marginTop: 2,
  },
  actionsCell: {
    width: 120,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 4,
  },
  actionIconBtn: {
    padding: 6,
    borderRadius: 6,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  actionIconBtnDeactivate: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
  },
  actionIconBtnReactivate: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
  },
  actionIconBtnDelete: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  loaderContainer: {
    padding: 40,
    alignItems: 'center',
    gap: 12,
  },
  loaderText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
    gap: 8,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#334155',
    marginTop: 8,
  },
  emptySub: {
    fontSize: 12,
    color: '#94A3B8',
    maxWidth: 320,
    textAlign: 'center',
  },
  emptyResetBtn: {
    marginTop: 8,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#0D9488',
  },
  emptyResetBtnText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#FFFFFF',
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
  userInfoBox: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    padding: 12,
    gap: 4,
  },
  userInfoBoxName: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#0F172A',
  },
  userInfoBoxEmail: {
    fontSize: 11.5,
    color: '#64748B',
  },
  userInfoBoxEmpId: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0D9488',
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
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : {}),
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
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : {}),
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
    elevation: 99999,
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
