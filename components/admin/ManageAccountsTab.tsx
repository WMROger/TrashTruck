import { collection, doc, endAt, getDocs, limit, orderBy, query, startAt, updateDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
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
    if (!functions || !db) return;
    setBusyMap((m) => ({ ...m, [userId]: true }));
    try {
      const callable = httpsCallable(functions, 'setUserRole');
      await callable({ userId, role: nextRole });
      // Optimistic update
      setUsers((list) => list.map((u) => (u.id === userId ? { ...u, role: nextRole } : u)));
      showError(`Role updated to ${nextRole}`, 'Success', 'success');
    } catch (err) {
      // Fallback to direct write for admins if rules allow
      try {
        await updateDoc(doc(db, 'users', userId), { role: nextRole });
        setUsers((list) => list.map((u) => (u.id === userId ? { ...u, role: nextRole } : u)));
        showError(`Role updated to ${nextRole}`, 'Success', 'success');
      } catch (e) {
        showError('Failed to update role', 'Update Error', 'error');
      }
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
            <TouchableOpacity disabled={isBusy || isAdmin} onPress={() => setRole(item.id, 'user')} style={[styles.btn, styles.btnLight, (isBusy || isAdmin) && { opacity: 0.6 }]}>
              <Text style={styles.btnText}>User</Text>
            </TouchableOpacity>
            <TouchableOpacity disabled={isBusy || isAdmin} onPress={() => setRole(item.id, 'driver')} style={[styles.btn, styles.btnPrimary, (isBusy || isAdmin) && { opacity: 0.6 }]}>
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
});

export default ManageAccountsTab;


