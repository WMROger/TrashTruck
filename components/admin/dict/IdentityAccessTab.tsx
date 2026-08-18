import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { auth, db } from '../../../config/firebase';
import { provisionCenroOnSpark } from '../../../services/cenroProvisioningService';
import { isDictEmail, ensureDictProfileInFirestore } from '../../../constants/dictConfig';

interface UserData {
  id: string;
  email: string;
  displayName: string;
  role: string;
  verified: boolean;
  employeeId?: string;
  department?: string;
  designation?: string;
  contactInfo?: string;
  createdAt: any;
}

type RoleFilter = 'all' | 'admin' | 'coordinator' | 'driver' | 'user';

export default function IdentityAccessTab() {
  const { width } = useWindowDimensions();
  const isMobile = width < 768;

  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<RoleFilter>('all');

  // Create CENRO Modal state
  const [isCenroModalOpen, setIsCenroModalOpen] = useState(false);
  const [isSubmittingCenro, setIsSubmittingCenro] = useState(false);

  // New CENRO Form fields
  const [cenroEmail, setCenroEmail] = useState('');
  const [cenroPassword, setCenroPassword] = useState('');
  const [showPassword, setShowPassword] = useState(true);
  const [copiedPassword, setCopiedPassword] = useState(false);
  const [cenroContact, setCenroContact] = useState('');
  const [cenroDepartment, setCenroDepartment] = useState('CENRO Danao City - Solid Waste Management Office');
  const [cenroDesignation, setCenroDesignation] = useState('CENRO Administrator');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Result & Feedback Modal state
  const [resultModal, setResultModal] = useState<{
    visible: boolean;
    type: 'success' | 'error' | 'info';
    title: string;
    subtitle: string;
    email?: string;
    password?: string;
    copied?: boolean;
  }>({
    visible: false,
    type: 'success',
    title: '',
    subtitle: '',
  });

  const showFeedback = (
    title: string,
    subtitle: string,
    type: 'success' | 'error' | 'info' = 'info',
    extra?: { email?: string; password?: string }
  ) => {
    setResultModal({
      visible: true,
      type,
      title,
      subtitle,
      email: extra?.email,
      password: extra?.password,
      copied: false,
    });
  };

  const generateSecureCenroPassword = () => {
    const prefixes = ['Cenro@Danao', 'Cenro#Danao', 'Cenro!Eco', 'Cenro$Admin', 'Danao#Green'];
    const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    const suffixes = ['2026', 'Gov', 'PH', 'Sec'];
    const suffix = suffixes[Math.floor(Math.random() * suffixes.length)];
    return `${prefix}${randomNum}!${suffix}`;
  };

  const fetchUsers = () => {
    if (!db) {
      setLoading(false);
      return () => {};
    }

    setIsRefreshing(true);
    const q = query(collection(db, 'users'));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const userData: UserData[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          userData.push({
            id: doc.id,
            email: data.email || 'No email',
            displayName: data.displayName || data.name || 'Unnamed User',
            role: data.role || 'user',
            verified: data.verified || false,
            employeeId: data.employeeId || '',
            department: data.department || '',
            designation: data.designation || '',
            contactInfo: data.contactInfo || data.phone || '',
            createdAt: data.createdAt,
          });
        });

        userData.sort((a, b) => {
          const left = a.createdAt?.toMillis ? a.createdAt.toMillis() : new Date(a.createdAt || 0).getTime();
          const right = b.createdAt?.toMillis ? b.createdAt.toMillis() : new Date(b.createdAt || 0).getTime();
          return right - left;
        });

        setUsers(userData);
        setLoading(false);
        setIsRefreshing(false);
      },
      (error) => {
        console.error('Error listening to users collection:', error);
        setLoading(false);
        setIsRefreshing(false);
      }
    );

    return unsubscribe;
  };

  useEffect(() => {
    // Initial fetch + real-time listener
    const unsubscribe = fetchUsers();

    // Periodic 1-hour background scan
    const ONE_HOUR_MS = 60 * 60 * 1000;
    const interval = setInterval(() => {
      console.log('🔄 Executing 1-hour periodic directory re-scan...');
      fetchUsers();
    }, ONE_HOUR_MS);

    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
      clearInterval(interval);
    };
  }, []);

  // Filtered lists
  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (user.employeeId && user.employeeId.toLowerCase().includes(searchQuery.toLowerCase()));

    if (!matchesSearch) return false;
    if (activeFilter === 'all') return true;
    return user.role === activeFilter;
  });

  // Metrics
  const totalCount = users.length;
  const cenroCount = users.filter((u) => u.role === 'admin').length;
  const coordinatorCount = users.filter((u) => u.role === 'coordinator').length;
  const driverCount = users.filter((u) => u.role === 'driver').length;
  const residentCount = users.filter((u) => u.role === 'user').length;

  const handleOpenCreateCenro = () => {
    const autoPassword = generateSecureCenroPassword();
    setCenroEmail('');
    setCenroPassword(autoPassword);
    setShowPassword(true);
    setCopiedPassword(false);
    setCenroContact('');
    setCenroDepartment('CENRO Danao City - Solid Waste Management Office');
    setCenroDesignation('CENRO Administrator');
    setIsCenroModalOpen(true);
  };

  const handleRegeneratePassword = () => {
    const freshPassword = generateSecureCenroPassword();
    setCenroPassword(freshPassword);
    setCopiedPassword(false);
  };

  const handleCopyPassword = async () => {
    if (!cenroPassword) return;
    try {
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(cenroPassword);
      }
      setCopiedPassword(true);
      setTimeout(() => setCopiedPassword(false), 2000);
    } catch {
      setCopiedPassword(true);
      setTimeout(() => setCopiedPassword(false), 2000);
    }
  };

  const formatPhoneNumber = (text: string) => {
    let digits = text.replace(/\D/g, '');
    if (digits.startsWith('63')) {
      digits = digits.slice(2);
    }
    if (digits.startsWith('0')) {
      digits = digits.slice(1);
    }
    digits = digits.slice(0, 10);

    if (digits.length <= 3) {
      return digits;
    } else if (digits.length <= 6) {
      return `${digits.slice(0, 3)} ${digits.slice(3)}`;
    } else {
      return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
    }
  };

  const handleContactChange = (text: string) => {
    const formatted = formatPhoneNumber(text);
    setCenroContact(formatted);
  };

  const handleCreateCenroSubmit = async () => {
    if (!cenroEmail.trim() || !cenroPassword.trim()) {
      showFeedback('Validation Error', 'Official Email Address and Password are required.', 'error');
      return;
    }

    if (cenroPassword.length < 6) {
      showFeedback('Validation Error', 'Password must be at least 6 characters.', 'error');
      return;
    }

    const targetEmail = cenroEmail.trim();
    const targetPassword = cenroPassword;

    try {
      setIsSubmittingCenro(true);

      // Ensure DICT identity profile exists in Firestore (auto-heals if database was wiped)
      if (auth.currentUser && isDictEmail(auth.currentUser.email)) {
        await ensureDictProfileInFirestore(auth.currentUser.uid, auth.currentUser.email || 'dict@trashtrack.gov.ph');
      }

      const formattedContact = cenroContact.trim() ? `+63 ${cenroContact.trim()}` : '';

      await provisionCenroOnSpark({
        mode: 'create',
        email: targetEmail,
        password: targetPassword,
        fullName: 'CENRO Administrator',
        contactInfo: formattedContact,
        employeeId: 'CENRO-ADMIN',
        department: cenroDepartment,
        designation: cenroDesignation,
      });

      setIsCenroModalOpen(false);
      showFeedback(
        'Account Provisioned Successfully',
        `CENRO Administrator account created for ${targetEmail}. An official welcome email with login credentials and portal access instructions has been dispatched.`,
        'success',
        { email: targetEmail, password: targetPassword }
      );
    } catch (error: any) {
      console.error('Error provisioning CENRO account:', error);
      showFeedback('Provisioning Error', error.message || 'Failed to provision CENRO account.', 'error');
    } finally {
      setIsSubmittingCenro(false);
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'dict':
        return {
          label: 'DICT SUPER ADMIN',
          bg: '#EEF2FF',
          border: '#C7D2FE',
          text: '#4338CA',
          icon: 'security',
        };
      case 'admin':
        return {
          label: 'CENRO ADMIN',
          bg: '#ECFDF5',
          border: '#A7F3D0',
          text: '#047857',
          icon: 'admin-panel-settings',
        };
      case 'coordinator':
        return {
          label: 'COORDINATOR',
          bg: '#E0F2FE',
          border: '#BAE6FD',
          text: '#0369A1',
          icon: 'people',
        };
      case 'driver':
        return {
          label: 'TRUCK DRIVER',
          bg: '#FEF3C7',
          border: '#FDE68A',
          text: '#B45309',
          icon: 'local-shipping',
        };
      default:
        return {
          label: 'CITIZEN / RESIDENT',
          bg: '#F3F4F6',
          border: '#E5E7EB',
          text: '#4B5563',
          icon: 'person',
        };
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, isMobile && { padding: 16 }]}
      showsVerticalScrollIndicator={true}
    >
      {/* Header Bar */}
      <View style={[styles.header, isMobile && { flexDirection: 'column', gap: 16, alignItems: 'stretch' }]}>
        <View style={{ flex: 1 }}>
          <View style={styles.eyebrowRow}>
            <View style={styles.eyebrowBadge}>
              <MaterialIcons name="security" size={12} color="#4F46E5" />
              <Text style={styles.eyebrowText}>DICT SUPER ADMIN OVERSIGHT</Text>
            </View>
          </View>
          <Text style={styles.title}>Identity & Access Management</Text>
          <Text style={styles.subtitle}>
            Read-only supervision of system accounts and creation of CENRO administrators for Danao City waste operations.
          </Text>
        </View>

        <View style={[styles.headerActions, isMobile && { flexDirection: 'column', width: '100%' }]}>
          <TouchableOpacity
            style={styles.refreshActionBtn}
            onPress={() => fetchUsers()}
            disabled={isRefreshing}
            activeOpacity={0.85}
          >
            <MaterialIcons
              name="sync"
              size={18}
              color="#374151"
            />
            <Text style={styles.refreshActionBtnText}>
              {isRefreshing ? 'Scanning...' : 'Refresh Directory'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.primaryActionBtn}
            onPress={handleOpenCreateCenro}
            activeOpacity={0.85}
          >
            <MaterialIcons name="person-add" size={18} color="#FFFFFF" />
            <Text style={styles.primaryActionBtnText}>Create CENRO Account</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Metric Cards */}
      <View style={styles.statsGrid}>
        <View style={styles.statCard}>
          <View style={[styles.statIconBox, { backgroundColor: '#EEF2FF' }]}>
            <MaterialIcons name="group" size={22} color="#4F46E5" />
          </View>
          <View>
            <Text style={styles.statValue}>{totalCount}</Text>
            <Text style={styles.statLabel}>TOTAL DIRECTORY</Text>
          </View>
        </View>

        <View style={[styles.statCard, styles.statCardHighlighted]}>
          <View style={[styles.statIconBox, { backgroundColor: '#ECFDF5' }]}>
            <MaterialIcons name="admin-panel-settings" size={22} color="#059669" />
          </View>
          <View>
            <Text style={[styles.statValue, { color: '#047857' }]}>{cenroCount}</Text>
            <Text style={styles.statLabel}>CENRO ADMINS</Text>
          </View>
        </View>

        <View style={styles.statCard}>
          <View style={[styles.statIconBox, { backgroundColor: '#E0F2FE' }]}>
            <MaterialIcons name="people" size={22} color="#0284C7" />
          </View>
          <View>
            <Text style={styles.statValue}>{coordinatorCount}</Text>
            <Text style={styles.statLabel}>COORDINATORS</Text>
          </View>
        </View>

        <View style={styles.statCard}>
          <View style={[styles.statIconBox, { backgroundColor: '#FEF3C7' }]}>
            <MaterialIcons name="local-shipping" size={22} color="#D97706" />
          </View>
          <View>
            <Text style={styles.statValue}>{driverCount}</Text>
            <Text style={styles.statLabel}>TRUCK DRIVERS</Text>
          </View>
        </View>

        <View style={styles.statCard}>
          <View style={[styles.statIconBox, { backgroundColor: '#F3F4F6' }]}>
            <MaterialIcons name="person-outline" size={22} color="#6B7280" />
          </View>
          <View>
            <Text style={styles.statValue}>{residentCount}</Text>
            <Text style={styles.statLabel}>CITIZENS</Text>
          </View>
        </View>
      </View>

      {/* Role Delegation Info Box */}
      <View style={styles.delegationNoticeBox}>
        <MaterialIcons name="info-outline" size={20} color="#047857" style={{ marginTop: 2 }} />
        <View style={{ flex: 1 }}>
          <Text style={styles.delegationNoticeTitle}>Role Delegation & System Architecture</Text>
          <Text style={styles.delegationNoticeDesc}>
            DICT oversees the municipal deployment and creates the <Text style={{ fontWeight: '700' }}>CENRO Administrator</Text> account.
            Once provisioned, CENRO is empowered to set collection schedules, onboard truck drivers, and appoint barangay environmental coordinators.
          </Text>
        </View>
      </View>

      {/* Directory Card */}
      <View style={[styles.card, isMobile && { padding: 14 }]}>
        {/* Toolbar & Filter Pills */}
        <View style={styles.toolbar}>
          <View style={[styles.searchContainer, isMobile && { maxWidth: '100%', width: '100%' }]}>
            <MaterialIcons name="search" size={20} color="#9CA3AF" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search by name, email, or employee ID..."
              placeholderTextColor="#9CA3AF"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <MaterialIcons name="close" size={18} color="#9CA3AF" />
              </TouchableOpacity>
            )}
          </View>

          {/* Filter Pills */}
          <ScrollView
            horizontal={true}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterPillsContainer}
          >
            {[
              { id: 'all', label: `All (${totalCount})` },
              { id: 'admin', label: `CENRO (${cenroCount})` },
              { id: 'coordinator', label: `Coordinators (${coordinatorCount})` },
              { id: 'driver', label: `Drivers (${driverCount})` },
              { id: 'user', label: `Citizens (${residentCount})` },
            ].map((pill) => {
              const isActive = activeFilter === pill.id;
              return (
                <TouchableOpacity
                  key={pill.id}
                  style={[styles.filterPill, isActive && styles.filterPillActive]}
                  onPress={() => setActiveFilter(pill.id as RoleFilter)}
                >
                  <Text style={[styles.filterPillText, isActive && styles.filterPillTextActive]}>
                    {pill.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* User Table (Read-Only) */}
        <View style={styles.tableContainer}>
          <ScrollView
            horizontal={isMobile}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ flexGrow: 1, minWidth: '100%' }}
            style={{ width: '100%' }}
          >
            <View style={{ minWidth: isMobile ? 650 : '100%', width: '100%' }}>
              <View style={styles.tableHeader}>
                <Text style={[styles.tableHeaderText, { flex: 2.5 }]}>USER / OFFICER</Text>
                <Text style={[styles.tableHeaderText, { flex: 2.2 }]}>EMAIL</Text>
                <Text style={[styles.tableHeaderText, { flex: 1.8 }]}>SYSTEM ROLE</Text>
                <Text style={[styles.tableHeaderText, { flex: 1.2, textAlign: 'right' }]}>STATUS</Text>
              </View>

              {loading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color="#4F46E5" />
                  <Text style={styles.loadingText}>Synchronizing user directory...</Text>
                </View>
              ) : filteredUsers.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <MaterialIcons name="person-search" size={48} color="#D1D5DB" />
                  <Text style={styles.emptyTitle}>No matching accounts found</Text>
                  <Text style={styles.emptySubtitle}>Try changing your search query or role filter.</Text>
                </View>
              ) : (
                filteredUsers.map((user) => {
                  const badge = getRoleBadge(user.role);

                  return (
                    <View key={user.id} style={styles.tableRow}>
                      {/* Name & Avatar */}
                      <View style={[styles.tableCell, { flex: 2.5, flexDirection: 'row', alignItems: 'center' }]}>
                        <View style={[styles.avatar, { backgroundColor: `${badge.text}15` }]}>
                          <Text style={[styles.avatarText, { color: badge.text }]}>
                            {user.displayName.charAt(0).toUpperCase()}
                          </Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.cellTextPrimary}>{user.displayName}</Text>
                          {user.employeeId ? (
                            <Text style={styles.cellTextSubtitle}>
                              ID: {user.employeeId} {user.designation ? `· ${user.designation}` : ''}
                            </Text>
                          ) : (
                            <Text style={styles.cellTextSubtitle}>Resident Member</Text>
                          )}
                        </View>
                      </View>

                      {/* Email */}
                      <View style={[styles.tableCell, { flex: 2.2 }]}>
                        <Text style={styles.cellTextSecondary}>{user.email}</Text>
                      </View>

                      {/* Role Badge */}
                      <View style={[styles.tableCell, { flex: 1.8 }]}>
                        <View
                          style={[
                            styles.roleBadge,
                            { backgroundColor: badge.bg, borderColor: badge.border },
                          ]}
                        >
                          <MaterialIcons name={badge.icon as any} size={13} color={badge.text} />
                          <Text style={[styles.roleText, { color: badge.text }]}>{badge.label}</Text>
                        </View>
                      </View>

                      {/* Status */}
                      <View style={[styles.tableCell, { flex: 1.2, alignItems: 'flex-end' }]}>
                        {user.verified ? (
                          <View style={styles.statusBadge}>
                            <MaterialIcons name="check-circle" size={14} color="#10B981" />
                            <Text style={styles.statusTextVerified}>Verified</Text>
                          </View>
                        ) : (
                          <View style={styles.statusBadge}>
                            <MaterialIcons name="pending" size={14} color="#F59E0B" />
                            <Text style={styles.statusTextPending}>Pending</Text>
                          </View>
                        )}
                      </View>
                    </View>
                  );
                })
              )}
            </View>
          </ScrollView>
        </View>
      </View>

      {/* CREATE CENRO MODAL */}
      <Modal visible={isCenroModalOpen} transparent={true} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, isMobile && { width: '95%', padding: 16 }]}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={styles.modalHeaderIcon}>
                  <MaterialIcons name="admin-panel-settings" size={22} color="#059669" />
                </View>
                <View>
                  <Text style={styles.modalTitle}>Create CENRO Admin Account</Text>
                  <Text style={styles.modalSubtitle}>
                    Provision municipal administration account for Danao City waste operations.
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                onPress={() => setIsCenroModalOpen(false)}
                disabled={isSubmittingCenro}
                style={styles.modalCloseBtn}
              >
                <MaterialIcons name="close" size={20} color="#6B7280" />
              </TouchableOpacity>
            </View>

            {/* Modal Body Scroll */}
            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              <View style={styles.formGrid}>
                <View style={styles.formGroupHalf}>
                  <Text style={styles.formLabel}>OFFICIAL EMAIL (LOGIN) *</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="e.g. cenro.danao@gmail.com"
                    placeholderTextColor="#9CA3AF"
                    value={cenroEmail}
                    onChangeText={setCenroEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                </View>

                <View style={styles.formGroupHalf}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <Text style={styles.formLabel}>AUTO-GENERATED PASSWORD *</Text>
                    <TouchableOpacity
                      onPress={handleRegeneratePassword}
                      style={styles.pwdInlineBtn}
                      activeOpacity={0.7}
                    >
                      <MaterialIcons name="refresh" size={13} color="#059669" />
                      <Text style={styles.pwdInlineBtnText}>Regenerate</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={styles.passwordContainer}>
                    <TextInput
                      style={[
                        styles.formInput,
                        {
                          paddingRight: 80,
                          fontFamily: Platform.OS === 'web' ? 'monospace' : undefined,
                          fontWeight: '700',
                          letterSpacing: 0.5,
                          backgroundColor: '#F0FDF4',
                          borderColor: '#BBF7D0',
                          color: '#065F46',
                        },
                      ]}
                      placeholder="Generating secure password..."
                      placeholderTextColor="#9CA3AF"
                      value={cenroPassword}
                      onChangeText={setCenroPassword}
                      secureTextEntry={!showPassword}
                    />
                    <View style={styles.passwordActions}>
                      <TouchableOpacity
                        style={styles.pwdIconBtn}
                        onPress={handleCopyPassword}
                        activeOpacity={0.7}
                      >
                        <MaterialIcons
                          name={copiedPassword ? 'check' : 'content-copy'}
                          size={16}
                          color={copiedPassword ? '#059669' : '#6B7280'}
                        />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.pwdIconBtn}
                        onPress={() => setShowPassword(!showPassword)}
                        activeOpacity={0.7}
                      >
                        <MaterialIcons
                          name={showPassword ? 'visibility-off' : 'visibility'}
                          size={16}
                          color="#6B7280"
                        />
                      </TouchableOpacity>
                    </View>
                  </View>
                  <Text style={styles.pwdHintText}>
                    {copiedPassword ? '✓ Copied to clipboard!' : '✉ This password & portal access will be emailed to the administrator.'}
                  </Text>
                </View>

                <View style={styles.formGroupFull}>
                  <Text style={styles.formLabel}>CONTACT NUMBER</Text>
                  <View style={styles.phoneInputContainer}>
                    <View style={styles.phonePrefixBox}>
                      <Text style={styles.phonePrefixFlag}>🇵🇭</Text>
                      <Text style={styles.phonePrefixText}>+63</Text>
                    </View>
                    <TextInput
                      style={styles.phoneInput}
                      placeholder="9XX XXX XXXX"
                      placeholderTextColor="#9CA3AF"
                      value={cenroContact}
                      onChangeText={handleContactChange}
                      keyboardType="phone-pad"
                      maxLength={12}
                    />
                  </View>
                </View>

                <View style={styles.formGroupFull}>
                  <Text style={styles.formLabel}>DEPARTMENT / OFFICE</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="e.g. CENRO Danao City - Solid Waste Management Office"
                    placeholderTextColor="#9CA3AF"
                    value={cenroDepartment}
                    onChangeText={setCenroDepartment}
                  />
                </View>

                <View style={styles.formGroupFull}>
                  <Text style={styles.formLabel}>DESIGNATION / TITLE</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="e.g. CENRO Administrator"
                    placeholderTextColor="#9CA3AF"
                    value={cenroDesignation}
                    onChangeText={setCenroDesignation}
                  />
                </View>
              </View>

              {/* Informational Privilege Banner */}
              <View style={styles.modalInfoBanner}>
                <MaterialIcons name="verified-user" size={18} color="#047857" style={{ marginTop: 1 }} />
                <Text style={styles.modalInfoBannerText}>
                  This CENRO Administrator will have municipal authority in Danao City to configure collection schedules, onboard drivers, and appoint environmental coordinators.
                </Text>
              </View>
            </ScrollView>

            {/* Modal Actions */}
            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setIsCenroModalOpen(false)}
                disabled={isSubmittingCenro}
              >
                <Text style={styles.modalCancelBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalSubmitBtn}
                onPress={handleCreateCenroSubmit}
                disabled={isSubmittingCenro}
              >
                {isSubmittingCenro ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <MaterialIcons name="check" size={18} color="#FFFFFF" />
                    <Text style={styles.modalSubmitBtnText}>Provision CENRO Account</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* RESULT & NOTIFICATION POPUP DIALOG */}
      <Modal visible={resultModal.visible} transparent={true} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.resultModalContent, isMobile && { width: '92%', padding: 20 }]}>
            <View
              style={[
                styles.resultIconCircle,
                resultModal.type === 'success'
                  ? styles.resultIconSuccess
                  : styles.resultIconError,
              ]}
            >
              <MaterialIcons
                name={resultModal.type === 'success' ? 'check-circle' : 'error-outline'}
                size={40}
                color={resultModal.type === 'success' ? '#059669' : '#DC2626'}
              />
            </View>

            <Text style={styles.resultTitle}>{resultModal.title}</Text>
            <Text style={styles.resultSubtitle}>{resultModal.subtitle}</Text>

            {resultModal.type === 'success' && resultModal.email && (
              <View style={styles.resultCredentialsBox}>
                <View style={styles.resultCredRow}>
                  <Text style={styles.resultCredLabel}>OFFICIAL EMAIL:</Text>
                  <Text style={styles.resultCredValue}>{resultModal.email}</Text>
                </View>
                {resultModal.password && (
                  <View style={styles.resultCredRow}>
                    <Text style={styles.resultCredLabel}>PASSWORD:</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Text style={styles.resultCredPassword}>{resultModal.password}</Text>
                      <TouchableOpacity
                        style={styles.resultCopyBtn}
                        onPress={() => {
                          if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
                            navigator.clipboard.writeText(resultModal.password || '');
                          }
                          setResultModal((prev) => ({ ...prev, copied: true }));
                          setTimeout(() => setResultModal((prev) => ({ ...prev, copied: false })), 2000);
                        }}
                      >
                        <MaterialIcons
                          name={resultModal.copied ? 'check' : 'content-copy'}
                          size={13}
                          color={resultModal.copied ? '#059669' : '#374151'}
                        />
                        <Text style={[styles.resultCopyText, resultModal.copied && { color: '#059669' }]}>
                          {resultModal.copied ? 'Copied' : 'Copy'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
                <View style={styles.resultCredRow}>
                  <Text style={styles.resultCredLabel}>PORTAL ACCESS:</Text>
                  <Text style={[styles.resultCredValue, { color: '#059669', fontWeight: '800' }]}>
                    /cenro (CENRO Portal)
                  </Text>
                </View>
              </View>
            )}

            <TouchableOpacity
              style={[
                styles.resultActionBtn,
                resultModal.type === 'error' && { backgroundColor: '#DC2626' },
              ]}
              onPress={() => setResultModal((prev) => ({ ...prev, visible: false }))}
              activeOpacity={0.85}
            >
              <Text style={styles.resultActionBtnText}>
                {resultModal.type === 'success' ? 'Done / Return to Directory' : 'Dismiss'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  content: {
    padding: 32,
    paddingBottom: 64,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  eyebrowRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  eyebrowBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: '#EEF2FF',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  eyebrowText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#4338CA',
    letterSpacing: 0.8,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 6,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    color: '#4B5563',
    lineHeight: 20,
    maxWidth: 680,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  refreshActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  refreshActionBtnText: {
    color: '#374151',
    fontSize: 13,
    fontWeight: '600',
  },
  primaryActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#059669',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  primaryActionBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.2,
  },

  // Stats Grid
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    minWidth: 160,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  statCardHighlighted: {
    borderColor: '#A7F3D0',
    backgroundColor: '#F0FDF4',
  },
  statIconBox: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statValue: {
    fontSize: 22,
    fontWeight: '800',
    color: '#111827',
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#6B7280',
    letterSpacing: 0.6,
    marginTop: 2,
  },

  // Delegation Notice
  delegationNoticeBox: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  delegationNoticeTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#065F46',
    marginBottom: 2,
  },
  delegationNoticeDesc: {
    fontSize: 12,
    color: '#047857',
    lineHeight: 18,
  },

  // Card & Table
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
    overflow: 'hidden',
  },
  toolbar: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 42,
    maxWidth: 360,
    flex: 1,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 13,
    color: '#111827',
  },
  filterPillsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  filterPill: {
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  filterPillActive: {
    backgroundColor: '#047857',
    borderColor: '#047857',
  },
  filterPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4B5563',
  },
  filterPillTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },

  tableContainer: {
    flex: 1,
  },
  tableHeader: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: '#F9FAFB',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  tableHeaderText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6B7280',
    letterSpacing: 0.5,
  },
  tableRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    alignItems: 'center',
  },
  tableCell: {
    justifyContent: 'center',
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontSize: 15,
    fontWeight: '800',
  },
  cellTextPrimary: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  cellTextSubtitle: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 2,
  },
  cellTextSecondary: {
    fontSize: 13,
    color: '#4B5563',
  },

  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  roleText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },

  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  statusTextVerified: {
    fontSize: 12,
    fontWeight: '600',
    color: '#059669',
  },
  statusTextPending: {
    fontSize: 12,
    fontWeight: '600',
    color: '#D97706',
  },

  loadingContainer: {
    padding: 60,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '500',
  },
  emptyContainer: {
    padding: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#374151',
    marginTop: 12,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#9CA3AF',
    marginTop: 4,
  },

  // MODAL STYLES
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(17, 24, 39, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    width: '100%',
    maxWidth: 600,
    maxHeight: '90%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.2,
    shadowRadius: 30,
    elevation: 10,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  modalHeaderIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#111827',
  },
  modalSubtitle: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  modalCloseBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
  },

  modalBody: {
    padding: 20,
  },
  formGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
  },
  formGroupFull: {
    width: '100%',
  },
  formGroupHalf: {
    width: '48%',
    flex: 1,
    minWidth: 240,
  },
  formLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#374151',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  formInput: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 13,
    color: '#111827',
  },
  phoneInputContainer: {
    flexDirection: 'row',
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    overflow: 'hidden',
    alignItems: 'center',
  },
  phonePrefixBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRightWidth: 1,
    borderRightColor: '#E5E7EB',
  },
  phonePrefixFlag: {
    fontSize: 14,
  },
  phonePrefixText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#374151',
  },
  phoneInput: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 13,
    color: '#111827',
  },
  passwordContainer: {
    position: 'relative',
    justifyContent: 'center',
  },
  passwordActions: {
    position: 'absolute',
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  pwdIconBtn: {
    padding: 6,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
  },
  pwdInlineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: '#ECFDF5',
  },
  pwdInlineBtnText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#059669',
  },
  pwdHintText: {
    fontSize: 10,
    color: '#059669',
    marginTop: 4,
    fontWeight: '600',
  },

  modalInfoBanner: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#DCFCE7',
    borderRadius: 10,
    padding: 12,
    marginTop: 16,
  },
  modalInfoBannerText: {
    fontSize: 11,
    color: '#166534',
    lineHeight: 16,
    flex: 1,
  },

  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  modalCancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  modalCancelBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4B5563',
  },
  modalSubmitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#059669',
  },
  modalSubmitBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // RESULT MODAL STYLES
  resultModalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 28,
    width: 440,
    maxWidth: '95%',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
  resultIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  resultIconSuccess: {
    backgroundColor: '#ECFDF5',
    borderWidth: 2,
    borderColor: '#A7F3D0',
  },
  resultIconError: {
    backgroundColor: '#FEF2F2',
    borderWidth: 2,
    borderColor: '#FECACA',
  },
  resultTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 8,
  },
  resultSubtitle: {
    fontSize: 13,
    color: '#4B5563',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
  },
  resultCredentialsBox: {
    width: '100%',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
    gap: 10,
  },
  resultCredRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  resultCredLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.5,
  },
  resultCredValue: {
    fontSize: 13,
    color: '#1E293B',
    fontWeight: '600',
  },
  resultCredPassword: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0369A1',
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  resultCopyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
    backgroundColor: '#E2E8F0',
  },
  resultCopyText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#374151',
  },
  resultActionBtn: {
    width: '100%',
    backgroundColor: '#059669',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultActionBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
