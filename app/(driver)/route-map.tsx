import { useAuthContext } from '@/components/AuthContext';
import MapView, { Marker, Polyline } from '@/components/MapView';
import CompletePickupModal from '@/components/driver/CompletePickupModal';
import { db } from '@/config/firebase';
import { useTheme } from '@/hooks/useTheme';
import { locationService, SimulationState, DANAO_SIMULATION_ROUTE } from '@/services/locationService';
import { MaterialIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { collection, doc, onSnapshot, query, where } from 'firebase/firestore';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Coordinate = { latitude: number; longitude: number };

type RouteStop = {
  id: string;
  street: string;
  barangay: string;
  wasteCategory: string;
  status: string;
  routeOrder: number;
  isLiveDispatch: boolean;
  location?: { lat?: number; lng?: number; latitude?: number; longitude?: number } | null;
  routeOptimization?: {
    estimatedDistanceKm?: number;
    estimatedDurationMinutes?: number;
    method?: string;
    provider?: string;
    roadPolyline?: Coordinate[];
  } | null;
};

const DANAO_CENTER: Coordinate = { latitude: 10.5200, longitude: 124.0270 };

function coordinateOf(stop: RouteStop): Coordinate | null {
  const latitude = stop.location?.lat ?? stop.location?.latitude;
  const longitude = stop.location?.lng ?? stop.location?.longitude;
  return Number.isFinite(latitude) && Number.isFinite(longitude)
    ? { latitude: Number(latitude), longitude: Number(longitude) }
    : null;
}

export default function DriverRouteMap() {
  const router = useRouter();
  const params = useLocalSearchParams<{ scheduleId?: string | string[] }>();
  const requestedScheduleId = Array.isArray(params.scheduleId) ? params.scheduleId[0] : params.scheduleId;
  const { user } = useAuthContext();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const insets = useSafeAreaInsets();
  const mapRef = useRef<any>(null);

  const [stops, setStops] = useState<RouteStop[]>([]);
  const [selectedId, setSelectedId] = useState(requestedScheduleId || '');
  const [truckCoordinate, setTruckCoordinate] = useState<Coordinate | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState('');
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [simulationState, setSimulationState] = useState<SimulationState>(locationService.getSimulationState());

  useEffect(() => {
    return locationService.onSimulationChange((state) => {
      setSimulationState({ ...state });
      if (state.currentCoordinate) {
        setTruckCoordinate(state.currentCoordinate);
      }
    });
  }, []);

  const handleToggleSimulation = async () => {
    if (!user?.uid) {
      Alert.alert('Authentication Required', 'Please sign in as a driver.');
      return;
    }

    if (simulationState.isActive) {
      await locationService.stopSimulation(user.uid);
    } else {
      // Build custom route from stops if available, or use Danao simulation route
      const customRoute = locatedStops.length >= 2
        ? locatedStops.map(s => ({ latitude: s.coordinate.latitude, longitude: s.coordinate.longitude, name: s.stop.street, speed: 35 }))
        : DANAO_SIMULATION_ROUTE;

      await locationService.startSimulation(user.uid, 'TRUCK-DANAO-01', customRoute);
    }
  };

  useEffect(() => {
    if (requestedScheduleId) setSelectedId(requestedScheduleId);
  }, [requestedScheduleId]);

  useEffect(() => {
    if (!user?.uid || !db) {
      setLoading(false);
      return;
    }

    const assignedQuery = query(collection(db, 'schedules'), where('assignedDriverId', '==', user.uid));
    return onSnapshot(assignedQuery, snapshot => {
      const nextStops = snapshot.docs
        .map(scheduleDoc => {
          const data = scheduleDoc.data();
          return {
            id: scheduleDoc.id,
            street: data.street || 'Unknown street',
            barangay: data.barangay || 'Danao City',
            wasteCategory: data.wasteCategory || 'General waste',
            status: data.status || 'pending',
            routeOrder: Number(data.routeOrder) || 0,
            isLiveDispatch: data.isLiveDispatch === true,
            location: data.location || null,
            routeOptimization: data.routeOptimization || null,
          } satisfies RouteStop;
        })
        .filter(stop => ['pending', 'in-progress'].includes(stop.status) && (stop.isLiveDispatch || stop.id === requestedScheduleId))
        .sort((a, b) => (a.routeOrder || Number.MAX_SAFE_INTEGER) - (b.routeOrder || Number.MAX_SAFE_INTEGER));

      setStops(nextStops);
      setSelectedId(current => nextStops.some(stop => stop.id === current) ? current : (nextStops[0]?.id || ''));
      setLoading(false);
      setErrorText('');
    }, error => {
      console.error('Live route map listener failed:', error);
      setErrorText('The live route could not be loaded. Check your connection and try again.');
      setLoading(false);
    });
  }, [requestedScheduleId, user?.uid]);

  useEffect(() => {
    if (!user?.uid || !db) return;
    return onSnapshot(doc(db, 'truck_locations', user.uid), snapshot => {
      const data = snapshot.data();
      const latitude = data?.lat ?? data?.location?.latitude;
      const longitude = data?.lng ?? data?.location?.longitude;
      setTruckCoordinate(Number.isFinite(latitude) && Number.isFinite(longitude)
        ? { latitude: Number(latitude), longitude: Number(longitude) }
        : null);
    });
  }, [user?.uid]);

  const selectedStop = stops.find(stop => stop.id === selectedId) || stops[0] || null;
  const locatedStops = useMemo(() => stops
    .map(stop => ({ stop, coordinate: coordinateOf(stop) }))
    .filter((item): item is { stop: RouteStop; coordinate: Coordinate } => item.coordinate !== null), [stops]);
  const routeCoordinates = useMemo(() => [
    ...(truckCoordinate ? [truckCoordinate] : []),
    ...locatedStops.map(item => item.coordinate),
  ], [locatedStops, truckCoordinate]);
  const routeMetadata = stops.find(stop => stop.routeOptimization)?.routeOptimization;
  const roadPolyline = useMemo(() => (routeMetadata?.roadPolyline || []).filter(point =>
    Number.isFinite(point?.latitude) && Number.isFinite(point?.longitude)), [routeMetadata?.roadPolyline]);
  const displayedPolyline = roadPolyline.length > 1 ? roadPolyline : routeCoordinates;
  const mapFitCoordinates = useMemo(() => [
    ...displayedPolyline,
    ...routeCoordinates,
  ], [displayedPolyline, routeCoordinates]);

  useEffect(() => {
    if (!mapRef.current || mapFitCoordinates.length === 0) return;
    const timer = setTimeout(() => {
      if (mapFitCoordinates.length > 1) {
        mapRef.current?.fitToCoordinates?.(mapFitCoordinates, {
          edgePadding: { top: 120, right: 60, bottom: 330, left: 60 },
          animated: true,
        });
      } else {
        mapRef.current?.animateToRegion?.({
          ...mapFitCoordinates[0], latitudeDelta: 0.018, longitudeDelta: 0.018,
        }, 450);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [mapFitCoordinates]);

  const focusStop = (stop: RouteStop) => {
    setSelectedId(stop.id);
    const coordinate = coordinateOf(stop);
    if (coordinate) {
      mapRef.current?.animateToRegion?.({ ...coordinate, latitudeDelta: 0.012, longitudeDelta: 0.012 }, 400);
    }
  };

  const routeDistance = stops.find(stop => Number.isFinite(stop.routeOptimization?.estimatedDistanceKm))
    ?.routeOptimization?.estimatedDistanceKm;
  const routeDuration = routeMetadata?.estimatedDurationMinutes;
  const hasRoadRoute = roadPolyline.length > 1 && routeMetadata?.provider === 'Google Routes API';

  return (
    <View style={[styles.container, isDark && styles.containerDark]}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        initialRegion={{ ...DANAO_CENTER, latitudeDelta: 0.08, longitudeDelta: 0.08 }}
        showsCompass
        showsMyLocationButton
      >
        {displayedPolyline.length > 1 && (
          <Polyline coordinates={displayedPolyline} strokeColor="#7C3AED" strokeWidth={5} />
        )}

        {truckCoordinate && (
          <Marker coordinate={truckCoordinate} title="Your live truck location" anchor={{ x: 0.5, y: 0.5 }}>
            <View style={styles.truckMarker}>
              <MaterialIcons name="local-shipping" size={19} color="#FFFFFF" />
            </View>
          </Marker>
        )}

        {locatedStops.map(({ stop, coordinate }) => {
          const selected = stop.id === selectedStop?.id;
          const routeNumber = stops.indexOf(stop) + 1;
          return (
            <Marker
              key={stop.id}
              coordinate={coordinate}
              title={`${routeNumber}. ${stop.street}`}
              description={stop.barangay}
              onPress={() => focusStop(stop)}
            >
              <View style={[styles.stopMarker, selected && styles.stopMarkerSelected]}>
                <Text style={styles.stopMarkerText}>{routeNumber}</Text>
              </View>
            </Marker>
          );
        })}
      </MapView>

      <View style={[styles.header, { top: insets.top + 10 }, isDark && styles.panelDark]}>
        <TouchableOpacity style={styles.iconButton} onPress={() => router.back()} accessibilityLabel="Back to driver home">
          <MaterialIcons name="arrow-back" size={23} color={isDark ? '#F9FAFB' : '#1F2937'} />
        </TouchableOpacity>
        <View style={styles.headerCopy}>
          <Text style={[styles.headerTitle, isDark && styles.textLight]}>Live Route Dispatch</Text>
          <Text style={[styles.headerSubtitle, isDark && styles.textMuted]}>
            {stops.length} stop{stops.length === 1 ? '' : 's'}{routeDistance ? ` · ${routeDistance} km${routeDuration ? ` · ${routeDuration} min` : ''}` : ' · in-app map'}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <TouchableOpacity
            style={[styles.simMapBtn, simulationState.isActive && styles.simMapBtnActive]}
            onPress={handleToggleSimulation}
            accessibilityLabel="Toggle GPS simulation"
          >
            <MaterialIcons
              name={simulationState.isActive ? 'stop' : 'play-arrow'}
              size={17}
              color="#FFFFFF"
            />
            <Text style={styles.simMapBtnText}>
              {simulationState.isActive ? `${simulationState.currentSpeedKph}kph` : 'Simulate'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.iconButton} onPress={() => {
            if (mapFitCoordinates.length > 1) {
              mapRef.current?.fitToCoordinates?.(mapFitCoordinates, { edgePadding: { top: 120, right: 60, bottom: 330, left: 60 }, animated: true });
            }
          }} accessibilityLabel="Show the full route">
            <MaterialIcons name="center-focus-strong" size={22} color="#7C3AED" />
          </TouchableOpacity>
        </View>
      </View>

      <View style={[styles.routePanel, { paddingBottom: Math.max(insets.bottom, 14) }, isDark && styles.panelDark]}>
        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator color="#7C3AED" />
            <Text style={[styles.loadingText, isDark && styles.textMuted]}>Loading the assigned route…</Text>
          </View>
        ) : errorText ? (
          <View style={styles.emptyBox}>
            <MaterialIcons name="cloud-off" size={30} color="#EF4444" />
            <Text style={styles.errorText}>{errorText}</Text>
          </View>
        ) : !selectedStop ? (
          <View style={styles.emptyBox}>
            <MaterialIcons name="check-circle" size={35} color="#2E8B57" />
            <Text style={[styles.emptyTitle, isDark && styles.textLight]}>No active route stops</Text>
            <Text style={[styles.emptyText, isDark && styles.textMuted]}>Return to Home to wait for the next dispatch.</Text>
          </View>
        ) : (
          <>
            <View style={styles.panelHeadingRow}>
              <View>
                <Text style={styles.eyebrow}>CURRENT TARGET</Text>
                <Text style={[styles.targetStreet, isDark && styles.textLight]} numberOfLines={1}>{selectedStop.street}</Text>
                <Text style={[styles.targetMeta, isDark && styles.textMuted]}>{selectedStop.barangay} · {selectedStop.wasteCategory}</Text>
              </View>
              <View style={styles.orderBadge}>
                <Text style={styles.orderBadgeText}>#{Math.max(1, stops.indexOf(selectedStop) + 1)}</Text>
              </View>
            </View>

            <View style={[styles.routeTypeBadge, hasRoadRoute ? styles.routeTypeRoad : styles.routeTypeFallback]}>
              <MaterialIcons name={hasRoadRoute ? 'add-road' : 'route'} size={15} color={hasRoadRoute ? '#166534' : '#6D28D9'} />
              <Text style={[styles.routeTypeText, { color: hasRoadRoute ? '#166534' : '#6D28D9' }]}>
                {hasRoadRoute ? 'Road-aware optimized route' : 'Geographic fallback route'}
              </Text>
            </View>

            {!coordinateOf(selectedStop) && (
              <View style={styles.gpsWarning}>
                <MaterialIcons name="location-off" size={16} color="#92400E" />
                <Text style={styles.gpsWarningText}>This stop has no GPS pin. Use the address shown above.</Text>
              </View>
            )}

            <Text style={[styles.stopsLabel, isDark && styles.textMuted]}>ROUTE ORDER</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.stopStrip}>
              {stops.map((stop, index) => (
                <TouchableOpacity
                  key={stop.id}
                  style={[styles.stopChip, stop.id === selectedStop.id && styles.stopChipActive, isDark && styles.stopChipDark]}
                  onPress={() => focusStop(stop)}
                >
                  <Text style={[styles.stopChipNumber, stop.id === selectedStop.id && styles.stopChipTextActive]}>{index + 1}</Text>
                  <Text style={[styles.stopChipStreet, stop.id === selectedStop.id && styles.stopChipTextActive]} numberOfLines={1}>{stop.street}</Text>
                  {!coordinateOf(stop) && <MaterialIcons name="location-off" size={13} color="#F59E0B" />}
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TouchableOpacity style={styles.completeButton} onPress={() => setShowCompleteModal(true)}>
              <MaterialIcons name="photo-camera" size={19} color="#FFFFFF" />
              <Text style={styles.completeButtonText}>Complete this pickup</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      {selectedStop && (
        <CompletePickupModal
          visible={showCompleteModal}
          scheduleId={selectedStop.id}
          location={`${selectedStop.street}, ${selectedStop.barangay}`}
          wasteType={selectedStop.wasteCategory}
          onClose={() => setShowCompleteModal(false)}
          onSubmit={() => setShowCompleteModal(false)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#E5E7EB' },
  containerDark: { backgroundColor: '#111827' },
  header: { position: 'absolute', left: 16, right: 16, minHeight: 68, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.96)', borderRadius: 18, padding: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.14, shadowRadius: 8, elevation: 5 },
  panelDark: { backgroundColor: 'rgba(31,41,55,0.97)' },
  iconButton: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F3F4F6' },
  headerCopy: { flex: 1, marginHorizontal: 10 },
  headerTitle: { color: '#111827', fontSize: 17, fontWeight: '800' },
  headerSubtitle: { color: '#6B7280', fontSize: 11, marginTop: 2 },
  routePanel: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingTop: 18, paddingHorizontal: 18, backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, shadowColor: '#000', shadowOffset: { width: 0, height: -3 }, shadowOpacity: 0.12, shadowRadius: 10, elevation: 9 },
  panelHeadingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 14 },
  eyebrow: { color: '#7C3AED', fontSize: 10, fontWeight: '900', letterSpacing: 0.8, marginBottom: 4 },
  targetStreet: { color: '#111827', fontSize: 20, fontWeight: '800', maxWidth: 280 },
  targetMeta: { color: '#6B7280', fontSize: 12, marginTop: 3 },
  orderBadge: { width: 45, height: 45, borderRadius: 15, backgroundColor: '#EDE9FE', alignItems: 'center', justifyContent: 'center' },
  orderBadgeText: { color: '#6D28D9', fontWeight: '900', fontSize: 16 },
  stopsLabel: { color: '#6B7280', fontSize: 10, fontWeight: '800', letterSpacing: 0.7, marginTop: 16, marginBottom: 8 },
  stopStrip: { gap: 8, paddingRight: 20 },
  stopChip: { width: 150, height: 47, flexDirection: 'row', alignItems: 'center', gap: 7, borderRadius: 13, paddingHorizontal: 10, backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: '#E5E7EB' },
  stopChipDark: { backgroundColor: '#374151', borderColor: '#4B5563' },
  stopChipActive: { backgroundColor: '#7C3AED', borderColor: '#7C3AED' },
  stopChipNumber: { color: '#7C3AED', fontSize: 12, fontWeight: '900' },
  stopChipStreet: { flex: 1, color: '#374151', fontSize: 12, fontWeight: '700' },
  stopChipTextActive: { color: '#FFFFFF' },
  completeButton: { height: 49, marginTop: 15, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#2E8B57' },
  completeButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  truckMarker: { width: 42, height: 42, borderRadius: 21, borderWidth: 3, borderColor: '#FFFFFF', backgroundColor: '#2563EB', alignItems: 'center', justifyContent: 'center' },
  stopMarker: { width: 34, height: 34, borderRadius: 17, borderWidth: 3, borderColor: '#FFFFFF', backgroundColor: '#7C3AED', alignItems: 'center', justifyContent: 'center' },
  stopMarkerSelected: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#2E8B57' },
  stopMarkerText: { color: '#FFFFFF', fontWeight: '900', fontSize: 13 },
  gpsWarning: { flexDirection: 'row', alignItems: 'center', gap: 7, padding: 9, borderRadius: 9, backgroundColor: '#FFFBEB', marginTop: 12 },
  gpsWarningText: { flex: 1, color: '#92400E', fontSize: 11, fontWeight: '600' },
  routeTypeBadge: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 6, marginTop: 11 },
  routeTypeRoad: { backgroundColor: '#DCFCE7' },
  routeTypeFallback: { backgroundColor: '#EDE9FE' },
  routeTypeText: { fontSize: 11, fontWeight: '800' },
  loadingBox: { minHeight: 125, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 10 },
  loadingText: { color: '#6B7280', fontSize: 13 },
  emptyBox: { minHeight: 140, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  emptyTitle: { color: '#111827', fontSize: 16, fontWeight: '800', marginTop: 8 },
  emptyText: { color: '#6B7280', fontSize: 12, textAlign: 'center', marginTop: 3 },
  errorText: { color: '#B91C1C', fontSize: 12, textAlign: 'center', marginTop: 8 },
  textLight: { color: '#F9FAFB' },
  textMuted: { color: '#9CA3AF' },
  simMapBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#059669',
    paddingHorizontal: 10,
    height: 42,
    borderRadius: 21,
  },
  simMapBtnActive: {
    backgroundColor: '#DC2626',
  },
  simMapBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
});
