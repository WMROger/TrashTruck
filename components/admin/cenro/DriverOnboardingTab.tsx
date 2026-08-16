import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { provisionDriverOnSpark } from '@/services/driverProvisioningService';

export default function DriverOnboardingTab() {
  const [mode, setMode] = useState<'create' | 'upgrade'>('create');
  
  // Create State
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [newFullName, setNewFullName] = useState('');
  const [newContact, setNewContact] = useState('');
  
  // Upgrade State
  const [searchEmail, setSearchEmail] = useState('');
  const [foundUser, setFoundUser] = useState<any>(null);
  const [residentsList, setResidentsList] = useState<any[]>([]);

  // Common State
  const [employeeId, setEmployeeId] = useState('');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [selectedTruckId, setSelectedTruckId] = useState('');
  
  // Data State
  const [availableTrucks, setAvailableTrucks] = useState<any[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  useEffect(() => {
    if (!db) return;
    
    // Fetch active trucks
    const q = query(collection(db, 'trucks'), where('status', '==', 'active'));
    const unsub = onSnapshot(q, (snap) => {
      const trucks: any[] = [];
      snap.forEach(d => {
        const data = d.data();
        if (!data.assignedDriverId) { // Only trucks without drivers
          trucks.push({ id: d.id, plateNumber: data.plateNumber, type: data.type });
        }
      });
      setAvailableTrucks(trucks);
    });

    // Fetch residents (users who are not drivers/admins)
    const unsubUsers = onSnapshot(collection(db, 'users'), (snap) => {
      const residents: any[] = [];
      snap.forEach(d => {
        if ((d.data().role || 'user') === 'user') residents.push({ id: d.id, ...d.data() });
      });
      setResidentsList(residents);
    });

    return () => {
      unsub();
      unsubUsers();
    };
  }, []);

  const handleCompleteOnboarding = async () => {
    if (!employeeId || !licenseNumber) {
      Alert.alert('Validation Error', 'Please fill in the Employee ID and License Number.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (mode === 'create') {
        if (!newEmail || !newPassword || !newFullName) {
          Alert.alert('Validation Error', 'Please fill in Email, Password, and Full Name for the new driver.');
          setIsSubmitting(false);
          return;
        }
      } else {
        if (!foundUser) {
          Alert.alert('Validation Error', 'Please search and select a resident to upgrade.');
          setIsSubmitting(false);
          return;
        }
      }

      await provisionDriverOnSpark({
        mode,
        email: newEmail,
        password: mode === 'create' ? newPassword : undefined,
        fullName: mode === 'create' ? newFullName : foundUser?.displayName,
        contactInfo: mode === 'create' ? newContact : foundUser?.contactInfo,
        existingUserId: mode === 'upgrade' ? foundUser?.id : undefined,
        employeeId,
        licenseNumber,
        truckId: selectedTruckId || undefined,
      });

      Alert.alert(
        'Success',
        mode === 'create'
          ? 'Driver created. A verification link was sent to the driver email and must be opened before first sign-in.'
          : 'Resident account successfully upgraded to driver.',
      );
      
      // Reset form
      setNewEmail('');
      setNewPassword('');
      setNewFullName('');
      setNewContact('');
      setSearchEmail('');
      setFoundUser(null);
      setEmployeeId('');
      setLicenseNumber('');
      setSelectedTruckId('');
      
    } catch (e: any) {
      console.error('Onboarding Error:', e);
      Alert.alert('Error', e.message || 'Failed to complete onboarding.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.headerSubtitle}>ADMINISTRATIVE MANAGEMENT</Text>
      <Text style={styles.headerTitle}>Driver Onboarding</Text>

      {/* Mode Toggle */}
      <View style={styles.toggleContainer}>
        <TouchableOpacity 
          style={[styles.toggleBtn, mode === 'create' && styles.toggleBtnActive]}
          onPress={() => setMode('create')}
        >
          <Text style={[styles.toggleText, mode === 'create' && styles.toggleTextActive]}>Create New Account</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.toggleBtn, mode === 'upgrade' && styles.toggleBtnActive]}
          onPress={() => setMode('upgrade')}
        >
          <Text style={[styles.toggleText, mode === 'upgrade' && styles.toggleTextActive]}>Upgrade Existing Resident</Text>
        </TouchableOpacity>
      </View>

      {/* Registration / Upgrade Card */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.cardTitleRow}>
            <MaterialIcons name="person-add" size={20} color="#2E8B57" style={styles.cardIcon} />
            <Text style={styles.cardTitle}>
              {mode === 'create' ? 'Driver Registration' : 'Upgrade Resident'}
            </Text>
          </View>
        </View>

        {mode === 'upgrade' ? (
          <View style={styles.upgradeSection}>
            <View style={[styles.formGroup, { width: '100%', marginBottom: 16 }]}>
              <Text style={styles.label}>SEARCH RESIDENTS</Text>
              <View style={styles.searchContainer}>
                <MaterialIcons name="search" size={20} color="#9CA3AF" style={styles.searchIcon} />
                <TextInput 
                  style={[styles.input, { paddingLeft: 40, width: '100%' }]} 
                  placeholder="Type name or email to search..." 
                  value={searchEmail}
                  onChangeText={(text) => {
                    setSearchEmail(text);
                    setFoundUser(null); // Clear selection when typing
                  }}
                  autoCapitalize="none"
                />
              </View>
            </View>

            {foundUser ? (
              <View>
                <View style={styles.foundUserCard}>
                  <View style={styles.foundUserRow}>
                    <View style={styles.avatarBadge}>
                      <Text style={styles.avatarText}>{foundUser.displayName?.substring(0, 2).toUpperCase() || 'NA'}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.foundUserName}>{foundUser.displayName || 'Unknown Name'}</Text>
                      <Text style={styles.foundUserEmail}>{foundUser.email}</Text>
                    </View>
                    <TouchableOpacity onPress={() => setFoundUser(null)}>
                      <MaterialIcons name="close" size={20} color="#6B7280" />
                    </TouchableOpacity>
                  </View>
                </View>
                <Text style={{ fontSize: 12, color: '#6B7280', marginTop: 8, fontStyle: 'italic' }}>
                  Selected resident to upgrade.
                </Text>
              </View>
            ) : (
              <View style={styles.residentsListContainer}>
                <Text style={styles.listHeader}>Available Residents ({residentsList.filter(r => 
                    (r.displayName?.toLowerCase() || '').includes(searchEmail.toLowerCase()) || 
                    (r.email?.toLowerCase() || '').includes(searchEmail.toLowerCase())
                  ).length})</Text>
                <ScrollView style={styles.residentsScroll} nestedScrollEnabled={true}>
                  {residentsList
                    .filter(r => 
                      (r.displayName?.toLowerCase() || '').includes(searchEmail.toLowerCase()) || 
                      (r.email?.toLowerCase() || '').includes(searchEmail.toLowerCase())
                    )
                    .map(r => (
                      <TouchableOpacity 
                        key={r.id} 
                        style={styles.residentListItem}
                        onPress={() => setFoundUser(r)}
                      >
                        <View style={styles.avatarBadgeSmall}>
                          <Text style={styles.avatarTextSmall}>{r.displayName?.substring(0, 2).toUpperCase() || 'NA'}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.residentListName}>{r.displayName || 'Unknown Name'}</Text>
                          <Text style={styles.residentListEmail}>{r.email}</Text>
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          {r.role === 'admin' ? (
                            <View style={[styles.roleBadge, { backgroundColor: '#FEE2E2', borderColor: '#FCA5A5' }]}><Text style={[styles.roleText, { color: '#B91C1C' }]}>Admin</Text></View>
                          ) : r.role === 'driver' ? (
                            <View style={[styles.roleBadge, { backgroundColor: '#E0F2FE', borderColor: '#BAE6FD' }]}><Text style={[styles.roleText, { color: '#0369A1' }]}>Driver</Text></View>
                          ) : (
                            <View style={[styles.roleBadge, { backgroundColor: '#F3F4F6', borderColor: '#E5E7EB' }]}><Text style={[styles.roleText, { color: '#4B5563' }]}>Resident</Text></View>
                          )}
                        </View>
                      </TouchableOpacity>
                    ))
                  }
                  {residentsList.filter(r => 
                      (r.displayName?.toLowerCase() || '').includes(searchEmail.toLowerCase()) || 
                      (r.email?.toLowerCase() || '').includes(searchEmail.toLowerCase())
                    ).length === 0 && (
                      <Text style={{ padding: 16, color: '#6B7280', textAlign: 'center' }}>No residents found matching your search.</Text>
                  )}
                </ScrollView>
              </View>
            )}
          </View>
        ) : (
          <View style={styles.formGrid}>
            <View style={styles.formGroup}>
              <Text style={styles.label}>EMAIL ADDRESS (LOGIN)</Text>
              <TextInput style={styles.input} placeholder="driver@trashtrack.com" value={newEmail} onChangeText={setNewEmail} autoCapitalize="none" />
            </View>
            <View style={styles.formGroup}>
              <Text style={styles.label}>TEMPORARY PASSWORD</Text>
              <View style={styles.passwordContainer}>
                <TextInput 
                  style={[styles.input, styles.passwordInput]} 
                  placeholder="********" 
                  value={newPassword} 
                  onChangeText={setNewPassword} 
                  secureTextEntry={!showPassword} 
                />
                <Text style={{ fontSize: 11, color: '#6B7280', marginTop: 5 }}>Use at least 12 characters.</Text>
                <TouchableOpacity 
                  style={styles.eyeIcon} 
                  onPress={() => setShowPassword(!showPassword)}
                >
                  <MaterialIcons 
                    name={showPassword ? "visibility-off" : "visibility"} 
                    size={20} 
                    color="#6B7280" 
                  />
                </TouchableOpacity>
              </View>
            </View>
            <View style={styles.formGroup}>
              <Text style={styles.label}>FULL NAME</Text>
              <TextInput style={styles.input} placeholder="Juan De La Cruz" value={newFullName} onChangeText={setNewFullName} />
            </View>
            <View style={styles.formGroup}>
              <Text style={styles.label}>CONTACT INFORMATION</Text>
              <TextInput style={styles.input} placeholder="+63 9XX XXX XXXX" value={newContact} onChangeText={setNewContact} />
            </View>
          </View>
        )}

        <View style={styles.divider} />

        <View style={styles.formGrid}>
          <View style={styles.formGroup}>
            <Text style={styles.label}>EMPLOYEE ID</Text>
            <TextInput style={styles.input} placeholder="CENRO-2024-XXXX" value={employeeId} onChangeText={setEmployeeId} />
          </View>
          <View style={styles.formGroup}>
            <Text style={styles.label}>LICENSE NUMBER</Text>
            <TextInput style={styles.input} placeholder="N01-XX-XXXXXX" value={licenseNumber} onChangeText={setLicenseNumber} />
          </View>
        </View>
      </View>

      {/* Vehicle Assignment Card */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.cardTitleRow}>
            <MaterialIcons name="local-shipping" size={20} color="#2E8B57" style={styles.cardIcon} />
            <Text style={styles.cardTitle}>Vehicle Assignment (Optional)</Text>
          </View>
        </View>

        <View style={styles.assignmentRow}>
          <View style={[styles.formGroup, { flex: 1, marginBottom: 0 }]}>
            <Text style={styles.label}>SELECT AVAILABLE UNIT</Text>
            <View style={{ position: 'relative', zIndex: 10 }}>
              <TouchableOpacity style={styles.dropdown} onPress={() => setIsDropdownOpen(!isDropdownOpen)}>
                <Text style={[styles.dropdownText, !selectedTruckId && { color: '#9CA3AF' }]}>
                  {selectedTruckId 
                    ? availableTrucks.find(t => t.id === selectedTruckId)?.plateNumber + ' - ' + availableTrucks.find(t => t.id === selectedTruckId)?.type
                    : 'Select Truck'}
                </Text>
                <MaterialIcons name={isDropdownOpen ? "keyboard-arrow-up" : "keyboard-arrow-down"} size={20} color="#6B7280" />
              </TouchableOpacity>
              
              {isDropdownOpen && (
                <View style={styles.dropdownMenu}>
                  <ScrollView style={{ maxHeight: 200 }}>
                    <TouchableOpacity 
                      style={styles.dropdownItem} 
                      onPress={() => { setSelectedTruckId(''); setIsDropdownOpen(false); }}
                    >
                      <Text style={styles.dropdownItemText}>None (Assign Later)</Text>
                    </TouchableOpacity>
                    {availableTrucks.map(truck => (
                      <TouchableOpacity 
                        key={truck.id} 
                        style={styles.dropdownItem}
                        onPress={() => { setSelectedTruckId(truck.id); setIsDropdownOpen(false); }}
                      >
                        <Text style={styles.dropdownItemText}>{truck.plateNumber} - {truck.type}</Text>
                      </TouchableOpacity>
                    ))}
                    {availableTrucks.length === 0 && (
                      <View style={styles.dropdownItem}><Text style={styles.dropdownItemText}>No available trucks</Text></View>
                    )}
                  </ScrollView>
                </View>
              )}
            </View>
          </View>

          <View style={styles.infoBox}>
            <MaterialIcons name="info-outline" size={20} color="#2E8B57" style={styles.infoIcon} />
            <View style={{ flex: 1 }}>
              <Text style={styles.infoTitle}>Route Optimization</Text>
              <Text style={styles.infoText}>Assigning a truck automatically links the driver to the pre-designated AI-optimized route for that vehicle.</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Action Buttons */}
      <View style={styles.actionsRow}>
        <TouchableOpacity 
          style={styles.primaryBtn} 
          onPress={handleCompleteOnboarding}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <MaterialIcons name="person-add" size={18} color="#fff" />
              <Text style={styles.primaryBtnText}>Complete Onboarding</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB', padding: 32 },
  headerSubtitle: { fontSize: 12, fontWeight: '700', color: '#6B7280', letterSpacing: 1, marginBottom: 8, textTransform: 'uppercase' },
  headerTitle: { fontSize: 28, fontWeight: 'bold', color: '#111827', marginBottom: 24 },
  
  toggleContainer: { flexDirection: 'row', backgroundColor: '#E5E7EB', borderRadius: 8, padding: 4, marginBottom: 24, alignSelf: 'flex-start' },
  toggleBtn: { paddingVertical: 10, paddingHorizontal: 20, borderRadius: 6 },
  toggleBtnActive: { backgroundColor: '#FFFFFF', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 2 },
  toggleText: { fontSize: 14, fontWeight: '600', color: '#6B7280' },
  toggleTextActive: { color: '#111827' },

  card: { backgroundColor: '#fff', borderRadius: 12, padding: 24, marginBottom: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 2 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardIcon: { marginRight: 4 },
  cardTitle: { fontSize: 18, fontWeight: 'bold', color: '#111827' },
  
  formGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 24 },
  formGroup: { width: '47%', marginBottom: 16 },
  label: { fontSize: 11, fontWeight: '700', color: '#374151', marginBottom: 8, letterSpacing: 0.5 },
  input: { backgroundColor: '#F9FAFB', borderRadius: 8, padding: 14, fontSize: 14, color: '#111827', borderWidth: 1, borderColor: '#E5E7EB' },
  passwordContainer: { position: 'relative', justifyContent: 'center' },
  passwordInput: { paddingRight: 45 },
  eyeIcon: { position: 'absolute', right: 12, top: 14 },
  
  divider: { height: 1, backgroundColor: '#F3F4F6', marginVertical: 24 },
  
  upgradeSection: { marginBottom: 16 },
  searchRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 16 },
  searchBtn: { backgroundColor: '#2E8B57', width: 50, height: 50, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  foundUserCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F6FBF7', padding: 16, borderRadius: 8, borderWidth: 1, borderColor: '#dcfce7', marginTop: 16 },
  foundUserRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  foundUserName: { fontSize: 16, fontWeight: 'bold', color: '#111827' },
  foundUserEmail: { fontSize: 14, color: '#4B5563', marginTop: 2 },

  searchContainer: { position: 'relative', justifyContent: 'center' },
  searchIcon: { position: 'absolute', left: 14, zIndex: 1 },
  residentsListContainer: { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, backgroundColor: '#fff', overflow: 'hidden' },
  listHeader: { padding: 12, backgroundColor: '#F9FAFB', borderBottomWidth: 1, borderBottomColor: '#E5E7EB', fontSize: 12, fontWeight: '700', color: '#6B7280' },
  residentsScroll: { maxHeight: 250 },
  residentListItem: { flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  avatarBadgeSmall: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#dcfce7', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  avatarTextSmall: { fontSize: 12, fontWeight: 'bold', color: '#064e3b' },
  residentListName: { fontSize: 14, fontWeight: '600', color: '#111827' },
  residentListEmail: { fontSize: 12, color: '#4B5563' },
  avatarBadge: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#dcfce7', alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 14, fontWeight: 'bold', color: '#064e3b' },
  
  roleBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, borderWidth: 1 },
  roleText: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },

  quickToggleBtn: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, borderWidth: 1 },
  quickTogglePromote: { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' },
  quickToggleDemote: { backgroundColor: '#FEF2F2', borderColor: '#FECACA' },
  quickToggleText: { fontSize: 11, fontWeight: '700' },
  
  assignmentRow: { flexDirection: 'row', gap: 24 },
  dropdown: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#F9FAFB', padding: 14, borderRadius: 8, borderWidth: 1, borderColor: '#E5E7EB' },
  dropdownText: { fontSize: 14, color: '#111827' },
  dropdownMenu: { position: 'absolute', top: 52, left: 0, right: 0, backgroundColor: '#FFFFFF', borderRadius: 8, borderWidth: 1, borderColor: '#E5E7EB', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 5 },
  dropdownItem: { padding: 12, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  dropdownItemText: { fontSize: 14, color: '#374151' },
  
  infoBox: { flex: 1, flexDirection: 'row', backgroundColor: '#F6FBF7', padding: 20, borderRadius: 8, borderWidth: 1, borderColor: '#dcfce7', gap: 12, marginTop: 20 },
  infoIcon: { marginTop: 2 },
  infoTitle: { fontSize: 14, fontWeight: '600', color: '#111827', marginBottom: 4 },
  infoText: { fontSize: 12, color: '#4B5563', lineHeight: 18 },
  
  actionsRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 16, marginBottom: 32 },
  primaryBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 14, paddingHorizontal: 32, borderRadius: 8, backgroundColor: '#2E8B57' },
  primaryBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
});
