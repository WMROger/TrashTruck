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
import { db } from '../../../config/firebase';
import { provisionCenroOnSpark } from '../../../services/cenroProvisioningService';

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
  const [showPassword, setShowPassword] = useState(false);
  const [cenroFullName, setCenroFullName] = useState('');
  const [cenroContact, setCenroContact] = useState('');
  const [cenroEmployeeId, setCenroEmployeeId] = useState('');
  const [cenroDepartment, setCenroDepartment] = useState('CENRO Danao City - Solid Waste Management Office');
  const [cenroDesignation, setCenroDesignation] = useState('CENRO Administrator');

  useEffect(() => {
    if (!db) {
      setLoading(false);
      return;
    }

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
      },
      (error) => {
        console.error('Error listening to users collection:', error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
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
    setCenroEmail('');
    setCenroPassword('');
    setShowPassword(false);
    setCenroFullName('');
    setCenroContact('');
    setCenroEmployeeId(`CENRO-ADM-${String(cenroCount + 1).padStart(2, '0')}`);
    setCenroDepartment('CENRO Danao City - Solid Waste Management Office');
    setCenroDesignation('CENRO Administrator');
    setIsCenroModalOpen(true);
  };

  const handleCreateCenroSubmit = async () => {
    if (!cenroFullName.trim() || !cenroEmail.trim() || !cenroPassword.trim() || !cenroEmployeeId.trim()) {
      showAlert('Validation Error', 'Full Name, Email Address, Temporary Password, and Employee ID are required.');
      return;
    }

    if (cenroPassword.length < 12) {
      showAlert('Validation Error', 'Temporary password must be at least 12 characters.');
      return;
    }

    try {
      setIsSubmittingCenro(true);

      await provisionCenroOnSpark({
        mode: 'create',
        email: cenroEmail,
        password: cenroPassword,
        fullName: cenroFullName,
        contactInfo: cenroContact,
        employeeId: cenroEmployeeId,
        department: cenroDepartment,
        designation: cenroDesignation,
      });

      setIsCenroModalOpen(false);
      showAlert(
        'Success',
        `CENRO Admin account for ${cenroFullName} has been created successfully. A verification link has been sent to ${cenroEmail}.`
      );
    } catch (error: any) {
      console.error('Error provisioning CENRO account:', error);
      showAlert('Provisioning Error', error.message || 'Failed to provision CENRO account.');
    } finally {
      setIsSubmittingCenro(false);
    }
  };

  const showAlert = (title: string, message: string) => {
    if (Platform.OS === 'web') {
      window.alert(`${title}: ${message}`);
    } else {
      Alert.alert(title, message);
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
                <View style={styles.formGroupFull}>
                  <Text style={styles.formLabel}>FULL NAME *</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="e.g. Engr. Maria Teresa Santos"
                    value={cenroFullName}
                    onChangeText={setCenroFullName}
                  />
                </View>

                <View style={styles.formGroupHalf}>
                  <Text style={styles.formLabel}>OFFICIAL EMAIL (LOGIN) *</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="e.g. cenro.danao@gmail.com"
                    value={cenroEmail}
                    onChangeText={setCenroEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                </View>

                <View style={styles.formGroupHalf}>
                  <Text style={styles.formLabel}>TEMPORARY PASSWORD *</Text>
                  <View style={styles.passwordContainer}>
                    <TextInput
                      style={[styles.formInput, { paddingRight: 40 }]}
                      placeholder="At least 12 characters..."
                      value={cenroPassword}
                      onChangeText={setCenroPassword}
                      secureTextEntry={!showPassword}
                    />
                    <TouchableOpacity
                      style={styles.passwordToggle}
                      onPress={() => setShowPassword(!showPassword)}
                    >
                      <MaterialIcons
                        name={showPassword ? 'visibility-off' : 'visibility'}
                        size={18}
                        color="#6B7280"
                      />
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.formGroupHalf}>
                  <Text style={styles.formLabel}>EMPLOYEE ID *</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="e.g. CENRO-ADM-01"
                    value={cenroEmployeeId}
                    onChangeText={setCenroEmployeeId}
                    autoCapitalize="characters"
                  />
                </View>

                <View style={styles.formGroupHalf}>
                  <Text style={styles.formLabel}>CONTACT NUMBER</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="e.g. +63 912 345 6789"
                    value={cenroContact}
                    onChangeText={setCenroContact}
                  />
                </View>

                <View style={styles.formGroupFull}>
                  <Text style={styles.formLabel}>DEPARTMENT / OFFICE</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="Department"
                    value={cenroDepartment}
                    onChangeText={setCenroDepartment}
                  />
                </View>

                <View style={styles.formGroupFull}>
                  <Text style={styles.formLabel}>DESIGNATION / TITLE</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="Designation"
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
  passwordContainer: {
    position: 'relative',
    justifyContent: 'center',
  },
  passwordToggle: {
    position: 'absolute',
    right: 12,
    top: 12,
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
});
