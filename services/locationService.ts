import * as Location from 'expo-location';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/config/firebase';

class LocationService {
  private locationSubscription: Location.LocationSubscription | null = null;
  private isTracking = false;
  private retryTimeout: ReturnType<typeof setTimeout> | null = null;
  private maxRetries = 3;

  async startTracking(driverId: string, truckId: string = 'truck-1') {
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
        this.scheduleRetry(driverId, truckId, 0);
        return;
      }

      this.isTracking = true;

      // Try to get initial location with fallback
      try {
        const initialLocation = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        await this.updateLocationInFirestore(driverId, truckId, initialLocation.coords);
      } catch (initialError) {
        console.warn('getCurrentPositionAsync failed, trying getLastKnownPositionAsync...');
        try {
          const lastKnown = await Location.getLastKnownPositionAsync();
          if (lastKnown) {
            await this.updateLocationInFirestore(driverId, truckId, lastKnown.coords);
          }
        } catch (fallbackError) {
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
          this.updateLocationInFirestore(driverId, truckId, location.coords);
        }
      );
      
      console.log('Started live GPS tracking for driver:', driverId);
    } catch (error) {
      console.error('Error starting location tracking:', error);
      this.isTracking = false;
      // Schedule a retry
      this.scheduleRetry(driverId, truckId, 0);
    }
  }

  private scheduleRetry(driverId: string, truckId: string, attempt: number) {
    if (attempt >= this.maxRetries) {
      console.warn(`GPS tracking: gave up after ${this.maxRetries} retries.`);
      return;
    }
    
    const delay = Math.min(5000 * Math.pow(2, attempt), 30000); // 5s, 10s, 20s
    console.log(`GPS tracking: retrying in ${delay / 1000}s (attempt ${attempt + 1}/${this.maxRetries})`);
    
    this.retryTimeout = setTimeout(() => {
      this.startTracking(driverId, truckId);
    }, delay);
  }

  async stopTracking(driverId: string) {
    // Cancel any pending retry
    if (this.retryTimeout) {
      clearTimeout(this.retryTimeout);
      this.retryTimeout = null;
    }

    if (this.locationSubscription) {
      this.locationSubscription.remove();
      this.locationSubscription = null;
    }
    this.isTracking = false;

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

  private async updateLocationInFirestore(driverId: string, truckId: string, coords: Location.LocationObjectCoords) {
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
    } catch (error) {
      console.error('Error updating location in Firestore:', error);
    }
  }
}

export const locationService = new LocationService();
export default locationService;
