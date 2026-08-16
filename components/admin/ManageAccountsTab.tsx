import { MaterialIcons } from '@expo/vector-icons';
import { collection, doc, endAt, getDocs, limit, orderBy, query, serverTimestamp, startAt, updateDoc } from 'firebase/firestore';
import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { db } from '../../config/firebase';
import ErrorModal from '../ErrorModal';

type UserRow = {
  id: string;
  email: string;
  role: string;
  displayName?: string;
  createdAt?: any;
};

const ManageAccountsTab: React.FC = () => {
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [busyMap, setBusyMap] = useState<Record<string, boolean>>({});
  const [errorModal, setErrorModal] = useState({
    visible: false,
    title: 'Error',
    message: '',
    type: 'error' as 'error' | 'warning' | 'info' | 'success',
  });
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(5);
  
  // Sorting and filtering state
  const [sortBy, setSortBy] = useState<'name' | 'email' | 'role' | 'createdAt'>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [roleFilter, setRoleFilter] = useState<'all' | 'user' | 'driver'>('all');
  
  // Role change confirmation modal state
  const [showRoleChangeModal, setShowRoleChangeModal] = useState(false);
  const [roleChangeTarget, setRoleChangeTarget] = useState<{
    userId: string;
    email: string;
    currentRole: string;
    newRole: 'user' | 'driver';
  } | null>(null);

  // Show error modal
  const showError = (message: string, title = 'Error', type: 'error' | 'warning' | 'info' | 'success' = 'error') => {
    setErrorModal({
      visible: true,
      title,
      message,
      type,
    });
  };

  // Close error modal
  const closeErrorModal = () => {
    setErrorModal(prev => ({ ...prev, visible: false }));
  };

  // Show role change confirmation modal
  const showRoleChangeConfirmation = (userId: string, email: string, currentRole: string, newRole: 'user' | 'driver') => {
    setRoleChangeTarget({
      userId,
      email,
      currentRole,
      newRole,
    });
    setShowRoleChangeModal(true);
  };

  // Hide role change confirmation modal
  const hideRoleChangeConfirmation = () => {
    setShowRoleChangeModal(false);
    setRoleChangeTarget(null);
  };

  // Confirm role change
  const confirmRoleChange = () => {
    if (roleChangeTarget) {
      setRole(roleChangeTarget.userId, roleChangeTarget.newRole);
      hideRoleChangeConfirmation();
    }
  };

  const normalizedQuery = useMemo(() => (search || '').trim().toLowerCase(), [search]);

  // Filter and sort users
  const filteredAndSortedUsers = useMemo(() => {
    let filtered = users;

    // Apply role filter
    if (roleFilter !== 'all') {
      filtered = filtered.filter(user => user.role === roleFilter);
    }

    // Apply search filter
    if (normalizedQuery) {
      filtered = filtered.filter(user => 
        user.email.toLowerCase().includes(normalizedQuery) ||
        (user.displayName && user.displayName.toLowerCase().includes(normalizedQuery))
      );
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let aValue, bValue;
      
      switch (sortBy) {
        case 'name':
          aValue = (a.displayName || a.email || '').toLowerCase();
          bValue = (b.displayName || b.email || '').toLowerCase();
          break;
        case 'email':
          aValue = (a.email || '').toLowerCase();
          bValue = (b.email || '').toLowerCase();
          break;
        case 'role':
          aValue = (a.role || '').toLowerCase();
          bValue = (b.role || '').toLowerCase();
          break;
        case 'createdAt':
          aValue = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(0);
          bValue = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(0);
          break;
        default:
          return 0;
      }

      if (sortBy === 'createdAt') {
        return sortOrder === 'asc' 
          ? aValue.getTime() - bValue.getTime()
          : bValue.getTime() - aValue.getTime();
      } else {
        if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1;
        return 0;
      }
    });

    return filtered;
  }, [users, roleFilter, normalizedQuery, sortBy, sortOrder]);

  // Pagination calculations
  const totalPages = Math.ceil(filteredAndSortedUsers.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentUsers = filteredAndSortedUsers.slice(startIndex, endIndex);

  // Reset to first page when search, filter, or sort changes
  useEffect(() => {
    setCurrentPage(1);
  }, [search, roleFilter, sortBy, sortOrder]);

  const fetchUsers = async () => {
    if (!db) return;
    setLoading(true);
    try {
      const usersRef = collection(db, 'users');
      let q;
      if (normalizedQuery) {
        // Basic email prefix search (requires email to be stored/lowercased)
        const start = normalizedQuery;
        const end = normalizedQuery + '\uf8ff';
        q = query(usersRef, orderBy('email'), startAt(start), endAt(end), limit(50));
      } else {
        q = query(usersRef, orderBy('createdAt', 'desc'), limit(50));
      }
      const snap = await getDocs(q);
      const rows: UserRow[] = snap.docs.map((d) => {
        const data: any = d.data();
        return {
          id: d.id,
          email: (data?.email || '').toString(),
          role: (data?.role || 'user').toString(),
          displayName: (data?.displayName || '').toString(),
          createdAt: data?.createdAt,
        };
      }).filter((u) => (u.role || '').toLowerCase() !== 'admin');
      setUsers(rows);
    } catch (e) {
      showError('Failed to load users', 'Loading Error', 'error');
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setRole = async (userId: string, nextRole: 'user' | 'driver') => {
    if (!db) return;
    setBusyMap((m) => ({ ...m, [userId]: true }));
    
    try {
      await updateDoc(doc(db, 'users', userId), {
        role: nextRole,
        updatedAt: serverTimestamp(),
      });
      setUsers((list) => list.map((u) => (u.id === userId ? { ...u, role: nextRole } : u)));
      showError(`Role updated to ${nextRole}`, 'Success', 'success');
    } catch (e) {
      console.error('Role update failed:', e);
      showError('Failed to update role', 'Update Error', 'error');
    } finally {
      setBusyMap((m) => ({ ...m, [userId]: false }));
    }
  };

  const renderItem = ({ item }: { item: UserRow }) => {
    const isBusy = !!busyMap[item.id];
    const isAdmin = (item.role || '').toLowerCase() === 'admin';
    return (
      <View style={styles.row}>
        <View style={styles.rowInfo}>
          <Text style={styles.email}>{item.email || item.id}</Text>
          <Text style={styles.meta}>{item.displayName || ''}</Text>
        </View>
        <View style={styles.actions}>
          <Text style={styles.role}>Role: {item.role}</Text>
          <View style={styles.buttons}>
            <TouchableOpacity disabled={isBusy || isAdmin} onPress={() => showRoleChangeConfirmation(item.id, item.email, item.role, 'user')} style={[styles.btn, styles.btnLight, (isBusy || isAdmin) && { opacity: 0.6 }]}>
              <Text style={styles.btnText}>User</Text>
            </TouchableOpacity>
            <TouchableOpacity disabled={isBusy || isAdmin} onPress={() => showRoleChangeConfirmation(item.id, item.email, item.role, 'driver')} style={[styles.btn, styles.btnPrimary, (isBusy || isAdmin) && { opacity: 0.6 }]}>
              <Text style={styles.btnText}>Driver</Text>
            </TouchableOpacity>
           
          </View>
        </View>
      </View>
    );
  };

  return (
    <ScrollView style={styles.scrollContainer} contentContainerStyle={styles.scrollContent}>
      <View style={styles.container}>
      <Text style={styles.title}>Manage Accounts</Text>
      <View style={styles.searchRow}>
        <TextInput
          style={styles.input}
          placeholder="Search by email"
          autoCapitalize="none"
          value={search}
          onChangeText={setSearch}
          onSubmitEditing={fetchUsers}
        />
        <TouchableOpacity onPress={fetchUsers} style={styles.searchBtn} activeOpacity={0.85}>
          <Text style={styles.searchBtnText}>{loading ? 'Loading...' : 'Search'}</Text>
        </TouchableOpacity>
      </View>

      {/* Sort and Filter Controls */}
      <View style={styles.controlsContainer}>
        <View style={styles.controlRow}>
          <Text style={styles.controlLabel}>Sort by:</Text>
          <View style={styles.sortControls}>
            <TouchableOpacity
              style={[styles.sortButton, sortBy === 'name' && styles.sortButtonActive]}
              onPress={() => setSortBy('name')}
            >
              <Text style={[styles.sortButtonText, sortBy === 'name' && styles.sortButtonTextActive]}>
                Name
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.sortButton, sortBy === 'email' && styles.sortButtonActive]}
              onPress={() => setSortBy('email')}
            >
              <Text style={[styles.sortButtonText, sortBy === 'email' && styles.sortButtonTextActive]}>
                Email
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.sortButton, sortBy === 'role' && styles.sortButtonActive]}
              onPress={() => setSortBy('role')}
            >
              <Text style={[styles.sortButtonText, sortBy === 'role' && styles.sortButtonTextActive]}>
                Role
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.sortButton, sortBy === 'createdAt' && styles.sortButtonActive]}
              onPress={() => setSortBy('createdAt')}
            >
              <Text style={[styles.sortButtonText, sortBy === 'createdAt' && styles.sortButtonTextActive]}>
                Date
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.controlRow}>
          <Text style={styles.controlLabel}>Order:</Text>
          <View style={styles.orderControls}>
            <TouchableOpacity
              style={[styles.orderButton, sortOrder === 'asc' && styles.orderButtonActive]}
              onPress={() => setSortOrder('asc')}
            >
              <Text style={[styles.orderButtonText, sortOrder === 'asc' && styles.orderButtonTextActive]}>
                A-Z
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.orderButton, sortOrder === 'desc' && styles.orderButtonActive]}
              onPress={() => setSortOrder('desc')}
            >
              <Text style={[styles.orderButtonText, sortOrder === 'desc' && styles.orderButtonTextActive]}>
                Z-A
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.controlRow}>
          <Text style={styles.controlLabel}>Filter:</Text>
          <View style={styles.filterControls}>
            <TouchableOpacity
              style={[styles.filterButton, roleFilter === 'all' && styles.filterButtonActive]}
              onPress={() => setRoleFilter('all')}
            >
              <Text style={[styles.filterButtonText, roleFilter === 'all' && styles.filterButtonTextActive]}>
                All
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.filterButton, roleFilter === 'user' && styles.filterButtonActive]}
              onPress={() => setRoleFilter('user')}
            >
              <Text style={[styles.filterButtonText, roleFilter === 'user' && styles.filterButtonTextActive]}>
                Users
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.filterButton, roleFilter === 'driver' && styles.filterButtonActive]}
              onPress={() => setRoleFilter('driver')}
            >
              <Text style={[styles.filterButtonText, roleFilter === 'driver' && styles.filterButtonTextActive]}>
                Drivers
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <FlatList
        data={currentUsers}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        contentContainerStyle={{ paddingVertical: 8 }}
      />

      {/* Pagination Controls */}
      {users.length > 0 && (
        <View style={styles.paginationContainer}>
          <View style={styles.paginationInfo}>
            <Text style={styles.paginationText}>
              Showing {startIndex + 1}-{Math.min(endIndex, filteredAndSortedUsers.length)} of {filteredAndSortedUsers.length} accounts
            </Text>
          </View>
          
          <View style={styles.paginationControls}>
            <TouchableOpacity
              style={[styles.paginationButton, currentPage === 1 && styles.paginationButtonDisabled]}
              onPress={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
            >
              <Text style={[styles.paginationButtonText, currentPage === 1 && styles.paginationButtonTextDisabled]}>
                Previous
              </Text>
            </TouchableOpacity>

            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              style={styles.pageNumbersScrollView}
              contentContainerStyle={styles.pageNumbersContainer}
            >
              {Array.from({ length: totalPages }, (_, i) => {
                const pageNum = i + 1;
                
                return (
                  <TouchableOpacity
                    key={pageNum}
                    style={[
                      styles.pageNumberButton,
                      currentPage === pageNum && styles.pageNumberButtonActive
                    ]}
                    onPress={() => setCurrentPage(pageNum)}
                  >
                    <Text style={[
                      styles.pageNumberText,
                      currentPage === pageNum && styles.pageNumberTextActive
                    ]}>
                      {pageNum}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <TouchableOpacity
              style={[styles.paginationButton, currentPage === totalPages && styles.paginationButtonDisabled]}
              onPress={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
            >
              <Text style={[styles.paginationButtonText, currentPage === totalPages && styles.paginationButtonTextDisabled]}>
                Next
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Role Change Confirmation Modal */}
      <Modal
        visible={showRoleChangeModal}
        transparent={true}
        animationType="fade"
        onRequestClose={hideRoleChangeConfirmation}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <MaterialIcons name="person-outline" size={24} color="#2E8B57" />
              <Text style={styles.modalTitle}>Confirm Role Change</Text>
            </View>
            
            <View style={styles.modalContent}>
              <Text style={styles.modalMessage}>
                Are you sure you want to change this user’s role?
              </Text>
              
              {roleChangeTarget && (
                <View style={styles.userInfo}>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>User:</Text>
                    <Text style={styles.infoValue}>{roleChangeTarget.email}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Current Role:</Text>
                    <Text style={styles.infoValue}>{roleChangeTarget.currentRole}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>New Role:</Text>
                    <Text style={[styles.infoValue, styles.newRoleValue]}>{roleChangeTarget.newRole}</Text>
                  </View>
                </View>
              )}
              
              <Text style={styles.warningText}>
                This will immediately update the user’s permissions.
              </Text>
            </View>
            
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={hideRoleChangeConfirmation}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.confirmButton]}
                onPress={confirmRoleChange}
              >
                <Text style={styles.confirmButtonText}>Confirm</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Error Modal */}
      <ErrorModal
        visible={errorModal.visible}
        title={errorModal.title}
        message={errorModal.message}
        type={errorModal.type}
        onClose={closeErrorModal}
        autoClose={true}
        autoCloseDelay={4000}
      />
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  scrollContainer: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollContent: {
    flexGrow: 1,
    padding: 16,
  },
  container: {
    backgroundColor: '#E3F0E3',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#8FB497',
    padding: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#242E21',
    marginBottom: 12,
  },
  searchRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  input: {
    flex: 1,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#dfe9df',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: '#333',
  },
  searchBtn: {
    backgroundColor: '#234033',
    borderRadius: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  row: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#dfe9df',
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  rowInfo: {
    flex: 1,
  },
  email: {
    fontSize: 14,
    fontWeight: '700',
    color: '#242E21',
  },
  meta: {
    fontSize: 12,
    color: '#4A5A49',
  },
  actions: {
    alignItems: 'flex-end',
    gap: 6,
  },
  role: {
    fontSize: 12,
    color: '#234033',
    fontWeight: '600',
  },
  buttons: {
    flexDirection: 'row',
    gap: 6,
  },
  btn: {
    backgroundColor: '#2E8B57',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  btnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  btnLight: {
    backgroundColor: '#6b8b6b',
  },
  btnPrimary: {
    backgroundColor: '#2E8B57',
  },
  btnWarn: {
    backgroundColor: '#d97706',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderRadius: 16,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#242E21',
    marginLeft: 12,
  },
  modalContent: {
    padding: 20,
  },
  modalMessage: {
    fontSize: 16,
    color: '#374151',
    lineHeight: 22,
    marginBottom: 16,
    textAlign: 'center',
  },
  userInfo: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  infoLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  newRoleValue: {
    color: '#2E8B57',
    fontWeight: '700',
  },
  warningText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  modalButtons: {
    flexDirection: 'row',
    padding: 20,
    paddingTop: 0,
    gap: 12,
  },
  modalButton: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  cancelButtonText: {
    color: '#374151',
    fontSize: 16,
    fontWeight: '600',
  },
  confirmButton: {
    backgroundColor: '#2E8B57',
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  // Pagination styles
  paginationContainer: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#dfe9df',
  },
  paginationInfo: {
    alignItems: 'center',
    marginBottom: 12,
  },
  paginationText: {
    fontSize: 14,
    color: '#4A5A49',
    fontWeight: '500',
  },
  paginationControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 40,
  },
  paginationButton: {
    backgroundColor: '#2E8B57',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
    minWidth: 80,
    alignItems: 'center',
  },
  paginationButtonDisabled: {
    backgroundColor: '#ccc',
  },
  paginationButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  paginationButtonTextDisabled: {
    color: '#999',
  },
  pageNumbersScrollView: {
    flex: 1,
    maxHeight: 40,
  },
  pageNumbersContainer: {
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: 4,
  },
  pageNumberButton: {
    backgroundColor: '#f0f0f0',
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    minWidth: 32,
    alignItems: 'center',
  },
  pageNumberButtonActive: {
    backgroundColor: '#2E8B57',
  },
  pageNumberText: {
    color: '#333',
    fontSize: 14,
    fontWeight: '500',
  },
  pageNumberTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  // Sort and Filter Controls styles
  controlsContainer: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  controlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  controlLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#495057',
    minWidth: 60,
    marginRight: 8,
  },
  sortControls: {
    flexDirection: 'row',
    gap: 6,
    flex: 1,
  },
  sortButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#dee2e6',
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    flex: 1,
    alignItems: 'center',
  },
  sortButtonActive: {
    backgroundColor: '#2E8B57',
    borderColor: '#2E8B57',
  },
  sortButtonText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6c757d',
  },
  sortButtonTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  orderControls: {
    flexDirection: 'row',
    gap: 6,
    flex: 1,
  },
  orderButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#dee2e6',
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    flex: 1,
    alignItems: 'center',
  },
  orderButtonActive: {
    backgroundColor: '#2E8B57',
    borderColor: '#2E8B57',
  },
  orderButtonText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6c757d',
  },
  orderButtonTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  filterControls: {
    flexDirection: 'row',
    gap: 6,
    flex: 1,
  },
  filterButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#dee2e6',
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    flex: 1,
    alignItems: 'center',
  },
  filterButtonActive: {
    backgroundColor: '#2E8B57',
    borderColor: '#2E8B57',
  },
  filterButtonText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6c757d',
  },
  filterButtonTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
});

export default ManageAccountsTab;

