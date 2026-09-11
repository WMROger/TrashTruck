import * as Location from 'expo-location';
import { addDoc, collection, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { dailyTripId, distanceFromRouteMeters, distanceMeters, FleetTrackingContext } from '@/services/fleetMonitoringService';

import { getBarangaySimulationRoute, SimulationWaypoint } from '@/constants/barangaySimulationRoutes';
import { getRoadSnappedSimulationRoute } from '@/services/osrmRoutingService';

export type SimulationState = {
  isActive: boolean;
  currentStep: number;
  totalSteps: number;
  currentSpeedKph: number;
  currentCoordinate: { latitude: number; longitude: number } | null;
  locationName: string;
  barangay?: string;
  truckId: string;
  driverId: string;
  heading?: number;

  // 1:1 Realistic Drive Metrics
  speedMultiplier: number; // 1 = 1:1 real-time ratio, 2 = 2x, 5 = 5x, 10 = 10x
  elapsedDurationSeconds: number; // e.g. 180 (3 min)
  totalDurationSeconds: number; // e.g. 600 (10 min drive)
  remainingDurationSeconds: number; // e.g. 420 (7 min left)
  distanceTraveledKm: number; // e.g. 1.20 km
  totalDistanceKm: number; // e.g. 4.10 km
  progressPercent: number; // e.g. 29%

  // Live Fuel Consumption Metrics ("how much it would take and etc")
  fuelBurnedLiters: number; // e.g. 0.45 L
  totalEstimatedFuelLiters: number; // e.g. 1.55 L
  fuelCostBurnedPhp: number | null; // e.g. ₱27.00
  totalEstimatedCostPhp: number | null; // e.g. ₱93.00
  fuelBurnRateKmPerLiter: number; // e.g. 3.2 km/L
};

export const DANAO_SIMULATION_ROUTE = [
  { latitude: 10.5218, longitude: 124.0285, name: 'Danao City Hall (Poblacion)', speed: 25, barangay: 'Poblacion' },
  { latitude: 10.5245, longitude: 124.0298, name: 'Beatriz D. Durano Ave', speed: 32, barangay: 'Poblacion' },
  { latitude: 10.5280, longitude: 124.0315, name: 'P.G. Almendras St', speed: 38, barangay: 'Suba' },
  { latitude: 10.5312, longitude: 124.0328, name: 'F. Ralota St / Suba', speed: 35, barangay: 'Suba' },
  { latitude: 10.5348, longitude: 124.0340, name: 'Danao Port Coastal Road', speed: 42, barangay: 'Looc' },
  { latitude: 10.5395, longitude: 124.0355, name: 'Looc Coastal Highway', speed: 48, barangay: 'Looc' },
  { latitude: 10.5432, longitude: 124.0330, name: 'Taytay Junction', speed: 40, barangay: 'Taytay' },
  { latitude: 10.5480, longitude: 124.0305, name: 'Guinsay Boulevard', speed: 45, barangay: 'Guinsay' },
  { latitude: 10.5525, longitude: 124.0270, name: 'Sabang Highway Entry', speed: 52, barangay: 'Sabang' },
  { latitude: 10.5560, longitude: 124.0240, name: 'Sabang Highway (Speed Alert Test)', speed: 64, barangay: 'Sabang' },
  { latitude: 10.5590, longitude: 124.0210, name: 'Sabang Elementary Crossing', speed: 35, barangay: 'Sabang' },
  { latitude: 10.5540, longitude: 124.0175, name: 'Maslog Bypass Road', speed: 44, barangay: 'Maslog' },
  { latitude: 10.5470, longitude: 124.0150, name: 'Tuburan Access Link', speed: 38, barangay: 'Tuburan Sur' },
  { latitude: 10.5390, longitude: 124.0165, name: 'Cogon Collector Path', speed: 32, barangay: 'Cogon-Cruz' },
  { latitude: 10.5310, longitude: 124.0220, name: 'Danao Central Terminal', speed: 28, barangay: 'Poblacion' },
  { latitude: 10.5255, longitude: 124.0250, name: 'Hospital Memorial Road', speed: 30, barangay: 'Poblacion' },
  { latitude: 10.5218, longitude: 124.0285, name: 'Danao City Municipal Depot', speed: 22, barangay: 'Poblacion' },
];

function calculateBearing(startLat: number, startLng: number, destLat: number, destLng: number): number {
  const startLatRad = (startLat * Math.PI) / 180;
  const startLngRad = (startLng * Math.PI) / 180;
  const destLatRad = (destLat * Math.PI) / 180;
  const destLngRad = (destLng * Math.PI) / 180;

  const y = Math.sin(destLngRad - startLngRad) * Math.cos(destLatRad);
  const x =
    Math.cos(startLatRad) * Math.sin(destLatRad) -
    Math.sin(startLatRad) * Math.cos(destLatRad) * Math.cos(destLngRad - startLngRad);
  let brng = (Math.atan2(y, x) * 180) / Math.PI;
  return (brng + 360) % 360;
}

export function haversineDistKm(
  c1: { latitude: number; longitude: number },
  c2: { latitude: number; longitude: number }
): number {
  const R = 6371;
  const dLat = ((c2.latitude - c1.latitude) * Math.PI) / 180;
  const dLon = ((c2.longitude - c1.longitude) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((c1.latitude * Math.PI) / 180) *
      Math.cos((c2.latitude * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function densifySimulationRoute(
  waypoints: SimulationWaypoint[],
  maxSegmentKm = 0.04
): SimulationWaypoint[] {
  if (waypoints.length < 2) return waypoints;
  const result: SimulationWaypoint[] = [];
  for (let i = 0; i < waypoints.length - 1; i++) {
    const p1 = waypoints[i];
    const p2 = waypoints[i + 1];
    result.push(p1);
    const dist = haversineDistKm(p1, p2);
    if (dist > maxSegmentKm) {
      const steps = Math.ceil(dist / maxSegmentKm);
      for (let s = 1; s < steps; s++) {
        const t = s / steps;
        result.push({
          latitude: p1.latitude + (p2.latitude - p1.latitude) * t,
          longitude: p1.longitude + (p2.longitude - p1.longitude) * t,
          name: p1.name || 'En Route Sector',
          speed: Math.round((p1.speed ?? 24) + ((p2.speed ?? 24) - (p1.speed ?? 24)) * t),
          barangay: p1.barangay,
        });
      }
    }
  }
  result.push(waypoints[waypoints.length - 1]);
  return result;
}

class LocationService {
  private locationSubscription: Location.LocationSubscription | null = null;
  private isTracking = false;
  private currentDriverId: string | null = null;
  private currentTruckId: string | null = null;
  private retryTimeout: ReturnType<typeof setTimeout> | null = null;
  private maxRetries = 3;
  private lastHistoryAt = 0;
  private lastHistoryCoordinate: { latitude: number; longitude: number } | null = null;
  private deviationSamples = 0;
  private lastAlertAt: Record<string, number> = {};

  // Simulation state
  private simulationInterval: ReturnType<typeof setInterval> | null = null;
  private simulationListeners: Array<(state: SimulationState) => void> = [];
  private currentActiveTripId: string | null = null;
  private activeTripPoints: Array<{
    id: string;
    step: number;
    latitude: number;
    longitude: number;
    speedKph: number;
    heading: number;
    locationName: string;
    timestampMs: number;
    recordedAt: string;
  }> = [];
  private speedMultiplier = 1;
  private simElapsedSeconds = 0;
  private simTotalDurationSeconds = 600;
  private simRouteWaypoints: SimulationWaypoint[] = [];
  private simCumDistances: number[] = [];
  private simTotalDistanceKm = 0;
  private simLastFirestoreWrite = 0;
  private simLastTripPersist = 0;
  private simIsWriting = false;
  private firestoreBackoffUntil = 0;
  private simDieselKmPerLiter = 3.2;
  private simPricePerLiter = 60.0;
  private simIdleLitersPerHour = 1.2;

  private simulationState: SimulationState = {
    isActive: false,
    currentStep: 0,
    totalSteps: 0,
    currentSpeedKph: 0,
    currentCoordinate: null,
    locationName: '',
    truckId: '',
    driverId: '',
    heading: 0,
    speedMultiplier: 1,
    elapsedDurationSeconds: 0,
    totalDurationSeconds: 600,
    remainingDurationSeconds: 600,
    distanceTraveledKm: 0,
    totalDistanceKm: 0,
    progressPercent: 0,
    fuelBurnedLiters: 0,
    totalEstimatedFuelLiters: 0,
    fuelCostBurnedPhp: 0,
    totalEstimatedCostPhp: 0,
    fuelBurnRateKmPerLiter: 3.2,
  };

  public isGpsTracking(): boolean {
    return this.isTracking;
  }

  // =========================================================================
  // STANDALONE APK: BACKGROUND LOCATION TRACKING (UNCOMMENT WHEN BUILDING APK)
  // =========================================================================
  // When building a standalone APK (with `eas build` or `npx expo run:android`),
  // you can enable true 24/7 background GPS tracking even when the phone screen is locked.
  //
  // Steps to enable for APK:
  // 1. Run: npx expo install expo-task-manager
  // 2. Uncomment the TaskManager code and startBackgroundTracking() below.
  // 3. Set "locationAlwaysAndWhenInUsePermission": true in app.json.
  //
  // /*
  // import * as TaskManager from 'expo-task-manager';
  // export const BACKGROUND_LOCATION_TASK = 'TRASHTRACK_BACKGROUND_LOCATION';
  //
  // TaskManager.defineTask(BACKGROUND_LOCATION_TASK, async ({ data, error }: any) => {
  //   if (error) {
  //     console.error('Background location error:', error);
  //     return;
  //   }
  //   if (data) {
  //     const { locations } = data as { locations: Location.LocationObject[] };
  //     const latest = locations[locations.length - 1];
  //     if (latest && locationService.currentDriverId && locationService.currentTruckId) {
  //       await locationService.updateLocationInFirestore(
  //         locationService.currentDriverId,
  //         locationService.currentTruckId,
  //         latest.coords,
  //         locationService.currentTrackingContext
  //       );
  //     }
  //   }
  // });
  // */

  async startTracking(driverId: string, truckId: string, context: FleetTrackingContext = {}) {
    if (!driverId || !truckId) {
      console.warn('GPS tracking requires both an authenticated driver and an assigned truck.');
      return;
    }
    if (this.isTracking || this.simulationState.isActive) return;

    try {
      const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
      if (foregroundStatus !== 'granted') {
        console.warn('Location permission denied — GPS tracking not started.');
        return;
      }

      // Check if location services are enabled
      const isEnabled = await Location.hasServicesEnabledAsync();
      if (!isEnabled) {
        console.warn('Location services are disabled. GPS tracking will retry when available.');
        this.scheduleRetry(driverId, truckId, context, 0);
        return;
      }

      this.isTracking = true;
      this.currentDriverId = driverId;
      this.currentTruckId = truckId;

      // Try to get initial location with fallback
      try {
        const initialLocation = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        await this.updateLocationInFirestore(driverId, truckId, initialLocation.coords, context);
      } catch {
        console.warn('getCurrentPositionAsync failed, trying getLastKnownPositionAsync...');
        try {
          const lastKnown = await Location.getLastKnownPositionAsync();
          if (lastKnown) {
            await this.updateLocationInFirestore(driverId, truckId, lastKnown.coords, context);
          }
        } catch {
          console.warn('getLastKnownPositionAsync also failed — will rely on watchPosition updates.');
        }
      }

      // --- [FOR EXPO GO: Standard Foreground Location Watcher] ---
      this.locationSubscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 10000, // Update every 10 seconds
          distanceInterval: 10, // Update every 10 meters
        },
        (location) => {
          this.updateLocationInFirestore(driverId, truckId, location.coords, context);
        }
      );

      // --- [FOR STANDALONE APK: UNCOMMENT FOR BACKGROUND TRACKING WHEN SCREEN IS LOCKED] ---
      // const { status: bgStatus } = await Location.requestBackgroundPermissionsAsync();
      // if (bgStatus === 'granted') {
      //   await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
      //     accuracy: Location.Accuracy.High,
      //     timeInterval: 10000,
      //     distanceInterval: 10,
      //     showsBackgroundLocationIndicator: true,
      //     foregroundService: {
      //       notificationTitle: 'TrashTrack Driver Active',
      //       notificationBody: 'Broadcasting live collection truck coordinates to CENRO dispatch.',
      //       notificationColor: '#2E8B57',
      //     },
      //   });
      // }
      
      console.log('Started live GPS tracking for driver:', driverId);
    } catch (error) {
      console.error('Error starting location tracking:', error);
      this.isTracking = false;
      // Schedule a retry
      this.scheduleRetry(driverId, truckId, context, 0);
    }
  }

  private scheduleRetry(driverId: string, truckId: string, context: FleetTrackingContext, attempt: number) {
    if (attempt >= this.maxRetries) {
      console.warn(`GPS tracking: gave up after ${this.maxRetries} retries.`);
      return;
    }
    
    const delay = Math.min(5000 * Math.pow(2, attempt), 30000); // 5s, 10s, 20s
    console.log(`GPS tracking: retrying in ${delay / 1000}s (attempt ${attempt + 1}/${this.maxRetries})`);
    
    this.retryTimeout = setTimeout(() => {
      this.startTracking(driverId, truckId, context);
    }, delay);
  }

  async stopTracking(driverId?: string) {
    // If tracking is already stopped, avoid redundant writes and duplicate log messages
    if (!this.isTracking && !this.locationSubscription && !this.retryTimeout) {
      return;
    }

    // Cancel any pending retry
    if (this.retryTimeout) {
      clearTimeout(this.retryTimeout);
      this.retryTimeout = null;
    }

    if (this.locationSubscription) {
      try {
        this.locationSubscription.remove();
      } catch (e) {
        console.warn('Failed to remove location subscription safely:', e);
      }
      this.locationSubscription = null;
    }
    this.isTracking = false;
    this.lastHistoryAt = 0;
    this.lastHistoryCoordinate = null;
    this.deviationSamples = 0;

    const targetDriverId = driverId || this.currentDriverId;
    this.currentDriverId = null;
    this.currentTruckId = null;

    // Mark as inactive in Firestore
    try {
      if (db && targetDriverId) {
        const truckRef = doc(db, 'truck_locations', targetDriverId);
        await setDoc(truckRef, {
          status: 'inactive',
          lastUpdate: serverTimestamp(),
        }, { merge: true });
        console.log('Stopped live GPS tracking for driver:', targetDriverId);
      }
    } catch (error: any) {
      if (error?.message?.includes('Missing or insufficient permissions') || error?.code === 'permission-denied') {
        console.log('Location tracking stopped (Ignored permission error during logout)');
      } else {
        console.error('Error stopping location tracking:', error);
      }
    }
  }


  // -------------------------------------------------------------
  // 1:1 REAL-TIME SIMULATION ENGINE & FUEL ANALYTICS
  // -------------------------------------------------------------

  public getSimulationState(): SimulationState {
    return this.simulationState;
  }

  public onSimulationChange(listener: (state: SimulationState) => void): () => void {
    this.simulationListeners.push(listener);
    listener(this.simulationState);
    return () => {
      this.simulationListeners = this.simulationListeners.filter((l) => l !== listener);
    };
  }

  private notifySimulationListeners() {
    this.simulationListeners.forEach((listener) => {
      try {
        listener(this.simulationState);
      } catch (e) {
        console.warn('Error in simulation listener:', e);
      }
    });
  }

  public setSimulationSpeed(multiplier: number) {
    if (!Number.isFinite(multiplier) || multiplier <= 0) return;
    this.speedMultiplier = multiplier;
    this.simulationState.speedMultiplier = multiplier;
    this.notifySimulationListeners();
  }

  /**
   * Starts a realistic GPS simulation driving along Danao City routes for a specific Barangay.
   * Runs in authentic 1:1 real-time ratio (e.g. 10-minute drive = 10 minutes at 1x speed),
   * calculating live diesel fuel consumed (Liters and ₱) and remaining ETA.
   */
  public async startSimulation(
    driverId: string,
    truckId: string,
    barangayOrRoute?: string | SimulationWaypoint[],
    context: FleetTrackingContext = {},
    initialSpeedMultiplier = 1
  ) {
    if (this.simulationInterval) {
      await this.stopSimulation(driverId);
    }

    this.speedMultiplier = Math.max(0.25, Math.min(20, initialSpeedMultiplier || 1));

    let rawRoute: SimulationWaypoint[];
    let targetBarangay = 'Poblacion';

    if (Array.isArray(barangayOrRoute) && barangayOrRoute.length >= 2) {
      rawRoute = barangayOrRoute;
      const routeBarangays = barangayOrRoute.map((wp) => wp.barangay).filter((b) => b && b !== 'Poblacion');
      targetBarangay = routeBarangays[0] || barangayOrRoute[0]?.barangay || 'Poblacion';
    } else if (typeof barangayOrRoute === 'string' && barangayOrRoute.trim()) {
      targetBarangay = barangayOrRoute.trim();
      rawRoute = await getRoadSnappedSimulationRoute(targetBarangay);
    } else {
      rawRoute = await getRoadSnappedSimulationRoute('Poblacion');
    }

    // Densify raw waypoints so 1:1 movement interpolates smoothly along streets (~30-40m)
    const route = densifySimulationRoute(rawRoute, 0.04);
    this.simRouteWaypoints = route;

    // Calculate cumulative distances
    const cumDist: number[] = [0];
    for (let i = 0; i < route.length - 1; i++) {
      const segDist = haversineDistKm(route[i], route[i + 1]);
      cumDist.push(cumDist[i] + segDist);
    }
    this.simCumDistances = cumDist;
    const totalDistKm = Math.max(0.8, cumDist[cumDist.length - 1] || 4.0);
    this.simTotalDistanceKm = totalDistKm;

    // 1:1 Real-Time Drive Duration:
    // Typical urban collection truck speed in Danao City averages ~24 km/h (including stops & traffic).
    // For a ~4.0 km route: 4.0 / 24 * 3600 = 600 seconds = exactly 10 minutes!
    const targetSpeedKph = 24;
    const totalDurationSeconds = Math.max(180, Math.round((totalDistKm / targetSpeedKph) * 3600));
    this.simTotalDurationSeconds = totalDurationSeconds;
    this.simElapsedSeconds = 0;
    this.simLastFirestoreWrite = Date.now();

    // Diesel Parameters: standard Danao 6-wheeler compactor truck
    this.simDieselKmPerLiter = 3.2; // 3.2 km/L
    this.simIdleLitersPerHour = 1.2; // 1.2 L/h idle & compaction
    this.simPricePerLiter = 60.0; // ₱60.00 / Liter

    // Total Estimated Diesel Fuel for the entire route
    const totalDrivingLiters = (totalDistKm / this.simDieselKmPerLiter) * 1.10; // 10% load penalty factor
    const totalIdleLiters = (totalDurationSeconds / 3600) * this.simIdleLitersPerHour;
    const totalFuelLiters = Math.round((totalDrivingLiters + totalIdleLiters) * 100) / 100;
    const totalCostPhp = Math.round(totalFuelLiters * this.simPricePerLiter);

    const effectiveTruckId = truckId || 'TRUCK-DANAO-01';
    const dateStr = new Date().toISOString().slice(0, 10);
    this.currentActiveTripId = `${effectiveTruckId}-${driverId}-${dateStr}`;
    this.activeTripPoints = [];

    const initialHeading = calculateBearing(
      route[0].latitude,
      route[0].longitude,
      route[1]?.latitude || route[0].latitude,
      route[1]?.longitude || route[0].longitude
    );

    this.simulationState = {
      isActive: true,
      currentStep: 1,
      totalSteps: route.length,
      currentSpeedKph: route[0].speed || 24,
      currentCoordinate: { latitude: route[0].latitude, longitude: route[0].longitude },
      locationName: route[0].name || `Brgy. ${targetBarangay} Route`,
      barangay: targetBarangay,
      truckId: effectiveTruckId,
      driverId,
      heading: initialHeading,
      speedMultiplier: this.speedMultiplier,
      elapsedDurationSeconds: 0,
      totalDurationSeconds,
      remainingDurationSeconds: totalDurationSeconds,
      distanceTraveledKm: 0,
      totalDistanceKm: Math.round(totalDistKm * 100) / 100,
      progressPercent: 0,
      fuelBurnedLiters: 0,
      totalEstimatedFuelLiters: totalFuelLiters,
      fuelCostBurnedPhp: 0,
      totalEstimatedCostPhp: totalCostPhp,
      fuelBurnRateKmPerLiter: this.simDieselKmPerLiter,
    };
    this.notifySimulationListeners();

    // Emit first telemetry point immediately
    await this.emitSimulationPoint(
      driverId,
      effectiveTruckId,
      route[0],
      route[1] || route[0],
      context,
      targetBarangay,
      route.length,
      this.simulationState
    );

    // 1-Second Continuous Interval Engine (1:1 Ratio Ticker)
    this.simulationInterval = setInterval(async () => {
      // Advance simulated time by (1.0s * speedMultiplier)
      const simAdvance = 1.0 * this.speedMultiplier;
      this.simElapsedSeconds += simAdvance;

      if (this.simElapsedSeconds >= this.simTotalDurationSeconds) {
        console.log(`🎉 1:1 GPS Simulation completed full ${totalDurationSeconds}s drive for driver: ${driverId}`);
        await this.completeSimulation(driverId, effectiveTruckId, targetBarangay, route.length);
        return;
      }

      const progress = Math.min(1, this.simElapsedSeconds / this.simTotalDurationSeconds);
      const targetDist = progress * totalDistKm;

      // Locate enclosing segment along cumulative distances
      let segIdx = 0;
      for (let i = 0; i < cumDist.length - 1; i++) {
        if (targetDist >= cumDist[i] && targetDist <= cumDist[i + 1]) {
          segIdx = i;
          break;
        }
        if (targetDist > cumDist[i + 1]) {
          segIdx = i + 1;
        }
      }
      segIdx = Math.min(segIdx, route.length - 2);

      const p1 = route[segIdx];
      const p2 = route[segIdx + 1] || p1;
      const segSpan = (cumDist[segIdx + 1] - cumDist[segIdx]) || 0.0001;
      const t = Math.max(0, Math.min(1, (targetDist - cumDist[segIdx]) / segSpan));

      const curLat = p1.latitude + (p2.latitude - p1.latitude) * t;
      const curLng = p1.longitude + (p2.longitude - p1.longitude) * t;
      const heading = calculateBearing(curLat, curLng, p2.latitude, p2.longitude);

      // Realistic speed variations around segment target speed
      const baseSpeed = p1.speed || 24;
      const speedKph = Math.max(14, Math.min(48, Math.round(baseSpeed + Math.sin(this.simElapsedSeconds * 0.2) * 4)));

      // Live fuel consumption calculations
      const curDistKm = Math.min(totalDistKm, targetDist);
      const drivingLiters = (curDistKm / this.simDieselKmPerLiter) * 1.10;
      const idleLiters = (this.simElapsedSeconds / 3600) * this.simIdleLitersPerHour;
      const fuelBurnedLiters = Math.min(totalFuelLiters, Math.round((drivingLiters + idleLiters) * 100) / 100);
      const fuelCostBurnedPhp = Math.round(fuelBurnedLiters * this.simPricePerLiter);
      const remainingSec = Math.max(0, Math.round(this.simTotalDurationSeconds - this.simElapsedSeconds));
      const progressPct = Math.min(100, Math.round(progress * 100));

      this.simulationState = {
        isActive: true,
        currentStep: segIdx + 1,
        totalSteps: route.length,
        currentSpeedKph: speedKph,
        currentCoordinate: { latitude: curLat, longitude: curLng },
        locationName: p1.name || `Waypoint ${segIdx + 1}`,
        barangay: targetBarangay,
        truckId: effectiveTruckId,
        driverId,
        heading,
        speedMultiplier: this.speedMultiplier,
        elapsedDurationSeconds: Math.round(this.simElapsedSeconds),
        totalDurationSeconds: this.simTotalDurationSeconds,
        remainingDurationSeconds: remainingSec,
        distanceTraveledKm: Math.round(curDistKm * 100) / 100,
        totalDistanceKm: Math.round(totalDistKm * 100) / 100,
        progressPercent: progressPct,
        fuelBurnedLiters,
        totalEstimatedFuelLiters: totalFuelLiters,
        fuelCostBurnedPhp,
        totalEstimatedCostPhp: totalCostPhp,
        fuelBurnRateKmPerLiter: this.simDieselKmPerLiter,
      };

      // Update in-app listeners every 1 second (super responsive)
      this.notifySimulationListeners();

      // Throttle remote Firestore writes to every 6 seconds to prevent exceeding rate limits and preserve quota
      const now = Date.now();
      if (
        !this.simIsWriting &&
        now >= this.firestoreBackoffUntil &&
        now - this.simLastFirestoreWrite >= 6000
      ) {
        this.simLastFirestoreWrite = now;
        this.simIsWriting = true;
        const currentSimPt = {
          latitude: curLat,
          longitude: curLng,
          name: p1.name,
          speed: speedKph,
          barangay: p1.barangay || targetBarangay,
        };
        this.emitSimulationPoint(
          driverId,
          effectiveTruckId,
          currentSimPt,
          p2,
          context,
          targetBarangay,
          route.length,
          this.simulationState
        )
          .catch((err: any) => {
            if (err?.code === 'resource-exhausted' || String(err?.message).includes('backoff')) {
              this.firestoreBackoffUntil = Date.now() + 30000;
            }
          })
          .finally(() => {
            this.simIsWriting = false;
          });
      }
    }, 1000);

    console.log(
      `🚀 Started 1:1 GPS Simulation (${this.speedMultiplier}x speed) for Driver: ${driverId} in Brgy. ${targetBarangay} ` +
      `[Total: ${Math.round(totalDistKm * 10) / 10} km · ${Math.round(totalDurationSeconds / 60)} min drive · Est. Fuel: ${totalFuelLiters} L / ₱${totalCostPhp}]`
    );
  }

  public async completeSimulation(driverId: string, truckId: string, barangay: string, totalSteps: number) {
    if (this.simulationInterval) {
      clearInterval(this.simulationInterval);
      this.simulationInterval = null;
    }

    const totalEstFuel = this.simulationState.totalEstimatedFuelLiters || 1.5;
    const totalEstCost = this.simulationState.totalEstimatedCostPhp || 90;
    const totalDist = this.simulationState.totalDistanceKm || 4.0;
    const totalDuration = this.simulationState.totalDurationSeconds || 600;

    this.simulationState = {
      isActive: false,
      currentStep: totalSteps,
      totalSteps,
      currentSpeedKph: 0,
      currentCoordinate: null,
      locationName: 'Route Completed',
      truckId,
      driverId,
      heading: 0,
      speedMultiplier: this.speedMultiplier,
      elapsedDurationSeconds: totalDuration,
      totalDurationSeconds: totalDuration,
      remainingDurationSeconds: 0,
      distanceTraveledKm: totalDist,
      totalDistanceKm: totalDist,
      progressPercent: 100,
      fuelBurnedLiters: totalEstFuel,
      totalEstimatedFuelLiters: totalEstFuel,
      fuelCostBurnedPhp: totalEstCost,
      totalEstimatedCostPhp: totalEstCost,
      fuelBurnRateKmPerLiter: this.simDieselKmPerLiter,
    };
    this.notifySimulationListeners();

    if (db) {
      try {
        const truckRef = doc(db, 'truck_locations', driverId);
        await setDoc(truckRef, {
          status: 'completed',
          lastUpdate: serverTimestamp(),
          isSimulation: false,
        }, { merge: true });

        // Update persistent fleet_trips document
        if (this.currentActiveTripId) {
          const tripRef = doc(db, 'fleet_trips', this.currentActiveTripId);
          await setDoc(tripRef, {
            id: this.currentActiveTripId,
            tripId: this.currentActiveTripId,
            driverId,
            truckId,
            barangay,
            status: 'completed',
            completedSteps: totalSteps,
            totalSteps,
            completionPercentage: 100,
            endTime: new Date().toISOString(),
            points: this.activeTripPoints,
            totalPoints: this.activeTripPoints.length,
            totalDistanceKm: totalDist,
            totalFuelLiters: totalEstFuel,
            totalDurationSeconds: totalDuration,
            lastUpdate: serverTimestamp(),
            updatedAt: serverTimestamp(),
          }, { merge: true });
        }

        // Record completed trip event in client_activity
        await addDoc(collection(db, 'client_activity'), {
          type: 'client',
          event: 'fleet.trip_completed',
          tripId: this.currentActiveTripId || dailyTripId(driverId, truckId),
          driverId,
          truckId,
          barangay,
          totalSteps,
          completedSteps: totalSteps,
          completionPercentage: 100,
          status: 'completed',
          totalDistanceKm: totalDist,
          totalFuelLiters: totalEstFuel,
          recordedAtClient: new Date().toISOString(),
          createdAt: serverTimestamp(),
        });
      } catch (err) {
        console.warn('Error completing simulation in Firestore:', err);
      }
    }
  }

  public async stopSimulation(driverId?: string, reason = 'manual_stop') {
    if (this.simulationInterval) {
      clearInterval(this.simulationInterval);
      this.simulationInterval = null;
    }

    const targetDriver = driverId || this.simulationState.driverId;
    const prevStep = this.simulationState.currentStep;
    const totalSteps = this.simulationState.totalSteps;
    const truckId = this.simulationState.truckId;
    const barangay = this.simulationState.barangay || 'Poblacion';
    const lastCoord = this.simulationState.currentCoordinate;
    const lastLocName = this.simulationState.locationName;
    const currentDist = this.simulationState.distanceTraveledKm;
    const currentFuel = this.simulationState.fuelBurnedLiters;

    this.simulationState = {
      isActive: false,
      currentStep: 0,
      totalSteps: 0,
      currentSpeedKph: 0,
      currentCoordinate: null,
      locationName: '',
      truckId: '',
      driverId: '',
      heading: 0,
      speedMultiplier: 1,
      elapsedDurationSeconds: 0,
      totalDurationSeconds: 600,
      remainingDurationSeconds: 600,
      distanceTraveledKm: 0,
      totalDistanceKm: 0,
      progressPercent: 0,
      fuelBurnedLiters: 0,
      totalEstimatedFuelLiters: 0,
      fuelCostBurnedPhp: 0,
      totalEstimatedCostPhp: 0,
      fuelBurnRateKmPerLiter: 3.2,
    };
    this.notifySimulationListeners();

    if (targetDriver && db) {
      try {
        const truckRef = doc(db, 'truck_locations', targetDriver);
        await setDoc(truckRef, { status: 'inactive', lastUpdate: serverTimestamp() }, { merge: true });

        // Update persistent fleet_trips document
        if (this.currentActiveTripId) {
          const tripRef = doc(db, 'fleet_trips', this.currentActiveTripId);
          await setDoc(tripRef, {
            id: this.currentActiveTripId,
            tripId: this.currentActiveTripId,
            driverId: targetDriver,
            truckId,
            barangay,
            status: prevStep >= totalSteps && totalSteps > 0 ? 'completed' : 'stopped_early',
            completedSteps: prevStep,
            totalSteps,
            completionPercentage: totalSteps > 0 ? Math.round((prevStep / totalSteps) * 100) : 0,
            endTime: new Date().toISOString(),
            reason,
            points: this.activeTripPoints,
            totalPoints: this.activeTripPoints.length,
            distanceTraveledKm: currentDist,
            fuelBurnedLiters: currentFuel,
            lastUpdate: serverTimestamp(),
            updatedAt: serverTimestamp(),
          }, { merge: true });
        }

        if (prevStep > 0 && prevStep < totalSteps) {
          // Record stopped early trip event in client_activity
          await addDoc(collection(db, 'client_activity'), {
            type: 'client',
            event: 'fleet.trip_interrupted',
            tripId: this.currentActiveTripId || dailyTripId(targetDriver, truckId),
            driverId: targetDriver,
            truckId,
            barangay,
            totalSteps,
            completedSteps: prevStep,
            completionPercentage: Math.round((prevStep / Math.max(1, totalSteps)) * 100),
            status: 'stopped_early',
            reason,
            lastLocation: lastCoord,
            lastLocationName: lastLocName,
            distanceTraveledKm: currentDist,
            fuelBurnedLiters: currentFuel,
            recordedAtClient: new Date().toISOString(),
            createdAt: serverTimestamp(),
          });
        }
      } catch {}
    }

    console.log('🛑 Stopped GPS movement simulation');
  }

  private async emitSimulationPoint(
    driverId: string,
    truckId: string,
    currentPoint: { latitude: number; longitude: number; name?: string; speed?: number; barangay?: string },
    nextPoint: { latitude: number; longitude: number },
    context: FleetTrackingContext,
    assignedBarangay?: string,
    totalStepsCount = 47,
    simState?: SimulationState
  ) {
    if (!db) return;

    const heading = calculateBearing(
      currentPoint.latitude,
      currentPoint.longitude,
      nextPoint.latitude,
      nextPoint.longitude
    );
    const speedKph = currentPoint.speed || 24;
    const speedMps = speedKph / 3.6;

    const mockCoords: Location.LocationObjectCoords = {
      latitude: currentPoint.latitude,
      longitude: currentPoint.longitude,
      altitude: 12,
      accuracy: 5,
      altitudeAccuracy: 5,
      heading,
      speed: speedMps,
    };

    // Append to in-memory trip points array
    const ptRecord = {
      id: `pt-${this.activeTripPoints.length + 1}-${Date.now()}`,
      step: this.activeTripPoints.length + 1,
      latitude: currentPoint.latitude,
      longitude: currentPoint.longitude,
      speedKph,
      heading,
      locationName: currentPoint.name || `Waypoint ${this.activeTripPoints.length + 1}`,
      timestampMs: Date.now(),
      recordedAt: new Date().toISOString(),
    };
    this.activeTripPoints.push(ptRecord);

    // 1. Update live truck marker in Firestore (every 6s)
    try {
      const truckRef = doc(db, 'truck_locations', driverId);
      await setDoc(truckRef, {
        driverId,
        truckId,
        lat: currentPoint.latitude,
        lng: currentPoint.longitude,
        speed: speedMps,
        speedKph,
        heading,
        status: 'active',
        barangay: assignedBarangay || currentPoint.barangay || 'Poblacion',
        locationName: currentPoint.name || `Brgy. ${assignedBarangay || 'Poblacion'} Route`,
        isSimulation: true,
        speedMultiplier: simState?.speedMultiplier || this.speedMultiplier,
        elapsedDurationSeconds: simState?.elapsedDurationSeconds || 0,
        totalDurationSeconds: simState?.totalDurationSeconds || 600,
        remainingDurationSeconds: simState?.remainingDurationSeconds || 600,
        distanceTraveledKm: simState?.distanceTraveledKm || 0,
        totalDistanceKm: simState?.totalDistanceKm || 0,
        progressPercent: simState?.progressPercent || 0,
        fuelBurnedLiters: simState?.fuelBurnedLiters || 0,
        totalEstimatedFuelLiters: simState?.totalEstimatedFuelLiters || 0,
        fuelCostBurnedPhp: simState?.fuelCostBurnedPhp || 0,
        totalEstimatedCostPhp: simState?.totalEstimatedCostPhp || 0,
        recentTrail: this.activeTripPoints.slice(-40).map((p) => ({
          latitude: p.latitude,
          longitude: p.longitude,
        })),
        lastUpdate: serverTimestamp(),
      }, { merge: true });
    } catch (err: any) {
      if (err?.code === 'resource-exhausted') {
        this.firestoreBackoffUntil = Date.now() + 30000;
      }
      console.warn('Simulation truck_locations update note:', err?.message || err);
    }

    // 2. Persist to fleet_trips document in Firestore only periodically (every 30 seconds) to avoid quota exhaustion
    const now = Date.now();
    if (this.currentActiveTripId && (now - this.simLastTripPersist >= 30000)) {
      this.simLastTripPersist = now;
      try {
        const tripRef = doc(db, 'fleet_trips', this.currentActiveTripId);
        await setDoc(tripRef, {
          id: this.currentActiveTripId,
          tripId: this.currentActiveTripId,
          driverId,
          truckId,
          barangay: assignedBarangay || currentPoint.barangay || 'Poblacion',
          status: 'in_progress',
          startTime: this.activeTripPoints[0]?.recordedAt || new Date().toISOString(),
          totalSteps: totalStepsCount,
          completedSteps: this.activeTripPoints.length,
          completionPercentage: Math.round((this.activeTripPoints.length / Math.max(1, totalStepsCount)) * 100),
          points: this.activeTripPoints,
          totalPoints: this.activeTripPoints.length,
          distanceTraveledKm: simState?.distanceTraveledKm || 0,
          fuelBurnedLiters: simState?.fuelBurnedLiters || 0,
          lastUpdate: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }, { merge: true });
      } catch (err: any) {
        if (err?.code === 'resource-exhausted') {
          this.firestoreBackoffUntil = Date.now() + 30000;
        }
        console.warn('Simulation fleet_trips write note:', err?.message || err);
      }
    }
  }

  private async writeTripPoint(
    driverId: string,
    truckId: string,
    coords: Location.LocationObjectCoords,
    context: FleetTrackingContext,
    isSimulation = false,
    pointBarangay?: string
  ) {
    if (!db) return;
    const now = Date.now();
    const coordinate = { latitude: coords.latitude, longitude: coords.longitude };
    const movedMeters = this.lastHistoryCoordinate ? distanceMeters(this.lastHistoryCoordinate, coordinate) : Number.POSITIVE_INFINITY;
    
    // Throttle writing permanent trail points to client_activity only for real GPS (not simulation)
    if (!isSimulation && (now - this.lastHistoryAt < 20_000 && movedMeters < 30)) return;
    this.lastHistoryAt = now;
    this.lastHistoryCoordinate = coordinate;

    const speedKph = Math.max(0, Number(coords.speed || 0) * 3.6);
    const deviationMeters = distanceFromRouteMeters(coordinate, context.routePolyline);
    
    const payload: any = {
      event: 'fleet.location',
      actorUid: driverId,
      driverId,
      truckId,
      tripId: dailyTripId(driverId, truckId),
      activeScheduleIds: context.activeScheduleIds || [],
      location: { lat: coords.latitude, lng: coords.longitude },
      speedKph: Number(speedKph.toFixed(1)),
      heading: coords.heading || 0,
      accuracyMeters: coords.accuracy || 5,
      deviationMeters: deviationMeters === null ? null : Math.round(deviationMeters),
      source: isSimulation ? 'driver-gps-simulator' : 'driver-gps',
      isSimulation: !!isSimulation,
      recordedAtClient: new Date(now).toISOString(),
      createdAt: serverTimestamp(),
    };

    if (pointBarangay) {
      payload.metadata = { barangay: pointBarangay };
    }

    try {
      await addDoc(collection(db, 'client_activity'), { ...payload, type: 'client' });
    } catch (err) {
      console.warn('Error writing trip point to client_activity:', err);
    }

    // Record only a uniquely attributed real trip. Never duplicate a whole
    // shift's distance across several concurrent route assignments.
    const scheduleIds = context.activeScheduleIds || [];
    if (!isSimulation && scheduleIds.length === 1) {
      try {
        await addDoc(collection(db, 'diesel_gps', scheduleIds[0], 'points'), {
          latitude: coords.latitude, longitude: coords.longitude, timestampMs: now,
          accuracyMeters: coords.accuracy ?? 10000, isSimulation: false,
          driverId, createdAt: serverTimestamp(),
        });
      } catch (error) {
        console.warn('Diesel trip GPS point was not saved:', error);
      }
    }

    this.lastHistoryAt = now;
    this.lastHistoryCoordinate = coordinate;

    if (speedKph >= 60) {
      await this.writeOperationalAlert('speeding', driverId, truckId, {
        speedKph: Number(speedKph.toFixed(1)),
        thresholdKph: 60,
        location: { lat: coords.latitude, lng: coords.longitude },
        barangay: pointBarangay,
      });
    }

    if (deviationMeters !== null && deviationMeters >= 500) {
      this.deviationSamples += 1;
    } else {
      this.deviationSamples = 0;
    }

    if (this.deviationSamples >= 3) {
      await this.writeOperationalAlert('route-deviation', driverId, truckId, {
        deviationMeters: Math.round(deviationMeters || 0),
        thresholdMeters: 500,
        location: { lat: coords.latitude, lng: coords.longitude },
        barangay: pointBarangay,
      });
      this.deviationSamples = 0;
    }
  }

  private async writeOperationalAlert(type: string, driverId: string, truckId: string, metadata: Record<string, unknown>) {
    if (!db) return;
    const now = Date.now();
    if (now - (this.lastAlertAt[type] || 0) < 5 * 60 * 1000) return;
    try {
      const alertPayload = {
        type: 'client',
        event: 'fleet.alert',
        alertType: type,
        severity: type === 'route-deviation' ? 'high' : 'medium',
        actorUid: driverId,
        driverId,
        truckId,
        tripId: dailyTripId(driverId, truckId),
        metadata,
        source: 'driver-gps',
        recordedAtClient: new Date(now).toISOString(),
        createdAt: serverTimestamp(),
      };
      await addDoc(collection(db, 'client_activity'), alertPayload);
      this.lastAlertAt[type] = now;
    } catch (err) {
      console.warn('Error writing fleet alert to client_activity:', err);
    }
  }

  private async updateLocationInFirestore(driverId: string, truckId: string, coords: Location.LocationObjectCoords, context: FleetTrackingContext) {
    if (!db) return;
    
    try {
      const truckRef = doc(db, 'truck_locations', driverId);
      const truckBarangay = context.barangay || context.assignedBarangay;
      const speedKph = coords.speed ? Math.round(coords.speed * 3.6) : 0;
      await setDoc(
        truckRef,
        {
          driverId,
          truckId,
          lat: coords.latitude,
          lng: coords.longitude,
          speed: coords.speed,
          speedKph,
          heading: coords.heading || 0,
          lastUpdate: serverTimestamp(),
          status: 'active',
          ...(truckBarangay ? { barangay: truckBarangay } : {}),
        },
        { merge: true }
      );
      await this.writeTripPoint(driverId, truckId, coords, context, false);
    } catch (error) {
      console.error('Error updating location in Firestore:', error);
    }
  }
}

export const locationService = new LocationService();
export default locationService;
