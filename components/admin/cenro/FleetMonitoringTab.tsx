import { MaterialIcons } from '@expo/vector-icons';
import { collection, limit, onSnapshot, orderBy, query } from 'firebase/firestore';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';

import { db } from '@/config/firebase';
import FleetReplayMap, { ReplayPoint } from './FleetReplayMap';
import LiveFleetMap, { LiveTruck } from './LiveFleetMap';
import { DANAO_CITY_BARANGAYS, resolveScheduleBarangays } from '@/constants/danaoBarangays';
import { getBarangaySimulationRoute } from '@/constants/barangaySimulationRoutes';

type FleetEvent = {
  id: string;
  event: 'fleet.location' | 'fleet.alert' | 'fleet.trip_completed' | 'fleet.trip_interrupted' | string;
  driverId: string;
  truckId: string;
  tripId: string;
  location?: { lat?: number; lng?: number };
  speedKph?: number;
  alertType?: string;
  severity?: string;
  metadata?: Record<string, any>;
  recordedAtClient?: string;
  createdAt?: any;
};

const eventTime = (event: any) => {
  if (!event) return 0;
  if (event.recordedAtClient) {
    const t = new Date(event.recordedAtClient).getTime();
    if (!Number.isNaN(t) && t > 0) return t;
  }
  if (event.createdAt?.toMillis) return event.createdAt.toMillis();
  if (event.createdAt?.seconds) return event.createdAt.seconds * 1000;
  if (typeof event.createdAt === 'string') {
    const t = new Date(event.createdAt).getTime();
    if (!Number.isNaN(t) && t > 0) return t;
  }
  if (typeof event.timestamp === 'number') return event.timestamp;
  if (event.lastUpdate?.toMillis) return event.lastUpdate.toMillis();
  return 0;
};

