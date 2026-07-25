import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Modal, Image } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { collection, query, where, getDocs, doc, updateDoc, addDoc, serverTimestamp, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '../../../config/firebase';
import { sendTestNotification as sendTestNotificationHelper } from '../../../app/(tabs)/home.notifications';

interface Report {
  id: string;
  title: string;
  description: string;
  street: string;
  barangay: string;
  status: string;
  imageURL?: string;
  createdAt: any;
  userEmail: string;
  userId: string;
}

interface Driver {
  id: string;
  displayName: string;
  email: string;
}

export default function RouteOptimizationTab() {
  const [reports, setReports] = useState<Report[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReports, setSelectedReports] = useState<Set<string>>(new Set());
  const [selectedDriver, setSelectedDriver] = useState<string>('');
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [optimizedRoute, setOptimizedRoute] = useState<Report[]>([]);
  const [showDispatchModal, setShowDispatchModal] = useState(false);
  const [isDispatching, setIsDispatching] = useState(false);

  useEffect(() => {
    if (!db) return;

    // Listen to pending/acknowledged reports
    const reportsRef = collection(db, 'reports');
    const reportsQuery = query(reportsRef, where('status', 'in', ['pending', 'acknowledged']));
    
    const unsubscribeReports = onSnapshot(reportsQuery, (snapshot) => {
      const data: Report[] = [];
      snapshot.forEach(doc => {
        data.push({ id: doc.id, ...doc.data() } as Report);
      });
      // Sort locally to ensure stable order
      data.sort((a, b) => b.createdAt - a.createdAt);
      setReports(data);
    });

    // Fetch drivers
    const fetchDrivers = async () => {
      try {
        const usersRef = collection(db, 'users');
        // Fetch all users to find drivers (if no role field, we'll just show all for demo, or hardcode role checks)
        const snap = await getDocs(usersRef);
        const driverList: Driver[] = [];
        snap.forEach(d => {
          const u = d.data();
          if (u.role === 'driver' || u.role === 'admin') { // include admin for testing
            driverList.push({ id: d.id, displayName: u.displayName || u.email || 'Unknown', email: u.email });
          }
        });
        setDrivers(driverList);
        setLoading(false);
      } catch (e) {
        console.error('Error fetching drivers', e);
        setLoading(false);
      }
    };
    
    fetchDrivers();

    return () => unsubscribeReports();
  }, []);

  const toggleReportSelection = (id: string) => {
    const newSet = new Set(selectedReports);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedReports(newSet);
  };

  const selectAll = () => {
    const newSet = new Set(reports.map(r => r.id));
    setSelectedReports(newSet);
  };

  const handleOptimizeRoute = () => {
    if (selectedReports.size === 0) {
      Alert.alert('Selection Empty', 'Please select at least one report to route.');
      return;
    }
    if (!selectedDriver) {
      Alert.alert('No Driver', 'Please select a driver to assign this route to.');
      return;
    }

    setIsOptimizing(true);
    
    // Simulate AI Optimization logic (Delay + Greedy Sort by Barangay grouping)
    setTimeout(() => {
      const selectedData = reports.filter(r => selectedReports.has(r.id));
      
      // Simulated Routing Algorithm: Group by Barangay, then order by creation date
      selectedData.sort((a, b) => {
        if (a.barangay === b.barangay) {
          return a.createdAt - b.createdAt;
        }
        return a.barangay.localeCompare(b.barangay);
      });

      setOptimizedRoute(selectedData);
      setIsOptimizing(false);
      setShowDispatchModal(true);
    }, 1500);
  };

  const handleDispatch = async () => {
    setIsDispatching(true);
    try {
      const driverObj = drivers.find(d => d.id === selectedDriver);
      const driverName = driverObj?.displayName || 'Assigned Driver';
      const today = new Date();
      const dateText = today.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
      
      for (let i = 0; i < optimizedRoute.length; i++) {
        const report = optimizedRoute[i];
        
        // 1. Create a schedule/dispatch for the driver
        await addDoc(collection(db, 'schedules'), {
          street: report.street,
          barangay: report.barangay,
          wasteCategory: 'Citizen Report', // Special category
          timeText: 'ASAP',
          dateText: dateText,
          status: 'pending',
          driver: driverName,
          assignedDriverId: selectedDriver,
          reportId: report.id,
          routeOrder: i + 1,
          isLiveDispatch: true,
          createdAt: serverTimestamp(),
        });

        // 2. Update the original report status to in-progress
        await updateDoc(doc(db, 'reports', report.id), {
          status: 'in progress',
          adminNote: `Dispatched to driver ${driverName}`,
          updatedAt: serverTimestamp(),
        });

        // 3. Notify the resident
        await addDoc(collection(db, 'notifications'), {
          userId: report.userId,
          title: 'Report Dispatched',
          body: `Your report at ${report.street} has been dispatched to a collection truck.`,
          type: 'report_update',
          read: false,
          createdAt: serverTimestamp(),
        });
      }

      Alert.alert('Dispatch Successful', `Successfully dispatched ${optimizedRoute.length} locations to ${driverName}.`);
      setShowDispatchModal(false);
      setSelectedReports(new Set());
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Failed to dispatch route.');
    } finally {
      setIsDispatching(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2E8B57" />
        <Text style={styles.loadingText}>Loading reports & drivers...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.headerTitle}>AI Route Optimization</Text>
          <Text style={styles.headerDesc}>Generate and dispatch efficient routes for verified citizen reports.</Text>
        </View>
      </View>

      <View style={styles.mainGrid}>
        {/* Left Column - Report Selection */}
        <View style={styles.leftColumn}>
          <View style={styles.card}>
            <View style={styles.cardHeaderRow}>
              <Text style={styles.cardTitle}>Verified Reports Queue</Text>
              <TouchableOpacity style={styles.textBtn} onPress={selectAll}>
                <Text style={styles.textBtnText}>Select All</Text>
              </TouchableOpacity>
            </View>

            {reports.length === 0 ? (
              <View style={styles.emptyBox}>
                <MaterialIcons name="done-all" size={32} color="#9CA3AF" />
                <Text style={styles.emptyText}>No pending reports to route.</Text>
              </View>
            ) : (
              reports.map((report) => {
                const isSelected = selectedReports.has(report.id);
                return (
                  <TouchableOpacity 
                    key={report.id} 
                    style={[styles.reportItem, isSelected && styles.reportItemSelected]}
                    onPress={() => toggleReportSelection(report.id)}
                  >
                    <View style={styles.checkbox}>
                      {isSelected && <MaterialIcons name="check" size={16} color="#FFF" />}
                    </View>
                    <View style={styles.reportImageBg}>
                      {report.imageURL ? (
                        <Image source={{ uri: report.imageURL }} style={styles.reportImg} />
                      ) : (
                        <MaterialIcons name="image" size={20} color="#9CA3AF" />
                      )}
                    </View>
                    <View style={styles.reportContent}>
                      <Text style={styles.reportStreet}>{report.street}, {report.barangay}</Text>
                      <Text style={styles.reportDesc} numberOfLines={1}>{report.description}</Text>
                    </View>
                    <View style={[styles.badge, { backgroundColor: report.status === 'pending' ? '#FEF3C7' : '#DBEAFE' }]}>
                      <Text style={[styles.badgeText, { color: report.status === 'pending' ? '#D97706' : '#2563EB' }]}>
                        {report.status.toUpperCase()}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </View>
        </View>

        {/* Right Column - Routing Controls */}
        <View style={styles.rightColumn}>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Routing Engine</Text>
            
            <Text style={styles.label}>1. SELECT ASSIGNED DRIVER</Text>
            <View style={styles.pickerContainer}>
              {drivers.length === 0 ? (
                <Text style={styles.noDriverText}>No active drivers found</Text>
              ) : (
                drivers.map(d => (
                  <TouchableOpacity 
                    key={d.id} 
                    style={[styles.driverPill, selectedDriver === d.id && styles.driverPillActive]}
                    onPress={() => setSelectedDriver(d.id)}
                  >
                    <MaterialIcons name="person" size={16} color={selectedDriver === d.id ? '#FFF' : '#4B5563'} />
                    <Text style={[styles.driverPillText, selectedDriver === d.id && styles.driverPillTextActive]}>
                      {d.displayName}
                    </Text>
                  </TouchableOpacity>
                ))
              )}
            </View>

            <Text style={styles.label}>2. OPTIMIZATION SUMMARY</Text>
            <View style={styles.statsBox}>
              <View style={styles.statItem}>
                <Text style={styles.statVal}>{selectedReports.size}</Text>
                <Text style={styles.statLabel}>Pickups</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statVal}>
                  {selectedReports.size > 0 ? '~' + (selectedReports.size * 15) : '0'}
                </Text>
                <Text style={styles.statLabel}>Est. Mins</Text>
              </View>
            </View>

            <TouchableOpacity 
              style={[styles.primaryBtn, (selectedReports.size === 0 || !selectedDriver) && styles.primaryBtnDisabled]} 
              onPress={handleOptimizeRoute}
              disabled={selectedReports.size === 0 || !selectedDriver || isOptimizing}
            >
              {isOptimizing ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <>
                  <MaterialIcons name="route" size={20} color="#FFF" />
                  <Text style={styles.primaryBtnText}>Generate Route</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
          
          <View style={styles.infoBox}>
            <MaterialIcons name="auto-awesome" size={20} color="#2563EB" style={{ marginTop: 2 }} />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.infoTitle}>AI Optimization</Text>
              <Text style={styles.infoDesc}>The routing engine considers geographic proximity, truck capacity, and priority to generate the most fuel-efficient collection path.</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Dispatch Modal */}
      <Modal visible={showDispatchModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Generated Route Map</Text>
              <TouchableOpacity onPress={() => !isDispatching && setShowDispatchModal(false)}>
                <MaterialIcons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <Text style={styles.modalSubtitle}>Optimized Collection Sequence:</Text>
              {optimizedRoute.map((report, idx) => (
                <View key={report.id} style={styles.routeItem}>
                  <View style={styles.routeNumberBg}>
                    <Text style={styles.routeNumber}>{idx + 1}</Text>
                  </View>
                  <View style={styles.routeDetails}>
                    <Text style={styles.routeStreet}>{report.street}</Text>
                    <Text style={styles.routeBrgy}>{report.barangay}</Text>
                  </View>
                </View>
              ))}
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity 
                style={styles.cancelBtn} 
                onPress={() => setShowDispatchModal(false)}
                disabled={isDispatching}
              >
                <Text style={styles.cancelBtnText}>Discard</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.confirmBtn} 
                onPress={handleDispatch}
                disabled={isDispatching}
              >
                {isDispatching ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <>
                    <MaterialIcons name="send" size={18} color="#FFF" />
                    <Text style={styles.confirmBtnText}>Dispatch to Driver</Text>
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
  container: { flex: 1, backgroundColor: '#F9FAFB', padding: 24 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F9FAFB' },
  loadingText: { marginTop: 12, color: '#6B7280', fontSize: 14 },
  
  headerRow: { marginBottom: 24 },
  headerTitle: { fontSize: 24, fontWeight: '800', color: '#111827', marginBottom: 4 },
  headerDesc: { fontSize: 14, color: '#6B7280' },

  mainGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 24 },
  leftColumn: { flex: 1, minWidth: 400 },
  rightColumn: { width: 320 },

  card: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 20, borderWidth: 1, borderColor: '#E5E7EB', marginBottom: 20 },
  cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 16 },
  
  textBtn: { padding: 4 },
  textBtnText: { color: '#2E8B57', fontWeight: '600', fontSize: 13 },

  emptyBox: { padding: 40, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F9FAFB', borderRadius: 8, borderWidth: 1, borderColor: '#E5E7EB', borderStyle: 'dashed' },
  emptyText: { marginTop: 12, color: '#9CA3AF', fontSize: 14 },

  reportItem: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#E5E7EB', marginBottom: 8, backgroundColor: '#FFF' },
  reportItemSelected: { borderColor: '#2E8B57', backgroundColor: '#F6FBF7' },
  checkbox: { width: 20, height: 20, borderRadius: 4, borderWidth: 2, borderColor: '#D1D5DB', marginRight: 12, justifyContent: 'center', alignItems: 'center' },
  reportImageBg: { width: 40, height: 40, borderRadius: 6, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center', marginRight: 12, overflow: 'hidden' },
  reportImg: { width: 40, height: 40 },
  reportContent: { flex: 1 },
  reportStreet: { fontSize: 14, fontWeight: '600', color: '#111827' },
  reportDesc: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  badgeText: { fontSize: 10, fontWeight: '700' },

  label: { fontSize: 12, fontWeight: '700', color: '#6B7280', marginBottom: 8, marginTop: 16, letterSpacing: 0.5 },
  pickerContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  noDriverText: { color: '#9CA3AF', fontSize: 13, fontStyle: 'italic' },
  driverPill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: '#E5E7EB' },
  driverPillActive: { backgroundColor: '#2E8B57', borderColor: '#2E8B57' },
  driverPillText: { fontSize: 13, fontWeight: '600', color: '#4B5563' },
  driverPillTextActive: { color: '#FFF' },

  statsBox: { flexDirection: 'row', backgroundColor: '#F9FAFB', borderRadius: 8, padding: 16, borderWidth: 1, borderColor: '#E5E7EB', marginBottom: 24 },
  statItem: { flex: 1, alignItems: 'center' },
  statDivider: { width: 1, backgroundColor: '#E5E7EB' },
  statVal: { fontSize: 24, fontWeight: '800', color: '#111827' },
  statLabel: { fontSize: 12, color: '#6B7280', fontWeight: '500', marginTop: 4 },

  primaryBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#2E8B57', paddingVertical: 14, borderRadius: 8 },
  primaryBtnDisabled: { opacity: 0.5 },
  primaryBtnText: { color: '#FFF', fontSize: 15, fontWeight: '700' },

  infoBox: { flexDirection: 'row', backgroundColor: '#EFF6FF', padding: 16, borderRadius: 8, borderWidth: 1, borderColor: '#BFDBFE' },
  infoTitle: { fontSize: 14, fontWeight: '700', color: '#1E3A8A', marginBottom: 4 },
  infoDesc: { fontSize: 12, color: '#2563EB', lineHeight: 18 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: '#FFFFFF', borderRadius: 12, width: '90%', maxWidth: 480, maxHeight: '80%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
  modalBody: { padding: 20 },
  modalSubtitle: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 16 },
  
  routeItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  routeNumberBg: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#2E8B57', justifyContent: 'center', alignItems: 'center' },
  routeNumber: { color: '#FFF', fontSize: 13, fontWeight: '700' },
  routeDetails: { flex: 1 },
  routeStreet: { fontSize: 15, fontWeight: '600', color: '#111827' },
  routeBrgy: { fontSize: 13, color: '#6B7280' },

  modalFooter: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, padding: 20, borderTopWidth: 1, borderTopColor: '#E5E7EB' },
  cancelBtn: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 6 },
  cancelBtnText: { color: '#4B5563', fontSize: 14, fontWeight: '600' },
  confirmBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#2E8B57', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 6 },
  confirmBtnText: { color: '#FFF', fontSize: 14, fontWeight: '600' },
});
