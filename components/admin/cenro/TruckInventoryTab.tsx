import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert, Modal, useWindowDimensions } from 'react-native';
import { MaterialIcons, FontAwesome5 } from '@expo/vector-icons';
import { collection, onSnapshot, addDoc, doc, updateDoc, serverTimestamp, query, orderBy, where, getDocs } from 'firebase/firestore';
import { db } from '../../../config/firebase';

interface Truck {
  id: string;
  plateNumber: string;
  type: string;
  capacity: string;
  status: 'active' | 'maintenance' | 'out_of_service';
  assignedDriverId?: string;
  assignedDriverName?: string;
  shiftStartedAt?: any;
  createdAt: any;
}

export default function TruckInventoryTab() {
  const { width } = useWindowDimensions();
  const isMobile = width < 768;
  const [trucks, setTrucks] = useState<Truck[]>([]);
  const [loading, setLoading] = useState(true);

  // Form State
  const [plateNumber, setPlateNumber] = useState('');
  const [truckType, setTruckType] = useState('Compactor');
  const [capacity, setCapacity] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  
  // History Modal State
  const [historyModalVisible, setHistoryModalVisible] = useState(false);
  const [selectedTruck, setSelectedTruck] = useState<Truck | null>(null);
  const [historyFilter, setHistoryFilter] = useState<'week' | 'month' | 'all'>('week');
  const [truckHistory, setTruckHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  useEffect(() => {
    if (!db) return;
    const q = query(collection(db, 'trucks'), orderBy('createdAt', 'desc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data: Truck[] = [];
      snapshot.forEach(doc => {
        data.push({ id: doc.id, ...doc.data() } as Truck);
      });
      setTrucks(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleAddTruck = async () => {
    if (!plateNumber.trim() || !capacity.trim()) {
      Alert.alert('Missing Fields', 'Please fill in the plate number and capacity.');
      return;
    }

    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'trucks'), {
        plateNumber: plateNumber.toUpperCase().trim(),
        type: truckType,
        capacity: capacity.trim(),
        status: 'active',
        createdAt: serverTimestamp(),
      });
      
      setPlateNumber('');
      setCapacity('');
      setShowAddForm(false);
      Alert.alert('Success', 'Truck added to the inventory.');
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Failed to add truck.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateStatus = async (id: string, newStatus: string) => {
    try {
      await updateDoc(doc(db, 'trucks', id), {
        status: newStatus,
        updatedAt: serverTimestamp(),
      });
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Failed to update status.');
    }
  };

  const handleUnassignDriver = async (truckId: string) => {
    const truck = trucks.find(t => t.id === truckId);
    if (!truck) return;

    Alert.alert(
      'Unassign Driver',
      `Remove ${truck.assignedDriverName || 'driver'} from ${truck.plateNumber}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unassign',
          style: 'destructive',
          onPress: async () => {
            try {
              // Clear driver assignment from truck
              await updateDoc(doc(db, 'trucks', truckId), {
                assignedDriverId: null,
                assignedDriverName: null,
                shiftStartedAt: null,
                updatedAt: serverTimestamp(),
              });

              // Clear truck from driver's user doc
              if (truck.assignedDriverId) {
                try {
                  await updateDoc(doc(db, 'users', truck.assignedDriverId), {
                    currentTruckId: null,
                    currentTruckPlate: null,
                  });
                } catch (userErr) {
                  console.warn('Could not clear driver user doc:', userErr);
                }
              }
            } catch (e) {
              console.error(e);
              Alert.alert('Error', 'Failed to unassign driver.');
            }
          },
        },
      ]
    );
  };

  const activeCount = trucks.filter(t => t.status === 'active').length;
  const maintenanceCount = trucks.filter(t => t.status === 'maintenance').length;
  const outCount = trucks.filter(t => t.status === 'out_of_service').length;
  const deployedCount = trucks.filter(t => t.assignedDriverId).length;

  useEffect(() => {
    async function fetchHistory() {
      if (!selectedTruck || !db) return;
      setLoadingHistory(true);
      
      try {
        const ref = collection(db, 'schedules');
        // Schedules usually store the truck plate or name in the 'truck' field
        const qy = query(ref, where('truck', '==', selectedTruck.plateNumber));
        const snap = await getDocs(qy);
        
        let allHist = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
        
        // Client-side sort to avoid index requirements
        allHist.sort((a, b) => {
          const aTime = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
          const bTime = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
          return bTime - aTime;
        });
        
        // Filter by time
        const now = new Date();
        let cutoff = new Date(0); // All time
        
        if (historyFilter === 'week') {
          cutoff = new Date();
          cutoff.setDate(now.getDate() - 7);
        } else if (historyFilter === 'month') {
          cutoff = new Date();
          cutoff.setMonth(now.getMonth() - 1);
        }
        
        const filtered = allHist.filter((r) => {
          if (!r.createdAt) return false;
          const createdMs = r.createdAt?.toDate ? r.createdAt.toDate().getTime() : new Date(r.createdAt).getTime();
          return createdMs >= cutoff.getTime() && ['completed', 'issue', 'resolved', 'done'].includes((r.status || '').toLowerCase());
        });
        
        // Map to display format
        const formatted = filtered.map(item => {
           const d = item.createdAt?.toDate ? item.createdAt.toDate() : (item.createdAt ? new Date(item.createdAt) : new Date());
           return {
             id: item.id,
             date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
             time: d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
             driver: item.driver || 'Unknown Driver',
             route: item.barangayName || item.streetName || 'Unknown Route',
             status: (item.status === 'issue') ? 'issue' : 'completed'
           };
        });
        
        setTruckHistory(formatted);
      } catch (err) {
        console.error("Error fetching truck history:", err);
        setTruckHistory([]);
      } finally {
        setLoadingHistory(false);
      }
    }
    
    fetchHistory();
  }, [selectedTruck, historyFilter]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2E8B57" />
        <Text style={styles.loadingText}>Loading fleet data...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={[styles.container, isMobile && { padding: 16 }]}>
      <View style={[styles.headerRow, isMobile && { flexDirection: 'column', gap: 12 }]}>
        <View>
          <Text style={styles.headerTitle}>Fleet Inventory</Text>
          <Text style={styles.headerDesc}>Manage and monitor municipal garbage trucks.</Text>
        </View>
        <TouchableOpacity style={[styles.primaryBtn, isMobile && { width: '100%', justifyContent: 'center' }]} onPress={() => setShowAddForm(!showAddForm)}>
          <MaterialIcons name={showAddForm ? "close" : "add"} size={20} color="#FFF" />
          <Text style={styles.primaryBtnText}>{showAddForm ? "Cancel" : "Add New Truck"}</Text>
        </TouchableOpacity>
      </View>

      {/* Summary Cards */}
      <View style={[styles.summaryGrid, isMobile && { gap: 10 }]}>
        <View style={[styles.summaryCard, isMobile && { width: '48%', minWidth: 130 }]}>
          <View style={styles.summaryIconBg}>
            <MaterialIcons name="local-shipping" size={24} color="#2E8B57" />
          </View>
          <View>
            <Text style={styles.summaryTitle}>Total Fleet</Text>
            <Text style={styles.summaryValue}>{trucks.length}</Text>
          </View>
        </View>
        
        <View style={[styles.summaryCard, isMobile && { width: '48%', minWidth: 130 }]}>
          <View style={[styles.summaryIconBg, { backgroundColor: '#ECFDF5' }]}>
            <MaterialIcons name="check-circle" size={24} color="#059669" />
          </View>
          <View>
            <Text style={styles.summaryTitle}>Active</Text>
            <Text style={[styles.summaryValue, { color: '#059669' }]}>{activeCount}</Text>
          </View>
        </View>

        <View style={[styles.summaryCard, isMobile && { width: '48%', minWidth: 130 }]}>
          <View style={[styles.summaryIconBg, { backgroundColor: '#EDE9FE' }]}>
            <MaterialIcons name="person-pin" size={24} color="#7C3AED" />
          </View>
          <View>
            <Text style={styles.summaryTitle}>Deployed</Text>
            <Text style={[styles.summaryValue, { color: '#7C3AED' }]}>{deployedCount}</Text>
          </View>
        </View>

        <View style={[styles.summaryCard, isMobile && { width: '48%', minWidth: 130 }]}>
          <View style={[styles.summaryIconBg, { backgroundColor: '#FEF3C7' }]}>
            <MaterialIcons name="build" size={24} color="#D97706" />
          </View>
          <View>
            <Text style={styles.summaryTitle}>Maintenance</Text>
            <Text style={[styles.summaryValue, { color: '#D97706' }]}>{maintenanceCount}</Text>
          </View>
        </View>

        <View style={[styles.summaryCard, isMobile && { width: '48%', minWidth: 130 }]}>
          <View style={[styles.summaryIconBg, { backgroundColor: '#FEE2E2' }]}>
            <MaterialIcons name="block" size={24} color="#DC2626" />
          </View>
          <View>
            <Text style={styles.summaryTitle}>Out of Service</Text>
            <Text style={[styles.summaryValue, { color: '#DC2626' }]}>{outCount}</Text>
          </View>
        </View>
      </View>

      {/* Add Truck Form */}
      {showAddForm && (
        <View style={styles.formCard}>
          <Text style={styles.cardTitle}>Register New Truck</Text>
          <View style={styles.formGrid}>
            <View style={styles.formGroup}>
              <Text style={styles.label}>PLATE NUMBER</Text>
              <TextInput 
                style={styles.input} 
                placeholder="e.g. ABC-1234" 
                value={plateNumber}
                onChangeText={setPlateNumber}
                placeholderTextColor="#9CA3AF" 
              />
            </View>
            
            <View style={styles.formGroup}>
              <Text style={styles.label}>TRUCK TYPE</Text>
              <View style={styles.typeSelector}>
                {['Compactor', 'Dump Truck', 'Mini-Dump'].map(type => (
                  <TouchableOpacity 
                    key={type} 
                    style={[styles.typeBtn, truckType === type && styles.typeBtnActive]}
                    onPress={() => setTruckType(type)}
                  >
                    <Text style={[styles.typeBtnText, truckType === type && styles.typeBtnTextActive]}>
                      {type}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>CAPACITY (Tons)</Text>
              <TextInput 
                style={styles.input} 
                placeholder="e.g. 5" 
                value={capacity}
                onChangeText={setCapacity}
                keyboardType="numeric"
                placeholderTextColor="#9CA3AF" 
              />
            </View>
          </View>

          <View style={styles.formFooter}>
            <TouchableOpacity 
              style={[styles.primaryBtn, isSubmitting && styles.primaryBtnDisabled]} 
              onPress={handleAddTruck}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <>
                  <MaterialIcons name="save" size={18} color="#FFF" />
                  <Text style={styles.primaryBtnText}>Save Truck</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Trucks Table */}
      <View style={[styles.tableCard, isMobile && { padding: 12 }]}>
        <Text style={styles.cardTitle}>Fleet Roster</Text>
        
        <ScrollView 
          horizontal={isMobile} 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ flexGrow: 1, minWidth: '100%' }}
          style={{ width: '100%' }}
        >
          <View style={{ minWidth: isMobile ? 650 : '100%', width: '100%' }}>
            <View style={styles.tableHead}>
              <Text style={[styles.th, { flex: 1.5 }]}>VEHICLE INFO</Text>
              <Text style={[styles.th, { flex: 1 }]}>CAPACITY</Text>
              <Text style={[styles.th, { flex: 1.5 }]}>ASSIGNED DRIVER</Text>
              <Text style={[styles.th, { flex: 1.5 }]}>STATUS</Text>
              <Text style={[styles.th, { flex: 1, textAlign: 'right' }]}>ACTIONS</Text>
            </View>

            {trucks.length === 0 ? (
              <View style={styles.emptyTable}>
                <Text style={styles.emptyText}>No trucks registered in the fleet.</Text>
              </View>
            ) : (
              trucks.map(truck => (
                <View key={truck.id} style={styles.tr}>
                  <View style={[styles.td, { flex: 1.5, flexDirection: 'row', alignItems: 'center', gap: 12 }]}>
                    <View style={styles.avatarBg}>
                      <FontAwesome5 name="truck" size={16} color="#4B5563" />
                    </View>
                    <View>
                      <Text style={styles.truckPlate}>{truck.plateNumber}</Text>
                      <Text style={styles.truckType}>{truck.type}</Text>
                    </View>
                  </View>
                  
                  <View style={[styles.td, { flex: 1, justifyContent: 'center' }]}>
                    <Text style={styles.capacityText}>{truck.capacity} Tons</Text>
                  </View>

                  <View style={[styles.td, { flex: 1.5, justifyContent: 'center' }]}>
                    {truck.assignedDriverId ? (
                      <View style={styles.driverAssignedBadge}>
                        <MaterialIcons name="person" size={14} color="#7C3AED" />
                        <Text style={styles.driverAssignedText} numberOfLines={1}>{truck.assignedDriverName || 'Unknown'}</Text>
                      </View>
                    ) : (
                      <Text style={styles.unassignedText}>Unassigned</Text>
                    )}
                  </View>
                  
                  <View style={[styles.td, { flex: 1.5, justifyContent: 'center' }]}>
                    <View style={[
                      styles.statusBadge, 
                      truck.status === 'active' ? styles.statusActive : 
                      truck.status === 'maintenance' ? styles.statusMaintenance : styles.statusOut
                    ]}>
                      <View style={[
                        styles.statusDot, 
                        truck.status === 'active' ? {backgroundColor: '#059669'} : 
                        truck.status === 'maintenance' ? {backgroundColor: '#D97706'} : {backgroundColor: '#DC2626'}
                      ]} />
                      <Text style={[
                        styles.statusText,
                        truck.status === 'active' ? {color: '#059669'} : 
                        truck.status === 'maintenance' ? {color: '#D97706'} : {color: '#DC2626'}
                      ]}>
                        {truck.status === 'active' ? 'Active' : 
                         truck.status === 'maintenance' ? 'Maintenance' : 'Out of Service'}
                      </Text>
                    </View>
                  </View>
                  
                  <View style={[styles.td, { flex: 1, flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 8 }]}>
                    <TouchableOpacity onPress={() => { setSelectedTruck(truck); setHistoryModalVisible(true); }} style={styles.actionBtn}>
                      <MaterialIcons name="history" size={20} color="#4B5563" />
                    </TouchableOpacity>
                    {truck.assignedDriverId && (
                      <TouchableOpacity onPress={() => handleUnassignDriver(truck.id)} style={styles.actionBtn}>
                        <MaterialIcons name="person-remove" size={18} color="#7C3AED" />
                      </TouchableOpacity>
                    )}
                    {truck.status !== 'active' && (
                      <TouchableOpacity onPress={() => handleUpdateStatus(truck.id, 'active')} style={styles.actionBtn}>
                        <MaterialIcons name="check-circle" size={20} color="#059669" />
                      </TouchableOpacity>
                    )}
                    {truck.status !== 'maintenance' && (
                      <TouchableOpacity onPress={() => handleUpdateStatus(truck.id, 'maintenance')} style={styles.actionBtn}>
                        <MaterialIcons name="build" size={20} color="#D97706" />
                      </TouchableOpacity>
                    )}
                    {truck.status !== 'out_of_service' && (
                      <TouchableOpacity onPress={() => handleUpdateStatus(truck.id, 'out_of_service')} style={styles.actionBtn}>
                        <MaterialIcons name="block" size={20} color="#DC2626" />
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
      
      {/* Truck History Modal */}
      <Modal visible={historyModalVisible} transparent animationType="fade" onRequestClose={() => setHistoryModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {selectedTruck && (
              <>
                <View style={styles.modalHeader}>
                  <View>
                    <Text style={styles.modalTitle}>{selectedTruck.plateNumber} History</Text>
                    <Text style={styles.modalSubtitle}>{selectedTruck.type} • {selectedTruck.capacity} Tons</Text>
                  </View>
                  <TouchableOpacity onPress={() => setHistoryModalVisible(false)} style={styles.modalCloseBtn}>
                    <MaterialIcons name="close" size={24} color="#6B7280" />
                  </TouchableOpacity>
                </View>

                {/* Filters */}
                <View style={styles.filterRow}>
                  {['week', 'month', 'all'].map((f) => (
                    <TouchableOpacity 
                      key={f} 
                      style={[styles.filterChip, historyFilter === f && styles.filterChipActive]}
                      onPress={() => setHistoryFilter(f as any)}
                    >
                      <Text style={[styles.filterChipText, historyFilter === f && styles.filterChipTextActive]}>
                        {f === 'week' ? 'Past Week' : f === 'month' ? 'Past Month' : 'All Time'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <ScrollView style={styles.historyList}>
                  {loadingHistory ? (
                    <ActivityIndicator size="small" color="#2E8B57" style={{ marginTop: 20 }} />
                  ) : truckHistory.length === 0 ? (
                    <Text style={{ textAlign: 'center', color: '#6B7280', marginTop: 20 }}>No completed routes found for this period.</Text>
                  ) : (
                    truckHistory.map((item) => (
                      <View key={item.id} style={styles.historyItem}>
                      <View style={styles.historyTimeCol}>
                        <Text style={styles.historyDate}>{item.date}</Text>
                        <Text style={styles.historyTime}>{item.time}</Text>
                      </View>
                      
                      <View style={styles.historyDivider}>
                        <View style={[styles.historyDot, item.status === 'issue' && {backgroundColor: '#ef4444'}]} />
                        <View style={styles.historyLine} />
                      </View>
                      
                      <View style={styles.historyDetails}>
                        <Text style={styles.historyDriver}>
                          <MaterialIcons name="person" size={14} color="#6B7280" /> {item.driver}
                        </Text>
                        <Text style={styles.historyRoute}>
                          <MaterialIcons name="place" size={14} color="#6B7280" /> {item.route}
                        </Text>
                        <View style={[styles.historyStatus, item.status === 'issue' ? styles.statusOut : styles.statusActive]}>
                          <Text style={[styles.statusText, item.status === 'issue' ? {color: '#DC2626'} : {color: '#059669'}]}>
                            {item.status === 'issue' ? 'Issue Reported' : 'Completed'}
                          </Text>
                        </View>
                      </View>
                    </View>
                  )))}
                </ScrollView>
              </>
            )}
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB', padding: 24 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F9FAFB' },
  loadingText: { marginTop: 12, color: '#6B7280', fontSize: 14 },
  
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 },
  headerTitle: { fontSize: 24, fontWeight: '800', color: '#111827', marginBottom: 4 },
  headerDesc: { fontSize: 14, color: '#6B7280' },

  primaryBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#2E8B57', paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8 },
  primaryBtnDisabled: { opacity: 0.5 },
  primaryBtnText: { color: '#FFF', fontSize: 14, fontWeight: '600' },

  summaryGrid: { flexDirection: 'row', gap: 16, marginBottom: 24, flexWrap: 'wrap' },
  summaryCard: { flex: 1, minWidth: 200, backgroundColor: '#FFF', padding: 20, borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB', flexDirection: 'row', alignItems: 'center', gap: 16 },
  summaryIconBg: { width: 48, height: 48, borderRadius: 12, backgroundColor: '#E8F5E9', justifyContent: 'center', alignItems: 'center' },
  summaryTitle: { fontSize: 13, color: '#6B7280', fontWeight: '500', marginBottom: 4 },
  summaryValue: { fontSize: 24, fontWeight: '800', color: '#111827' },

  formCard: { backgroundColor: '#FFF', padding: 24, borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB', marginBottom: 24 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 20 },
  formGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 20 },
  formGroup: { flex: 1, minWidth: 250 },
  label: { fontSize: 12, fontWeight: '700', color: '#6B7280', marginBottom: 8, letterSpacing: 0.5 },
  input: { backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, paddingHorizontal: 16, paddingVertical: 12, fontSize: 14, color: '#111827' },
  
  typeSelector: { flexDirection: 'row', gap: 8 },
  typeBtn: { flex: 1, paddingVertical: 12, alignItems: 'center', backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8 },
  typeBtnActive: { backgroundColor: '#E8F5E9', borderColor: '#2E8B57' },
  typeBtnText: { fontSize: 13, fontWeight: '600', color: '#4B5563' },
  typeBtnTextActive: { color: '#2E8B57' },
  
  formFooter: { marginTop: 24, alignItems: 'flex-end' },

  tableCard: { backgroundColor: '#FFF', borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB', overflow: 'hidden', padding: 20 },
  table: { width: '100%' },
  tableHead: { flexDirection: 'row', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#E5E7EB', backgroundColor: '#F9FAFB', paddingHorizontal: 16, borderRadius: 8 },
  th: { fontSize: 12, fontWeight: '700', color: '#6B7280', letterSpacing: 0.5 },
  tr: { flexDirection: 'row', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#F3F4F6', paddingHorizontal: 16 },
  td: { justifyContent: 'flex-start' },
  
  avatarBg: { width: 40, height: 40, borderRadius: 8, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center' },
  truckPlate: { fontSize: 15, fontWeight: '700', color: '#111827' },
  truckType: { fontSize: 13, color: '#6B7280', marginTop: 2 },
  
  capacityText: { fontSize: 14, fontWeight: '600', color: '#374151' },
  
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, alignSelf: 'flex-start' },
  statusActive: { backgroundColor: '#ECFDF5' },
  statusMaintenance: { backgroundColor: '#FEF3C7' },
  statusOut: { backgroundColor: '#FEE2E2' },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 12, fontWeight: '600' },
  
  actionBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#F9FAFB', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#E5E7EB' },
  
  driverAssignedBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 16, backgroundColor: '#EDE9FE', alignSelf: 'flex-start' },
  driverAssignedText: { fontSize: 12, fontWeight: '600', color: '#7C3AED', maxWidth: 120 },
  unassignedText: { fontSize: 12, color: '#9CA3AF', fontStyle: 'italic' },

  emptyTable: { padding: 40, alignItems: 'center' },
  emptyText: { color: '#9CA3AF', fontSize: 14 },
  
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: '90%', maxWidth: 600, backgroundColor: '#FFF', borderRadius: 16, padding: 24, maxHeight: '80%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: '800', color: '#111827' },
  modalSubtitle: { fontSize: 14, color: '#6B7280', marginTop: 4 },
  modalCloseBtn: { padding: 4 },
  
  filterRow: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  filterChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: '#E5E7EB' },
  filterChipActive: { backgroundColor: '#E8F5E9', borderColor: '#2E8B57' },
  filterChipText: { fontSize: 13, fontWeight: '600', color: '#4B5563' },
  filterChipTextActive: { color: '#2E8B57' },
  
  historyList: { flex: 1 },
  historyItem: { flexDirection: 'row', marginBottom: 16 },
  historyTimeCol: { width: 90, alignItems: 'flex-end', paddingTop: 2 },
  historyDate: { fontSize: 13, fontWeight: '700', color: '#111827' },
  historyTime: { fontSize: 11, color: '#6B7280', marginTop: 2 },
  historyDivider: { width: 30, alignItems: 'center', marginHorizontal: 8 },
  historyDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#2E8B57', zIndex: 1 },
  historyLine: { width: 2, flex: 1, backgroundColor: '#E5E7EB', position: 'absolute', top: 12, bottom: -16 },
  historyDetails: { flex: 1, backgroundColor: '#F9FAFB', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#E5E7EB' },
  historyDriver: { fontSize: 14, fontWeight: '700', color: '#111827', marginBottom: 4 },
  historyRoute: { fontSize: 13, color: '#4B5563', marginBottom: 8 },
  historyStatus: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
});
