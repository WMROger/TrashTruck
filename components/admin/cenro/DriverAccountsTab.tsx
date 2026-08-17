import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator, useWindowDimensions } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { collection, query, onSnapshot, doc, updateDoc, serverTimestamp, orderBy } from 'firebase/firestore';
import { db } from '@/config/firebase';

interface UserAccount {
  id: string;
  displayName: string;
  email: string;
  role: string;
  employeeId?: string;
  licenseNumber?: string;
  currentTruckId?: string;
  currentTruckPlate?: string;
  createdAt: any;
}

export default function DriverAccountsTab() {
  const { width } = useWindowDimensions();
  const isMobile = width < 768;
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!db) return;
    const q = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      const userList: UserAccount[] = [];
      snap.forEach(d => {
        const data = d.data();
        userList.push({
          id: d.id,
          displayName: data.displayName || 'Unknown Name',
          email: data.email || 'No email',
          role: data.role || 'user', // Default to resident if missing
          employeeId: data.employeeId || '',
          licenseNumber: data.licenseNumber || '',
          currentTruckId: data.currentTruckId || null,
          currentTruckPlate: data.currentTruckPlate || null,
          createdAt: data.createdAt,
        });
      });
      setUsers(userList);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  const handleToggleRole = (user: UserAccount) => {
    if (user.role === 'admin') {
      Alert.alert('Not Allowed', 'Cannot change the role of an Administrator from here.');
      return;
    }

    const isCurrentlyDriver = user.role === 'driver';
    const newRole = isCurrentlyDriver ? 'user' : 'driver';
    const actionText = isCurrentlyDriver ? 'demote to Resident' : 'promote to Driver';

    Alert.alert(
      `Change Role to ${newRole.charAt(0).toUpperCase() + newRole.slice(1)}`,
      `Are you sure you want to ${actionText} for ${user.displayName}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Confirm', 
          style: isCurrentlyDriver ? 'destructive' : 'default',
          onPress: async () => {
            try {
              if (isCurrentlyDriver && user.currentTruckId) {
                // Unassign from truck first if they are being demoted
                await updateDoc(doc(db, 'trucks', user.currentTruckId), {
                  assignedDriverId: null,
                  assignedDriverName: null,
                  shiftStartedAt: null,
                  updatedAt: serverTimestamp()
                });
              }
              // Update user role
              await updateDoc(doc(db, 'users', user.id), {
                role: newRole,
                ...(isCurrentlyDriver ? { 
                  currentTruckId: null, 
                  currentTruckPlate: null 
                } : {}), // Clear truck assignment if demoted
                updatedAt: serverTimestamp()
              });
              Alert.alert('Success', `Role updated to ${newRole}.`);
            } catch (error) {
              console.error('Error updating role:', error);
              Alert.alert('Error', 'Failed to update user role.');
            }
          }
        }
      ]
    );
  };

  const getRoleBadge = (role: string) => {
    if (role === 'admin') return <View style={[styles.roleBadge, { backgroundColor: '#FEE2E2', borderColor: '#FCA5A5' }]}><Text style={[styles.roleText, { color: '#B91C1C' }]}>Admin</Text></View>;
    if (role === 'driver') return <View style={[styles.roleBadge, { backgroundColor: '#E0F2FE', borderColor: '#BAE6FD' }]}><Text style={[styles.roleText, { color: '#0369A1' }]}>Driver</Text></View>;
    return <View style={[styles.roleBadge, { backgroundColor: '#F3F4F6', borderColor: '#E5E7EB' }]}><Text style={[styles.roleText, { color: '#4B5563' }]}>Resident</Text></View>;
  };

  return (
    <ScrollView style={[styles.container, isMobile && { padding: 16 }]}>
      <Text style={styles.headerSubtitle}>ADMINISTRATIVE MANAGEMENT</Text>
      <Text style={styles.headerTitle}>Accounts Directory</Text>

      <View style={[styles.card, isMobile && { padding: 14 }]}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>All System Users</Text>
        </View>

        <ScrollView 
          horizontal={isMobile} 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ flexGrow: 1, minWidth: '100%' }}
          style={{ width: '100%' }}
        >
          <View style={{ minWidth: isMobile ? 650 : '100%', width: '100%', marginTop: 16 }}>
            <View style={styles.tableHead}>
              <Text style={[styles.th, { flex: 2.5 }]}>USER NAME & EMAIL</Text>
              <Text style={[styles.th, { flex: 1.5 }]}>ROLE</Text>
              <Text style={[styles.th, { flex: 2 }]}>EMPLOYEE / LICENSE</Text>
              <Text style={[styles.th, { flex: 1.5 }]}>ASSIGNMENT</Text>
              <Text style={[styles.th, { flex: 1, textAlign: 'right' }]}>ACTIONS</Text>
            </View>
            
            {loading ? (
              <View style={{ padding: 40, alignItems: 'center' }}>
                <ActivityIndicator size="large" color="#2E8B57" />
              </View>
            ) : users.length === 0 ? (
              <View style={{ padding: 40, alignItems: 'center' }}>
                <Text style={{ color: '#6B7280' }}>No users found.</Text>
              </View>
            ) : (
              users.map((row) => (
                <View key={row.id} style={styles.tableRow}>
                  <View style={{ flex: 2.5, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <View style={styles.avatarBadge}>
                      <Text style={styles.avatarText}>{row.displayName.substring(0, 2).toUpperCase()}</Text>
                    </View>
                    <View>
                      <Text style={styles.userName}>{row.displayName}</Text>
                      <Text style={styles.userEmail}>{row.email}</Text>
                    </View>
                  </View>
                  
                  <View style={{ flex: 1.5, alignItems: 'flex-start' }}>
                    {getRoleBadge(row.role)}
                  </View>

                  <View style={{ flex: 2 }}>
                    {row.role === 'driver' ? (
                      <>
                        <Text style={{ color: '#4B5563', fontSize: 13, fontWeight: '500' }}>ID: {row.employeeId || 'Not set'}</Text>
                        <Text style={{ color: '#6B7280', fontSize: 12 }}>Lic: {row.licenseNumber || 'Not set'}</Text>
                      </>
                    ) : (
                      <Text style={{ color: '#9CA3AF', fontSize: 13, fontStyle: 'italic' }}>N/A</Text>
                    )}
                  </View>
                  
                  <View style={{ flex: 1.5 }}>
                    {row.role === 'driver' && row.currentTruckId ? (
                      <View style={styles.truckBadge}>
                        <Text style={styles.truckBadgeText}>{row.currentTruckPlate}</Text>
                      </View>
                    ) : row.role === 'driver' ? (
                      <Text style={{ color: '#9CA3AF', fontSize: 13, fontStyle: 'italic' }}>Unassigned</Text>
                    ) : (
                      <Text style={{ color: '#9CA3AF', fontSize: 13, fontStyle: 'italic' }}>-</Text>
                    )}
                  </View>
                  
                  <View style={{ flex: 1, flexDirection: 'row', justifyContent: 'flex-end', gap: 12 }}>
                    {row.role !== 'admin' && (
                      <TouchableOpacity 
                        onPress={() => handleToggleRole(row)} 
                        style={[styles.toggleBtn, row.role === 'driver' ? styles.demoteBtn : styles.promoteBtn]}
                      >
                        <Text style={[styles.toggleBtnText, row.role === 'driver' ? { color: '#B91C1C' } : { color: '#047857' }]}>
                          {row.role === 'driver' ? 'Demote' : 'Make Driver'}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              ))
            )}
          </View>
        </ScrollView>
      </View>
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB', padding: 32 },
  headerSubtitle: { fontSize: 12, fontWeight: '700', color: '#6B7280', letterSpacing: 1, marginBottom: 8, textTransform: 'uppercase' },
  headerTitle: { fontSize: 28, fontWeight: 'bold', color: '#111827', marginBottom: 32 },
  
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 24, marginBottom: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 2 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  cardTitle: { fontSize: 18, fontWeight: 'bold', color: '#111827' },
  
  tableActions: { flexDirection: 'row', gap: 8 },
  iconBtn: { padding: 8, backgroundColor: '#F3F4F6', borderRadius: 6 },
  
  table: { marginTop: 16 },
  tableHead: { flexDirection: 'row', backgroundColor: '#F9FAFB', paddingVertical: 12, paddingHorizontal: 16, borderRadius: 8, marginBottom: 8 },
  th: { fontSize: 11, fontWeight: '700', color: '#6B7280', letterSpacing: 0.5 },
  tableRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  td: { fontSize: 14 },
  
  avatarBadge: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#dcfce7', alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 13, fontWeight: 'bold', color: '#064e3b' },
  userName: { fontWeight: '700', color: '#111827', fontSize: 14 },
  userEmail: { color: '#6B7280', fontSize: 12, marginTop: 2 },
  
  roleBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, borderWidth: 1 },
  roleText: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },

  truckBadge: { backgroundColor: '#ECFDF5', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, alignSelf: 'flex-start', borderWidth: 1, borderColor: '#A7F3D0' },
  truckBadgeText: { fontSize: 12, fontWeight: '700', color: '#047857' },

  toggleBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, borderWidth: 1 },
  promoteBtn: { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' },
  demoteBtn: { backgroundColor: '#FEF2F2', borderColor: '#FECACA' },
  toggleBtnText: { fontSize: 12, fontWeight: '700' },
});
