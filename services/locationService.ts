import * as Location from 'expo-location';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/config/firebase';

class LocationService {
  private locationSubscription: Location.LocationSubscription | null = null;
  private isTracking = false;

  async startTracking(driverId: string, truckId: string = 'truck-1') {
    if (this.isTracking) return;

    try {
      const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
      if (foregroundStatus !== 'granted') {
        console.error('Permission to access location was denied');
        return;
      }

      this.isTracking = true;

      // Initial location update
      const initialLocation = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      await this.updateLocationInFirestore(driverId, truckId, initialLocation.coords);

      // Start watching location
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
    }
  }

  async stopTracking(driverId: string) {
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
