import { MaterialIcons } from '@expo/vector-icons';
import { collection, doc, endAt, getDocs, limit, orderBy, query, startAt, updateDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, Modal, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { db, functions } from '../../config/firebase';
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
      // For web platform, use direct Firestore update to avoid CORS issues
      // For mobile platforms, try Cloud Function first, then fallback to direct update
      if (Platform.OS === 'web') {
        // Direct Firestore update for web
        await updateDoc(doc(db, 'users', userId), { role: nextRole });
        setUsers((list) => list.map((u) => (u.id === userId ? { ...u, role: nextRole } : u)));
        showError(`Role updated to ${nextRole}`, 'Success', 'success');
      } else {
        // Try Cloud Function first for mobile, then fallback to direct update
        try {
          if (functions) {
            const callable = httpsCallable(functions, 'setUserRole');
            await callable({ userId, role: nextRole });
            setUsers((list) => list.map((u) => (u.id === userId ? { ...u, role: nextRole } : u)));
            showError(`Role updated to ${nextRole}`, 'Success', 'success');
          } else {
            throw new Error('Functions not available');
          }
        } catch (err) {
          // Fallback to direct write for admins if rules allow
          await updateDoc(doc(db, 'users', userId), { role: nextRole });
          setUsers((list) => list.map((u) => (u.id === userId ? { ...u, role: nextRole } : u)));
          showError(`Role updated to ${nextRole}`, 'Success', 'success');
        }
      }
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
      <FlatList
        data={users}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        contentContainerStyle={{ paddingVertical: 8 }}
      />

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
                Are you sure you want to change this user's role?
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
                This will immediately update the user's permissions.
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
  );
};

const styles = StyleSheet.create({
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
});

export default ManageAccountsTab;

