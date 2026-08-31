import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';

import { auth, db } from '@/config/firebase';
import { DANAO_CITY_BARANGAYS, resolveScheduleBarangays, mergeDanaoBarangays } from '@/constants/danaoBarangays';
import { BARANGAY_COLLECTION_ROUTES } from '@/constants/barangaySimulationRoutes';
import { locationService, SimulationState } from '@/services/locationService';
import {
  optimizeBarangayRouteWithTraffic,
  RouteStop,
  TrafficOptimizationResult,
} from '@/services/trafficAwareOptimizerService';
import RouteOptimizationMap from './RouteOptimizationMap';
import { writeAuditLog } from '@/services/auditLogService';
import { isAutoDispatchEnabled, setAutoDispatchEnabled } from '@/services/autoDispatchService';

interface Report {
  id: string;
  title: string;
  description: string;
  street: string;
  barangay: string;
  status: string;
  imageURL?: string;
  createdAt: any;
  userEmail?: string;
  userId?: string;
  location?: { lat?: number; lng?: number; latitude?: number; longitude?: number } | null;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
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
  assignedBarangay?: string;
  barangay?: string;
  currentTruckId?: string;
  currentTruckPlate?: string;
  status?: string;
  dutyStatus?: string;
}

export default function RouteOptimizationTab() {
  const { width } = useWindowDimensions();
  const isMobile = width < 768;
  const isNarrow = width < 980;

  // Active Sub-Tab
  const [activeSubView, setActiveSubView] = useState<'route-ai' | 'report-dispatch'>('route-ai');

  // Core Data
  const [availableBarangays, setAvailableBarangays] = useState<string[]>([]);
  const [selectedBarangay, setSelectedBarangay] = useState<string>('Poblacion');
  const [isBarangayDropdownOpen, setIsBarangayDropdownOpen] = useState(false);
  const [barangaySearchQuery, setBarangaySearchQuery] = useState('');
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [selectedDriverId, setSelectedDriverId] = useState<string>('');
  const [trucksMap, setTrucksMap] = useState<Record<string, string>>({});
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);

  // Simulation & Live State
  const [simState, setSimState] = useState<SimulationState>(locationService.getSimulationState());
  const [isStartingSim, setIsStartingSim] = useState(false);

  // AI Optimization State
  const [selectedReportIds, setSelectedReportIds] = useState<Set<string>>(new Set());
  const [isOptimizingAI, setIsOptimizingAI] = useState(false);
  const [optResult, setOptResult] = useState<TrafficOptimizationResult | null>(null);

  // Dispatch Modal State
  const [showDispatchConfirmModal, setShowDispatchConfirmModal] = useState(false);
  const [isDispatching, setIsDispatching] = useState(false);
  const [dispatchSuccess, setDispatchSuccess] = useState(false);

  // AI Autonomous Dispatch Toggle State
  const [autoDispatchActive, setAutoDispatchActive] = useState(true);
  const [isTogglingAutoDispatch, setIsTogglingAutoDispatch] = useState(false);

  // Fetch initial auto dispatch toggle setting
  useEffect(() => {
    isAutoDispatchEnabled().then((enabled) => {
      setAutoDispatchActive(enabled);
    });
  }, []);

  const handleToggleAutoDispatch = async () => {
    setIsTogglingAutoDispatch(true);
    const nextVal = !autoDispatchActive;
    setAutoDispatchActive(nextVal);
    await setAutoDispatchEnabled(nextVal);
    setIsTogglingAutoDispatch(false);
  };

  // Report Preview Modal
  const [viewingReport, setViewingReport] = useState<Report | null>(null);
  const [reportSearch, setReportSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'acknowledged' | 'in_progress'>('all');

  const autoDispatchedReportsCount = useMemo(() => {
    return reports.filter((r) => r.status === 'in-progress' || r.status === 'in_progress').length;
  }, [reports]);

  const queuedReportsCount = useMemo(() => {
    return reports.filter((r) => r.status === 'acknowledged' || (r as any).queuedForDriver === true).length;
  }, [reports]);

  // 1. Subscribe to Collection Schedules for Dynamic Barangays + All Danao City & Report Barangays
  useEffect(() => {
    if (!db) return;
    const unsubSchedules = onSnapshot(collection(db, 'barangay_schedules'), (snap) => {
      const scheduleNames = new Set<string>();
      snap.forEach((d) => {
        const data = d.data();
        if (data.barangayName && typeof data.barangayName === 'string' && data.barangayName.trim()) {
          scheduleNames.add(data.barangayName.trim());
        }
      });
      const reportBarangays = reports.map((r) => r.barangay).filter(Boolean);
      const resolved = mergeDanaoBarangays([...Array.from(scheduleNames), ...reportBarangays]);
      setAvailableBarangays(resolved);
      if (resolved.length > 0 && (!selectedBarangay || !resolved.includes(selectedBarangay))) {
        setSelectedBarangay(resolved[0]);
      }
    });
    return () => unsubSchedules();
  }, [reports]);

  // Also update availableBarangays when reports change
  useEffect(() => {
    if (reports.length > 0) {
      setAvailableBarangays((prev) => {
        const reportBrs = reports.map((r) => r.barangay).filter(Boolean);
        return mergeDanaoBarangays([...prev, ...reportBrs]);
      });
    }
  }, [reports]);

  // 2. Fetch Trucks Map
  useEffect(() => {
    if (!db) return;
    const unsubTrucks = onSnapshot(collection(db, 'trucks'), (snap) => {
      const map: Record<string, string> = {};
      snap.forEach((d) => {
        const data = d.data();
        map[d.id] = data.plateNumber || data.truckNumber || `Truck ${d.id.slice(-4)}`;
      });
      setTrucksMap(map);
    });
    return () => unsubTrucks();
  }, []);

  // 3. Fetch Drivers
  useEffect(() => {
    if (!db) return;
    const qUsers = query(collection(db, 'users'), where('role', '==', 'driver'));
    const unsubUsers = onSnapshot(qUsers, (snap) => {
      const driverList: Driver[] = [];
      snap.forEach((d) => {
        const u = d.data();
        if (u.disabled !== true && u.status !== 'disabled') {
          const rawDuty = u.dutyStatus || u.status || 'off_duty';
          const hasAssignedTruck = Boolean(u.currentTruckId);
          const isOnDuty = (hasAssignedTruck || rawDuty === 'on_duty' || u.status === 'on_duty') && rawDuty !== 'off_duty' && u.status !== 'off_duty';

          driverList.push({
            id: d.id,
            displayName: u.displayName || u.name || u.email || 'Assigned Driver',
            email: u.email || '',
            assignedBarangay: (u.assignedBarangay || u.barangay || '').trim(),
            barangay: (u.barangay || '').trim(),
            currentTruckId: u.currentTruckId || undefined,
            currentTruckPlate: u.currentTruckPlate || undefined,
            status: isOnDuty ? 'on_duty' : 'off_duty',
            dutyStatus: rawDuty,
          });
        }
      });
      setDrivers(driverList);
      setLoading(false);
    });
    return () => unsubUsers();
  }, []);

  // 4. Fetch Verified Reports (including acknowledged and in-progress)
  useEffect(() => {
    if (!db) return;
    const reportsRef = collection(db, 'reports');
    const qReports = query(
      reportsRef,
      where('status', 'in', ['acknowledged', 'in-progress', 'in_progress', 'in progress', 'verified'])
    );
    const unsubReports = onSnapshot(qReports, (snapshot) => {
      const data: Report[] = [];
      snapshot.forEach((docSnap) => {
        data.push({ id: docSnap.id, ...docSnap.data() } as Report);
      });
      data.sort((a, b) => (b.createdAt?.toMillis ? b.createdAt.toMillis() : 0) - (a.createdAt?.toMillis ? a.createdAt.toMillis() : 0));
      setReports(data);
    });
    return () => unsubReports();
  }, []);

  // 5. Listen to Live Driver Movement Simulation State
  useEffect(() => {
    const unsubSim = locationService.onSimulationChange((state) => {
      setSimState(state);
    });
    return () => unsubSim();
  }, []);

  // 6. Filter Barangays for Searchable Dropdown
  const filteredBarangays = useMemo(() => {
    const q = barangaySearchQuery.trim().toLowerCase();
    if (!q) return availableBarangays;
    return availableBarangays.filter((b) => b.toLowerCase().includes(q));
  }, [availableBarangays, barangaySearchQuery]);

  // 7. Filter Drivers strictly by Selected Barangay and Currently On Duty / Active
  const activeBarangayDrivers = useMemo(() => {
    const current = selectedBarangay.trim().toLowerCase();
    if (!current) return [];

    return drivers.filter((d) => {
      const b = (d.assignedBarangay || d.barangay || '').trim().toLowerCase();
      // Must be explicitly assigned to this barangay
      if (!b) return false;
      const isMatch = b === current || b === `${current} city` || current.includes(b) || b.includes(current);
      if (!isMatch) return false;

      // Must be currently on duty with an assigned truck / shift
      const isAvailable = (d.status === 'on_duty' || d.dutyStatus === 'on_duty' || !!d.currentTruckId) &&
        d.status !== 'off_duty' && d.dutyStatus !== 'off_duty' && d.status !== 'disabled' && d.status !== 'inactive';
      return isAvailable;
    });
  }, [drivers, selectedBarangay]);

  // Auto-select first available driver when barangay changes
  useEffect(() => {
    if (activeBarangayDrivers.length > 0) {
      if (!selectedDriverId || !activeBarangayDrivers.some((d) => d.id === selectedDriverId)) {
        setSelectedDriverId(activeBarangayDrivers[0].id);
      }
    } else {
      setSelectedDriverId('');
    }
  }, [activeBarangayDrivers, selectedBarangay]);

  // Selected driver object
  const currentSelectedDriver = useMemo(() => {
    return drivers.find((d) => d.id === selectedDriverId) || null;
  }, [drivers, selectedDriverId]);

  // 7. Filter Verified Reports for this Barangay
  const barangayReports = useMemo(() => {
    return reports.filter((r) => {
      const b = (r.barangay || '').trim().toLowerCase();
      const current = selectedBarangay.trim().toLowerCase();
      if (b !== current && b !== `${current} city` && !current.includes(b) && !b.includes(current)) {
        return false;
      }
      const normStatus = (r.status || '').toLowerCase().replace(/_/g, '-');
      const normFilter = statusFilter === 'in_progress' ? 'in-progress' : statusFilter;
      if (statusFilter !== 'all' && normStatus !== normFilter) {
        return false;
      }
      if (reportSearch.trim()) {
        const q = reportSearch.toLowerCase().trim();
        return (
          (r.title || '').toLowerCase().includes(q) ||
          (r.street || '').toLowerCase().includes(q) ||
          (r.description || '').toLowerCase().includes(q) ||
          (r.aiAnalysis?.wasteType || '').toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [reports, selectedBarangay, statusFilter, reportSearch]);

  // Selected Report objects
  const selectedReportObjects = useMemo(() => {
    return reports.filter((r) => selectedReportIds.has(r.id));
  }, [reports, selectedReportIds]);

  // 8. Trigger AI Traffic & Fuel Optimization
  const runOptimization = (extraReps: Report[] = selectedReportObjects) => {
    setIsOptimizingAI(true);
    setTimeout(() => {
      try {
        const result = optimizeBarangayRouteWithTraffic(selectedBarangay, extraReps);
        setOptResult(result);
      } catch (err) {
        console.error('Error running traffic optimization:', err);
      } finally {
        setIsOptimizingAI(false);
      }
    }, 300);
  };

  // Run automatically when selected barangay or inserted reports change
  useEffect(() => {
    if (selectedBarangay) {
      runOptimization(selectedReportObjects);
    }
  }, [selectedBarangay, selectedReportObjects.length]);

  // Toggle report insertion
  const toggleReportSelection = (id: string) => {
    setSelectedReportIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Driver Live Phone GPS Location from Firestore (written by driver's mobile device or driver phone app)
  const [driverLiveLocation, setDriverLiveLocation] = useState<{
    latitude: number;
    longitude: number;
    speed: number;
    locationName?: string;
    isBroadcasting: boolean;
    isSimulation?: boolean;
  } | null>(null);

  useEffect(() => {
    if (!db || !selectedDriverId) {
      setDriverLiveLocation(null);
      return;
    }
    const unsubLocation = onSnapshot(doc(db, 'truck_locations', selectedDriverId), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        const lat = data.lat ?? data.location?.latitude;
        const lng = data.lng ?? data.location?.longitude;
        const isActive = data.status === 'active';
        if (Number.isFinite(lat) && Number.isFinite(lng) && isActive) {
          setDriverLiveLocation({
            latitude: Number(lat),
            longitude: Number(lng),
            speed: Number(data.speed || 0),
            locationName: data.locationName || data.barangay || 'Active Route',
            isBroadcasting: true,
            isSimulation: !!data.isSimulation,
          });
          return;
        }
      }
      setDriverLiveLocation(null);
    });
    return () => unsubLocation();
  }, [selectedDriverId]);

  // 10. Dispatch Route to Driver Terminal
  const handleDispatchToDriver = async () => {
    if (!selectedDriverId || !currentSelectedDriver) {
      Alert.alert('No Driver Selected', 'Please select an active driver for dispatch.');
      return;
    }
    if (!optResult) {
      Alert.alert('No Optimized Route', 'Please generate the optimized route first.');
      return;
    }

    setIsDispatching(true);
    try {
      const driverName = currentSelectedDriver.displayName || 'Assigned Driver';
      const truckId = currentSelectedDriver.currentTruckId || null;
      const today = new Date();
      const dateText = today.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

      // 1. Create a live master route schedule in Firestore
      await addDoc(collection(db, 'schedules'), {
        barangay: selectedBarangay,
        street: `Master AI Collection Route (${optResult.optimizedStops.length} Stops)`,
        wasteCategory: 'Scheduled & Citizen Reports',
        timeText: 'Active Route Sequence',
        dateText: dateText,
        status: 'in_progress',
        driver: driverName,
        assignedDriverId: selectedDriverId,
        truckId: truckId,
        isLiveDispatch: true,
        routeOptimization: {
          method: 'traffic-aware-fuel-optimized',
          baselineDistanceKm: optResult.baselineDistanceKm,
          optimizedDistanceKm: optResult.optimizedDistanceKm,
          fuelSavingsLiters: optResult.fuelSavingsLiters,
          fuelCostSavedPhp: optResult.fuelCostSavedPhp,
          timeSavingsMinutes: optResult.timeSavingsMinutes,
          bottlenecksAvoided: optResult.bottlenecksAvoided,
          stopCount: optResult.optimizedStops.length,
          roadPolyline: optResult.roadPolyline,
        },
        stops: optResult.optimizedStops.map((s, idx) => ({
          order: idx + 1,
          name: s.name,
          lat: s.latitude,
          lng: s.longitude,
          type: s.stopType,
          reportId: s.reportId || null,
          timeWindow: s.optimalTimeWindow || 'Routine',
        })),
        createdByUid: auth.currentUser?.uid || null,
        createdAt: serverTimestamp(),
      });

      // 2. Mark inserted citizen reports as in_progress
      for (const rep of selectedReportObjects) {
        try {
          const reportRef = doc(db, 'reports', rep.id);
          await updateDoc(reportRef, {
            status: 'in_progress',
            assignedDriverId: selectedDriverId,
            assignedDriverName: driverName,
            dispatchedAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        } catch (repErr) {
          console.warn('Error updating report status:', repErr);
        }
      }

      // 3. Update driver's assigned barangay in their user profile
      if (selectedDriverId) {
        try {
          await updateDoc(doc(db, 'users', selectedDriverId), {
            assignedBarangay: selectedBarangay,
            barangay: selectedBarangay,
            updatedAt: serverTimestamp(),
          });
        } catch (uErr) {
          console.warn('Error updating driver assigned barangay:', uErr);
        }
      }

      await writeAuditLog('route.dispatched', 'driver', selectedDriverId, {
        barangay: selectedBarangay,
        driverName,
        stopsCount: optResult.optimizedStops.length,
        reportsCount: selectedReportObjects.length,
        fuelSavingsLiters: optResult.fuelSavingsLiters,
        fuelCostSavedPhp: optResult.fuelCostSavedPhp,
      });

      setDispatchSuccess(true);
      setShowDispatchConfirmModal(false);
      setSelectedReportIds(new Set());
      Alert.alert(
        'Route Dispatched Successfully! 🚛',
        `The traffic-optimized collection route with ${optResult.optimizedStops.length} stopping points has been transmitted directly to ${driverName}'s terminal.`
      );
    } catch (err: any) {
      console.error('Error dispatching route:', err);
      Alert.alert('Dispatch Error', err?.message || 'Failed to dispatch route.');
    } finally {
      setIsDispatching(false);
    }
  };

  return (
    <ScrollView style={[styles.container, isMobile && { padding: 12 }]} showsVerticalScrollIndicator={false}>
      {/* Top Header Banner */}
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.headerSubtitle}>MUNICIPAL SOLID WASTE LOGISTICS &bull; FEATURE 30</Text>
          <Text style={styles.headerTitle}>AI Traffic & Fuel Route Optimization</Text>
          <Text style={styles.headerDescription}>
            Simulate baseline driver routes, avoid commercial traffic bottlenecks, and insert verified citizen reports.
          </Text>
        </View>

        {/* Sub-View Switcher Tabs */}
        <View style={styles.subViewSwitcher}>
          <TouchableOpacity
            style={[styles.subViewBtn, activeSubView === 'route-ai' && styles.subViewBtnActive]}
            onPress={() => setActiveSubView('route-ai')}
            activeOpacity={0.85}
          >
            <MaterialIcons
              name="alt-route"
              size={16}
              color={activeSubView === 'route-ai' ? '#FFFFFF' : '#64748B'}
            />
            <Text style={[styles.subViewBtnText, activeSubView === 'route-ai' && styles.subViewBtnTextActive]}>
              1. Route & AI Optimization
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.subViewBtn, activeSubView === 'report-dispatch' && styles.subViewBtnActive]}
            onPress={() => setActiveSubView('report-dispatch')}
            activeOpacity={0.85}
          >
            <MaterialIcons
              name="add-location-alt"
              size={16}
              color={activeSubView === 'report-dispatch' ? '#FFFFFF' : '#64748B'}
            />
            <Text style={[styles.subViewBtnText, activeSubView === 'report-dispatch' && styles.subViewBtnTextActive]}>
              2. Insert Verified Reports ({selectedReportIds.size > 0 ? `${selectedReportIds.size}/${barangayReports.length}` : barangayReports.length})
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* AI Autonomous Dispatch Master Control Bar */}
      <View style={[styles.autoDispatchHeaderBar, isNarrow && { flexDirection: 'column', gap: 14 }]}>
        <View style={styles.autoDispatchLeft}>
          <View
            style={[
              styles.autoDispatchIconCircle,
              autoDispatchActive ? styles.autoDispatchIconCircleActive : styles.autoDispatchIconCirclePaused,
            ]}
          >
            <MaterialIcons name="auto-mode" size={22} color={autoDispatchActive ? '#059669' : '#64748B'} />
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <Text style={styles.autoDispatchTitle}>Autonomous AI Report Dispatch</Text>
              <View
                style={[
                  styles.autoDispatchStatusBadge,
                  autoDispatchActive ? styles.autoDispatchStatusBadgeActive : styles.autoDispatchStatusBadgePaused,
                ]}
              >
                <View
                  style={[
                    styles.autoDispatchStatusDot,
                    { backgroundColor: autoDispatchActive ? '#10B981' : '#94A3B8' },
                  ]}
                />
                <Text
                  style={[
                    styles.autoDispatchStatusText,
                    { color: autoDispatchActive ? '#065F46' : '#475569' },
                  ]}
                >
                  {autoDispatchActive ? 'ACTIVE (Auto-Slots into Driver Route)' : 'PAUSED (Manual Mode)'}
                </Text>
              </View>
            </View>
            <Text style={styles.autoDispatchDesc}>
              {autoDispatchActive
                ? 'Verified citizen reports are automatically slotted into the active on-duty driver\'s route at lowest detour, or bundled when a driver clocks in.'
                : 'Reports wait in the queue below until manually selected and dispatched by CENRO administrators.'}
            </Text>
          </View>
        </View>

        <View style={[styles.autoDispatchRight, isMobile && { flexWrap: 'wrap' }]}>
          <View style={styles.autoDispatchStatPill}>
            <Text style={styles.autoDispatchStatNum}>{autoDispatchedReportsCount}</Text>
            <Text style={styles.autoDispatchStatLabel}>Auto-Dispatched</Text>
          </View>
          <View style={[styles.autoDispatchStatPill, { backgroundColor: '#FEF3C7', borderColor: '#FDE68A' }]}>
            <Text style={[styles.autoDispatchStatNum, { color: '#B45309' }]}>{queuedReportsCount}</Text>
            <Text style={[styles.autoDispatchStatLabel, { color: '#92400E' }]}>In Queue</Text>
          </View>
          <TouchableOpacity
            style={[
              styles.autoDispatchToggleBtn,
              autoDispatchActive ? styles.autoDispatchToggleBtnActive : styles.autoDispatchToggleBtnPaused,
            ]}
            onPress={handleToggleAutoDispatch}
            disabled={isTogglingAutoDispatch}
            activeOpacity={0.85}
          >
            <MaterialIcons
              name={autoDispatchActive ? 'toggle-on' : 'toggle-off'}
              size={28}
              color={autoDispatchActive ? '#059669' : '#94A3B8'}
            />
            <Text
              style={[
                styles.autoDispatchToggleText,
                { color: autoDispatchActive ? '#065F46' : '#475569' },
              ]}
            >
              {autoDispatchActive ? 'Auto-Dispatch ON' : 'Auto-Dispatch OFF'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Operational Selection Card: Barangay & Active Driver */}
      <View
        style={[
          styles.selectorCard,
          isBarangayDropdownOpen && { zIndex: 1000, elevation: 25 },
        ]}
      >
        <View
          style={[
            styles.selectorGrid,
            isNarrow && { flexDirection: 'column', gap: 12 },
            isBarangayDropdownOpen && { zIndex: 1000 },
          ]}
        >
          {/* 1. Searchable Barangay Dropdown */}
          <View style={{ flex: 1.2, zIndex: 1000, position: 'relative' }}>
            <View style={styles.selectorLabelRow}>
              <MaterialIcons name="location-city" size={16} color="#059669" />
              <Text style={styles.selectorLabel}>SELECT OPERATIONAL BARANGAY</Text>
            </View>

            {/* Dropdown Button */}
            <TouchableOpacity
              style={[
                styles.barangayDropdownBtn,
                isBarangayDropdownOpen && styles.barangayDropdownBtnActive,
              ]}
              onPress={() => setIsBarangayDropdownOpen(!isBarangayDropdownOpen)}
              activeOpacity={0.85}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                <View
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 6,
                    backgroundColor: '#ECFDF5',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <MaterialIcons name="holiday-village" size={16} color="#059669" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, fontWeight: '800', color: '#0F172A' }}>
                    Brgy. {selectedBarangay || 'Select Barangay'}
                  </Text>
                  <Text style={{ fontSize: 10.5, color: '#64748B' }}>
                    {availableBarangays.length} Barangays Available
                  </Text>
                </View>
              </View>
              <MaterialIcons
                name={isBarangayDropdownOpen ? 'keyboard-arrow-up' : 'keyboard-arrow-down'}
                size={22}
                color="#64748B"
              />
            </TouchableOpacity>

            {/* Dropdown Menu with Search Input */}
            {isBarangayDropdownOpen && (
              <View style={styles.barangayDropdownMenu}>
                {/* Search box inside dropdown */}
                <View style={styles.dropdownSearchContainer}>
                  <MaterialIcons name="search" size={16} color="#64748B" />
                  <TextInput
                    style={styles.dropdownSearchInput}
                    placeholder="Search barangay name..."
                    placeholderTextColor="#94A3B8"
                    value={barangaySearchQuery}
                    onChangeText={setBarangaySearchQuery}
                    autoFocus
                  />
                  {barangaySearchQuery ? (
                    <TouchableOpacity onPress={() => setBarangaySearchQuery('')}>
                      <MaterialIcons name="close" size={14} color="#94A3B8" />
                    </TouchableOpacity>
                  ) : null}
                </View>

                {/* List of Barangays */}
                <ScrollView style={{ maxHeight: 220 }} nestedScrollEnabled keyboardShouldPersistTaps="handled">
                  {filteredBarangays.length === 0 ? (
                    <View style={{ padding: 14, alignItems: 'center' }}>
                      <Text style={{ fontSize: 12, color: '#94A3B8', fontStyle: 'italic' }}>
                        No matching barangays found.
                      </Text>
                    </View>
                  ) : (
                    filteredBarangays.map((b) => {
                      const isSelected = selectedBarangay === b;
                      const bLower = b.trim().toLowerCase();
                      const bReportCount = reports.filter((r) => {
                        const rBLower = (r.barangay || '').trim().toLowerCase();
                        return rBLower === bLower || bLower.includes(rBLower) || rBLower.includes(bLower);
                      }).length;

                      return (
                        <TouchableOpacity
                          key={b}
                          style={[
                            styles.barangayDropdownItem,
                            isSelected && styles.barangayDropdownItemSelected,
                          ]}
                          onPress={() => {
                            setSelectedBarangay(b);
                            setIsBarangayDropdownOpen(false);
                            setBarangaySearchQuery('');
                          }}
                          activeOpacity={0.7}
                        >
                          <MaterialIcons
                            name={isSelected ? 'check-circle' : 'location-on'}
                            size={16}
                            color={isSelected ? '#059669' : '#94A3B8'}
                          />
                          <Text
                            style={[
                              styles.barangayDropdownItemText,
                              isSelected && styles.barangayDropdownItemTextSelected,
                            ]}
                          >
                            Brgy. {b}
                          </Text>
                          {bReportCount > 0 && (
                            <View style={{ backgroundColor: '#FEF3C7', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, marginLeft: 'auto', marginRight: 6 }}>
                              <Text style={{ fontSize: 10, fontWeight: '700', color: '#B45309' }}>
                                {bReportCount} {bReportCount === 1 ? 'Report' : 'Reports'}
                              </Text>
                            </View>
                          )}
                          {isSelected && (
                            <View style={[styles.activePillTag, bReportCount > 0 && { marginLeft: 0 }]}>
                              <Text style={styles.activePillTagText}>Selected</Text>
                            </View>
                          )}
                        </TouchableOpacity>
                      );
                    })
                  )}
                </ScrollView>
              </View>
            )}
          </View>

          {/* 2. Active Driver Selector for this Barangay */}
          <View style={{ flex: 1 }}>
            <View style={styles.selectorLabelRow}>
              <MaterialIcons name="badge" size={16} color="#0284C7" />
              <Text style={styles.selectorLabel}>ASSIGNED / ACTIVE DRIVER IN {selectedBarangay.toUpperCase()}</Text>
            </View>
            {activeBarangayDrivers.length === 0 ? (
              <View style={styles.noDriverNotice}>
                <MaterialIcons name="info-outline" size={16} color="#D97706" />
                <Text style={styles.noDriverNoticeText}>No drivers currently on duty in Brgy. {selectedBarangay}.</Text>
              </View>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.driverPillsContainer}>
                {activeBarangayDrivers.map((d) => {
                  const isSelected = selectedDriverId === d.id;
                  const isSimulatingThisDriver = simState.isActive && simState.driverId === d.id;
                  return (
                    <TouchableOpacity
                      key={d.id}
                      style={[
                        styles.driverPill,
                        isSelected && styles.driverPillActive,
                        isSimulatingThisDriver && styles.driverPillSimulating,
                      ]}
                      onPress={() => setSelectedDriverId(d.id)}
                      activeOpacity={0.8}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={[styles.driverPillName, isSelected && { color: '#0F172A', fontWeight: '800' }]}>
                          {d.displayName}
                        </Text>
                        {isSimulatingThisDriver ? (
                          <View style={styles.simBadgeLive}>
                            <Text style={styles.simBadgeLiveText}>SIMULATING</Text>
                          </View>
                        ) : (
                          <View style={styles.activeBadgeSmall}>
                            <Text style={styles.activeBadgeSmallText}>ON DUTY</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.driverPillTruck}>
                        🚚 {d.currentTruckPlate || trucksMap[d.currentTruckId || ''] || 'CENRO Compactor'}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}
          </View>
        </View>
      </View>

      {/* SUB-VIEW 1: DRIVER LIVE ROUTE & AI OPTIMIZATION */}
      {activeSubView === 'route-ai' && (
        <View style={{ gap: 16 }}>
          {/* Driver Mobile GPS Telemetry Monitor Bar */}
          <View style={styles.simControlCard}>
            <View style={styles.simControlLeft}>
              <View
                style={[
                  styles.simStatusIcon,
                  driverLiveLocation?.isBroadcasting || (simState.isActive && simState.driverId === selectedDriverId)
                    ? { backgroundColor: '#DCFCE7' }
                    : { backgroundColor: '#F1F5F9' },
                ]}
              >
                <MaterialIcons
                  name={
                    driverLiveLocation?.isBroadcasting || (simState.isActive && simState.driverId === selectedDriverId)
                      ? 'satellite-alt'
                      : 'phone-android'
                  }
                  size={22}
                  color={
                    driverLiveLocation?.isBroadcasting || (simState.isActive && simState.driverId === selectedDriverId)
                      ? '#166534'
                      : '#64748B'
                  }
                />
              </View>
              <View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={styles.simCardTitle}>
                    {driverLiveLocation?.isBroadcasting || (simState.isActive && simState.driverId === selectedDriverId)
                      ? `Driver Live Mobile GPS: ${currentSelectedDriver?.displayName || 'Active Driver'}`
                      : `Driver Mobile Telemetry: Brgy. ${selectedBarangay}`}
                  </Text>
                  {driverLiveLocation?.isBroadcasting || (simState.isActive && simState.driverId === selectedDriverId) ? (
                    <View style={styles.simPulseBadge}>
                      <View style={styles.simPulseDot} />
                      <Text style={styles.simPulseText}>
                        {driverLiveLocation?.isSimulation || simState.isActive ? 'Simulated Phone GPS' : 'Live Phone GPS'}
                      </Text>
                    </View>
                  ) : (
                    <View style={[styles.simPulseBadge, { backgroundColor: '#F1F5F9' }]}>
                      <Text style={[styles.simPulseText, { color: '#64748B' }]}>Mobile Device Standby</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.simCardSubtitle}>
                  {driverLiveLocation?.isBroadcasting || (simState.isActive && simState.driverId === selectedDriverId)
                    ? `Live movement stream received from driver mobile device (${driverLiveLocation?.speed || simState.currentSpeedKph || 0} km/h · ${driverLiveLocation?.locationName || simState.locationName || 'On Route'}).`
                    : `Driver initiates collection & GPS movement on their mobile terminal for their assigned jurisdiction (Brgy. ${selectedBarangay}).`}
                </Text>
              </View>
            </View>

            <View style={styles.telemetryStatusBadge}>
              <MaterialIcons
                name={
                  driverLiveLocation?.isBroadcasting || (simState.isActive && simState.driverId === selectedDriverId)
                    ? 'wifi-tethering'
                    : 'phonelink-setup'
                }
                size={16}
                color={
                  driverLiveLocation?.isBroadcasting || (simState.isActive && simState.driverId === selectedDriverId)
                    ? '#059669'
                    : '#64748B'
                }
              />
              <Text
                style={[
                  styles.telemetryStatusBadgeText,
                  (driverLiveLocation?.isBroadcasting || (simState.isActive && simState.driverId === selectedDriverId)) && {
                    color: '#065F46',
                    fontWeight: '800',
                  },
                ]}
              >
                {driverLiveLocation?.isBroadcasting || (simState.isActive && simState.driverId === selectedDriverId)
                  ? 'Receiving Mobile Telemetry'
                  : 'Awaiting Driver Phone Start'}
              </Text>
            </View>
          </View>

          {/* AI Fuel & Traffic Optimization Breakdown Hero Grid */}
          {optResult && (
            <View style={[styles.metricsGrid, isMobile && { flexDirection: 'column' }]}>
              {/* Metric 1: Fuel Saved */}
              <View style={[styles.metricCard, { borderLeftColor: '#059669' }]}>
                <View style={styles.metricHeader}>
                  <Text style={styles.metricLabel}>FUEL SAVINGS ESTIMATE</Text>
                  <MaterialIcons name="local-gas-station" size={20} color="#059669" />
                </View>
                <Text style={styles.metricMainValue}>
                  {optResult.fuelSavingsLiters}{' '}
                  <Text style={{ fontSize: 14, fontWeight: '600', color: '#64748B' }}>Liters Saved</Text>
                </Text>
                <View style={styles.metricSubRow}>
                  <Text style={styles.metricSubText}>
                    Baseline: <Text style={{ fontWeight: '700' }}>{optResult.baselineFuelLiters} L</Text> &bull; AI Optimized:{' '}
                    <Text style={{ fontWeight: '700', color: '#059669' }}>{optResult.optimizedFuelLiters} L</Text>
                  </Text>
                  <View style={styles.savingsChip}>
                    <Text style={styles.savingsChipText}>₱{optResult.fuelCostSavedPhp} Diesel Saved</Text>
                  </View>
                </View>
              </View>

              {/* Metric 2: Time Saved */}
              <View style={[styles.metricCard, { borderLeftColor: '#0284C7' }]}>
                <View style={styles.metricHeader}>
                  <Text style={styles.metricLabel}>TRAVEL & IDLING TIME</Text>
                  <MaterialIcons name="timer" size={20} color="#0284C7" />
                </View>
                <Text style={[styles.metricMainValue, { color: '#0369A1' }]}>
                  {optResult.timeSavingsMinutes}{' '}
                  <Text style={{ fontSize: 14, fontWeight: '600', color: '#64748B' }}>Minutes Shaved</Text>
                </Text>
                <View style={styles.metricSubRow}>
                  <Text style={styles.metricSubText}>
                    Baseline: {optResult.baselineDurationMins}m &bull; Optimized:{' '}
                    <Text style={{ fontWeight: '700', color: '#0369A1' }}>{optResult.optimizedDurationMins}m</Text>
                  </Text>
                  <View style={[styles.savingsChip, { backgroundColor: '#E0F2FE', borderColor: '#BAE6FD' }]}>
                    <Text style={[styles.savingsChipText, { color: '#0369A1' }]}>
                      +{optResult.efficiencyGainPercent}% Faster
                    </Text>
                  </View>
                </View>
              </View>

              {/* Metric 3: Bottleneck Traffic Avoidance */}
              <View style={[styles.metricCard, { borderLeftColor: '#F59E0B' }]}>
                <View style={styles.metricHeader}>
                  <Text style={styles.metricLabel}>TRAFFIC BOTTLENECKS AVOIDED</Text>
                  <MaterialIcons name="traffic" size={20} color="#D97706" />
                </View>
                <Text style={[styles.metricMainValue, { color: '#B45309' }]}>
                  {optResult.bottlenecksAvoided}{' '}
                  <Text style={{ fontSize: 14, fontWeight: '600', color: '#64748B' }}>Congestion Hotspots</Text>
                </Text>
                <View style={styles.metricSubRow}>
                  <Text style={styles.metricSubText}>
                    Commercial / market stops re-timed to off-peak slots.
                  </Text>
                  <View style={[styles.savingsChip, { backgroundColor: '#FEF3C7', borderColor: '#FDE68A' }]}>
                    <Text style={[styles.savingsChipText, { color: '#B45309' }]}>100% Stops Visited</Text>
                  </View>
                </View>
              </View>
            </View>
          )}

          {/* Interactive Route Map */}
          {optResult && (
            <View style={styles.mapCard}>
              <View style={styles.mapCardHeader}>
                <View>
                  <Text style={styles.mapCardTitle}>Interactive GPS Collection Corridor</Text>
                  <Text style={styles.mapCardSubtitle}>
                    Blue dotted line: Driver baseline trajectory &bull; Green solid line: AI traffic-optimized order
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.reoptimizeBtn}
                  onPress={() => runOptimization(selectedReportObjects)}
                  disabled={isOptimizingAI}
                  activeOpacity={0.8}
                >
                  <MaterialIcons name="refresh" size={16} color="#1B4D3E" />
                  <Text style={styles.reoptimizeBtnText}>Recalculate AI Route</Text>
                </TouchableOpacity>
              </View>

              <RouteOptimizationMap
                baselineStops={optResult.baselineStops}
                optimizedStops={optResult.optimizedStops}
                currentSimPosition={
                  driverLiveLocation
                    ? { latitude: driverLiveLocation.latitude, longitude: driverLiveLocation.longitude }
                    : simState.isActive && simState.currentCoordinate && simState.driverId === selectedDriverId
                    ? simState.currentCoordinate
                    : null
                }
                activeDriverName={currentSelectedDriver?.displayName}
                barangayName={selectedBarangay}
              />
            </View>
          )}

          {/* Turn-by-Turn Collection Stop Sequence Table */}
          {optResult && (
            <View style={styles.tableCard}>
              <View style={styles.tableCardHeader}>
                <View>
                  <Text style={styles.tableCardTitle}>
                    AI-Optimized Stop Sequence ({optResult.optimizedStops.length} Total Points)
                  </Text>
                  <Text style={styles.tableCardSubtitle}>
                    Scheduled order preserves all collection stopping places while avoiding high-traffic peak windows.
                  </Text>
                </View>
                {selectedReportObjects.length > 0 && (
                  <View style={styles.insertedReportsBadge}>
                    <MaterialIcons name="add-location" size={14} color="#B45309" />
                    <Text style={styles.insertedReportsBadgeText}>
                      +{selectedReportObjects.length} Verified Reports Included
                    </Text>
                  </View>
                )}
              </View>

              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={{ minWidth: 700 }}>
                  <View style={styles.tableHeaderRow}>
                    <Text style={[styles.th, { width: 55 }]}>SEQ</Text>
                    <Text style={[styles.th, { width: 220 }]}>STOP / COLLECTION POINT</Text>
                    <Text style={[styles.th, { width: 130 }]}>STOP TYPE</Text>
                    <Text style={[styles.th, { width: 140 }]}>TRAFFIC IMPACT</Text>
                    <Text style={[styles.th, { width: 160 }]}>OPTIMAL WINDOW</Text>
                  </View>

                  {optResult.optimizedStops.map((stop, idx) => {
                    const isStart = idx === 0;
                    const isEnd = idx === optResult.optimizedStops.length - 1;
                    const isReport = stop.stopType === 'verified_report';
                    const isHotspot = stop.trafficCongestionLevel === 'high';

                    return (
                      <View
                        key={stop.id}
                        style={[
                          styles.tableRow,
                          idx % 2 === 1 && { backgroundColor: '#F8FAFC' },
                          isReport && { backgroundColor: '#FEF9C3' },
                        ]}
                      >
                        <View style={[styles.td, { width: 55 }]}>
                          <View
                            style={[
                              styles.seqBadge,
                              isStart && { backgroundColor: '#059669' },
                              isEnd && { backgroundColor: '#DC2626' },
                              isReport && { backgroundColor: '#D97706' },
                            ]}
                          >
                            <Text style={styles.seqBadgeText}>{idx + 1}</Text>
                          </View>
                        </View>

                        <View style={[styles.td, { width: 220 }]}>
                          <Text style={styles.stopNameText}>{stop.name}</Text>
                          <Text style={styles.stopLocationText}>
                            {stop.street ? `${stop.street}, ` : ''}Brgy. {stop.barangay}
                          </Text>
                        </View>

                        <View style={[styles.td, { width: 130 }]}>
                          {isStart ? (
                            <View style={styles.typeBadgeDepot}>
                              <Text style={styles.typeBadgeDepotText}>Depot Start</Text>
                            </View>
                          ) : isEnd ? (
                            <View style={styles.typeBadgeReturn}>
                              <Text style={styles.typeBadgeReturnText}>Transfer Station</Text>
                            </View>
                          ) : isReport ? (
                            <View style={styles.typeBadgeReport}>
                              <Text style={styles.typeBadgeReportText}>Citizen Report</Text>
                            </View>
                          ) : (
                            <View style={styles.typeBadgeRegular}>
                              <Text style={styles.typeBadgeRegularText}>Routine Stop</Text>
                            </View>
                          )}
                        </View>

                        <View style={[styles.td, { width: 140 }]}>
                          {isHotspot ? (
                            <View style={styles.trafficHighBadge}>
                              <MaterialIcons name="warning" size={12} color="#DC2626" />
                              <Text style={styles.trafficHighText}>Peak Congestion</Text>
                            </View>
                          ) : (
                            <View style={styles.trafficLowBadge}>
                              <MaterialIcons name="check" size={12} color="#059669" />
                              <Text style={styles.trafficLowText}>Clear Transit</Text>
                            </View>
                          )}
                        </View>

                        <View style={[styles.td, { width: 160 }]}>
                          <Text style={styles.timeWindowText}>{stop.optimalTimeWindow || 'Routine Schedule'}</Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              </ScrollView>
            </View>
          )}

          {/* Bottom Dispatch CTA */}
          <View style={styles.bottomDispatchBanner}>
            <View style={{ flex: 1 }}>
              <Text style={styles.bottomDispatchTitle}>Ready to Dispatch to Driver Terminal?</Text>
              <Text style={styles.bottomDispatchSubtitle}>
                Driver: <Text style={{ fontWeight: '700' }}>{currentSelectedDriver?.displayName || 'Unassigned'}</Text> &bull;{' '}
                Stops: <Text style={{ fontWeight: '700' }}>{optResult?.optimizedStops.length || 0} Total</Text> &bull; Fuel
                Savings: <Text style={{ fontWeight: '700', color: '#059669' }}>{optResult?.fuelSavingsLiters}L (₱{optResult?.fuelCostSavedPhp})</Text>
              </Text>
            </View>
            <TouchableOpacity
              style={styles.dispatchPrimaryBtn}
              onPress={() => setShowDispatchConfirmModal(true)}
              disabled={!selectedDriverId || !optResult}
              activeOpacity={0.85}
            >
              <MaterialIcons name="send" size={16} color="#FFFFFF" />
              <Text style={styles.dispatchPrimaryBtnText}>Dispatch Route to Driver</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* SUB-VIEW 2: VERIFIED REPORTS ROUTE DISPATCH */}
      {activeSubView === 'report-dispatch' && (
        <View style={{ gap: 16 }}>
          {/* Overview Info Card */}
          <View style={styles.reportDispatchIntroCard}>
            <View style={styles.reportDispatchIntroIcon}>
              <MaterialIcons name="playlist-add-check" size={24} color="#059669" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.reportDispatchIntroTitle}>
                Insert Verified Citizen Reports into Brgy. {selectedBarangay} Route
              </Text>
              <Text style={styles.reportDispatchIntroSubtitle}>
                Select verified waste clusters reported by residents. The AI optimizer will slot them into the driver&apos;s
                collection route at the lowest detour and traffic cost.
              </Text>
            </View>
            <TouchableOpacity
              style={styles.switchBackBtn}
              onPress={() => setActiveSubView('route-ai')}
              activeOpacity={0.8}
            >
              <MaterialIcons name="visibility" size={16} color="#1B4D3E" />
              <Text style={styles.switchBackBtnText}>
                Preview on Map ({selectedReportIds.size > 0 ? selectedReportIds.size : barangayReports.length})
              </Text>
            </TouchableOpacity>
          </View>

          {/* Search and Filters */}
          <View style={styles.reportFilterBar}>
            <View style={styles.reportSearchBox}>
              <MaterialIcons name="search" size={18} color="#94A3B8" />
              <TextInput
                value={reportSearch}
                onChangeText={setReportSearch}
                placeholder="Search street, description, or waste type..."
                placeholderTextColor="#94A3B8"
                style={styles.reportSearchInput}
              />
              {reportSearch.length > 0 && (
                <TouchableOpacity onPress={() => setReportSearch('')}>
                  <MaterialIcons name="close" size={16} color="#94A3B8" />
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.filterPillsRow}>
              <TouchableOpacity
                style={[styles.statusFilterPill, statusFilter === 'all' && styles.statusFilterPillActive]}
                onPress={() => setStatusFilter('all')}
              >
                <Text style={[styles.statusFilterPillText, statusFilter === 'all' && styles.statusFilterPillTextActive]}>
                  All Verified ({barangayReports.length})
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.statusFilterPill, statusFilter === 'acknowledged' && styles.statusFilterPillActive]}
                onPress={() => setStatusFilter('acknowledged')}
              >
                <Text style={[styles.statusFilterPillText, statusFilter === 'acknowledged' && styles.statusFilterPillTextActive]}>
                  Acknowledged
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.statusFilterPill, statusFilter === 'in_progress' && styles.statusFilterPillActive]}
                onPress={() => setStatusFilter('in_progress')}
              >
                <Text style={[styles.statusFilterPillText, statusFilter === 'in_progress' && styles.statusFilterPillTextActive]}>
                  In Progress
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Reports Table / Card List */}
          {barangayReports.length === 0 ? (
            <View style={styles.noReportsCard}>
              <MaterialIcons name="check-circle" size={36} color="#10B981" />
              <Text style={styles.noReportsTitle}>No Pending Verified Reports</Text>
              <Text style={styles.noReportsSubtitle}>
                All acknowledged reports in Brgy. {selectedBarangay} have been addressed or none match your search.
              </Text>
            </View>
          ) : (
            <View style={styles.reportsTableCard}>
              <View style={styles.reportsTableHeader}>
                <TouchableOpacity
                  style={styles.selectAllBtn}
                  onPress={() => {
                    if (selectedReportIds.size === barangayReports.length) {
                      setSelectedReportIds(new Set());
                    } else {
                      setSelectedReportIds(new Set(barangayReports.map((r) => r.id)));
                    }
                  }}
                >
                  <MaterialIcons
                    name={selectedReportIds.size === barangayReports.length ? 'check-box' : 'check-box-outline-blank'}
                    size={20}
                    color="#059669"
                  />
                  <Text style={styles.selectAllText}>
                    {selectedReportIds.size === barangayReports.length ? 'Deselect All' : 'Select All Reports'}
                  </Text>
                </TouchableOpacity>

                <Text style={styles.selectedCountBadge}>
                  {selectedReportIds.size} of {barangayReports.length} Selected for Route Insertion
                </Text>
              </View>

              <View style={{ gap: 10 }}>
                {barangayReports.map((rep) => {
                  const isSelected = selectedReportIds.has(rep.id);
                  const hasLocation = Number.isFinite(rep.location?.lat ?? rep.location?.latitude);

                  return (
                    <TouchableOpacity
                      key={rep.id}
                      style={[styles.reportItemCard, isSelected && styles.reportItemCardSelected]}
                      onPress={() => toggleReportSelection(rep.id)}
                      activeOpacity={0.8}
                    >
                      <View style={styles.reportItemCheckbox}>
                        <MaterialIcons
                          name={isSelected ? 'check-box' : 'check-box-outline-blank'}
                          size={22}
                          color={isSelected ? '#059669' : '#94A3B8'}
                        />
                      </View>

                      {rep.imageURL ? (
                        <Image source={{ uri: rep.imageURL }} style={styles.reportThumb} resizeMode="cover" />
                      ) : (
                        <View style={styles.reportThumbPlaceholder}>
                          <MaterialIcons name="image-not-supported" size={18} color="#94A3B8" />
                        </View>
                      )}

                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                          <Text style={styles.reportItemTitle} numberOfLines={1}>
                            {rep.title || 'Citizen Waste Report'}
                          </Text>
                          <View style={styles.statusBadgeSmall}>
                            <Text style={styles.statusBadgeSmallText}>{rep.status.toUpperCase()}</Text>
                          </View>
                        </View>

                        <Text style={styles.reportItemLocation}>
                          📍 {rep.street ? `${rep.street}, ` : ''}Brgy. {rep.barangay}
                        </Text>

                        <View style={styles.reportItemMetaRow}>
                          <View style={styles.metaPill}>
                            <Text style={styles.metaPillText}>{rep.aiAnalysis?.wasteType || 'Solid Waste'}</Text>
                          </View>
                          <View style={[styles.metaPill, { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' }]}>
                            <Text style={[styles.metaPillText, { color: '#1E40AF' }]}>
                              ~{rep.aiAnalysis?.estimatedWeight || '25 kg'}
                            </Text>
                          </View>
                          {hasLocation ? (
                            <View style={[styles.metaPill, { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' }]}>
                              <Text style={[styles.metaPillText, { color: '#065F46' }]}>GPS Tagged</Text>
                            </View>
                          ) : (
                            <View style={[styles.metaPill, { backgroundColor: '#FEF2F2', borderColor: '#FECACA' }]}>
                              <Text style={[styles.metaPillText, { color: '#991B1B' }]}>No GPS</Text>
                            </View>
                          )}
                        </View>
                      </View>

                      <TouchableOpacity
                        style={styles.viewDetailBtn}
                        onPress={(e) => {
                          e.stopPropagation();
                          setViewingReport(rep);
                        }}
                      >
                        <MaterialIcons name="open-in-new" size={18} color="#64748B" />
                      </TouchableOpacity>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          {/* Action Bar for Sub-View 2 */}
          <View style={styles.bottomDispatchBanner}>
            <View style={{ flex: 1 }}>
              <Text style={styles.bottomDispatchTitle}>
                {selectedReportIds.size} Reports Selected for Insertion
              </Text>
              <Text style={styles.bottomDispatchSubtitle}>
                Driver: <Text style={{ fontWeight: '700' }}>{currentSelectedDriver?.displayName || 'Unassigned'}</Text> in
                Brgy. {selectedBarangay}
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.dispatchPrimaryBtn, selectedReportIds.size === 0 && { opacity: 0.6 }]}
              onPress={() => setShowDispatchConfirmModal(true)}
              disabled={selectedReportIds.size === 0 || !selectedDriverId}
              activeOpacity={0.85}
            >
              <MaterialIcons name="send" size={16} color="#FFFFFF" />
              <Text style={styles.dispatchPrimaryBtnText}>Dispatch Route with Reports</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* MODAL: DISPATCH CONFIRMATION */}
      <Modal
        visible={showDispatchConfirmModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDispatchConfirmModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.confirmModalBox}>
            <View style={styles.confirmModalIcon}>
              <MaterialIcons name="local-shipping" size={32} color="#059669" />
            </View>

            <Text style={styles.confirmModalTitle}>Confirm Route Dispatch</Text>
            <Text style={styles.confirmModalSubtitle}>
              You are dispatching an AI traffic-optimized collection route directly to the driver&apos;s terminal.
            </Text>

            <View style={styles.confirmSummaryBox}>
              <View style={styles.confirmRow}>
                <Text style={styles.confirmLabel}>OPERATIONAL BARANGAY:</Text>
                <Text style={styles.confirmVal}>Brgy. {selectedBarangay}</Text>
              </View>
              <View style={styles.confirmRow}>
                <Text style={styles.confirmLabel}>ASSIGNED DRIVER:</Text>
                <Text style={styles.confirmVal}>{currentSelectedDriver?.displayName || 'Driver'}</Text>
              </View>
              <View style={styles.confirmRow}>
                <Text style={styles.confirmLabel}>ASSIGNED TRUCK:</Text>
                <Text style={styles.confirmVal}>
                  {currentSelectedDriver?.currentTruckPlate || trucksMap[currentSelectedDriver?.currentTruckId || ''] || 'CENRO Unit'}
                </Text>
              </View>
              <View style={styles.confirmRow}>
                <Text style={styles.confirmLabel}>TOTAL ROUTE STOPS:</Text>
                <Text style={[styles.confirmVal, { color: '#059669', fontWeight: '800' }]}>
                  {optResult?.optimizedStops.length || 0} Stopping Points
                </Text>
              </View>
              <View style={styles.confirmRow}>
                <Text style={styles.confirmLabel}>INSERTED CITIZEN REPORTS:</Text>
                <Text style={[styles.confirmVal, { color: '#D97706', fontWeight: '800' }]}>
                  {selectedReportObjects.length} Verified Reports
                </Text>
              </View>
              <View style={[styles.confirmRow, { borderBottomWidth: 0 }]}>
                <Text style={styles.confirmLabel}>ESTIMATED FUEL SAVINGS:</Text>
                <Text style={[styles.confirmVal, { color: '#059669', fontWeight: '800' }]}>
                  {optResult?.fuelSavingsLiters}L (₱{optResult?.fuelCostSavedPhp})
                </Text>
              </View>
            </View>

            <View style={styles.confirmActions}>
              <TouchableOpacity
                style={styles.confirmCancelBtn}
                onPress={() => setShowDispatchConfirmModal(false)}
                disabled={isDispatching}
              >
                <Text style={styles.confirmCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.confirmSubmitBtn}
                onPress={handleDispatchToDriver}
                disabled={isDispatching}
              >
                {isDispatching ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <MaterialIcons name="check" size={18} color="#FFFFFF" />
                    <Text style={styles.confirmSubmitText}>Confirm & Transmit</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* MODAL: REPORT DETAILS INSPECTOR */}
      <Modal
        visible={!!viewingReport}
        transparent
        animationType="fade"
        onRequestClose={() => setViewingReport(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.reportModalBox}>
            <View style={styles.reportModalHeader}>
              <View>
                <Text style={styles.reportModalTitle}>{viewingReport?.title || 'Citizen Report'}</Text>
                <Text style={styles.reportModalSubtitle}>
                  Brgy. {viewingReport?.barangay} &bull; {viewingReport?.street}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setViewingReport(null)}>
                <MaterialIcons name="close" size={22} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 400 }} showsVerticalScrollIndicator={false}>
              {viewingReport?.imageURL ? (
                <Image source={{ uri: viewingReport.imageURL }} style={styles.reportModalImg} resizeMode="cover" />
              ) : null}

              <Text style={styles.reportModalDesc}>{viewingReport?.description || 'No description provided.'}</Text>

              <View style={styles.aiBox}>
                <Text style={styles.aiBoxTitle}>AI Vision Waste Classification</Text>
                <Text style={styles.aiBoxText}>Type: {viewingReport?.aiAnalysis?.wasteType || 'Solid Waste'}</Text>
                <Text style={styles.aiBoxText}>
                  Estimated Weight: {viewingReport?.aiAnalysis?.estimatedWeight || 'Not specified'}
                </Text>
                {viewingReport?.aiAnalysis?.details ? (
                  <Text style={[styles.aiBoxText, { marginTop: 4, fontStyle: 'italic' }]}>
                    {viewingReport.aiAnalysis.details}
                  </Text>
                ) : null}
              </View>
            </ScrollView>

            <TouchableOpacity
              style={styles.modalCloseDoneBtn}
              onPress={() => setViewingReport(null)}
            >
              <Text style={styles.modalCloseDoneBtnText}>Close Details</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    padding: 24,
  },
  headerRow: {
    marginBottom: 16,
    gap: 12,
  },
  headerSubtitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#059669',
    letterSpacing: 1,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.5,
  },
  headerDescription: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 4,
  },
  subViewSwitcher: {
    flexDirection: 'row',
    backgroundColor: '#E2E8F0',
    borderRadius: 10,
    padding: 3,
    gap: 4,
    marginTop: 6,
    alignSelf: 'flex-start',
  },
  subViewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  subViewBtnActive: {
    backgroundColor: '#1B4D3E',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  subViewBtnText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#64748B',
  },
  subViewBtnTextActive: {
    color: '#FFFFFF',
  },

  // Selector Card
  selectorCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
    position: 'relative',
    zIndex: 10,
  },
  selectorGrid: {
    flexDirection: 'row',
    gap: 20,
  },
  selectorLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  selectorLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#475569',
    letterSpacing: 0.5,
  },
  barangayDropdownBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  barangayDropdownBtnActive: {
    borderColor: '#059669',
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  barangayDropdownMenu: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#059669',
    borderTopWidth: 0,
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 30,
    zIndex: 9999,
    overflow: 'hidden',
  },
  dropdownSearchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: '#F8FAFC',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    gap: 8,
  },
  dropdownSearchInput: {
    flex: 1,
    fontSize: 12.5,
    color: '#0F172A',
    padding: 0,
  },
  barangayDropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
    gap: 8,
  },
  barangayDropdownItemSelected: {
    backgroundColor: '#ECFDF5',
  },
  barangayDropdownItemText: {
    fontSize: 13,
    color: '#334155',
    fontWeight: '600',
    flex: 1,
  },
  barangayDropdownItemTextSelected: {
    color: '#047857',
    fontWeight: '800',
  },
  activePillTag: {
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  activePillTagText: {
    fontSize: 10,
    color: '#047857',
    fontWeight: '800',
  },
  pillsContainer: {
    gap: 6,
  },
  barangayPill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  barangayPillActive: {
    backgroundColor: '#1B4D3E',
    borderColor: '#1B4D3E',
  },
  barangayPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  barangayPillTextActive: {
    color: '#FFFFFF',
  },
  driverPillsContainer: {
    gap: 8,
  },
  driverPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    minWidth: 140,
  },
  driverPillActive: {
    backgroundColor: '#ECFDF5',
    borderColor: '#10B981',
  },
  driverPillSimulating: {
    borderColor: '#059669',
    backgroundColor: '#DCFCE7',
  },
  driverPillName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  driverPillTruck: {
    fontSize: 10.5,
    color: '#64748B',
    marginTop: 2,
  },
  activeBadgeSmall: {
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
  },
  activeBadgeSmallText: {
    fontSize: 8.5,
    fontWeight: '800',
    color: '#0369A1',
  },
  simBadgeLive: {
    backgroundColor: '#166534',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  simBadgeLiveText: {
    fontSize: 8.5,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  noDriverNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
  },
  noDriverNoticeText: {
    fontSize: 11.5,
    color: '#92400E',
    fontWeight: '600',
  },

  // Sim Control Card
  simControlCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
    flexWrap: 'wrap',
    gap: 12,
  },
  simControlLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    minWidth: 280,
  },
  simStatusIcon: {
    width: 42,
    height: 42,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  simCardTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  simCardSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  simPulseBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  simPulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#16A34A',
  },
  simPulseText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#166534',
  },
  telemetryStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    gap: 6,
  },
  telemetryStatusBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },

  // Metrics Grid
  metricsGrid: {
    flexDirection: 'row',
    gap: 14,
  },
  metricCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderLeftWidth: 4,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  metricHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  metricLabel: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.5,
  },
  metricMainValue: {
    fontSize: 22,
    fontWeight: '900',
    color: '#059669',
    letterSpacing: -0.5,
  },
  metricSubRow: {
    marginTop: 8,
    gap: 6,
  },
  metricSubText: {
    fontSize: 11.5,
    color: '#64748B',
  },
  savingsChip: {
    alignSelf: 'flex-start',
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#BBF7D0',
    marginTop: 4,
  },
  savingsChipText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#166534',
  },

  // Map Card
  mapCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  mapCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    flexWrap: 'wrap',
    gap: 8,
  },
  mapCardTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  mapCardSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  reoptimizeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#C8E6C9',
  },
  reoptimizeBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1B4D3E',
  },

  // Table Card
  tableCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  tableCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    flexWrap: 'wrap',
    gap: 8,
  },
  tableCardTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  tableCardSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  insertedReportsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  insertedReportsBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#92400E',
  },
  tableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    marginBottom: 4,
  },
  th: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#475569',
    letterSpacing: 0.5,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  td: {
    justifyContent: 'center',
  },
  seqBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
  },
  seqBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  stopNameText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#0F172A',
  },
  stopLocationText: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  typeBadgeDepot: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  typeBadgeDepotText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#065F46',
  },
  typeBadgeReturn: {
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  typeBadgeReturnText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#991B1B',
  },
  typeBadgeReport: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  typeBadgeReportText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#92400E',
  },
  typeBadgeRegular: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  typeBadgeRegularText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#475569',
  },
  trafficHighBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  trafficHighText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#991B1B',
  },
  trafficLowBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  trafficLowText: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#065F46',
  },
  timeWindowText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#0F172A',
  },

  // Bottom Dispatch Banner
  bottomDispatchBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1E293B',
    borderRadius: 14,
    padding: 16,
    gap: 14,
    flexWrap: 'wrap',
  },
  bottomDispatchTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  bottomDispatchSubtitle: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  dispatchPrimaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#059669',
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 10,
  },
  dispatchPrimaryBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },

  // Sub-View 2 (Verified Reports Dispatch)
  reportDispatchIntroCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    gap: 12,
    flexWrap: 'wrap',
  },
  reportDispatchIntroIcon: {
    width: 42,
    height: 42,
    borderRadius: 10,
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reportDispatchIntroTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  reportDispatchIntroSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  switchBackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#C8E6C9',
  },
  switchBackBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1B4D3E',
  },
  reportFilterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap',
  },
  reportSearchBox: {
    flex: 1,
    minWidth: 260,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  reportSearchInput: {
    flex: 1,
    fontSize: 13,
    color: '#0F172A',
  },
  filterPillsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  statusFilterPill: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  statusFilterPillActive: {
    backgroundColor: '#1B4D3E',
    borderColor: '#1B4D3E',
  },
  statusFilterPillText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#475569',
  },
  statusFilterPillTextActive: {
    color: '#FFFFFF',
  },

  noReportsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 36,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  noReportsTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  noReportsSubtitle: {
    fontSize: 12.5,
    color: '#64748B',
    textAlign: 'center',
  },

  reportsTableCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
  },
  reportsTableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  selectAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  selectAllText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#059669',
  },
  selectedCountBadge: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  reportItemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    padding: 10,
    gap: 12,
  },
  reportItemCardSelected: {
    backgroundColor: '#F0FDF4',
    borderColor: '#86EFAC',
  },
  reportItemCheckbox: {
    justifyContent: 'center',
  },
  reportThumb: {
    width: 48,
    height: 48,
    borderRadius: 8,
  },
  reportThumbPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reportItemTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  reportItemLocation: {
    fontSize: 11.5,
    color: '#64748B',
    marginTop: 2,
  },
  reportItemMetaRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 4,
    flexWrap: 'wrap',
  },
  metaPill: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  metaPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#475569',
  },
  statusBadgeSmall: {
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  statusBadgeSmallText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#0369A1',
  },
  viewDetailBtn: {
    padding: 6,
  },

  // Modals
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  confirmModalBox: {
    width: 480,
    maxWidth: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
  },
  confirmModalIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  confirmModalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
  },
  confirmModalSubtitle: {
    fontSize: 12.5,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 18,
  },
  confirmSummaryBox: {
    width: '100%',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    marginVertical: 16,
  },
  confirmRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  confirmLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
  },
  confirmVal: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  confirmActions: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  confirmCancelBtn: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  confirmCancelText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
  },
  confirmSubmitBtn: {
    flex: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#059669',
    paddingVertical: 12,
    borderRadius: 10,
    gap: 6,
  },
  confirmSubmitText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },

  reportModalBox: {
    width: 500,
    maxWidth: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
  },
  reportModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  reportModalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  reportModalSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  reportModalImg: {
    width: '100%',
    height: 180,
    borderRadius: 10,
    marginBottom: 12,
  },
  reportModalDesc: {
    fontSize: 13,
    color: '#334155',
    lineHeight: 18,
    marginBottom: 12,
  },
  aiBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    marginBottom: 16,
  },
  aiBoxTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#059669',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  aiBoxText: {
    fontSize: 12,
    color: '#475569',
  },
  modalCloseDoneBtn: {
    backgroundColor: '#1B4D3E',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  modalCloseDoneBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  autoDispatchHeaderBar: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  autoDispatchLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  autoDispatchIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  autoDispatchIconCircleActive: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  autoDispatchIconCirclePaused: {
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  autoDispatchTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  autoDispatchDesc: {
    fontSize: 11.5,
    color: '#64748B',
    marginTop: 3,
    lineHeight: 16,
  },
  autoDispatchStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  autoDispatchStatusBadgeActive: {
    backgroundColor: '#D1FAE5',
  },
  autoDispatchStatusBadgePaused: {
    backgroundColor: '#F1F5F9',
  },
  autoDispatchStatusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  autoDispatchStatusText: {
    fontSize: 10.5,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  autoDispatchRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  autoDispatchStatPill: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    alignItems: 'center',
    minWidth: 90,
  },
  autoDispatchStatNum: {
    fontSize: 14,
    fontWeight: '900',
    color: '#065F46',
  },
  autoDispatchStatLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#059669',
    marginTop: 1,
  },
  autoDispatchToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  autoDispatchToggleBtnActive: {
    backgroundColor: '#ECFDF5',
    borderColor: '#10B981',
  },
  autoDispatchToggleBtnPaused: {
    backgroundColor: '#F8FAFC',
    borderColor: '#CBD5E1',
  },
  autoDispatchToggleText: {
    fontSize: 12,
    fontWeight: '800',
  },
});
