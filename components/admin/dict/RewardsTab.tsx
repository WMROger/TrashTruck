import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Modal, Alert, ActivityIndicator, Image } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { collection, query, orderBy, onSnapshot, limit, addDoc, serverTimestamp, doc, updateDoc, increment } from 'firebase/firestore';
import { db } from '../../../config/firebase';

interface UserScore {
  id: string;
  name: string;
  email: string;
  tokens: number;
  reportCount: number;
  location: string;
  avatar?: string;
}

export default function RewardsTab() {
  const [searchQuery, setSearchQuery] = useState('');
  const [users, setUsers] = useState<UserScore[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modal State
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserScore | null>(null);
  const [selectedSouvenir, setSelectedSouvenir] = useState<any>(null);
  const [isIssuing, setIsIssuing] = useState(false);

  const souvenirs = [
    { id: 'tumbler', name: 'Eco-Friendly Tumbler', type: 'Matte Green, Double-walled insulation', cost: 1000 },
    { id: 'tote', name: 'Cenro Tote Bag', type: 'Canvas, Heavy Duty', cost: 500 },
    { id: 'kit', name: 'Reusable Utensil Kit', type: 'Bamboo with pouch', cost: 2000 }
  ];

  useEffect(() => {
    if (!db) return;
    // Fetch users ordered by tokens (assuming a users collection where tokens are tracked)
    // Note: For a real production app we'd want to use a Cloud Function to securely handle tokens,
    // but for this capstone we track it directly in the user document.
    const q = query(collection(db, 'users'), orderBy('tokens', 'desc'), limit(50));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data: UserScore[] = [];
      snapshot.forEach(docSnap => {
        const d = docSnap.data();
        if (d.role === 'user') {
          data.push({
            id: docSnap.id,
            name: d.displayName || d.name || 'Anonymous',
            email: d.email || '',
            tokens: d.tokens || 0,
            reportCount: d.totalReports || 0,
            location: d.barangay || 'Citizen',
            avatar: d.photoURL
          });
        }
      });
      setUsers(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleIssueSouvenir = async () => {
    if (!selectedUser || !selectedSouvenir) return;
    
    if (selectedUser.tokens < selectedSouvenir.cost) {
      Alert.alert('Insufficient Tokens', 'This user does not have enough tokens for this souvenir.');
      return;
    }

    setIsIssuing(true);
    try {
      // 1. Create a transaction/history record
      await addDoc(collection(db, 'reward_redemptions'), {
        userId: selectedUser.id,
        userName: selectedUser.name,
        souvenirId: selectedSouvenir.id,
        souvenirName: selectedSouvenir.name,
        cost: selectedSouvenir.cost,
        issuedAt: serverTimestamp(),
        status: 'completed'
      });

      // 2. Deduct tokens from user
      const userRef = doc(db, 'users', selectedUser.id);
      await updateDoc(userRef, {
        tokens: increment(-selectedSouvenir.cost)
      });

      Alert.alert('Success', `Issued ${selectedSouvenir.name} to ${selectedUser.name}!`);
      setShowIssueModal(false);
      setSelectedUser(null);
      setSelectedSouvenir(null);
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Failed to issue souvenir.');
    } finally {
      setIsIssuing(false);
    }
  };

  const filteredUsers = users.filter(u => 
    u.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    u.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.pageSubtitle}>ICT CONTROLLER • Updated seconds ago</Text>
          <Text style={styles.pageTitle}>Citizen Reporter Rewards & Souvenir Registry</Text>
          <Text style={styles.pageDesc}>Comprehensive management of souvenirs and rewards earned by citizens for reporting environmental issues and trash concerns across the city's districts.</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.secondaryBtn}>
            <MaterialIcons name="download" size={16} color="#374151" />
            <Text style={styles.secondaryBtnText}>Export Registry</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.primaryBtn} onPress={() => setShowIssueModal(true)}>
            <MaterialIcons name="add" size={16} color="#FFF" />
            <Text style={styles.primaryBtnText}>Issue New Souvenir</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Main Content Card */}
      <View style={styles.mainCard}>
        {/* Top Performer Spotlight (Optional feature based on design) */}
        {users.length > 0 && (
          <View style={styles.spotlightCard}>
            <View style={styles.spotlightAvatar}>
              <Text style={styles.spotlightInitial}>{users[0].name.charAt(0)}</Text>
            </View>
            <View style={styles.spotlightInfo}>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>Top Contributor</Text>
              </View>
              <Text style={styles.spotlightName}>{users[0].name}</Text>
              <Text style={styles.spotlightStats}>🪙 {users[0].tokens.toLocaleString()} Tokens • Active Reporter</Text>
            </View>
          </View>
        )}

        {/* Toolbar */}
        <View style={styles.toolbar}>
          <View style={styles.searchBox}>
            <MaterialIcons name="search" size={20} color="#9CA3AF" />
            <TextInput 
              style={styles.searchInput} 
              placeholder="Search by Token ID, User or Rank..." 
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholderTextColor="#9CA3AF"
            />
          </View>
        </View>

        {/* Table */}
        <View style={styles.table}>
          <View style={styles.tableHead}>
            <Text style={[styles.th, { width: 50 }]}>RANK</Text>
            <Text style={[styles.th, { flex: 2 }]}>CITIZEN / USER PROFILE</Text>
            <Text style={[styles.th, { flex: 1 }]}>REPORT TYPE</Text>
            <Text style={[styles.th, { flex: 1 }]}>TOKENS EARNED</Text>
            <Text style={[styles.th, { flex: 1.5 }]}>ACTIONS</Text>
          </View>

          {loading ? (
            <ActivityIndicator size="large" color="#4B6354" style={{ marginTop: 40 }} />
          ) : (
            filteredUsers.map((user, index) => (
              <View key={user.id} style={styles.tr}>
                <Text style={[styles.td, { width: 50, fontWeight: '700', color: '#6B7280' }]}>#{index + 1}</Text>
                
                <View style={[styles.td, { flex: 2, flexDirection: 'row', alignItems: 'center', gap: 12 }]}>
                  <View style={styles.avatarBg}>
                    <Text style={styles.avatarInitial}>{user.name.charAt(0)}</Text>
                  </View>
                  <View>
                    <Text style={styles.userName}>{user.name}</Text>
                    <Text style={styles.userLocation}>{user.location}</Text>
                  </View>
                </View>

                <View style={[styles.td, { flex: 1 }]}>
                  <Text style={styles.reportCountText}>{user.reportCount} Reports</Text>
                </View>

                <View style={[styles.td, { flex: 1 }]}>
                  <View style={styles.tokenBadge}>
                    <Text style={styles.tokenText}>🪙 {user.tokens.toLocaleString()}</Text>
                  </View>
                </View>

                <View style={[styles.td, { flex: 1.5, flexDirection: 'row', gap: 8 }]}>
                  <TouchableOpacity 
                    style={styles.actionBtnIssue}
                    onPress={() => {
                      setSelectedUser(user);
                      setShowIssueModal(true);
                    }}
                  >
                    <Text style={styles.actionBtnText}>Issue Souvenir</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </View>
      </View>

      {/* Summary Footer */}
      <View style={styles.summaryGrid}>
        <View style={styles.summaryBox}>
          <Text style={styles.summaryLabel}>TOTAL ONLINE VOLUNTEERS</Text>
          <Text style={styles.summaryValue}>{users.length}</Text>
        </View>
        <View style={styles.summaryBox}>
          <Text style={styles.summaryLabel}>ACTIVE REPORTERS</Text>
          <Text style={styles.summaryValue}>{users.filter(u => u.reportCount > 0).length}</Text>
        </View>
        <View style={styles.summaryBox}>
          <Text style={styles.summaryLabel}>ITEM DISTRIBUTIONS</Text>
          <Text style={styles.summaryValue}>--</Text>
        </View>
      </View>

      {/* Issue Modal */}
      <Modal visible={showIssueModal} transparent={true} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <MaterialIcons name="card-giftcard" size={24} color="#4B6354" />
                <Text style={styles.modalTitle}>Issue New Souvenir</Text>
              </View>
              <TouchableOpacity onPress={() => { setShowIssueModal(false); setSelectedUser(null); }}>
                <MaterialIcons name="close" size={24} color="#9CA3AF" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              {/* If no user is pre-selected, we could have a search here. For now, assume user is selected from table or we force selection */}
              <View style={styles.modalFormGroup}>
                <Text style={styles.modalLabel}>CITIZEN (RECIPIENT)</Text>
                <View style={styles.selectedUserBox}>
                  {selectedUser ? (
                    <>
                      <Text style={styles.selectedUserName}>{selectedUser.name}</Text>
                      <Text style={styles.selectedUserTokens}>Available: {selectedUser.tokens} tokens</Text>
                    </>
                  ) : (
                    <Text style={{ color: '#9CA3AF' }}>Please select a user from the table first.</Text>
                  )}
                </View>
              </View>

              <View style={styles.modalFormGroup}>
                <Text style={styles.modalLabel}>SELECT SOUVENIR TYPE</Text>
                {souvenirs.map(item => (
                  <TouchableOpacity 
                    key={item.id}
                    style={[
                      styles.souvenirOption,
                      selectedSouvenir?.id === item.id && styles.souvenirOptionSelected
                    ]}
                    onPress={() => setSelectedSouvenir(item)}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[
                        styles.souvenirName,
                        selectedSouvenir?.id === item.id && { color: '#4B6354' }
                      ]}>{item.name}</Text>
                      <Text style={styles.souvenirType}>{item.type}</Text>
                    </View>
                    <View style={styles.souvenirCostBox}>
                      <Text style={styles.souvenirCostText}>{item.cost} TOKENS</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>

              {selectedUser && selectedSouvenir && (
                <View style={[
                  styles.eligibilityBox, 
                  selectedUser.tokens >= selectedSouvenir.cost ? styles.eligibilityValid : styles.eligibilityInvalid
                ]}>
                  <MaterialIcons 
                    name={selectedUser.tokens >= selectedSouvenir.cost ? "check-circle" : "cancel"} 
                    size={20} 
                    color={selectedUser.tokens >= selectedSouvenir.cost ? "#059669" : "#DC2626"} 
                  />
                  <View>
                    <Text style={[
                      styles.eligibilityTitle,
                      { color: selectedUser.tokens >= selectedSouvenir.cost ? "#059669" : "#DC2626" }
                    ]}>
                      {selectedUser.tokens >= selectedSouvenir.cost ? "Verify Eligibility Status: Valid" : "Verify Eligibility Status: Invalid"}
                    </Text>
                    <Text style={styles.eligibilityDesc}>
                      {selectedUser.tokens >= selectedSouvenir.cost ? "Citizen has sufficient token balance." : "Citizen does not have enough tokens."}
                    </Text>
                  </View>
                </View>
              )}
            </View>

            <View style={styles.modalFooter}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => { setShowIssueModal(false); setSelectedUser(null); }}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[
                  styles.confirmBtn, 
                  (!selectedUser || !selectedSouvenir || selectedUser.tokens < selectedSouvenir.cost || isIssuing) && { opacity: 0.5 }
                ]}
                disabled={!selectedUser || !selectedSouvenir || selectedUser.tokens < selectedSouvenir.cost || isIssuing}
                onPress={handleIssueSouvenir}
              >
                <Text style={styles.confirmBtnText}>{isIssuing ? "Processing..." : "Confirm Issue →"}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <View style={{ height: 40 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 32 },
  header: { marginBottom: 24, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  pageSubtitle: { fontSize: 11, fontWeight: '700', color: '#9CA3AF', letterSpacing: 1, marginBottom: 8 },
  pageTitle: { fontSize: 28, fontWeight: '800', color: '#111827', marginBottom: 8, letterSpacing: -0.5 },
  pageDesc: { fontSize: 14, color: '#6B7280', maxWidth: 600, lineHeight: 22 },
  
  headerActions: { flexDirection: 'row', gap: 12 },
  secondaryBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#D1D5DB' },
  secondaryBtnText: { fontSize: 13, fontWeight: '600', color: '#374151' },
  primaryBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, backgroundColor: '#4B6354' },
  primaryBtnText: { fontSize: 13, fontWeight: '600', color: '#FFF' },

  mainCard: { backgroundColor: '#FFF', borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB', padding: 24, marginBottom: 24 },
  
  spotlightCard: { flexDirection: 'row', alignItems: 'center', gap: 16, backgroundColor: '#F9FAFB', padding: 20, borderRadius: 12, borderWidth: 1, borderColor: '#F3F4F6', marginBottom: 24 },
  spotlightAvatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#4B6354', justifyContent: 'center', alignItems: 'center' },
  spotlightInitial: { fontSize: 24, fontWeight: '700', color: '#FFF' },
  spotlightInfo: { flex: 1 },
  badge: { alignSelf: 'flex-start', backgroundColor: '#ECFDF5', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, marginBottom: 8 },
  badgeText: { fontSize: 10, fontWeight: '700', color: '#059669', letterSpacing: 0.5 },
  spotlightName: { fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 4 },
  spotlightStats: { fontSize: 13, color: '#6B7280', fontWeight: '500' },

  toolbar: { flexDirection: 'row', marginBottom: 16 },
  searchBox: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, paddingHorizontal: 16, height: 44, gap: 8 },
  searchInput: { flex: 1, fontSize: 14, color: '#111827' },

  table: { width: '100%' },
  tableHead: { flexDirection: 'row', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#E5E7EB', marginBottom: 8 },
  th: { fontSize: 11, fontWeight: '700', color: '#9CA3AF', letterSpacing: 1 },
  tr: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  td: { fontSize: 14 },
  
  avatarBg: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center' },
  avatarInitial: { fontSize: 14, fontWeight: '700', color: '#4B5563' },
  userName: { fontSize: 14, fontWeight: '700', color: '#111827' },
  userLocation: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  
  reportCountText: { fontSize: 13, fontWeight: '600', color: '#059669' },
  
  tokenBadge: { backgroundColor: '#F9FAFB', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, alignSelf: 'flex-start', borderWidth: 1, borderColor: '#E5E7EB' },
  tokenText: { fontSize: 13, fontWeight: '700', color: '#4B6354' },
  
  actionBtnIssue: { backgroundColor: '#ECFDF5', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
  actionBtnText: { fontSize: 12, fontWeight: '700', color: '#059669' },

  summaryGrid: { flexDirection: 'row', gap: 24 },
  summaryBox: { flex: 1, backgroundColor: '#FFF', padding: 24, borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB' },
  summaryLabel: { fontSize: 11, fontWeight: '700', color: '#9CA3AF', letterSpacing: 1, marginBottom: 8 },
  summaryValue: { fontSize: 32, fontWeight: '800', color: '#111827' },

  /* Modal Styles */
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: '100%', maxWidth: 500, backgroundColor: '#FFF', borderRadius: 12, overflow: 'hidden' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 24, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
  modalBody: { padding: 24 },
  modalFormGroup: { marginBottom: 24 },
  modalLabel: { fontSize: 11, fontWeight: '700', color: '#6B7280', letterSpacing: 1, marginBottom: 8 },
  
  selectedUserBox: { backgroundColor: '#F9FAFB', padding: 16, borderRadius: 8, borderWidth: 1, borderColor: '#E5E7EB' },
  selectedUserName: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 4 },
  selectedUserTokens: { fontSize: 14, fontWeight: '600', color: '#059669' },

  souvenirOption: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 8, borderWidth: 1, borderColor: '#E5E7EB', marginBottom: 8 },
  souvenirOptionSelected: { borderColor: '#4B6354', backgroundColor: '#F0FDF4' },
  souvenirName: { fontSize: 15, fontWeight: '700', color: '#374151', marginBottom: 4 },
  souvenirType: { fontSize: 12, color: '#6B7280' },
  souvenirCostBox: { backgroundColor: '#F3F4F6', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 4 },
  souvenirCostText: { fontSize: 11, fontWeight: '700', color: '#4B5563', letterSpacing: 0.5 },

  eligibilityBox: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: 8, borderWidth: 1 },
  eligibilityValid: { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' },
  eligibilityInvalid: { backgroundColor: '#FEF2F2', borderColor: '#FECACA' },
  eligibilityTitle: { fontSize: 14, fontWeight: '700', marginBottom: 2 },
  eligibilityDesc: { fontSize: 12, color: '#6B7280' },

  modalFooter: { flexDirection: 'row', justifyContent: 'flex-end', padding: 24, borderTopWidth: 1, borderTopColor: '#F3F4F6', gap: 12 },
  cancelBtn: { paddingHorizontal: 20, paddingVertical: 10 },
  cancelBtnText: { fontSize: 14, fontWeight: '600', color: '#6B7280' },
  confirmBtn: { backgroundColor: '#4B6354', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 },
  confirmBtnText: { fontSize: 14, fontWeight: '600', color: '#FFF' },
});
