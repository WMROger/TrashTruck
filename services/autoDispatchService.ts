import { db, auth } from '@/config/firebase';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  addDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { optimizeBarangayRouteWithTraffic } from './trafficAwareOptimizerService';

export interface AutoDispatchResult {
  success: boolean;
  dispatched: boolean;
  driverName?: string;
  driverId?: string;
  barangay?: string;
  message: string;
}

let cachedAutoDispatchSetting: boolean | null = null;

/**
 * Checks if autonomous AI dispatch is currently enabled.
 * Defaults to true if no configuration document exists.
 */
export async function isAutoDispatchEnabled(): Promise<boolean> {
  if (!db) return true;
  try {
    const settingRef = doc(db, 'system_settings', 'auto_dispatch');
    const snap = await getDoc(settingRef);
    if (snap.exists()) {
      const data = snap.data();
      cachedAutoDispatchSetting = data.enabled !== false;
      return cachedAutoDispatchSetting;
    }
    return true;
  } catch (error) {
    console.warn('Could not read auto_dispatch setting, defaulting to enabled:', error);
    return cachedAutoDispatchSetting ?? true;
  }
}

/**
 * Updates the global AI Auto-Dispatch toggle setting in Firestore.
 */
export async function setAutoDispatchEnabled(enabled: boolean): Promise<void> {
  cachedAutoDispatchSetting = enabled;
  if (!db) return;
  try {
    const settingRef = doc(db, 'system_settings', 'auto_dispatch');
    await setDoc(
      settingRef,
      {
        enabled,
        updatedByEmail: auth.currentUser?.email || 'admin@cenro.gov.ph',
        updatedByUid: auth.currentUser?.uid || 'cenro_admin',
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (error) {
    console.error('Error saving auto_dispatch setting:', error);
  }
}

/**
 * Automatically slots an acknowledged/verified citizen report into the active driver's live route.
 * 1. Checks if AI Auto-Dispatch is enabled.
 * 2. Checks if an active on-duty driver is assigned to the report's barangay.
 * 3. Runs the Traffic & Lowest Detour AI Optimizer to insert the waypoint into the driver's route.
 * 4. Updates or creates the live dispatch schedule in Firestore.
 * 5. Marks the report as 'in_progress' and sends a push/in-app alert to the driver.
 */
export async function autoDispatchReportToActiveRoute(report: {
  id: string;
  title?: string;
  street?: string;
  barangay?: string;
  location?: { lat?: number; lng?: number; latitude?: number; longitude?: number } | null;
  aiAnalysis?: { wasteType?: string; estimatedWeight?: string; [key: string]: any } | null;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
}): Promise<AutoDispatchResult> {
  if (!db || !report || !report.id) {
    return { success: false, dispatched: false, message: 'Invalid report data or database uninitialized.' };
  }

  const barangay = (report.barangay || '').trim();
  if (!barangay) {
    return { success: false, dispatched: false, message: 'Report has no barangay specified.' };
  }

  const isEnabled = await isAutoDispatchEnabled();
  if (!isEnabled) {
    return {
      success: true,
      dispatched: false,
      barangay,
      message: 'AI Auto-Dispatch is currently turned OFF by CENRO. Report is queued for manual dispatch.',
    };
  }

  try {
    // 1. Find active on-duty driver for this barangay
    const usersRef = collection(db, 'users');
    const qDrivers = query(
      usersRef,
      where('role', '==', 'driver')
    );
    const driversSnap = await getDocs(qDrivers);

    let activeDriver: {
      id: string;
      displayName?: string;
      currentTruckId?: string;
      currentTruckPlate?: string;
      assignedBarangay?: string;
    } | null = null;

    driversSnap.forEach((docSnap) => {
      const data = docSnap.data();
      const dBarangay = (data.assignedBarangay || data.barangay || '').trim().toLowerCase();
      const targetB = barangay.toLowerCase();
      const isBarangayMatch = dBarangay === targetB || dBarangay.includes(targetB) || targetB.includes(dBarangay);

      const isOnDuty =
        (data.dutyStatus === 'on_duty' || data.status === 'on_duty' || !!data.currentTruckId) &&
        data.dutyStatus !== 'off_duty' &&
        data.status !== 'off_duty' &&
        data.status !== 'disabled' &&
        data.status !== 'inactive';

      if (isBarangayMatch && isOnDuty && !activeDriver) {
        activeDriver = {
          id: docSnap.id,
          displayName: data.displayName || data.name || 'Assigned Driver',
          currentTruckId: data.currentTruckId || null,
          currentTruckPlate: data.currentTruckPlate || data.assignedTruckPlate || null,
          assignedBarangay: data.assignedBarangay || data.barangay || barangay,
        };
      }
    });

    if (!activeDriver) {
      // Mark report as queued for the next driver shift in this barangay
      const reportRef = doc(db, 'reports', report.id);
      await updateDoc(reportRef, {
        queuedForDriver: true,
        queuedBarangay: barangay,
        updatedAt: serverTimestamp(),
      });

      return {
        success: true,
        dispatched: false,
        barangay,
        message: `Report is acknowledged and queued for Brgy. ${barangay}. Will auto-inject when driver starts shift.`,
      };
    }

    const driverName = (activeDriver as any).displayName || 'Assigned Driver';
    const driverId = (activeDriver as any).id;
    const truckPlate = (activeDriver as any).currentTruckPlate || 'TRK-ACTIVE';

    // 2. Fetch any other existing in-progress/acknowledged reports for this barangay to optimize them together
    const reportsRef = collection(db, 'reports');
    const qReports = query(
      reportsRef,
      where('barangay', '==', barangay),
      where('status', 'in', ['acknowledged', 'in_progress', 'in-progress'])
    );
    const existingReportsSnap = await getDocs(qReports);
    const allReportsForSector: any[] = [];

    existingReportsSnap.forEach((d) => {
      if (d.id !== report.id) {
        allReportsForSector.push({ id: d.id, ...d.data() });
      }
    });
    // Add the current report
    allReportsForSector.push(report);

    // 3. Run AI Traffic & Fuel Lowest-Detour Optimization
    const optResult = optimizeBarangayRouteWithTraffic(barangay, allReportsForSector);

    // 4. Check if an active live dispatch schedule already exists for this driver today
    const schedulesRef = collection(db, 'schedules');
    const qActiveSchedule = query(
      schedulesRef,
      where('assignedDriverId', '==', driverId),
      where('status', '==', 'in_progress')
    );
    const scheduleSnap = await getDocs(qActiveSchedule);

    const today = new Date();
    const dateText = today.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

    const formattedStops = optResult.optimizedStops.map((s, idx) => ({
      order: idx + 1,
      name: s.name,
      lat: s.latitude,
      lng: s.longitude,
      type: s.stopType,
      reportId: s.reportId || null,
      timeWindow: s.optimalTimeWindow || 'Routine',
    }));

    if (!scheduleSnap.empty) {
      // Update existing live schedule
      const activeSchedDoc = scheduleSnap.docs[0];
      await updateDoc(activeSchedDoc.ref, {
        street: `Master AI Collection Route (${optResult.optimizedStops.length} Stops)`,
        wasteCategory: 'Scheduled & Citizen Reports',
        stops: formattedStops,
        'routeOptimization.stopCount': optResult.optimizedStops.length,
        'routeOptimization.optimizedDistanceKm': optResult.optimizedDistanceKm,
        'routeOptimization.fuelSavingsLiters': optResult.fuelSavingsLiters,
        'routeOptimization.timeSavingsMinutes': optResult.timeSavingsMinutes,
        'routeOptimization.roadPolyline': optResult.roadPolyline,
        updatedAt: serverTimestamp(),
      });
    } else {
      // Create new live schedule for driver
      await addDoc(schedulesRef, {
        barangay: barangay,
        street: `Master AI Collection Route (${optResult.optimizedStops.length} Stops)`,
        wasteCategory: 'Scheduled & Citizen Reports',
        timeText: 'Active Route Sequence',
        dateText: dateText,
        status: 'in_progress',
        driver: driverName,
        assignedDriverId: driverId,
        truckId: (activeDriver as any).currentTruckId || null,
        truckPlate: truckPlate,
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
        stops: formattedStops,
        createdByUid: auth.currentUser?.uid || 'system_auto_dispatch',
        createdAt: serverTimestamp(),
      });
    }

    // 5. Update the report document status to 'in-progress'
    const reportRef = doc(db, 'reports', report.id);
    await updateDoc(reportRef, {
      status: 'in-progress',
      assignedDriverId: driverId,
      assignedDriverName: driverName,
      assignedTruckPlate: truckPlate,
      queuedForDriver: false,
      dispatchedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    // 6. Send push & in-app audible notification to driver
    try {
      await addDoc(collection(db, 'notifications'), {
        userId: driverId,
        type: 'route_waypoint_added',
        title: '🚨 New Pickup Added to Route',
        message: `A verified citizen report (${report.title || 'Trash Report'} at ${report.street || barangay}) was automatically added to your active route at lowest detour.`,
        reportId: report.id,
        barangay: barangay,
        read: false,
        createdAt: serverTimestamp(),
      });
    } catch (notifErr) {
      console.warn('Could not dispatch driver in-app notification:', notifErr);
    }

    // 7. Record audit activity
    try {
      await addDoc(collection(db, 'client_activity'), {
        action: 'Report Auto-Dispatched to Driver',
        category: 'dispatch',
        description: `Verified report at ${report.street || barangay} auto-injected into Driver ${driverName}'s active route (${truckPlate}).`,
        targetId: report.id,
        userEmail: auth.currentUser?.email || 'ai_dispatcher@trashtrack.gov.ph',
        timestamp: serverTimestamp(),
      });
    } catch (auditErr) {
      console.warn('Audit activity log warning:', auditErr);
    }

    return {
      success: true,
      dispatched: true,
      driverName,
      driverId,
      barangay,
      message: `Auto-dispatched to ${driverName} in Brgy. ${barangay} with smart detour route insertion.`,
    };
  } catch (error: any) {
    console.error('Error during auto-dispatch:', error);
    return {
      success: false,
      dispatched: false,
      barangay,
      message: `Failed to auto-dispatch: ${error?.message || error}`,
    };
  }
}

/**
 * Automatically bundles all waiting/queued verified reports for a barangay into a driver's initial shift schedule.
 * Called immediately when a driver starts their shift in select-truck.tsx.
 */
export async function autoAssignQueuedReportsOnDriverShiftStart(
  driverId: string,
  barangay: string,
  truckId?: string | null,
  truckPlate?: string | null
): Promise<{ bundledCount: number; message: string }> {
  if (!db || !driverId || !barangay) {
    return { bundledCount: 0, message: 'Invalid arguments for shift start auto-assignment.' };
  }

  const isEnabled = await isAutoDispatchEnabled();
  if (!isEnabled) {
    return { bundledCount: 0, message: 'AI Auto-Dispatch is currently turned off.' };
  }

  try {
    // 1. Query all acknowledged reports waiting in this barangay
    const reportsRef = collection(db, 'reports');
    const qQueued = query(
      reportsRef,
      where('barangay', '==', barangay),
      where('status', 'in', ['acknowledged', 'pending'])
    );
    const snap = await getDocs(qQueued);

    if (snap.empty) {
      return { bundledCount: 0, message: 'No queued reports for this barangay.' };
    }

    const queuedReports: any[] = [];
    snap.forEach((d) => {
      queuedReports.push({ id: d.id, ...d.data() });
    });

    // 2. Run AI Traffic & Detour Optimization
    const optResult = optimizeBarangayRouteWithTraffic(barangay, queuedReports);

    const today = new Date();
    const dateText = today.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

    const formattedStops = optResult.optimizedStops.map((s, idx) => ({
      order: idx + 1,
      name: s.name,
      lat: s.latitude,
      lng: s.longitude,
      type: s.stopType,
      reportId: s.reportId || null,
      timeWindow: s.optimalTimeWindow || 'Routine',
    }));

    // 3. Create/update active schedule for the driver
    const schedulesRef = collection(db, 'schedules');
    const qActiveSched = query(
      schedulesRef,
      where('assignedDriverId', '==', driverId),
      where('status', '==', 'in_progress')
    );
    const activeSchedSnap = await getDocs(qActiveSched);

    if (!activeSchedSnap.empty) {
      const activeDoc = activeSchedSnap.docs[0];
      await updateDoc(activeDoc.ref, {
        street: `Master AI Collection Route (${optResult.optimizedStops.length} Stops)`,
        wasteCategory: 'Scheduled & Citizen Reports',
        stops: formattedStops,
        'routeOptimization.stopCount': optResult.optimizedStops.length,
        'routeOptimization.optimizedDistanceKm': optResult.optimizedDistanceKm,
        'routeOptimization.fuelSavingsLiters': optResult.fuelSavingsLiters,
        'routeOptimization.timeSavingsMinutes': optResult.timeSavingsMinutes,
        'routeOptimization.roadPolyline': optResult.roadPolyline,
        updatedAt: serverTimestamp(),
      });
    } else {
      await addDoc(schedulesRef, {
        barangay,
        street: `Master AI Collection Route (${optResult.optimizedStops.length} Stops)`,
        wasteCategory: 'Scheduled & Citizen Reports',
        timeText: 'Shift Master Route',
        dateText,
        status: 'in_progress',
        assignedDriverId: driverId,
        truckId: truckId || null,
        truckPlate: truckPlate || 'TRK-01',
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
        stops: formattedStops,
        createdByUid: driverId,
        createdAt: serverTimestamp(),
      });
    }

    // 4. Update all queued reports to 'in-progress' and assign to driver
    const updatePromises = queuedReports.map((r) => {
      const rRef = doc(db, 'reports', r.id);
      return updateDoc(rRef, {
        status: 'in-progress',
        assignedDriverId: driverId,
        assignedTruckPlate: truckPlate || null,
        queuedForDriver: false,
        dispatchedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    });
    await Promise.all(updatePromises);

    // 5. Audit log
    try {
      await addDoc(collection(db, 'client_activity'), {
        action: 'Driver Shift Start Auto-Bundle',
        category: 'dispatch',
        description: `AI automatically bundled ${queuedReports.length} queued verified citizen report(s) into Driver's initial route for Brgy. ${barangay}.`,
        targetId: driverId,
        userEmail: auth.currentUser?.email || 'driver@trashtrack.gov.ph',
        timestamp: serverTimestamp(),
      });
    } catch (auditErr) {
      console.warn('Audit activity log note:', auditErr);
    }

    return {
      bundledCount: queuedReports.length,
      message: `AI bundled ${queuedReports.length} queued reports into your active route.`,
    };
  } catch (error: any) {
    console.error('Error auto-bundling queued reports on shift start:', error);
    return { bundledCount: 0, message: `Auto-bundle error: ${error?.message || error}` };
  }
}
