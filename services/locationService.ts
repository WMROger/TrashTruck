import * as Location from 'expo-location';
import { addDoc, collection, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { dailyTripId, distanceFromRouteMeters, distanceMeters, FleetTrackingContext } from '@/services/fleetMonitoringService';

class LocationService {
  private locationSubscription: Location.LocationSubscription | null = null;
  private isTracking = false;
  private retryTimeout: ReturnType<typeof setTimeout> | null = null;
  private maxRetries = 3;
  private lastHistoryAt = 0;
  private lastHistoryCoordinate: { latitude: number; longitude: number } | null = null;
  private deviationSamples = 0;
  private lastAlertAt: Record<string, number> = {};

  async startTracking(driverId: string, truckId: string, context: FleetTrackingContext = {}) {
    if (!driverId || !truckId) {
      console.warn('GPS tracking requires both an authenticated driver and an assigned truck.');
      return;
    }
    if (this.isTracking) return;

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

      // Start watching location — this is more resilient than getCurrentPositionAsync
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
      if (db) {
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

  private async writeTripPoint(
    driverId: string,
    truckId: string,
    coords: Location.LocationObjectCoords,
    context: FleetTrackingContext,
  ) {
    const now = Date.now();
    const coordinate = { latitude: coords.latitude, longitude: coords.longitude };
    const movedMeters = this.lastHistoryCoordinate ? distanceMeters(this.lastHistoryCoordinate, coordinate) : Number.POSITIVE_INFINITY;
    if (now - this.lastHistoryAt < 30_000 && movedMeters < 50) return;

    const speedKph = Math.max(0, Number(coords.speed || 0) * 3.6);
    const deviationMeters = distanceFromRouteMeters(coordinate, context.routePolyline);
    await addDoc(collection(db, 'client_activity'), {
      event: 'fleet.location',
      actorUid: driverId,
      driverId,
      truckId,
      tripId: dailyTripId(driverId, truckId),
      activeScheduleIds: context.activeScheduleIds || [],
      location: { lat: coords.latitude, lng: coords.longitude },
      speedKph: Number(speedKph.toFixed(1)),
      heading: coords.heading,
      accuracyMeters: coords.accuracy,
      deviationMeters: deviationMeters === null ? null : Math.round(deviationMeters),
      source: 'driver-gps',
      recordedAtClient: new Date(now).toISOString(),
      createdAt: serverTimestamp(),
    });
    this.lastHistoryAt = now;
    this.lastHistoryCoordinate = coordinate;

    if (speedKph >= 60) await this.writeOperationalAlert('speeding', driverId, truckId, {
      speedKph: Number(speedKph.toFixed(1)),
      thresholdKph: 60,
      location: { lat: coords.latitude, lng: coords.longitude },
    });

    if (deviationMeters !== null && deviationMeters >= 500) this.deviationSamples += 1;
    else this.deviationSamples = 0;
    if (this.deviationSamples >= 3) {
      await this.writeOperationalAlert('route-deviation', driverId, truckId, {
        deviationMeters: Math.round(deviationMeters || 0),
        thresholdMeters: 500,
        location: { lat: coords.latitude, lng: coords.longitude },
      });
      this.deviationSamples = 0;
    }
  }

  private async writeOperationalAlert(type: string, driverId: string, truckId: string, metadata: Record<string, unknown>) {
    const now = Date.now();
    if (now - (this.lastAlertAt[type] || 0) < 5 * 60 * 1000) return;
    await addDoc(collection(db, 'client_activity'), {
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
    });
    this.lastAlertAt[type] = now;
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
      await this.writeTripPoint(driverId, truckId, coords, context);
    } catch (error) {
      console.error('Error updating location in Firestore:', error);
    }
  }
}

export const locationService = new LocationService();
export default locationService;
