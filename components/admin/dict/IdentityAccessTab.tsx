import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert, Modal, Platform } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { collection, query, getDocs, doc, updateDoc, orderBy } from 'firebase/firestore';
import { db } from '../../../config/firebase';

interface UserData {
  id: string;
  email: string;
  displayName: string;
  role: string;
  verified: boolean;
  createdAt: any;
}

export default function IdentityAccessTab() {
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<UserData | null>(null);
  const [isRoleModalVisible, setIsRoleModalVisible] = useState(false);
  const [updatingRole, setUpdatingRole] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    if (!db) return;
    try {
      setLoading(true);
      const q = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      
      const userData: UserData[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        userData.push({
          id: doc.id,
          email: data.email || 'No email',
          displayName: data.displayName || 'Unnamed User',
          role: data.role || 'user',
          verified: data.verified || false,
          createdAt: data.createdAt,
        });
      });
      
      setUsers(userData);
    } catch (error) {
      console.error('Error fetching users:', error);
      Alert.alert('Error', 'Failed to fetch user directory');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateRole = async (newRole: string) => {
    if (!selectedUser || !db) return;
    
    Alert.alert(
      'Confirm Role Change',
      `Are you sure you want to change ${selectedUser.displayName}'s role to ${newRole.toUpperCase()}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Confirm', 
          style: 'destructive',
          onPress: async () => {
            try {
              setUpdatingRole(true);
              const userRef = doc(db, 'users', selectedUser.id);
              await updateDoc(userRef, { role: newRole });
              
              // Update local state
              setUsers(users.map(u => u.id === selectedUser.id ? { ...u, role: newRole } : u));
              setIsRoleModalVisible(false);
              Alert.alert('Success', 'User role updated successfully');
            } catch (error) {
              console.error('Error updating role:', error);
              Alert.alert('Error', 'Failed to update user role');
            } finally {
              setUpdatingRole(false);
            }
          }
        }
      ]
    );
  };

  const filteredUsers = users.filter(user => 
    user.email.toLowerCase().includes(searchQuery.toLowerCase()) || 
    user.displayName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getRoleBadgeColor = (role: string) => {
    switch(role) {
      case 'dict': return '#4F46E5'; // Indigo
      case 'admin': return '#059669'; // Emerald
      case 'driver': return '#D97706'; // Amber
      default: return '#6B7280'; // Gray
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Identity & Access Management</Text>
          <Text style={styles.subtitle}>Manage user roles, permissions, and system access</Text>
        </View>
        <TouchableOpacity style={styles.refreshButton} onPress={fetchUsers} disabled={loading}>
          <MaterialIcons name="refresh" size={20} color="#374151" />
          <Text style={styles.refreshText}>Refresh Directory</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        {/* Search and Filters */}
        <View style={styles.toolbar}>
          <View style={styles.searchContainer}>
            <MaterialIcons name="search" size={20} color="#9CA3AF" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search by name or email..."
              placeholderTextColor="#9CA3AF"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <MaterialIcons name="close" size={20} color="#9CA3AF" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* User Table */}
        <View style={styles.tableContainer}>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderText, { flex: 2 }]}>USER</Text>
            <Text style={[styles.tableHeaderText, { flex: 1.5 }]}>EMAIL</Text>
            <Text style={[styles.tableHeaderText, { flex: 1 }]}>ROLE</Text>
            <Text style={[styles.tableHeaderText, { flex: 1 }]}>STATUS</Text>
            <Text style={[styles.tableHeaderText, { flex: 0.5, textAlign: 'right' }]}>ACTIONS</Text>
          </View>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#4F46E5" />
            </View>
          ) : (
            <ScrollView style={styles.tableBody} showsVerticalScrollIndicator={false}>
              {filteredUsers.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <MaterialIcons name="people-outline" size={48} color="#D1D5DB" />
                  <Text style={styles.emptyText}>No users found</Text>
                </View>
              ) : (
                filteredUsers.map((user) => (
                  <View key={user.id} style={styles.tableRow}>
                    <View style={[styles.tableCell, { flex: 2, flexDirection: 'row', alignItems: 'center' }]}>
                      <View style={styles.avatar}>
                        <Text style={styles.avatarText}>{user.displayName.charAt(0).toUpperCase()}</Text>
                      </View>
                      <Text style={styles.cellTextPrimary}>{user.displayName}</Text>
                    </View>
                    
                    <View style={[styles.tableCell, { flex: 1.5 }]}>
                      <Text style={styles.cellTextSecondary}>{user.email}</Text>
                    </View>
                    
                    <View style={[styles.tableCell, { flex: 1 }]}>
                      <View style={[styles.roleBadge, { backgroundColor: `${getRoleBadgeColor(user.role)}15` }]}>
                        <View style={[styles.roleDot, { backgroundColor: getRoleBadgeColor(user.role) }]} />
                        <Text style={[styles.roleText, { color: getRoleBadgeColor(user.role) }]}>
                          {user.role.toUpperCase()}
                        </Text>
                      </View>
                    </View>
                    
                    <View style={[styles.tableCell, { flex: 1 }]}>
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
                    
                    <View style={[styles.tableCell, { flex: 0.5, alignItems: 'flex-end' }]}>
                      <TouchableOpacity 
                        style={styles.actionButton}
                        onPress={() => {
                          setSelectedUser(user);
                          setIsRoleModalVisible(true);
                        }}
                      >
                        <MaterialIcons name="edit" size={18} color="#4B5563" />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))
              )}
            </ScrollView>
          )}
        </View>
      </View>

      {/* Role Management Modal */}
      <Modal
        visible={isRoleModalVisible}
        transparent={true}
        animationType="fade"
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Manage User Role</Text>
              <TouchableOpacity onPress={() => setIsRoleModalVisible(false)}>
                <MaterialIcons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>
            
            <View style={styles.modalBody}>
              <Text style={styles.modalSubtitle}>
                Select a new role for <Text style={{fontWeight: '700', color: '#111827'}}>{selectedUser?.displayName}</Text> ({selectedUser?.email}).
              </Text>

              <View style={styles.roleOptions}>
                {['user', 'driver', 'admin', 'dict'].map((role) => (
                  <TouchableOpacity 
                    key={role}
                    style={[
                      styles.roleOptionCard,
                      selectedUser?.role === role && styles.roleOptionCardActive
                    ]}
                    onPress={() => handleUpdateRole(role)}
                    disabled={updatingRole || selectedUser?.role === role}
                  >
                    <View style={[styles.roleOptionIcon, { backgroundColor: `${getRoleBadgeColor(role)}15` }]}>
                      <MaterialIcons 
                        name={
                          role === 'dict' ? 'security' : 
                          role === 'admin' ? 'admin-panel-settings' : 
                          role === 'driver' ? 'directions-car' : 'person'
                        } 
                        size={24} 
                        color={getRoleBadgeColor(role)} 
                      />
                    </View>
                    <View style={styles.roleOptionDetails}>
                      <Text style={styles.roleOptionTitle}>{role.toUpperCase()}</Text>
                      <Text style={styles.roleOptionDesc}>
                        {role === 'dict' ? 'Full system access & IT management' : 
                         role === 'admin' ? 'CENRO dashboard & operational control' : 
                         role === 'driver' ? 'Mobile driver app access' : 'Standard citizen access'}
                      </Text>
                    </View>
                    {selectedUser?.role === role && (
                      <MaterialIcons name="check-circle" size={24} color={getRoleBadgeColor(role)} />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 32,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280',
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  refreshText: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
    flex: 1,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    overflow: 'hidden',
  },
  toolbar: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 48,
    maxWidth: 400,
  },
  searchInput: {
    flex: 1,
    marginLeft: 12,
    fontSize: 15,
    color: '#111827',
    ...(Platform.OS === 'web' && { outlineStyle: 'none' }),
  },
  tableContainer: {
    flex: 1,
  },
  tableHeader: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    paddingVertical: 16,
    backgroundColor: '#F9FAFB',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  tableHeaderText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6B7280',
    letterSpacing: 0.5,
  },
  tableBody: {
    flex: 1,
  },
  tableRow: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    alignItems: 'center',
  },
  tableCell: {
    justifyContent: 'center',
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E0E7FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#4F46E5',
  },
  cellTextPrimary: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  cellTextSecondary: {
    fontSize: 14,
    color: '#6B7280',
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  roleDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  roleText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusTextVerified: {
    marginLeft: 6,
    fontSize: 13,
    fontWeight: '500',
    color: '#10B981',
  },
  statusTextPending: {
    marginLeft: 6,
    fontSize: 13,
    fontWeight: '500',
    color: '#F59E0B',
  },
  actionButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 64,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6B7280',
    fontWeight: '500',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(17, 24, 39, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    width: '100%',
    maxWidth: 600,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.15,
    shadowRadius: 40,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  modalBody: {
    padding: 24,
  },
  modalSubtitle: {
    fontSize: 15,
    color: '#4B5563',
    marginBottom: 24,
    lineHeight: 22,
  },
  roleOptions: {
    gap: 12,
  },
  roleOptionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
  },
  roleOptionCardActive: {
    borderColor: '#4F46E5',
    backgroundColor: '#EEF2FF',
  },
  roleOptionIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  roleOptionDetails: {
    flex: 1,
  },
  roleOptionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  roleOptionDesc: {
    fontSize: 13,
    color: '#6B7280',
  },
});
