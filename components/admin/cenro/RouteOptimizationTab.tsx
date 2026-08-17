import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Modal, Image, TextInput, useWindowDimensions } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { collection, query, where, getDocs, getDoc, doc, updateDoc, addDoc, serverTimestamp, onSnapshot, arrayUnion } from 'firebase/firestore';
import { auth, db } from '../../../config/firebase';
import { MapCoordinate } from '../../../services/roadRouteOptimizationService';
import { buildConstraintAwareRoute } from '../../../services/routeConstraintService';
import { writeAuditLog } from '../../../services/auditLogService';
import { formatWasteAmount } from '../../../utils/wasteUnits';

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
  location?: { lat?: number; lng?: number; latitude?: number; longitude?: number } | null;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  timeWindowStart?: string;
  timeWindowEnd?: string;
  aiAnalysis?: {
    wasteType: string;
    estimatedWeight: string;
    confidence: string;
    details: string;
  };
}

interface Driver {
  id: string;
  displayName: string;
  email: string;
  currentTruckId?: string;
}

const reportPriority = (report: Report) => {
  if (report.priority) return report.priority;
  return report.aiAnalysis?.wasteType?.toLowerCase().includes('hazard') ? 'high' : 'normal';
};

export default function RouteOptimizationTab() {
  const { width } = useWindowDimensions();
  const isMobile = width < 768;
  const [reports, setReports] = useState<Report[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReports, setSelectedReports] = useState<Set<string>>(new Set());
  const [selectedDriver, setSelectedDriver] = useState<string>('');
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [optimizedRoute, setOptimizedRoute] = useState<Report[]>([]);
  const [routeSummary, setRouteSummary] = useState<{
    distanceKm: number;
    durationMinutes: number | null;
    geocodedStops: number;
    unlocatedStops: number;
    method: string;
    provider: string;
    roadPolyline: MapCoordinate[];
    fallbackReason?: string;
    estimatedLoadTons: number;
    capacityTons: number | null;
    utilizationPercent: number | null;
    warnings: string[];
    deferredStops: Report[];
    trafficAware: boolean;
    serviceWindow: { start: string; end: string };
  } | null>(null);
  const [showDispatchModal, setShowDispatchModal] = useState(false);
  const [isDispatching, setIsDispatching] = useState(false);
  const [viewingReport, setViewingReport] = useState<Report | null>(null);
  const [fullScreenImage, setFullScreenImage] = useState<string | null>(null);
  const [locationFilter, setLocationFilter] = useState<'all' | 'gps' | 'missing'>('all');
  const [reportSearch, setReportSearch] = useState('');
  const [serviceWindowStart, setServiceWindowStart] = useState('08:00');
  const [serviceWindowEnd, setServiceWindowEnd] = useState('17:00');
  const [trafficAware, setTrafficAware] = useState(true);

  const visibleReports = reports.filter(report => {
    const hasGps = Number.isFinite(report.location?.lat ?? report.location?.latitude) && Number.isFinite(report.location?.lng ?? report.location?.longitude);
    if (locationFilter === 'gps' && !hasGps) return false;
    if (locationFilter === 'missing' && hasGps) return false;
    const search = reportSearch.trim().toLowerCase();
    return !search || `${report.street} ${report.barangay} ${report.description}`.toLowerCase().includes(search);
  });

  useEffect(() => {
    if (!db) return;

    // Listen to acknowledged reports only
    const reportsRef = collection(db, 'reports');
    const reportsQuery = query(reportsRef, where('status', '==', 'acknowledged'));
    
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
          if (u.role === 'driver' && u.disabled !== true && u.status !== 'disabled') {
            driverList.push({ id: d.id, displayName: u.displayName || u.email || 'Unknown', email: u.email, currentTruckId: u.currentTruckId || undefined });
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
    const newSet = new Set(visibleReports.map(r => r.id));
    setSelectedReports(newSet);
  };

  const handleOptimizeRoute = async () => {
    if (selectedReports.size === 0) {
      Alert.alert('Selection Empty', 'Please select at least one report to route.');
      return;
    }
    if (!selectedDriver) {
      Alert.alert('No Driver', 'Please select a driver to assign this route to.');
      return;
    }

    setIsOptimizing(true);
    
    try {
      const selectedData = reports.filter(r => selectedReports.has(r.id));
      const driverLocationSnapshot = await getDoc(doc(db, 'truck_locations', selectedDriver));
      const locationData = driverLocationSnapshot.data();
      const latitude = locationData?.lat ?? locationData?.location?.latitude;
      const longitude = locationData?.lng ?? locationData?.location?.longitude;
      const truckOrigin = Number.isFinite(latitude) && Number.isFinite(longitude)
        ? { latitude: Number(latitude), longitude: Number(longitude) }
        : null;
      const driver = drivers.find(item => item.id === selectedDriver);
      let capacityTons: number | null = null;
      if (driver?.currentTruckId) {
        const truckSnapshot = await getDoc(doc(db, 'trucks', driver.currentTruckId));
        const rawCapacity = Number.parseFloat(String(truckSnapshot.data()?.capacity || '').replace(/[^\d.]/g, ''));
        capacityTons = Number.isFinite(rawCapacity) && rawCapacity > 0 ? rawCapacity : null;
      }
      const result = await buildConstraintAwareRoute(selectedData, truckOrigin, {
        truckCapacityTons: capacityTons,
        serviceWindowStart,
        serviceWindowEnd,
        trafficAware,
      });
      if (result.orderedStops.length === 0) {
        Alert.alert('Capacity Exceeded', 'None of the selected reports fit within the assigned truck capacity. Select fewer stops or another truck.');
        return;
      }
      setOptimizedRoute(result.orderedStops);
      setRouteSummary(result);
      setShowDispatchModal(true);
    } catch (error) {
      console.error('Route generation failed:', error);
      Alert.alert('Route unavailable', 'The route could not be generated. Please check the selected reports and try again.');
    } finally {
      setIsOptimizing(false);
    }
  };

  const handleDispatch = async () => {
    setIsDispatching(true);
    try {
      const driverObj = drivers.find(d => d.id === selectedDriver);
      const driverName = driverObj?.displayName || 'Assigned Driver';
      const today = new Date();
      const dateText = today.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
      const allowsNotification = async (userId: string) => {
        if (!userId) return false;
        const settings = await getDoc(doc(db, 'user_settings', userId));
        const preferences = settings.data()?.notificationPreferences;
        return preferences?.pushEnabled !== false && preferences?.reportUpdates !== false;
      };
      
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
          truckId: driverObj?.currentTruckId || null,
          reportId: report.id,
          userId: report.userId,
          location: report.location || null,
          routeOrder: i + 1,
          routeOptimization: routeSummary ? {
            method: routeSummary.method,
            estimatedDistanceKm: routeSummary.distanceKm,
            estimatedDurationMinutes: routeSummary.durationMinutes,
            geocodedStops: routeSummary.geocodedStops,
            unlocatedStops: routeSummary.unlocatedStops,
            provider: routeSummary.provider,
            roadPolyline: routeSummary.roadPolyline,
            fallbackReason: routeSummary.fallbackReason || null,
            estimatedLoadTons: routeSummary.estimatedLoadTons,
            capacityTons: routeSummary.capacityTons,
            utilizationPercent: routeSummary.utilizationPercent,
            trafficAware: routeSummary.trafficAware,
            serviceWindow: routeSummary.serviceWindow,
            warnings: routeSummary.warnings,
          } : null,
          isLiveDispatch: true,
          createdByUid: auth.currentUser?.uid || null,
          createdAt: serverTimestamp(),
        });

        const newHistoryItem = {
          status: 'in-progress',
          notes: `Dispatched to driver ${driverName}`,
          timestamp: new Date().toISOString(),
          adminEmail: 'System Dispatch'
        };

        // 2. Update the original report status to in-progress
        await updateDoc(doc(db, 'reports', report.id), {
          status: 'in-progress',
          assignedDriver: driverName,
          updatedAt: serverTimestamp(),
          statusHistory: arrayUnion(newHistoryItem)
        });

        // 3. Notify the resident
        if (await allowsNotification(report.userId)) {
          await addDoc(collection(db, 'userNotifications'), {
            userId: report.userId,
            title: 'Report Dispatched',
            body: `Your report at ${report.street} has been dispatched to a collection truck.`,
            type: 'report_update',
            read: false,
            createdAt: serverTimestamp(),
          });
        }
      }

      if (await allowsNotification(selectedDriver)) {
        await addDoc(collection(db, 'userNotifications'), {
          userId: selectedDriver,
          title: 'New Route Assigned',
          body: `${optimizedRoute.length} collection stop${optimizedRoute.length === 1 ? '' : 's'} assigned for today.`,
          type: 'route',
          read: false,
          createdAt: serverTimestamp(),
        });
      }

      const { deferredStops: deferredForAnotherTrip = [], ...auditRouteSummary } = routeSummary || {};
      await writeAuditLog('route.dispatched', 'driver', selectedDriver, {
        stopCount: optimizedRoute.length,
        reportIds: optimizedRoute.map(report => report.id),
        deferredReportIds: deferredForAnotherTrip.map(report => report.id),
        routeSummary: Object.keys(auditRouteSummary).length ? auditRouteSummary : null,
      });

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
    <ScrollView style={[styles.container, isMobile && { padding: 16 }]}>
      <View style={[styles.headerRow, isMobile && { marginBottom: 16 }]}>
        <View>
          <Text style={styles.headerTitle}>Automatic Route Optimization</Text>
          <Text style={styles.headerDesc}>Optimize GPS-tagged reports on drivable roads, then dispatch the route directly to the driver’s in-app map.</Text>
        </View>
      </View>

      <View style={[styles.mainGrid, isMobile && { flexDirection: 'column', gap: 16 }]}>
        {/* Left Column - Report Selection */}
        <View style={[styles.leftColumn, isMobile && { flex: undefined, width: '100%' }]}>
          <View style={styles.card}>
            <View style={styles.cardHeaderRow}>
              <Text style={styles.cardTitle}>Verified Reports Queue</Text>
              <TouchableOpacity style={styles.textBtn} onPress={selectAll}>
                <Text style={styles.textBtnText}>Select All</Text>
              </TouchableOpacity>
            </View>

            <TextInput style={styles.searchInput} value={reportSearch} onChangeText={setReportSearch} placeholder="Search street, barangay, or description" autoCorrect={false} />
            <View style={styles.filterRow}>
              {(['all', 'gps', 'missing'] as const).map(filter => (
                <TouchableOpacity key={filter} style={[styles.filterChip, locationFilter === filter && styles.filterChipActive]} onPress={() => setLocationFilter(filter)}>
                  <Text style={[styles.filterChipText, locationFilter === filter && styles.filterChipTextActive]}>
                    {filter === 'all' ? 'All reports' : filter === 'gps' ? 'With GPS' : 'Missing GPS'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {visibleReports.length === 0 ? (
              <View style={styles.emptyBox}>
                <MaterialIcons name="search-off" size={32} color="#9CA3AF" />
                <Text style={styles.emptyText}>{reports.length === 0 ? 'No acknowledged reports to route.' : 'No reports match the selected filters.'}</Text>
              </View>
            ) : (
              visibleReports.map((report) => {
                const isSelected = selectedReports.has(report.id);
                const hasGps = Number.isFinite(report.location?.lat ?? report.location?.latitude) && Number.isFinite(report.location?.lng ?? report.location?.longitude);
                return (
                  <TouchableOpacity 
                    key={report.id} 
                    style={[styles.reportItem, isSelected && styles.reportItemSelected]}
                    onPress={() => toggleReportSelection(report.id)}
                  >
                    <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
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
                      <Text style={styles.priorityText}>{reportPriority(report).toUpperCase()} PRIORITY</Text>
                      {!hasGps && <Text style={styles.missingGpsText}>GPS missing — placed after geotagged stops</Text>}
                    </View>
                    <View style={[styles.badge, { backgroundColor: report.status === 'pending' ? '#FEF3C7' : '#DBEAFE' }]}>
                      <Text style={[styles.badgeText, { color: report.status === 'pending' ? '#D97706' : '#2563EB' }]}>
                        {report.status.toUpperCase()}
                      </Text>
                    </View>
                    <TouchableOpacity 
                      style={{ padding: 8, marginLeft: 4 }}
                      onPress={(e) => {
                        e.stopPropagation(); // prevent toggling the checkbox
                        setViewingReport(report);
                      }}
                    >
                      <MaterialIcons name="visibility" size={22} color="#6B7280" />
                    </TouchableOpacity>
                  </TouchableOpacity>
                );
              })
            )}
          </View>
        </View>

        {/* Right Column - Routing Controls */}
        <View style={[styles.rightColumn, isMobile && { flex: undefined, width: '100%' }]}>
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

            <Text style={styles.label}>2. ROUTE CONSTRAINTS</Text>
            <View style={styles.constraintRow}>
              <View style={styles.constraintField}>
                <Text style={styles.constraintLabel}>SERVICE START</Text>
                <TextInput style={styles.constraintInput} value={serviceWindowStart} onChangeText={setServiceWindowStart} placeholder="08:00" maxLength={5} />
              </View>
              <View style={styles.constraintField}>
                <Text style={styles.constraintLabel}>SERVICE END</Text>
                <TextInput style={styles.constraintInput} value={serviceWindowEnd} onChangeText={setServiceWindowEnd} placeholder="17:00" maxLength={5} />
              </View>
            </View>
            <TouchableOpacity style={[styles.trafficToggle, trafficAware && styles.trafficToggleActive]} onPress={() => setTrafficAware(value => !value)}>
              <MaterialIcons name="traffic" size={18} color={trafficAware ? '#FFFFFF' : '#475569'} />
              <Text style={[styles.trafficToggleText, trafficAware && styles.trafficToggleTextActive]}>
                Traffic-aware ETA {trafficAware ? 'ON' : 'OFF'}
              </Text>
            </TouchableOpacity>

            <Text style={styles.label}>3. OPTIMIZATION SUMMARY</Text>
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
              <Text style={styles.infoTitle}>Road-aware with offline fallback</Text>
              <Text style={styles.infoDesc}>Google Routes optimizes travel time, distance, and turns. If it is unavailable, nearest-neighbor with 2-opt keeps dispatch functional.</Text>
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
              {routeSummary && (
                <View style={styles.constraintSummary}>
                  <Text style={styles.constraintSummaryTitle}>Constraint-aware plan</Text>
                  <Text style={styles.constraintSummaryText}>
                    {routeSummary.estimatedLoadTons.toFixed(3)} t planned
                    {routeSummary.capacityTons ? ` / ${routeSummary.capacityTons} t capacity (${routeSummary.utilizationPercent}%)` : ' · capacity unavailable'}
                    {` · ${routeSummary.serviceWindow.start}-${routeSummary.serviceWindow.end}`}
                    {routeSummary.trafficAware ? ' · traffic aware' : ''}
                  </Text>
                </View>
              )}
              {routeSummary && (
                <Text style={[styles.infoDesc, { marginBottom: 12 }]}>
                  {routeSummary.provider} · {routeSummary.distanceKm.toFixed(2)} km{routeSummary.durationMinutes ? ` · ${routeSummary.durationMinutes} min driving` : ''} · {routeSummary.unlocatedStops} without GPS
                </Text>
              )}
              {routeSummary?.fallbackReason && (
                <Text style={[styles.missingGpsText, { marginBottom: 12 }]}>Fallback active: {routeSummary.fallbackReason}</Text>
              )}
              {routeSummary?.warnings.map((warning, index) => (
                <Text key={`route-warning-${index}`} style={[styles.missingGpsText, { marginBottom: 6 }]}>• {warning}</Text>
              ))}
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
              {!!routeSummary?.deferredStops.length && (
                <View style={styles.deferredBox}>
                  <Text style={styles.deferredTitle}>Deferred for another trip ({routeSummary.deferredStops.length})</Text>
                  {routeSummary.deferredStops.map(report => <Text key={report.id} style={styles.deferredText}>• {report.street}, {report.barangay}</Text>)}
                </View>
              )}
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

      {/* Report View Modal */}
      <Modal visible={!!viewingReport} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Report Details</Text>
              <TouchableOpacity onPress={() => setViewingReport(null)}>
                <MaterialIcons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            {viewingReport && (
              <ScrollView style={styles.modalBody}>
                {viewingReport.imageURL ? (
                  <TouchableOpacity activeOpacity={0.8} onPress={() => setFullScreenImage(viewingReport.imageURL!)}>
                    <Image 
                      source={{ uri: viewingReport.imageURL }} 
                      style={{ width: '100%', height: 200, borderRadius: 8, marginBottom: 16 }} 
                      resizeMode="cover"
                    />
                  </TouchableOpacity>
                ) : (
                  <View style={{ width: '100%', height: 100, borderRadius: 8, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center', marginBottom: 16 }}>
                    <MaterialIcons name="image-not-supported" size={32} color="#9CA3AF" />
                    <Text style={{ color: '#6B7280', marginTop: 8 }}>No image provided</Text>
                  </View>
                )}
                
                <Text style={{ fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 4 }}>
                  {viewingReport.title}
                </Text>
                <Text style={{ fontSize: 14, color: '#4B5563', marginBottom: 16 }}>
                  {viewingReport.description}
                </Text>
                
                <View style={{ backgroundColor: '#F9FAFB', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#E5E7EB', marginBottom: 16 }}>
                  <Text style={{ fontSize: 12, fontWeight: '600', color: '#6B7280', marginBottom: 4 }}>LOCATION</Text>
                  <Text style={{ fontSize: 14, color: '#111827', fontWeight: '500' }}>
                    {viewingReport.street}, {viewingReport.barangay}
                  </Text>
                </View>

                {viewingReport.aiAnalysis && (
                  <View style={{ backgroundColor: '#E2EFE3', padding: 12, borderRadius: 8, marginBottom: 16 }}>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: '#4A6741', marginBottom: 8 }}>AI ANALYSIS</Text>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                      <Text style={{ fontSize: 13, color: '#6B8C72' }}>Detected Type:</Text>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: '#234033' }}>{viewingReport.aiAnalysis.wasteType}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                      <Text style={{ fontSize: 13, color: '#6B8C72' }}>Est. Weight:</Text>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: '#234033' }}>{formatWasteAmount(viewingReport.aiAnalysis.estimatedWeight)}</Text>
                    </View>
                    <Text style={{ fontSize: 12, color: '#4A6741', fontStyle: 'italic' }}>
                      {viewingReport.aiAnalysis.details}
                    </Text>
                  </View>
                )}
                <View style={{ height: 20 }} />
              </ScrollView>
            )}

            <View style={styles.modalFooter}>
              <TouchableOpacity 
                style={[styles.cancelBtn, { borderColor: '#6B7280', borderWidth: 1 }]} 
                onPress={() => setViewingReport(null)}
              >
                <Text style={[styles.cancelBtnText, { color: '#6B7280' }]}>Close</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.confirmBtn, { backgroundColor: '#2E8B57' }]} 
                onPress={() => {
                  if (!selectedReports.has(viewingReport!.id)) {
                    toggleReportSelection(viewingReport!.id);
                  }
                  setViewingReport(null);
                }}
              >
                <MaterialIcons name="check-circle" size={18} color="#FFF" />
                <Text style={styles.confirmBtnText}>Select for Route</Text>
              </TouchableOpacity>
            </View>

          </View>
        </View>
      </Modal>

      {/* Full Screen Image Modal */}
      <Modal visible={!!fullScreenImage} transparent animationType="fade">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center' }}>
          <TouchableOpacity 
            style={{ position: 'absolute', top: 40, right: 20, zIndex: 10, padding: 10 }}
            onPress={() => setFullScreenImage(null)}
          >
            <MaterialIcons name="close" size={30} color="#FFF" />
          </TouchableOpacity>
          {fullScreenImage && (
            <Image 
              source={{ uri: fullScreenImage }} 
              style={{ width: '100%', height: '80%' }} 
              resizeMode="contain"
            />
          )}
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
  searchInput: { borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 10, color: '#111827' },
  filterRow: { flexDirection: 'row', gap: 8, marginBottom: 14, flexWrap: 'wrap' },
  filterChip: { borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 18, paddingHorizontal: 12, paddingVertical: 7, backgroundColor: '#FFFFFF' },
  filterChipActive: { borderColor: '#2E8B57', backgroundColor: '#E8F5E9' },
  filterChipText: { color: '#6B7280', fontSize: 12, fontWeight: '600' },
  filterChipTextActive: { color: '#166534' },
  
  textBtn: { padding: 4 },
  textBtnText: { color: '#2E8B57', fontWeight: '600', fontSize: 13 },

  emptyBox: { padding: 40, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F9FAFB', borderRadius: 8, borderWidth: 1, borderColor: '#E5E7EB', borderStyle: 'dashed' },
  emptyText: { marginTop: 12, color: '#9CA3AF', fontSize: 14 },

  reportItem: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#E5E7EB', marginBottom: 8, backgroundColor: '#FFF' },
  reportItemSelected: { borderColor: '#2E8B57', backgroundColor: '#F6FBF7' },
  checkbox: { width: 20, height: 20, borderRadius: 4, borderWidth: 2, borderColor: '#D1D5DB', marginRight: 12, justifyContent: 'center', alignItems: 'center' },
  checkboxSelected: { backgroundColor: '#2E8B57', borderColor: '#2E8B57' },
  reportImageBg: { width: 40, height: 40, borderRadius: 6, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center', marginRight: 12, overflow: 'hidden' },
  reportImg: { width: 40, height: 40 },
  reportContent: { flex: 1 },
  reportStreet: { fontSize: 14, fontWeight: '600', color: '#111827' },
  reportDesc: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  priorityText: { fontSize: 9, color: '#7C3AED', fontWeight: '800', marginTop: 3, letterSpacing: 0.4 },
  missingGpsText: { color: '#B45309', fontSize: 11, fontWeight: '600', marginTop: 3 },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  badgeText: { fontSize: 10, fontWeight: '700' },

  label: { fontSize: 12, fontWeight: '700', color: '#6B7280', marginBottom: 8, marginTop: 16, letterSpacing: 0.5 },
  pickerContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  noDriverText: { color: '#9CA3AF', fontSize: 13, fontStyle: 'italic' },
  driverPill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: '#E5E7EB' },
  driverPillActive: { backgroundColor: '#2E8B57', borderColor: '#2E8B57' },
  driverPillText: { fontSize: 13, fontWeight: '600', color: '#4B5563' },
  driverPillTextActive: { color: '#FFF' },
  constraintRow: { flexDirection: 'row', gap: 10 },
  constraintField: { flex: 1 },
  constraintLabel: { color: '#64748B', fontSize: 9, fontWeight: '800', marginBottom: 5 },
  constraintInput: { borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 9, color: '#0F172A', backgroundColor: '#FFFFFF' },
  trafficToggle: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 8, backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: '#CBD5E1' },
  trafficToggleActive: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
  trafficToggleText: { color: '#475569', fontSize: 12, fontWeight: '700' },
  trafficToggleTextActive: { color: '#FFFFFF' },

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
  constraintSummary: { backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#BFDBFE', borderRadius: 10, padding: 12, marginBottom: 12 },
  constraintSummaryTitle: { color: '#1E3A8A', fontSize: 12, fontWeight: '800', marginBottom: 4 },
  constraintSummaryText: { color: '#1D4ED8', fontSize: 11, lineHeight: 17, fontWeight: '600' },
  deferredBox: { marginTop: 14, padding: 12, backgroundColor: '#FFF7ED', borderWidth: 1, borderColor: '#FED7AA', borderRadius: 10 },
  deferredTitle: { color: '#9A3412', fontSize: 12, fontWeight: '800', marginBottom: 6 },
  deferredText: { color: '#C2410C', fontSize: 11, marginTop: 3 },
  
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