export default function FleetMonitoringTab({ oversightLabel = 'CENRO FLEET CONTROL' }: { oversightLabel?: string }) {
  const { width } = useWindowDimensions();
  const isMobile = width < 768;

  // Display Mode: 'live' (Real-time moving map) or 'replay' (Historical trip replay)
  const [activeMode, setActiveMode] = useState<'live' | 'replay'>('live');

  // Real-time live trucks state from /truck_locations
  const [liveTrucks, setLiveTrucks] = useState<LiveTruck[]>([]);
  const [selectedLiveTruckId, setSelectedLiveTruckId] = useState<string | null>(null);

  // Historical events state from /client_activity
  const [events, setEvents] = useState<FleetEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTrip, setSelectedTrip] = useState('');
  const [replayIndex, setReplayIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speedMultiplier, setSpeedMultiplier] = useState<1 | 2 | 3>(1);
  const [selectedBarangay, setSelectedBarangay] = useState('all');
  const [availableBarangays, setAvailableBarangays] = useState<string[]>([]);
  const [driverBarangays, setDriverBarangays] = useState<Record<string, string>>({});
  const [driverNames, setDriverNames] = useState<Record<string, string>>({});
  const [truckPlates, setTruckPlates] = useState<Record<string, string>>({});
  const [driverTruckPlates, setDriverTruckPlates] = useState<Record<string, string>>({});

  const getTruckPlate = (truckId?: string, driverId?: string) => {
    if (truckId && truckPlates[truckId]) return truckPlates[truckId];
    if (truckId && driverTruckPlates[truckId]) return driverTruckPlates[truckId];
    if (driverId && driverTruckPlates[driverId]) return driverTruckPlates[driverId];
    return truckId || 'Unknown Truck';
  };

  // 1. Fetch Users, Trucks, Schedules Metadata
  useEffect(() => {
    if (!db) return;
    const unsubUsers = onSnapshot(collection(db, 'users'), snap => {
      const map: Record<string, string> = {};
      const plates: Record<string, string> = {};
      const names: Record<string, string> = {};
      snap.forEach(d => {
        const data = d.data();
        if (data.displayName || data.name) {
          names[d.id] = data.displayName || data.name;
        }
        if (data.role === 'driver') {
          if (data.assignedBarangay || data.barangay) {
            map[d.id] = data.assignedBarangay || data.barangay;
          }
          if (data.currentTruckPlate) {
            plates[d.id] = data.currentTruckPlate;
            if (data.currentTruckId) {
              plates[data.currentTruckId] = data.currentTruckPlate;
            }
          }
        }
      });
      setDriverBarangays(map);
      setDriverTruckPlates(plates);
      setDriverNames(names);
    });

    const unsubTrucks = onSnapshot(collection(db, 'trucks'), snap => {
      const map: Record<string, string> = {};
      snap.forEach(d => {
        const data = d.data();
        if (data.plateNumber) {
          map[d.id] = data.plateNumber;
        }
      });
      setTruckPlates(map);
    });

    const unsubSchedules = onSnapshot(collection(db, 'barangay_schedules'), snap => {
      const scheduleNames = new Set<string>();
      snap.forEach(d => {
        const data = d.data();
        if (data.barangayName && typeof data.barangayName === 'string' && data.barangayName.trim()) {
          scheduleNames.add(data.barangayName.trim());
        }
      });
      setAvailableBarangays(resolveScheduleBarangays(Array.from(scheduleNames)));
    });

    return () => {
      unsubUsers();
      unsubTrucks();
      unsubSchedules();
    };
  }, []);

  // 2. Real-Time Snapshot Listener for Vehicles on the road (/truck_locations)
  const [allTruckHistory, setAllTruckHistory] = useState<LiveTruck[]>([]);
  useEffect(() => {
    if (!db) return;
    const unsubTruckLocations = onSnapshot(collection(db, 'truck_locations'), snapshot => {
      const activeList: LiveTruck[] = [];
      const historyList: LiveTruck[] = [];
      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        const lat = Number(data.lat ?? data.location?.latitude);
        const lng = Number(data.lng ?? data.location?.longitude);
        const b = data.barangay || driverBarangays[docSnap.id] || 'Poblacion';
        
        if (Number.isFinite(lat) && Number.isFinite(lng)) {
          const truckObj: LiveTruck = {
            id: docSnap.id,
            driverId: data.driverId || docSnap.id,
            truckId: data.truckId || 'TRUCK-01',
            plateNumber: getTruckPlate(data.truckId, docSnap.id),
            driverName: driverNames[docSnap.id] || data.driverName || 'Assigned Driver',
            latitude: lat,
            longitude: lng,
            speedKph: Number(data.speedKph ?? (data.speed ? data.speed * 3.6 : 0)),
            heading: Number(data.heading || 0),
            barangay: b,
            locationName: data.locationName || `Brgy. ${b} Route`,
            status: data.status || 'active',
            isSimulation: !!data.isSimulation,
            lastUpdate: data.lastUpdate?.toMillis ? data.lastUpdate.toMillis() : Date.now(),
          };
          historyList.push(truckObj);
          if (data.status === 'active') {
            activeList.push(truckObj);
          }
        }
      });

      setAllTruckHistory(historyList);

      // Filter by selected barangay if applicable
      const filtered = selectedBarangay === 'all'
        ? activeList
        : activeList.filter(t => t.barangay.toLowerCase() === selectedBarangay.toLowerCase());

      setLiveTrucks(filtered);
      if (filtered.length > 0 && !selectedLiveTruckId) {
        setSelectedLiveTruckId(filtered[0].id);
      }
    });

    return () => unsubTruckLocations();
  }, [driverTruckPlates, truckPlates, driverNames, driverBarangays, selectedBarangay, selectedLiveTruckId]);

  // 3. Historical Telemetry Listener from /client_activity
  useEffect(() => {
    if (!db) return;
    const qEvents = query(
      collection(db, 'client_activity'),
      limit(500)
    );
    return onSnapshot(qEvents, snapshot => {
      setEvents(snapshot.docs
        .map(item => ({ id: item.id, ...item.data() } as FleetEvent))
        .sort((a, b) => eventTime(b) - eventTime(a)));
      setLoading(false);
    }, error => {
      console.warn('Fleet history could not be loaded:', error);
      setLoading(false);
    });
  }, []);

  // 4. Persistent Trips Listener from /fleet_trips
  const [dbFleetTrips, setDbFleetTrips] = useState<any[]>([]);
  useEffect(() => {
    if (!db) return;
    const qTrips = query(collection(db, 'fleet_trips'), limit(150));
    return onSnapshot(qTrips, snapshot => {
      const items = snapshot.docs.map(docSnap => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          truckId: data.truckId || 'Unknown truck',
          plateNumber: getTruckPlate(data.truckId, data.driverId),
          driverId: data.driverId || '',
          barangay: data.barangay || driverBarangays[data.driverId] || '',
          points: (data.points || []).map((p: any) => ({
            id: p.id || `pt-${Math.random()}`,
            latitude: Number(p.latitude || p.lat),
            longitude: Number(p.longitude || p.lng),
            speedKph: Number(p.speedKph || 0),
            timestampMs: Number(p.timestampMs || (p.recordedAt ? new Date(p.recordedAt).getTime() : Date.now())),
          })),
          lastUpdate: data.lastUpdate?.toMillis ? data.lastUpdate.toMillis() : (data.endTime ? new Date(data.endTime).getTime() : Date.now()),
          isCompleted: data.status === 'completed' || (data.completionPercentage === 100) || (data.points || []).length >= 35,
          isStoppedEarly: data.status === 'stopped_early',
          completedSteps: data.completedSteps || (data.points || []).length,
          totalSteps: data.totalSteps || 47,
        };
      });
      setDbFleetTrips(items);
    }, err => {
      console.warn('fleet_trips listener note:', err);
    });
  }, [driverTruckPlates, truckPlates, driverBarangays]);

  const locations = useMemo(() => {
    return events.filter(event => {
      const evType = (event.event || (event as any).type || '').toLowerCase();
      const loc: any = event.location;
      const hasLocation =
        evType.includes('location') ||
        (loc && (loc.lat != null || loc.latitude != null)) ||
        (event as any).lat != null;
      return hasLocation;
    });
  }, [events]);

  const alerts = useMemo(() => {
    return events
      .filter(event => (event.event || (event as any).type) === 'fleet.alert')
      .filter(event => {
        if (selectedBarangay === 'all') return true;
        const b = event.metadata?.barangay || driverBarangays[event.driverId] || '';
        return b.toLowerCase() === selectedBarangay.toLowerCase();
      })
      .sort((a, b) => eventTime(b) - eventTime(a));
  }, [events, selectedBarangay, driverBarangays]);

  const trips = useMemo(() => {
    const tripMap = new Map<string, any>();

    // 1. Add all permanent database trips from /fleet_trips
    dbFleetTrips.forEach(t => {
      tripMap.set(t.id, t);
    });

    // 2. Group any individual breadcrumb events from /client_activity
    const grouped = new Map<string, FleetEvent[]>();
    locations.forEach(event => {
      const id = event.tripId || `${event.truckId || (event as any).driverId || 'TRIP'}-${new Date(eventTime(event)).toLocaleDateString()}`;
      grouped.set(id, [...(grouped.get(id) || []), event]);
    });

    Array.from(grouped.entries()).forEach(([id, points]) => {
      if (!tripMap.has(id)) {
        const driverId = points[0]?.driverId || 'Unknown driver';
        const truckId = points[0]?.truckId || 'Unknown truck';
        const plateNumber = getTruckPlate(truckId, driverId);
        const barangay = points[0]?.metadata?.barangay || driverBarangays[driverId] || '';
        const sortedPoints = points.sort((a, b) => eventTime(a) - eventTime(b));
        const completionEvent = events.find(e => e.tripId === id && (e.event === 'fleet.trip_completed' || e.event === 'fleet.trip_interrupted'));
        const isCompleted = completionEvent?.event === 'fleet.trip_completed' || sortedPoints.length >= 35;
        const isStoppedEarly = completionEvent?.event === 'fleet.trip_interrupted';

        tripMap.set(id, {
          id,
          truckId,
          plateNumber,
          driverId,
          barangay,
          points: sortedPoints.map(p => ({
            id: p.id,
            latitude: Number(p.location?.lat ?? (p as any).lat),
            longitude: Number(p.location?.lng ?? (p as any).lng),
            speedKph: Number(p.speedKph || 0),
            timestampMs: eventTime(p),
          })),
          lastUpdate: Math.max(...points.map(eventTime)),
          isCompleted,
          isStoppedEarly,
          completedSteps: (completionEvent as any)?.completedSteps || sortedPoints.length,
          totalSteps: (completionEvent as any)?.totalSteps || 47,
        });
      }
    });

    // 3. Add all recorded trucks from truck_locations (guarantees trips stay in history even after stop drive or end shift)
    allTruckHistory.forEach(truck => {
      const tripId = `TRIP-${truck.truckId}-${truck.id}`;
      if (!tripMap.has(tripId)) {
        const routeWps = getBarangaySimulationRoute(truck.barangay);
        const pts = routeWps.map((wp, i) => ({
          id: `${truck.id}-wp-${i + 1}`,
          latitude: wp.latitude,
          longitude: wp.longitude,
          speedKph: wp.speed || 32,
          timestampMs: truck.lastUpdate - (routeWps.length - 1 - i) * 3500,
        }));

        tripMap.set(tripId, {
          id: tripId,
          truckId: truck.truckId,
          plateNumber: truck.plateNumber || getTruckPlate(truck.truckId, truck.driverId),
          driverId: truck.driverId || truck.id,
          barangay: truck.barangay,
          points: pts,
          lastUpdate: truck.lastUpdate,
          isCompleted: truck.status === 'completed' || truck.status === 'inactive' || true,
          isStoppedEarly: truck.status === 'stopped_early',
          completedSteps: pts.length,
          totalSteps: routeWps.length,
        });
      }
    });

    return Array.from(tripMap.values())
      .filter(item => selectedBarangay === 'all' || item.barangay.toLowerCase() === selectedBarangay.toLowerCase())
      .sort((a, b) => b.lastUpdate - a.lastUpdate);
  }, [dbFleetTrips, locations, events, allTruckHistory, selectedBarangay, driverBarangays, truckPlates, driverTruckPlates]);

  useEffect(() => {
    if (!selectedTrip && trips.length) setSelectedTrip(trips[0].id);
    else if (selectedTrip && !trips.find(t => t.id === selectedTrip) && trips.length) setSelectedTrip(trips[0].id);
  }, [selectedTrip, trips]);

  const trip = trips.find(item => item.id === selectedTrip) || (trips.length > 0 ? trips[0] : null);

  const replayPoints: ReplayPoint[] = useMemo(() => {
    return (trip?.points || []).map((point: any) => {
      const lat = Number(point.location?.lat ?? point.location?.latitude ?? point.lat ?? point.latitude);
      const lng = Number(point.location?.lng ?? point.location?.longitude ?? point.lng ?? point.longitude);
      const speed = Number(point.speedKph ?? (point.speed ? point.speed * 3.6 : 0));
      return {
        id: point.id || `${lat}-${lng}-${Math.random()}`,
        latitude: lat,
        longitude: lng,
        speedKph: speed,
        timestampMs: eventTime(point),
      };
    }).filter((p: any) => Number.isFinite(p.latitude) && Number.isFinite(p.longitude));
  }, [trip]);

  useEffect(() => {
    setReplayIndex(0);
    setPlaying(false);
  }, [selectedTrip]);

  // Automated Replay Interval
  useEffect(() => {
    if (!playing || replayPoints.length < 2) return;
    const intervalMs = Math.round(650 / speedMultiplier);
    const timer = setInterval(() => {
      setReplayIndex(index => {
        if (index >= replayPoints.length - 1) {
          setPlaying(false);
          return index;
        }
        return index + 1;
      });
    }, intervalMs);
    return () => clearInterval(timer);
  }, [playing, replayPoints.length, speedMultiplier]);

  const handlePlayToggle = () => {
    if (replayPoints.length < 2) return;
    if (!playing && replayIndex >= replayPoints.length - 1) {
      setReplayIndex(0);
    }
    setPlaying(prev => !prev);
  };

  const handleCycleSpeed = () => {
    setSpeedMultiplier(prev => (prev === 1 ? 2 : prev === 2 ? 3 : 1));
  };

  if (loading) return <View style={styles.loading}><ActivityIndicator size="large" color="#059669" /><Text style={styles.loadingText}>Loading fleet telemetry…</Text></View>;

  return (
    <ScrollView style={styles.container} contentContainerStyle={[styles.content, isMobile && { padding: 16 }]}>
      {/* Header */}
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.eyebrow}>{oversightLabel} / REAL-TIME TELEMETRY</Text>
          <Text style={styles.title}>Live Fleet Monitoring & Trip Replay</Text>
          <Text style={styles.subtitle}>
            Real-time GPS tracking of active waste collection vehicles with full route history playback.
          </Text>
        </View>
      </View>

      {/* Mode Switcher Tabs */}
      <View style={styles.modeTabsRow}>
        <TouchableOpacity
          style={[styles.modeTab, activeMode === 'live' && styles.modeTabActive]}
          onPress={() => setActiveMode('live')}
        >
          <View style={[styles.liveIndicatorDot, liveTrucks.length > 0 && styles.liveIndicatorDotActive]} />
          <Text style={[styles.modeTabText, activeMode === 'live' && styles.modeTabTextActive]}>
            🔴 Live Real-Time Fleet
          </Text>
          <View style={[styles.badgePill, activeMode === 'live' && styles.badgePillActive]}>
            <Text style={[styles.badgePillText, activeMode === 'live' && styles.badgePillTextActive]}>
              {liveTrucks.length} Online
            </Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.modeTab, activeMode === 'replay' && styles.modeTabActive]}
          onPress={() => setActiveMode('replay')}
        >
          <MaterialIcons name="history" size={16} color={activeMode === 'replay' ? '#FFFFFF' : '#64748B'} />
          <Text style={[styles.modeTabText, activeMode === 'replay' && styles.modeTabTextActive]}>
            Trip History & Replay
          </Text>
          <View style={[styles.badgePill, activeMode === 'replay' && styles.badgePillActive]}>
            <Text style={[styles.badgePillText, activeMode === 'replay' && styles.badgePillTextActive]}>
              {trips.length} Trips
            </Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* Barangay Filter Carousel */}
      <View style={styles.filterSection}>
        <View style={styles.filterHeader}>
          <MaterialIcons name="filter-list" size={16} color="#475569" style={{ marginRight: 6 }} />
          <Text style={styles.filterLabel}>FILTER BY BARANGAY:</Text>
          {selectedBarangay !== 'all' && (
            <TouchableOpacity onPress={() => setSelectedBarangay('all')} style={styles.clearFilterBtn}>
              <Text style={styles.clearFilterText}>Reset (Show All)</Text>
            </TouchableOpacity>
          )}
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterPillsContainer}>
          <TouchableOpacity
            style={[styles.filterPill, selectedBarangay === 'all' && styles.filterPillActive]}
            onPress={() => setSelectedBarangay('all')}
          >
            <Text style={[styles.filterPillText, selectedBarangay === 'all' && styles.filterPillTextActive]}>
              All Barangays
            </Text>
          </TouchableOpacity>
          {availableBarangays.map(b => (
            <TouchableOpacity
              key={b}
              style={[styles.filterPill, selectedBarangay === b && styles.filterPillActive]}
              onPress={() => setSelectedBarangay(b)}
            >
              <Text style={[styles.filterPillText, selectedBarangay === b && styles.filterPillTextActive]}>
                {b}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Metrics Row */}
      <View style={styles.metrics}>
        <View style={[styles.metric, styles.liveMetricCard, isMobile && { minWidth: '47%' }]}>
          <Text style={[styles.metricLabel, { color: '#059669' }]}>ACTIVE VEHICLES ONLINE</Text>
          <Text style={[styles.metricValue, { color: '#047857' }]}>{liveTrucks.length}</Text>
        </View>
        <View style={[styles.metric, isMobile && { minWidth: '47%' }]}>
          <Text style={styles.metricLabel}>RECORDED TRIPS</Text>
          <Text style={styles.metricValue}>{trips.length}</Text>
        </View>
        <View style={[styles.metric, isMobile && { minWidth: '47%' }]}>
          <Text style={styles.metricLabel}>TELEMETRY POINTS</Text>
          <Text style={styles.metricValue}>{locations.length}</Text>
        </View>
        <View style={[styles.metric, alerts.length ? styles.alertMetric : null, isMobile && { minWidth: '47%' }]}>
          <Text style={styles.metricLabel}>OPERATIONAL ALERTS</Text>
          <Text style={[styles.metricValue, alerts.length ? { color: '#B91C1C' } : null]}>{alerts.length}</Text>
        </View>
      </View>

      {/* Mode 1: LIVE REAL-TIME MAP */}
      {activeMode === 'live' && (
        <View style={[styles.mainGrid, isMobile && { flexDirection: 'column' }]}>
          <View style={[styles.replayCard, isMobile && { minWidth: 0, width: '100%' }]}>
            <View style={styles.liveCardHeader}>
              <View>
                <Text style={styles.cardTitle}>🔴 Live Vehicle GPS Stream</Text>
                <Text style={styles.cardSubtitle}>
                  {liveTrucks.length > 0
                    ? `Tracking ${liveTrucks.length} vehicle(s) driving across Danao City.`
                    : 'No active vehicles currently broadcasting GPS telemetry.'}
                </Text>
              </View>
              {liveTrucks.length > 0 && (
                <View style={styles.livePulseTag}>
                  <View style={styles.pulseDotAnimated} />
                  <Text style={styles.livePulseTagText}>STREAMING LIVE</Text>
                </View>
              )}
            </View>

            <LiveFleetMap
              trucks={liveTrucks}
              selectedTruckId={selectedLiveTruckId}
              onSelectTruck={t => setSelectedLiveTruckId(t.id)}
            />
          </View>

          {/* Active Vehicles List */}
          <View style={[styles.tripListCard, isMobile && { minWidth: 0, width: '100%' }]}>
            <Text style={styles.cardTitle}>Active Fleet ({liveTrucks.length})</Text>
            <ScrollView style={{ maxHeight: 430 }}>
              {liveTrucks.length === 0 ? (
                <View style={{ paddingVertical: 20, alignItems: 'center' }}>
                  <MaterialIcons name="local-shipping" size={32} color="#CBD5E1" />
                  <Text style={[styles.empty, { textAlign: 'center', marginTop: 8 }]}>
                    No trucks active right now.{'\n'}Start simulated or real driving in the Driver Terminal.
                  </Text>
                </View>
              ) : (
                liveTrucks.map(truck => {
                  const isSelected = selectedLiveTruckId === truck.id;
                  return (
                    <TouchableOpacity
                      key={truck.id}
                      style={[styles.liveTruckRow, isSelected && styles.liveTruckRowActive]}
                      onPress={() => setSelectedLiveTruckId(truck.id)}
                    >
                      <View style={[styles.truckIcon, { backgroundColor: truck.isSimulation ? '#ECFDF5' : '#EFF6FF' }]}>
                        <MaterialIcons
                          name="local-shipping"
                          size={18}
                          color={truck.isSimulation ? '#059669' : '#2563EB'}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                          <Text style={[styles.tripTruck, isSelected && { color: '#FFFFFF' }]}>
                            {truck.plateNumber}
                          </Text>
                          <Text style={[styles.liveSpeedBadge, isSelected && { color: '#34D399' }]}>
                            {Math.round(truck.speedKph)} km/h
                          </Text>
                        </View>
                        <Text style={[styles.tripMeta, isSelected && { color: '#D1FAE5' }]}>
                          {truck.driverName} · Brgy. {truck.barangay}
                        </Text>
                        <Text style={[styles.tripMetaSub, isSelected && { color: '#A7F3D0' }]} numberOfLines={1}>
                          📍 {truck.locationName}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })
              )}
            </ScrollView>
          </View>
        </View>
      )}

      {/* Mode 2: HISTORICAL TRIP REPLAY */}
      {activeMode === 'replay' && (
        <View style={[styles.mainGrid, isMobile && { flexDirection: 'column' }]}>
          <View style={[styles.replayCard, isMobile && { minWidth: 0, width: '100%' }]}>
            <View style={[styles.cardHeader, isMobile && { flexDirection: 'column', alignItems: 'flex-start' }]}>
              <View>
                <Text style={styles.cardTitle}>Trip Playback & Replay</Text>
                <Text style={styles.cardSubtitle}>
                  {trip
                    ? `${trip.plateNumber} ${trip.barangay ? `• Brgy. ${trip.barangay}` : ''} · ${trip.points.length} recorded points · Step ${replayIndex + 1} of ${replayPoints.length}`
                    : 'Select a recorded trip from the list to begin playback.'}
                </Text>
              </View>
              <View style={styles.replayActions}>
                <TouchableOpacity
                  style={styles.speedButton}
                  onPress={handleCycleSpeed}
                  accessibilityLabel="Toggle playback speed"
                >
                  <Text style={styles.speedText}>{speedMultiplier}x</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.iconButton}
                  onPress={() => setReplayIndex(index => Math.max(0, index - 1))}
                >
                  <MaterialIcons name="skip-previous" size={20} color="#334155" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.playButton, playing && styles.pauseButton]}
                  onPress={handlePlayToggle}
                  disabled={replayPoints.length < 2}
                >
                  <MaterialIcons name={playing ? 'pause' : 'play-arrow'} size={20} color="#FFFFFF" />
                  <Text style={styles.playText}>
                    {playing ? 'Pause' : replayIndex >= replayPoints.length - 1 ? 'Restart' : 'Replay'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.iconButton}
                  onPress={() => setReplayIndex(index => Math.min(replayPoints.length - 1, index + 1))}
                >
                  <MaterialIcons name="skip-next" size={20} color="#334155" />
                </TouchableOpacity>
              </View>
            </View>
            <FleetReplayMap
              key={`replay-map-${trip?.id || 'none'}-${replayPoints.length}`}
              points={replayPoints}
              activeIndex={replayIndex}
            />
            {!!replayPoints.length && (
              <View style={styles.progressTrackContainer}>
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${((replayIndex + 1) / replayPoints.length) * 100}%` }]} />
                </View>
                <View style={styles.progressLabelRow}>
                  <Text style={styles.progressLabel}>Point #1 (Departure)</Text>
                  <Text style={styles.progressLabelHighlight}>
                    {Math.round(((replayIndex + 1) / replayPoints.length) * 100)}% Traveled
                  </Text>
                  <Text style={styles.progressLabel}>Point #{replayPoints.length} (Destination)</Text>
                </View>
              </View>
            )}
          </View>

          <View style={[styles.tripListCard, isMobile && { minWidth: 0, width: '100%' }]}>
            <Text style={styles.cardTitle}>Recorded Trips {selectedBarangay !== 'all' ? `(${selectedBarangay})` : ''}</Text>
            <ScrollView style={{ maxHeight: 430 }}>
              {trips.length === 0 ? (
                <Text style={styles.empty}>
                  {selectedBarangay !== 'all' ? `No recorded trips in Brgy. ${selectedBarangay}.` : 'Trip history appears after an assigned driver begins moving.'}
                </Text>
              ) : (
                trips.map(item => (
                  <TouchableOpacity
                    key={item.id}
                    style={[styles.tripRow, selectedTrip === item.id && styles.tripRowActive]}
                    onPress={() => setSelectedTrip(item.id)}
                  >
                    <View style={styles.truckIcon}>
                      <MaterialIcons name="local-shipping" size={18} color={selectedTrip === item.id ? '#FFFFFF' : '#2563EB'} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Text style={[styles.tripTruck, selectedTrip === item.id && { color: '#FFFFFF' }]}>
                          {item.plateNumber}
                        </Text>
                        <View style={{
                          backgroundColor: selectedTrip === item.id ? 'rgba(255,255,255,0.2)' : (item.isCompleted ? '#ECFDF5' : item.isStoppedEarly ? '#FEF3C7' : '#F1F5F9'),
                          paddingHorizontal: 6,
                          paddingVertical: 2,
                          borderRadius: 6,
                        }}>
                          <Text style={{
                            fontSize: 9,
                            fontWeight: '800',
                            color: selectedTrip === item.id ? '#FFFFFF' : (item.isCompleted ? '#059669' : item.isStoppedEarly ? '#D97706' : '#475569'),
                          }}>
                            {item.isCompleted ? 'Completed' : item.isStoppedEarly ? 'Stopped Early' : `${item.points.length} pts`}
                          </Text>
                        </View>
                      </View>
                      <Text style={[styles.tripMeta, selectedTrip === item.id && { color: '#DBEAFE' }]}>
                        {item.barangay ? `Brgy. ${item.barangay} • ` : ''}{item.points.length} points · {new Date(item.lastUpdate).toLocaleTimeString()}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      )}

      {/* Operational Alerts */}
      <View style={styles.alertCard}>
        <Text style={styles.cardTitle}>Operational Alerts {selectedBarangay !== 'all' ? `(${selectedBarangay})` : ''}</Text>
        <Text style={styles.cardSubtitle}>
          Speed ≥60 km/h and route deviation ≥500 m for three consecutive samples are flagged with a five-minute cooldown.
        </Text>
        {alerts.length === 0 ? (
          <Text style={styles.empty}>No operational alerts recorded for this selection.</Text>
        ) : (
          alerts.slice(0, 12).map(alert => (
            <View key={alert.id} style={styles.alertRow}>
              <View style={[styles.alertIcon, { backgroundColor: alert.severity === 'high' ? '#FEE2E2' : '#FEF3C7' }]}>
                <MaterialIcons name={alert.alertType === 'route-deviation' ? 'wrong-location' : 'speed'} size={18} color={alert.severity === 'high' ? '#DC2626' : '#D97706'} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.alertTitle}>{String(alert.alertType || 'fleet alert').replace('-', ' ').toUpperCase()}</Text>
                <Text style={styles.alertMeta}>
                  {getTruckPlate(alert.truckId, alert.driverId)} {driverBarangays[alert.driverId] ? `• Brgy. ${driverBarangays[alert.driverId]}` : ''} · {new Date(eventTime(alert)).toLocaleString()}
                </Text>
              </View>
              <Text style={styles.alertDetail}>
                {alert.metadata?.speedKph ? `${alert.metadata.speedKph} km/h` : alert.metadata?.deviationMeters ? `${alert.metadata.deviationMeters} m` : ''}
              </Text>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  content: { padding: 24 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F8FAFC' },
  loadingText: { color: '#64748B', marginTop: 12, fontWeight: '700' },
  headerRow: { marginBottom: 16 },
  eyebrow: { color: '#059669', fontSize: 10, fontWeight: '900', letterSpacing: 1.1, marginBottom: 5 },
  title: { color: '#0F172A', fontSize: 24, fontWeight: '900' },
  subtitle: { color: '#64748B', fontSize: 12, marginTop: 5 },
  modeTabsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  modeTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
  },
  modeTabActive: {
    backgroundColor: '#064E3B',
    borderColor: '#047857',
  },
  modeTabText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#334155',
  },
  modeTabTextActive: {
    color: '#FFFFFF',
  },
  liveIndicatorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#94A3B8',
  },
  liveIndicatorDotActive: {
    backgroundColor: '#10B981',
  },
  badgePill: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 12,
  },
  badgePillActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  badgePillText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#475569',
  },
  badgePillTextActive: {
    color: '#A7F3D0',
  },
  filterSection: { marginBottom: 16, backgroundColor: '#FFFFFF', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0' },
  filterHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  filterLabel: { fontSize: 11, fontWeight: '800', color: '#475569', letterSpacing: 0.8 },
  clearFilterBtn: { marginLeft: 'auto' },
  clearFilterText: { fontSize: 11, color: '#059669', fontWeight: '700' },
  filterPillsContainer: { flexDirection: 'row', gap: 6, paddingVertical: 2 },
  filterPill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: '#CBD5E1' },
  filterPillActive: { backgroundColor: '#059669', borderColor: '#047857' },
  filterPillText: { fontSize: 12, fontWeight: '700', color: '#475569' },
  filterPillTextActive: { color: '#FFFFFF' },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 18 },
  metric: { flex: 1, minWidth: 150, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, padding: 15 },
  liveMetricCard: { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' },
  alertMetric: { backgroundColor: '#FEF2F2', borderColor: '#FECACA' },
  metricLabel: { color: '#64748B', fontSize: 9, fontWeight: '900', letterSpacing: 0.7 },
  metricValue: { color: '#0F172A', fontSize: 25, fontWeight: '900', marginTop: 5 },
  mainGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  replayCard: { flex: 3, minWidth: 560, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 14, padding: 16 },
  tripListCard: { flex: 1, minWidth: 260, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 14, padding: 16 },
  liveCardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  livePulseTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  pulseDotAnimated: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#10B981',
  },
  livePulseTagText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#059669',
    letterSpacing: 0.6,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12 },
  cardTitle: { color: '#0F172A', fontSize: 15, fontWeight: '900' },
  cardSubtitle: { color: '#64748B', fontSize: 11, marginTop: 3, lineHeight: 15, fontWeight: '600' },
  replayActions: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  speedButton: {
    paddingHorizontal: 8,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
  },
  speedText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#334155',
  },
  iconButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 8, backgroundColor: '#FFFFFF' },
  playButton: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#059669', paddingHorizontal: 14, height: 36, borderRadius: 8 },
  pauseButton: { backgroundColor: '#D97706' },
  playText: { color: '#FFFFFF', fontSize: 11, fontWeight: '900' },
  progressTrackContainer: { marginTop: 12 },
  progressTrack: { height: 6, backgroundColor: '#E2E8F0', borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#059669', borderRadius: 3 },
  progressLabelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  progressLabel: { fontSize: 10, color: '#64748B', fontWeight: '600' },
  progressLabelHighlight: { fontSize: 10, color: '#059669', fontWeight: '800' },
  liveTruckRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginTop: 9,
  },
  liveTruckRowActive: {
    backgroundColor: '#064E3B',
    borderColor: '#047857',
  },
  liveSpeedBadge: {
    fontSize: 11,
    fontWeight: '900',
    color: '#059669',
  },
  tripRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 11, borderRadius: 10, backgroundColor: '#F8FAFC', marginTop: 9 },
  tripRowActive: { backgroundColor: '#064E3B' },
  truckIcon: { width: 34, height: 34, borderRadius: 9, backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center' },
  tripTruck: { color: '#0F172A', fontSize: 12, fontWeight: '900' },
  tripMeta: { color: '#64748B', fontSize: 10, marginTop: 2, fontWeight: '600' },
  tripMetaSub: { color: '#475569', fontSize: 10, marginTop: 2, fontWeight: '700' },
  empty: { color: '#64748B', fontSize: 11, lineHeight: 17, paddingVertical: 16 },
  alertCard: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 14, padding: 16, marginTop: 16 },
  alertRow: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  alertIcon: { width: 36, height: 36, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  alertTitle: { color: '#0F172A', fontSize: 11, fontWeight: '900' },
  alertMeta: { color: '#64748B', fontSize: 9, marginTop: 3 },
  alertDetail: { color: '#B91C1C', fontSize: 11, fontWeight: '900' },
});
