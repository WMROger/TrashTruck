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

class LocationService {
  private locationSubscription: Location.LocationSubscription | null = null;
  private isTracking = false;
  private retryTimeout: ReturnType<typeof setTimeout> | null = null;
  private maxRetries = 3;
  private lastHistoryAt = 0;
  private lastHistoryCoordinate: { latitude: number; longitude: number } | null = null;
  private deviationSamples = 0;
  private lastAlertAt: Record<string, number> = {};

  // Simulation state
  private simulationInterval: ReturnType<typeof setInterval> | null = null;
  private simulationListeners: Array<(state: SimulationState) => void> = [];
  private simulationState: SimulationState = {
    isActive: false,
    currentStep: 0,
    totalSteps: 0,
    currentSpeedKph: 0,
    currentCoordinate: null,
    locationName: '',
    truckId: '',
    driverId: '',
  };

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

  async stopTracking(driverId: string) {
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

    // Mark as inactive in Firestore
    try {
      if (db && driverId) {
        const truckRef = doc(db, 'truck_locations', driverId);
        await setDoc(truckRef, {
          status: 'inactive',
          lastUpdate: serverTimestamp(),
        }, { merge: true });
        console.log('Stopped live GPS tracking for driver:', driverId);
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
  // SIMULATION ENGINE (Driver-Side Movement Simulator)
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

  /**
   * Starts a real-time GPS simulation driving along Danao City routes for a specific Barangay.
   * Telemetry is written directly to Firestore so CICTO & CENRO dashboards update live.
   */
  public async startSimulation(
    driverId: string,
    truckId: string,
    barangayOrRoute?: string | SimulationWaypoint[],
    context: FleetTrackingContext = {}
  ) {
    if (this.simulationInterval) {
      this.stopSimulation(driverId);
    }

    let route: SimulationWaypoint[];
    let targetBarangay = 'Poblacion';

    if (Array.isArray(barangayOrRoute) && barangayOrRoute.length >= 2) {
      route = barangayOrRoute;
      // Use the most common non-Poblacion barangay in the route as the assigned sector
      const routeBarangays = barangayOrRoute.map(wp => wp.barangay).filter(b => b && b !== 'Poblacion');
      targetBarangay = routeBarangays[0] || barangayOrRoute[0]?.barangay || 'Poblacion';
    } else if (typeof barangayOrRoute === 'string' && barangayOrRoute.trim()) {
      targetBarangay = barangayOrRoute.trim();
      route = await getRoadSnappedSimulationRoute(targetBarangay);
    } else {
      route = await getRoadSnappedSimulationRoute('Poblacion');
    }

    const effectiveTruckId = truckId || 'TRUCK-DANAO-01';
    let currentIndex = 0;

    this.simulationState = {
      isActive: true,
      currentStep: 1,
      totalSteps: route.length,
      currentSpeedKph: route[0].speed || 25,
      currentCoordinate: { latitude: route[0].latitude, longitude: route[0].longitude },
      locationName: route[0].name || `Brgy. ${targetBarangay} Route`,
      barangay: targetBarangay,
      truckId: effectiveTruckId,
      driverId,
    };
    this.notifySimulationListeners();

    // Emit first point immediately
    await this.emitSimulationPoint(driverId, effectiveTruckId, route[0], route[1] || route[0], context, targetBarangay);

    // Step every 3.5 seconds
    this.simulationInterval = setInterval(async () => {
      currentIndex += 1;
      if (currentIndex >= route.length) {
        // Loop or complete
        currentIndex = 0;
      }

      const currentPoint = route[currentIndex];
      const nextPoint = route[(currentIndex + 1) % route.length];
      const speed = currentPoint.speed || Math.floor(Math.random() * 12) + 25;

      this.simulationState = {
        isActive: true,
        currentStep: currentIndex + 1,
        totalSteps: route.length,
        currentSpeedKph: speed,
        currentCoordinate: { latitude: currentPoint.latitude, longitude: currentPoint.longitude },
        locationName: currentPoint.name || `Waypoint ${currentIndex + 1}`,
        barangay: targetBarangay,
        truckId: effectiveTruckId,
        driverId,
      };
      this.notifySimulationListeners();

      await this.emitSimulationPoint(driverId, effectiveTruckId, currentPoint, nextPoint, context, targetBarangay);
    }, 3500);

    console.log(`🚀 Started GPS movement simulation for Driver: ${driverId} in Brgy. ${targetBarangay} (Truck: ${effectiveTruckId})`);
  }

  public async stopSimulation(driverId?: string) {
    if (this.simulationInterval) {
      clearInterval(this.simulationInterval);
      this.simulationInterval = null;
    }

    const targetDriver = driverId || this.simulationState.driverId;

    this.simulationState = {
      isActive: false,
      currentStep: 0,
      totalSteps: 0,
      currentSpeedKph: 0,
      currentCoordinate: null,
      locationName: '',
      truckId: '',
      driverId: '',
    };
    this.notifySimulationListeners();

    if (targetDriver && db) {
      try {
        const truckRef = doc(db, 'truck_locations', targetDriver);
        await setDoc(truckRef, { status: 'inactive', lastUpdate: serverTimestamp() }, { merge: true });
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
    assignedBarangay?: string
  ) {
    if (!db) return;

    const heading = calculateBearing(
      currentPoint.latitude,
      currentPoint.longitude,
      nextPoint.latitude,
      nextPoint.longitude
    );
    const speedKph = currentPoint.speed || 32;
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

    // 1. Update live truck marker (isolated try-catch)
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
        lastUpdate: serverTimestamp(),
      }, { merge: true });
    } catch (err) {
      console.warn('Simulation truck_locations update note:', err);
    }

    // 2. Append to client_activity trip points (isolated try-catch)
    try {
      await this.writeTripPoint(driverId, truckId, mockCoords, context, true, currentPoint.barangay);
    } catch (err) {
      console.warn('Simulation client_activity write note:', err);
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
    
    // Throttle writing permanent trail points to client_activity to at most once every 25 seconds
    if (now - this.lastHistoryAt < 25_000 && (!isSimulation && movedMeters < 50)) return;
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
      recordedAtClient: new Date(now).toISOString(),
      createdAt: serverTimestamp(),
    };

    if (pointBarangay) {
      payload.metadata = { barangay: pointBarangay };
    }

    try {
      await addDoc(collection(db, 'client_activity'), payload);
      try {
        await addDoc(collection(db, 'audit_logs'), { ...payload, type: 'client' });
      } catch {}
    } catch (err) {
      console.warn('Error writing trip point to client_activity:', err);
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
      try {
        await addDoc(collection(db, 'audit_logs'), alertPayload);
      } catch {}
      this.lastAlertAt[type] = now;
    } catch (err) {
      console.warn('Error writing fleet alert to client_activity:', err);
    }
  }

  private async updateLocationInFirestore(driverId: string, truckId: string, coords: Location.LocationObjectCoords, context: FleetTrackingContext) {
    if (!db) return;
    
    try {
      const truckRef = doc(db, 'truck_locations', driverId);
      await setDoc(truckRef, {
        driverId,
        truckId,
        lat: coords.latitude,
        lng: coords.longitude,
        speed: coords.speed,
        heading: coords.heading,
        lastUpdate: serverTimestamp(),
        status: 'active',
      });
      await this.writeTripPoint(driverId, truckId, coords, context, false);
    } catch (error) {
      console.error('Error updating location in Firestore:', error);
    }
  }
}

export const locationService = new LocationService();
export default locationService;
