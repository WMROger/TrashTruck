import { useAuthContext } from '@/components/AuthContext';
import MapView, { Marker, Polyline } from '@/components/MapView';
import CompletePickupModal from '@/components/driver/CompletePickupModal';
import { db } from '@/config/firebase';
import { useTheme } from '@/hooks/useTheme';
import { locationService, SimulationState, DANAO_SIMULATION_ROUTE } from '@/services/locationService';
import { MaterialIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useKeepAwake } from 'expo-keep-awake';
import { collection, doc, onSnapshot, query, where } from 'firebase/firestore';
import * as Location from 'expo-location';
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

function haversineMeters(c1: Coordinate, c2: Coordinate): number {
  const R = 6371000;
  const dLat = ((c2.latitude - c1.latitude) * Math.PI) / 180;
  const dLng = ((c2.longitude - c1.longitude) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((c1.latitude * Math.PI) / 180) *
      Math.cos((c2.latitude * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function coordinateOf(stop: RouteStop): Coordinate | null {
  const latitude = stop.location?.lat ?? stop.location?.latitude;
  const longitude = stop.location?.lng ?? stop.location?.longitude;
  return Number.isFinite(latitude) && Number.isFinite(longitude)
    ? { latitude: Number(latitude), longitude: Number(longitude) }
    : null;
}

function formatMinutesSeconds(sec: number): string {
  const m = Math.floor(Math.max(0, sec) / 60);
  const s = Math.floor(Math.max(0, sec) % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export default function DriverRouteMap() {
  // Keep phone screen awake during navigation to comply with Hands-Free Driving (RA 10913)
  useKeepAwake();

  const router = useRouter();
  const params = useLocalSearchParams<{
    scheduleId?: string | string[];
    autoDrive?: string;
    driveMode?: string;
    targetBarangay?: string;
  }>();
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
  const [isActualDriving, setIsActualDriving] = useState<boolean>(locationService.isGpsTracking());
  const [actualSpeedKph, setActualSpeedKph] = useState<number>(0);
  const [isCockpitMode, setIsCockpitMode] = useState<boolean>(true);
  const [assignedTruckPlate, setAssignedTruckPlate] = useState<string>('TRUCK-DANAO-01');
  const autoDriveTriggeredRef = useRef(false);

  useEffect(() => {
    return locationService.onSimulationChange((state) => {
      setSimulationState({ ...state });
      if (state.currentCoordinate) {
        setTruckCoordinate(state.currentCoordinate);
      }
    });
  }, []);

  const [driverAssignedBarangay, setDriverAssignedBarangay] = useState<string>('Poblacion');
  const [isShiftActive, setIsShiftActive] = useState<boolean>(false);

  useEffect(() => {
    if (!user?.uid || !db) return;
    return onSnapshot(
      doc(db, 'users', user.uid),
      (docSnap) => {
        if (docSnap.exists()) {
          const u = docSnap.data();
          const b = (u.assignedBarangay || u.barangay || '').trim();
          if (b) setDriverAssignedBarangay(b);
          const active = Boolean(u.dutyStatus === 'on_duty' || u.status === 'on_duty' || u.currentTruckId);
          setIsShiftActive(active);
          if (u.currentTruckPlate || u.currentTruckId) {
            setAssignedTruckPlate(u.currentTruckPlate || u.currentTruckId);
          }
        }
      },
      (err) => {
        if (err?.code !== 'permission-denied') {
          console.warn('RouteMap: user doc listener error:', err);
        }
      }
    );
  }, [user?.uid]);

  const handleToggleSimulation = async () => {
    if (!user?.uid) {
      Alert.alert('Authentication Required', 'Please sign in as a driver.');
      return;
    }

    if (simulationState.isActive || isActualDriving) {
      if (isActualDriving) {
        await locationService.stopTracking(user.uid);
        setIsActualDriving(false);
      }
      if (simulationState.isActive) {
        await locationService.stopSimulation(user.uid);
      }
    } else {
      Alert.alert(
        'Start Drive (Testing Mode)',
        'Choose how you want to test the truck navigation:',
        [
          {
            text: 'Simulated Route (Brgy. Baliang)',
            onPress: async () => {
              await locationService.stopTracking(user.uid);
              setIsActualDriving(false);
              await locationService.startSimulation(user.uid, assignedTruckPlate, 'Baliang', {}, 1);
              setIsCockpitMode(true);
            },
          },
          {
            text: 'Use Actual Phone GPS',
            onPress: async () => {
              try {
                const { status } = await Location.requestForegroundPermissionsAsync();
                if (status !== 'granted') {
                  Alert.alert('Permission Denied', 'Location permission is required to broadcast physical truck location.');
                  return;
                }
                await locationService.stopSimulation(user.uid);
                await locationService.startTracking(user.uid, assignedTruckPlate, {
                  barangay: 'Baliang',
                });
                setIsActualDriving(true);
                setIsCockpitMode(true);
              } catch (e) {
                console.error('RouteMap: actual GPS start error:', e);
              }
            },
          },
          {
            text: 'Cancel',
            style: 'cancel',
          },
        ]
      );
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
      const nextStops: RouteStop[] = [];

      snapshot.docs.forEach(scheduleDoc => {
        const data = scheduleDoc.data();
        const status = data.status || 'pending';
        if (status === 'completed' || status === 'cancelled') return;

        // If the schedule has embedded optimized stops (from AI auto-dispatch or route optimization)
        if (Array.isArray(data.stops) && data.stops.length > 0) {
          data.stops.forEach((s: any, idx: number) => {
            nextStops.push({
              id: `${scheduleDoc.id}_stop_${idx + 1}`,
              street: s.name || data.street || `Stop ${idx + 1}`,
              barangay: data.barangay || 'Danao City',
              wasteCategory: s.type === 'citizen_report' ? 'Verified Citizen Report' : (data.wasteCategory || 'Routine Collection'),
              status: status,
              routeOrder: Number(s.order) || (idx + 1),
              isLiveDispatch: true,
              location: (s.lat && s.lng) ? { latitude: Number(s.lat), longitude: Number(s.lng) } : (data.location || null),
              routeOptimization: data.routeOptimization || null,
            });
          });
        } else if (data.isLiveDispatch || scheduleDoc.id === requestedScheduleId) {
          nextStops.push({
            id: scheduleDoc.id,
            street: data.street || 'Unknown street',
            barangay: data.barangay || 'Danao City',
            wasteCategory: data.wasteCategory || 'General waste',
            status: status,
            routeOrder: Number(data.routeOrder) || 0,
            isLiveDispatch: data.isLiveDispatch === true,
            location: data.location || null,
            routeOptimization: data.routeOptimization || null,
          });
        }
      });

      nextStops.sort((a, b) => (a.routeOrder || 0) - (b.routeOrder || 0));

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
    return onSnapshot(
      doc(db, 'truck_locations', user.uid),
      snapshot => {
        const data = snapshot.data();
        const latitude = data?.lat ?? data?.location?.latitude;
        const longitude = data?.lng ?? data?.location?.longitude;
        setTruckCoordinate(Number.isFinite(latitude) && Number.isFinite(longitude)
          ? { latitude: Number(latitude), longitude: Number(longitude) }
          : null);
        if (data?.speedKph !== undefined || data?.speed !== undefined) {
          setActualSpeedKph(Math.round(Number(data.speedKph ?? data.speed ?? 0)));
        }
        if (data?.status === 'active' && !data?.isSimulated) {
          setIsActualDriving(true);
        } else if (data?.status === 'inactive' && !locationService.getSimulationState().isActive) {
          setIsActualDriving(false);
        }
      },
      error => {
        if (error?.code !== 'permission-denied') {
          console.warn('RouteMap: truck_locations listener error:', error);
        }
      }
    );
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

  // Auto-drive when navigated with autoDrive or driveMode params
  useEffect(() => {
    if (!autoDriveTriggeredRef.current && user?.uid) {
      if (params.driveMode === 'actual') {
        autoDriveTriggeredRef.current = true;
        setIsCockpitMode(true);
        setIsActualDriving(true);
        (async () => {
          try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status === 'granted') {
              await locationService.stopSimulation(user.uid);
              await locationService.startTracking(user.uid, assignedTruckPlate, {
                barangay: params.targetBarangay || 'Baliang',
              });
            }
          } catch (e) {
            console.warn('RouteMap: Actual GPS tracking init error:', e);
          }
        })();
      } else if (params.autoDrive === 'true') {
        autoDriveTriggeredRef.current = true;
        setIsCockpitMode(true);
        if (!locationService.getSimulationState().isActive) {
          const targetBgy = params.targetBarangay || driverAssignedBarangay || 'Baliang';
          locationService.startSimulation(user.uid, assignedTruckPlate, targetBgy, {}, 1);
        }
      }
    }
  }, [params.autoDrive, params.driveMode, params.targetBarangay, user?.uid, driverAssignedBarangay, assignedTruckPlate]);

  // Smooth Navigation Camera Auto-Follow (Hands-Free, keeps truck centered)
  useEffect(() => {
    if ((!simulationState.isActive && !isActualDriving) || !isCockpitMode || !truckCoordinate || !mapRef.current) return;
    mapRef.current?.animateToRegion?.({
      latitude: truckCoordinate.latitude,
      longitude: truckCoordinate.longitude,
      latitudeDelta: 0.007,
      longitudeDelta: 0.007,
    }, 450);
  }, [truckCoordinate?.latitude, truckCoordinate?.longitude, simulationState.isActive, isActualDriving, isCockpitMode]);

  // Auto-proximity stop selection (hands-free awareness)
  useEffect(() => {
    if ((!simulationState.isActive && !isActualDriving) || !truckCoordinate || locatedStops.length === 0) return;
    let closestStop: RouteStop | null = null;
    let minMeters = 999999;
    for (const item of locatedStops) {
      const d = haversineMeters(truckCoordinate, item.coordinate);
      if (d < minMeters) {
        minMeters = d;
        closestStop = item.stop;
      }
    }
    if (closestStop && minMeters < 60 && closestStop.id !== selectedId) {
      setSelectedId(closestStop.id);
    }
  }, [truckCoordinate?.latitude, truckCoordinate?.longitude, simulationState.isActive, isActualDriving, locatedStops, selectedId]);

  // Fit overview map when NOT actively driving in cockpit mode
  useEffect(() => {
    if (!mapRef.current || mapFitCoordinates.length === 0) return;
    if (simulationState.isActive && isCockpitMode) return;
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
  }, [mapFitCoordinates, simulationState.isActive, isCockpitMode]);

  const focusStop = (stop: RouteStop) => {
    setSelectedId(stop.id);
    const coordinate = coordinateOf(stop);
    if (coordinate) {
      mapRef.current?.animateToRegion?.({ ...coordinate, latitudeDelta: 0.012, longitudeDelta: 0.012 }, 400);
    }
  };

  const handleGoBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(driver)' as any);
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

      {/* 🛡️ HANDS-FREE FULLSCREEN COCKPIT HUD (RA 10913 COMPLIANT) */}
      {(simulationState.isActive || isActualDriving) ? (
        <View style={[styles.cockpitHudContainer, { top: insets.top + 8 }]}>
          {/* Top Control Bar */}
          <View style={styles.cockpitTopBar}>
            <TouchableOpacity
              style={[styles.cockpitExitBtn, isDark && styles.cockpitExitBtnDark]}
              onPress={handleGoBack}
              accessibilityLabel="Exit to driver tab"
              activeOpacity={0.8}
            >
              <MaterialIcons name="arrow-back" size={20} color={isDark ? '#FFFFFF' : '#1F2937'} />
            </TouchableOpacity>

            <View style={[styles.cockpitComplianceBadge, isDark && styles.cockpitComplianceBadgeDark]}>
              <View style={styles.simLivePulseDot} />
              <MaterialIcons name={isActualDriving ? 'gps-fixed' : 'security'} size={13} color="#16A34A" />
              <Text style={[styles.cockpitComplianceText, isDark && { color: '#86EFAC' }]}>
                {isActualDriving ? 'ACTUAL GPS · PHYSICAL DRIVE' : 'HANDS-FREE · RA 10913'}
              </Text>
            </View>

            {/* Speed Multiplier Pills (Only in simulation mode) */}
            {simulationState.isActive && (
              <View style={styles.cockpitSpeedPills}>
                {[
                  { label: '1x', val: 1 },
                  { label: '2x', val: 2 },
                  { label: '5x', val: 5 },
                  { label: '10x', val: 10 },
                ].map((s) => {
                  const isSel = (simulationState.speedMultiplier || 1) === s.val;
                  return (
                    <TouchableOpacity
                      key={s.val}
                      style={[
                        styles.cockpitPill,
                        isSel && styles.cockpitPillActive,
                        isDark && { backgroundColor: '#1E293B', borderColor: '#334155' },
                        isSel && isDark && { backgroundColor: '#7C3AED', borderColor: '#7C3AED' },
                      ]}
                      onPress={() => locationService.setSimulationSpeed(s.val)}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.cockpitPillText, isSel && styles.cockpitPillTextActive]}>
                        {s.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {/* Stop Drive Button */}
            <TouchableOpacity
              style={styles.cockpitStopBtn}
              onPress={handleToggleSimulation}
              activeOpacity={0.85}
              accessibilityLabel="Stop driving"
            >
              <MaterialIcons name="stop" size={16} color="#FFFFFF" />
              <Text style={styles.cockpitStopBtnText}>Stop</Text>
            </TouchableOpacity>
          </View>

          {/* Large Glanceable Drive HUD Bar */}
          <View style={[styles.cockpitMainCard, isDark && styles.cockpitMainCardDark]}>
            {/* Speedometer */}
            <View style={[styles.cockpitSpeedometerBox, isDark && styles.cockpitSpeedometerBoxDark]}>
              <Text style={[styles.cockpitSpeedometerNumber, (isActualDriving ? actualSpeedKph : simulationState.currentSpeedKph) >= 60 && { color: '#DC2626' }]}>
                {isActualDriving ? actualSpeedKph : simulationState.currentSpeedKph}
              </Text>
              <Text style={styles.cockpitSpeedometerUnit}>KM/H</Text>
            </View>

            {/* Roadway & Target Street Info */}
            <View style={styles.cockpitStreetInfo}>
              <Text style={[styles.cockpitStreetHeading, isDark && { color: '#C4B5FD' }]} numberOfLines={1}>
                {isActualDriving ? 'Live Phone GPS Active' : (simulationState.locationName || `Brgy. ${driverAssignedBarangay}`)}
              </Text>
              <Text style={[styles.cockpitStreetTarget, isDark && styles.textLight]} numberOfLines={1}>
                {selectedStop ? `Next: ${selectedStop.street}` : `Sector: Brgy. ${params.targetBarangay || driverAssignedBarangay || 'Baliang'}`}
              </Text>
              {/* Progress Bar */}
              <View style={styles.cockpitProgressTrack}>
                <View
                  style={[
                    styles.cockpitProgressFill,
                    isActualDriving
                      ? { width: '100%', backgroundColor: '#10B981' }
                      : { width: `${Math.max(4, simulationState.progressPercent || 0)}%` },
                  ]}
                />
              </View>
            </View>
          </View>

          {/* Telemetry Glance Strip: Time | Fuel | Distance */}
          {isActualDriving ? (
            <View style={[styles.cockpitTelemetryRow, isDark && styles.cockpitTelemetryRowDark]}>
              <View style={styles.cockpitTelemetryItem}>
                <MaterialIcons name="my-location" size={13} color="#10B981" />
                <Text style={[styles.cockpitTelemetryVal, { color: '#10B981' }]}>
                  GPS BROADCASTING
                </Text>
              </View>
              <View style={styles.cockpitTelemetryDivider} />
              <View style={styles.cockpitTelemetryItem}>
                <MaterialIcons name="location-city" size={13} color="#8B5CF6" />
                <Text style={[styles.cockpitTelemetryVal, isDark && styles.textLight]}>
                  Brgy. {params.targetBarangay || 'Baliang'}
                </Text>
              </View>
              <View style={styles.cockpitTelemetryDivider} />
              <View style={styles.cockpitTelemetryItem}>
                <MaterialIcons name="speed" size={13} color="#F59E0B" />
                <Text style={[styles.cockpitTelemetryVal, isDark && styles.textLight]}>
                  {actualSpeedKph} km/h
                </Text>
              </View>
            </View>
          ) : (
            <View style={[styles.cockpitTelemetryRow, isDark && styles.cockpitTelemetryRowDark]}>
              <View style={styles.cockpitTelemetryItem}>
                <MaterialIcons name="timer" size={13} color="#8B5CF6" />
                <Text style={[styles.cockpitTelemetryVal, isDark && styles.textLight]}>
                  {formatMinutesSeconds(simulationState.elapsedDurationSeconds || 0)}
                  <Text style={styles.cockpitTelemetrySub}> / {formatMinutesSeconds(simulationState.totalDurationSeconds || 600)}</Text>
                </Text>
              </View>

              <View style={styles.cockpitTelemetryDivider} />

              <View style={styles.cockpitTelemetryItem}>
                <MaterialIcons name="local-gas-station" size={13} color="#10B981" />
                <Text style={[styles.cockpitTelemetryVal, { color: '#10B981' }]}>
                  {(simulationState.fuelBurnedLiters || 0).toFixed(2)} L
                  <Text style={styles.cockpitTelemetrySub}> (≈ ₱{(simulationState.fuelCostBurnedPhp || 0).toFixed(0)})</Text>
                </Text>
              </View>

              <View style={styles.cockpitTelemetryDivider} />

              <View style={styles.cockpitTelemetryItem}>
                <MaterialIcons name="speed" size={13} color="#F59E0B" />
                <Text style={[styles.cockpitTelemetryVal, isDark && styles.textLight]}>
                  {(simulationState.distanceTraveledKm || 0).toFixed(2)} km
                  <Text style={styles.cockpitTelemetrySub}> ({simulationState.progressPercent}%)</Text>
                </Text>
              </View>
            </View>
          )}
        </View>
      ) : (
        /* Standard Header when NOT in active drive */
        <View style={[styles.header, { top: insets.top + 10 }, isDark && styles.panelDark]}>
          <TouchableOpacity
            style={[styles.iconButton, isDark && styles.iconButtonDark]}
            onPress={handleGoBack}
            accessibilityLabel="Back to driver dashboard"
            activeOpacity={0.8}
          >
            <MaterialIcons name="arrow-back" size={24} color={isDark ? '#FFFFFF' : '#1F2937'} />
          </TouchableOpacity>
          <View style={styles.headerCopy}>
            <Text style={[styles.headerTitle, isDark && styles.textLight]}>Live Route Dispatch</Text>
            <Text style={[styles.headerSubtitle, isDark && styles.textMuted]}>
              {stops.length} stop{stops.length === 1 ? '' : 's'}{routeDistance ? ` · ${routeDistance} km${routeDuration ? ` · ${routeDuration} min` : ''}` : ' · in-app map'}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <TouchableOpacity
              style={[styles.simMapBtn, (simulationState.isActive || isActualDriving) && styles.simMapBtnActive]}
              onPress={handleToggleSimulation}
              accessibilityLabel="Start Drive"
            >
              <MaterialIcons
                name={(simulationState.isActive || isActualDriving) ? 'stop' : 'play-arrow'}
                size={18}
                color="#FFFFFF"
              />
              <Text style={styles.simMapBtnText}>
                {(simulationState.isActive || isActualDriving) ? 'Stop Drive' : 'Start Drive'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.iconButton, isDark && styles.iconButtonDark]} onPress={() => {
              if (mapFitCoordinates.length > 1) {
                mapRef.current?.fitToCoordinates?.(mapFitCoordinates, { edgePadding: { top: 120, right: 60, bottom: 330, left: 60 }, animated: true });
              }
            }} accessibilityLabel="Show the full route">
              <MaterialIcons name="center-focus-strong" size={22} color="#7C3AED" />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* BOTTOM SECTION: Fullscreen Cockpit Floating Dock OR Expanded Route Drawer */}
      {(simulationState.isActive || isActualDriving) && isCockpitMode ? (
        <View style={[styles.cockpitBottomDock, { bottom: Math.max(insets.bottom, 14) }, isDark && styles.cockpitBottomDockDark]}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View style={styles.cockpitStopBadge}>
                <Text style={styles.cockpitStopBadgeText}>
                  #{selectedStop ? Math.max(1, stops.indexOf(selectedStop) + 1) : 1}
                </Text>
              </View>
              <Text style={[styles.cockpitBottomStreet, isDark && styles.textLight]} numberOfLines={1}>
                {selectedStop?.street || 'En Route to Target Sector'}
              </Text>
            </View>
            <Text style={[styles.cockpitBottomSub, isDark && styles.textMuted]} numberOfLines={1}>
              {selectedStop ? `${selectedStop.barangay} · ${selectedStop.wasteCategory}` : 'Follow map route hands-free'}
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.cockpitExpandDrawerBtn, isDark && styles.cockpitExpandDrawerBtnDark]}
            onPress={() => setIsCockpitMode(false)}
            activeOpacity={0.8}
            accessibilityLabel="View stop details"
          >
            <MaterialIcons name="list" size={16} color={isDark ? '#86EFAC' : '#166534'} />
            <Text style={[styles.cockpitExpandDrawerText, isDark && { color: '#86EFAC' }]}>
              Stop Details
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={[styles.routePanel, { paddingBottom: Math.max(insets.bottom, 14) }, isDark && styles.panelDark]}>
          {(simulationState.isActive || isActualDriving) && (
            <TouchableOpacity
              style={styles.returnToCockpitBtn}
              onPress={() => setIsCockpitMode(true)}
              activeOpacity={0.8}
            >
              <MaterialIcons name="fullscreen" size={18} color="#FFFFFF" />
              <Text style={styles.returnToCockpitText}>Return to Hands-Free Fullscreen Drive</Text>
            </TouchableOpacity>
          )}

          {loading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator color="#7C3AED" />
              <Text style={[styles.loadingText, isDark && styles.textMuted]}>Loading the assigned route…</Text>
            </View>
          ) : errorText ? (
            <View style={styles.emptyBox}>
              <MaterialIcons name="cloud-off" size={30} color="#EF4444" />
              <Text style={styles.errorText}>{errorText}</Text>
              <TouchableOpacity style={styles.backHomeBtn} onPress={handleGoBack}>
                <MaterialIcons name="arrow-back" size={18} color="#FFFFFF" />
                <Text style={styles.backHomeBtnText}>Back to Dashboard</Text>
              </TouchableOpacity>
            </View>
          ) : !selectedStop ? (
            <View style={styles.emptyBox}>
              <MaterialIcons name="check-circle" size={35} color="#2E8B57" />
              <Text style={[styles.emptyTitle, isDark && styles.textLight]}>No active route stops</Text>
              <Text style={[styles.emptyText, isDark && styles.textMuted]}>Return to Home to wait for the next dispatch.</Text>
              <TouchableOpacity style={styles.backHomeBtn} onPress={handleGoBack}>
                <MaterialIcons name="arrow-back" size={18} color="#FFFFFF" />
                <Text style={styles.backHomeBtnText}>Back to Dashboard</Text>
              </TouchableOpacity>
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

              <TouchableOpacity
                style={[styles.completeButton, !isShiftActive && { backgroundColor: '#64748B' }]}
                onPress={() => {
                  if (!isShiftActive) {
                    Alert.alert(
                      'Off-Duty Notice',
                      'You are currently off duty. Please start your shift and select a truck before completing pickups.',
                      [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Start Shift', onPress: () => router.push('/(driver)/select-truck') }
                      ]
                    );
                    return;
                  }
                  setShowCompleteModal(true);
                }}
              >
                <MaterialIcons name={isShiftActive ? "photo-camera" : "lock"} size={19} color="#FFFFFF" />
                <Text style={styles.completeButtonText}>
                  {isShiftActive ? "Complete this pickup" : "Viewing Mode (Off Duty)"}
                </Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      )}

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
  iconButtonDark: { backgroundColor: '#374151' },
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
  backHomeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#2E8B57',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
    marginTop: 14,
  },
  backHomeBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
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
  simHudCard: {
    position: 'absolute',
    left: 16,
    right: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.98)',
    borderRadius: 18,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 10,
    elevation: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  simHudCardDark: {
    backgroundColor: 'rgba(30, 41, 59, 0.98)',
    borderColor: '#334155',
  },
  simHudHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  simLivePulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
  },
  simHudTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#1E293B',
    letterSpacing: 0.5,
  },
  simHudRatioBadge: {
    backgroundColor: '#EDE9FE',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  simHudRatioText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#7C3AED',
  },
  simHudStopBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  simHudStopText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#EF4444',
  },
  simHudProgressBarTrack: {
    height: 4,
    backgroundColor: '#F1F5F9',
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 10,
  },
  simHudProgressBarFill: {
    height: '100%',
    backgroundColor: '#7C3AED',
    borderRadius: 2,
  },
  simHudMetricsGrid: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  simHudMetricCard: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  simHudMetricCardDark: {
    backgroundColor: '#1E293B',
    borderColor: '#334155',
  },
  simHudMetricIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 2,
  },
  simHudMetricLabel: {
    fontSize: 8.5,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.4,
  },
  simHudMetricVal: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#0F172A',
  },
  simHudMetricSubVal: {
    fontSize: 10,
    fontWeight: '500',
    color: '#94A3B8',
  },
  simHudMetricCaption: {
    fontSize: 9,
    color: '#64748B',
    marginTop: 2,
    fontWeight: '500',
  },
  simSpeedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E2E8F0',
    paddingTop: 8,
  },
  simSpeedRowLabel: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#64748B',
  },
  simSpeedPillsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    flex: 1,
  },
  simSpeedPill: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  simSpeedPillDark: {
    backgroundColor: '#334155',
    borderColor: '#475569',
  },
  simSpeedPillActive: {
    backgroundColor: '#7C3AED',
    borderColor: '#7C3AED',
  },
  simSpeedPillActiveDark: {
    backgroundColor: '#8B5CF6',
    borderColor: '#8B5CF6',
  },
  simSpeedPillText: {
    fontSize: 9,
    fontWeight: '600',
    color: '#475569',
  },
  simSpeedPillTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  // Cockpit Mode HUD (RA 10913 Hands-Free Driving Compliant)
  cockpitHudContainer: {
    position: 'absolute',
    left: 12,
    right: 12,
    zIndex: 999,
  },
  cockpitTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  cockpitExitBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 3,
  },
  cockpitExitBtnDark: {
    backgroundColor: 'rgba(31, 41, 55, 0.95)',
  },
  cockpitComplianceBadge: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: 'rgba(240, 253, 244, 0.95)',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    height: 38,
    borderRadius: 19,
    paddingHorizontal: 8,
  },
  cockpitComplianceBadgeDark: {
    backgroundColor: 'rgba(20, 83, 45, 0.9)',
    borderColor: '#166534',
  },
  cockpitComplianceText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#15803D',
    letterSpacing: 0.3,
  },
  cockpitSpeedPills: {
    flexDirection: 'row',
    gap: 4,
  },
  cockpitPill: {
    paddingHorizontal: 7,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cockpitPillActive: {
    backgroundColor: '#7C3AED',
    borderColor: '#7C3AED',
  },
  cockpitPillText: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#475569',
  },
  cockpitPillTextActive: {
    color: '#FFFFFF',
    fontWeight: '900',
  },
  cockpitStopBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#DC2626',
    paddingHorizontal: 12,
    height: 38,
    borderRadius: 19,
    shadowColor: '#DC2626',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 4,
  },
  cockpitStopBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  cockpitMainCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.97)',
    borderRadius: 20,
    padding: 12,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cockpitMainCardDark: {
    backgroundColor: 'rgba(30, 41, 59, 0.97)',
    borderColor: '#334155',
  },
  cockpitSpeedometerBox: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#22C55E',
  },
  cockpitSpeedometerBoxDark: {
    backgroundColor: '#020617',
    borderColor: '#16A34A',
  },
  cockpitSpeedometerNumber: {
    fontSize: 26,
    fontWeight: '900',
    color: '#22C55E',
    lineHeight: 30,
  },
  cockpitSpeedometerUnit: {
    fontSize: 8.5,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 0.5,
  },
  cockpitStreetInfo: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
  },
  cockpitStreetHeading: {
    fontSize: 10,
    fontWeight: '800',
    color: '#7C3AED',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  cockpitStreetTarget: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    marginVertical: 2,
  },
  cockpitProgressTrack: {
    height: 5,
    backgroundColor: '#E2E8F0',
    borderRadius: 3,
    overflow: 'hidden',
    marginTop: 4,
  },
  cockpitProgressFill: {
    height: '100%',
    backgroundColor: '#7C3AED',
    borderRadius: 3,
  },
  cockpitTelemetryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginTop: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  cockpitTelemetryRowDark: {
    backgroundColor: 'rgba(30, 41, 59, 0.95)',
    borderColor: '#334155',
  },
  cockpitTelemetryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  cockpitTelemetryVal: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0F172A',
  },
  cockpitTelemetrySub: {
    fontSize: 9.5,
    fontWeight: '500',
    color: '#64748B',
  },
  cockpitTelemetryDivider: {
    width: 1,
    height: 14,
    backgroundColor: '#CBD5E1',
  },
  cockpitBottomDock: {
    position: 'absolute',
    left: 14,
    right: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.96)',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cockpitBottomDockDark: {
    backgroundColor: 'rgba(30, 41, 59, 0.96)',
    borderColor: '#334155',
  },
  cockpitStopBadge: {
    backgroundColor: '#EDE9FE',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 8,
  },
  cockpitStopBadgeText: {
    color: '#7C3AED',
    fontWeight: '900',
    fontSize: 12,
  },
  cockpitBottomStreet: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  cockpitBottomSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  cockpitExpandDrawerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
  cockpitExpandDrawerBtnDark: {
    backgroundColor: '#064E3B',
  },
  cockpitExpandDrawerText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#166534',
  },
  returnToCockpitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#16A34A',
    borderRadius: 14,
    paddingVertical: 10,
    marginBottom: 12,
  },
  returnToCockpitText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
});
