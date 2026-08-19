import { db, auth } from '@/config/firebase';
import { collection, doc, getDoc, getDocs, query, where, addDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { optimizeBarangayRouteWithTraffic } from './trafficAwareOptimizerService';

export interface AutoDispatchResult {
  success: boolean;
  dispatched: boolean;
  driverName?: string;
  driverId?: string;
  barangay?: string;
  message: string;
}

/**
 * Automatically slots an acknowledged/verified citizen report into the active driver's live route.
 * 1. Checks if an active on-duty driver is assigned to the report's barangay.
 * 2. Runs the Traffic & Lowest Detour AI Optimizer to insert the waypoint.
 * 3. Updates or creates the live dispatch schedule in Firestore.
 * 4. Marks the report as 'in_progress' and sends a push/in-app alert to the driver.
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

  try {
    // 1. Find active on-duty driver for this barangay
    const usersRef = collection(db, 'users');
    const qDrivers = query(
      usersRef,
      where('role', '==', 'driver')
    );
    const driversSnap = await getDocs(qDrivers);

    let activeDriver: { id: string; displayName?: string; currentTruckId?: string; assignedBarangay?: string } | null = null;

    driversSnap.forEach((docSnap) => {
      const data = docSnap.data();
      const dBarangay = (data.assignedBarangay || data.barangay || '').trim().toLowerCase();
      const targetB = barangay.toLowerCase();
      const isBarangayMatch = dBarangay === targetB || dBarangay.includes(targetB) || targetB.includes(dBarangay);

      const isOnDuty = (data.dutyStatus === 'on_duty' || data.status === 'on_duty' || !!data.currentTruckId) &&
        data.dutyStatus !== 'off_duty' && data.status !== 'off_duty' && data.status !== 'disabled' && data.status !== 'inactive';

      if (isBarangayMatch && isOnDuty && !activeDriver) {
        activeDriver = {
          id: docSnap.id,
          displayName: data.displayName || data.name || 'Assigned Driver',
          currentTruckId: data.currentTruckId || null,
          assignedBarangay: data.assignedBarangay || data.barangay || barangay,
        };
      }
    });

    if (!activeDriver) {
      return {
        success: true,
        dispatched: false,
        barangay,
        message: `Report is acknowledged and queued for Brgy. ${barangay}. No active on-duty driver currently on the road for this sector.`,
      };
    }

    const driverName = (activeDriver as any).displayName || 'Assigned Driver';
    const driverId = (activeDriver as any).id;

    // 2. Fetch any other existing in-progress/acknowledged reports for this barangay to optimize them together
    const reportsRef = collection(db, 'reports');
    const qReports = query(
      reportsRef,
      where('barangay', '==', barangay),
      where('status', 'in', ['acknowledged', 'in_progress'])
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

    // 5. Update the report document status to 'in_progress'
    const reportRef = doc(db, 'reports', report.id);
    await updateDoc(reportRef, {
      status: 'in_progress',
      assignedDriverId: driverId,
      assignedDriverName: driverName,
      dispatchedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    // 6. Send push & in-app notification to driver
    try {
      await addDoc(collection(db, 'notifications'), {
        userId: driverId,
        type: 'driver_route_update',
        title: '📍 New Pickup Added to Active Route',
        message: `A verified citizen report (${report.title || 'Trash Report'} at ${report.street || barangay}) has been slotted into your route at the lowest detour point.`,
        reportId: report.id,
        barangay: barangay,
        read: false,
        createdAt: serverTimestamp(),
      });
    } catch (notifErr) {
      console.warn('Could not dispatch driver in-app notification:', notifErr);
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
