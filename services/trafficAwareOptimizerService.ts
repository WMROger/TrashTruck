import { BARANGAY_COLLECTION_ROUTES, CENRO_DEPOT_WAYPOINT, CENRO_RETURN_WAYPOINT, SimulationWaypoint } from '@/constants/barangaySimulationRoutes';
import { calculateDiesel, DEMO_DIESEL_PARAMETERS, DieselParameters, DieselPlan } from './dieselMath';

export type RouteStop = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  barangay?: string;
  street?: string;
  stopType: 'depot' | 'regular_pickup' | 'verified_report' | 'transfer_station';
  reportId?: string;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  estimatedWeight?: string;
  wasteType?: string;
  trafficCongestionLevel?: 'low' | 'medium' | 'high';
  peakAvoidanceReason?: string;
  optimalTimeWindow?: string;
};

export type TrafficOptimizationResult = {
  barangay: string;
  baselineStops: RouteStop[];
  optimizedStops: RouteStop[];
  baselineDistanceKm: number;
  optimizedDistanceKm: number;
  baselineDurationMins: number;
  optimizedDurationMins: number;
  baselineFuelLiters: number;
  optimizedFuelLiters: number;
  fuelSavingsLiters: number;
  fuelCostSavedPhp: number;
  timeSavingsMinutes: number;
  efficiencyGainPercent: number;
  bottlenecksAvoided: number;
  trafficHotspots: Array<{ name: string; severity: 'high' | 'medium'; advice: string }>;
  roadPolyline: Array<{ latitude: number; longitude: number }>;
  dieselEstimate: DieselPlan;
};

// Haversine distance calculator in kilometers
export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Known Danao City peak traffic bottleneck indicators
const DANAO_TRAFFIC_CONGESTION_MAP: Record<string, { severity: 'high' | 'medium'; peakHours: string; advice: string }> = {
  'Beatriz D. Durano Ave (Commercial)': {
    severity: 'high',
    peakHours: '07:30 - 09:30 & 16:30 - 18:30',
    advice: 'Heavy commercial transit and public utility jeepney staging. Best served early morning or mid-day.',
  },
  'Duterte St Public Market Stop': {
    severity: 'high',
    peakHours: '06:00 - 10:00 & 15:00 - 19:00',
    advice: 'High pedestrian and market vendor congestion. Approaching from rear bypass avoids 12-min gridlock.',
  },
  'Central Terminal Link': {
    severity: 'high',
    peakHours: '07:00 - 09:00 & 17:00 - 19:00',
    advice: 'Inter-city bus arrivals. Scheduled during transition window.',
  },
  'Danao Port Access Road': {
    severity: 'high',
    peakHours: '08:00 - 11:00 & 14:00 - 17:00',
    advice: 'Camotes ferry embarkation queues. Route sequence altered to bypass dock gate choke point.',
  },
  'Taytay Flyover Approach': {
    severity: 'medium',
    peakHours: '07:00 - 08:30 & 17:00 - 18:30',
    advice: 'Highway merge bottleneck. Priority service assigned outside peak commuter wave.',
  },
  'Sabang Public Market Hub': {
    severity: 'high',
    peakHours: '06:30 - 09:30 & 16:00 - 18:30',
    advice: 'Barangay commercial core. Re-sequenced to avoid market rush hour.',
  },
};

/**
 * Transforms simulation waypoints into manageable RouteStop objects
 */
export function waypointsToRouteStops(waypoints: SimulationWaypoint[], defaultBarangay: string): RouteStop[] {
  return waypoints.map((w, index) => {
    const isStart = index === 0;
    const isEnd = index === waypoints.length - 1;
    const trafficInfo = DANAO_TRAFFIC_CONGESTION_MAP[w.name || ''];

    return {
      id: `stop-${defaultBarangay}-${index}-${w.name?.replace(/[^a-zA-Z0-9]/g, '_') || 'pt'}`,
      name: w.name || `Collection Point ${index + 1}`,
      latitude: w.latitude,
      longitude: w.longitude,
      barangay: w.barangay || defaultBarangay,
      stopType: isStart ? 'depot' : isEnd ? 'transfer_station' : 'regular_pickup',
      trafficCongestionLevel: trafficInfo?.severity || 'low',
      peakAvoidanceReason: trafficInfo?.advice,
      optimalTimeWindow: trafficInfo ? '05:30 - 07:15 AM (Low Congestion)' : 'Standard Routine',
    };
  });
}

/**
 * Calculates total route distance in km
 */
export function calculateRouteDistance(stops: Array<{ latitude: number; longitude: number }>): number {
  if (stops.length < 2) return 0;
  let total = 0;
  for (let i = 0; i < stops.length - 1; i++) {
    total += haversineKm(stops[i].latitude, stops[i].longitude, stops[i + 1].latitude, stops[i + 1].longitude);
  }
  return Math.round(total * 100) / 100;
}

/**
 * Inserts verified citizen reports into a driver's collection route at geographically optimal slots
 */
export function insertVerifiedReportsIntoRoute(
  baseStops: RouteStop[],
  verifiedReports: Array<{
    id: string;
    title?: string;
    street?: string;
    barangay?: string;
    location?: { lat?: number; lng?: number; latitude?: number; longitude?: number };
    aiAnalysis?: { wasteType?: string; estimatedWeight?: string };
    priority?: 'low' | 'normal' | 'high' | 'urgent';
  }>
): RouteStop[] {
  if (!verifiedReports || verifiedReports.length === 0) return [...baseStops];

  const currentStops = [...baseStops];

  verifiedReports.forEach((rep) => {
    const lat = rep.location?.lat ?? rep.location?.latitude;
    const lng = rep.location?.lng ?? rep.location?.longitude;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

    const reportStop: RouteStop = {
      id: `report-${rep.id}`,
      name: `Citizen Report: ${rep.title || rep.street || 'Waste Cluster'}`,
      latitude: Number(lat),
      longitude: Number(lng),
      barangay: rep.barangay || 'Danao City',
      street: rep.street,
      stopType: 'verified_report',
      reportId: rep.id,
      priority: rep.priority || 'high',
      wasteType: rep.aiAnalysis?.wasteType || 'Unsegregated Solid Waste',
      estimatedWeight: rep.aiAnalysis?.estimatedWeight || '25 kg',
      trafficCongestionLevel: 'low',
      optimalTimeWindow: 'Insert Priority Stop',
    };

    // Find the best insertion point between start depot and end depot to minimize detour distance
    let bestIndex = Math.max(1, currentStops.length - 1);
    let minAddedDistance = Number.POSITIVE_INFINITY;

    for (let i = 1; i < currentStops.length; i++) {
      const prev = currentStops[i - 1];
      const next = currentStops[i];

      const originalLeg = haversineKm(prev.latitude, prev.longitude, next.latitude, next.longitude);
      const newLegs =
        haversineKm(prev.latitude, prev.longitude, reportStop.latitude, reportStop.longitude) +
        haversineKm(reportStop.latitude, reportStop.longitude, next.latitude, next.longitude);

      const added = newLegs - originalLeg;
      if (added < minAddedDistance) {
        minAddedDistance = added;
        bestIndex = i;
      }
    }

    currentStops.splice(bestIndex, 0, reportStop);
  });

  return currentStops;
}

/**
 * Runs the AI Traffic & Fuel Optimization
 * Re-sequences collection stops so all required locations are visited with minimum traffic idling & fuel waste.
 */
export function optimizeBarangayRouteWithTraffic(
  barangay: string,
  extraReports: any[] = [],
  dieselParameters: DieselParameters = DEMO_DIESEL_PARAMETERS,
  dieselFactor = 1,
  dieselModelId: string | null = null,
  parameterSource = 'Demonstration assumptions; configure the CENRO supply price'
): TrafficOptimizationResult {
  const waypoints = BARANGAY_COLLECTION_ROUTES[barangay] || [
    CENRO_DEPOT_WAYPOINT,
    { latitude: 10.525, longitude: 124.029, name: `${barangay} Center`, speed: 25, barangay },
    CENRO_RETURN_WAYPOINT,
  ];

  let rawBaselineStops = waypointsToRouteStops(waypoints, barangay);

  if (extraReports.length > 0) {
    rawBaselineStops = insertVerifiedReportsIntoRoute(rawBaselineStops, extraReports);
  }

  const startDepot = rawBaselineStops[0];
  const endDepot = rawBaselineStops[rawBaselineStops.length - 1];
  const intermediateStops = rawBaselineStops.slice(1, rawBaselineStops.length - 1);

  // 1. Identify bottlenecks
  const detectedHotspots: Array<{ name: string; severity: 'high' | 'medium'; advice: string }> = [];
  intermediateStops.forEach((s) => {
    const info = DANAO_TRAFFIC_CONGESTION_MAP[s.name];
    if (info) {
      detectedHotspots.push({ name: s.name, severity: info.severity, advice: info.advice });
    }
  });

  // 2. Traffic-Aware Re-Sequencing:
  // Sort intermediate stops by priority and traffic avoidance scoring:
  // - High-traffic commercial zones are sequenced to early/off-peak slots
  // - Urgent/Hazardous verified reports are prioritized
  // - Smooth Euclidean/Haversine chain to eliminate back-and-forth zigzagging
  const remaining = [...intermediateStops];
  const sequenced: RouteStop[] = [];
  let currentPos = startDepot;

  while (remaining.length > 0) {
    let bestIdx = 0;
    let bestScore = Number.POSITIVE_INFINITY;

    for (let i = 0; i < remaining.length; i++) {
      const candidate = remaining[i];
      const dist = haversineKm(currentPos.latitude, currentPos.longitude, candidate.latitude, candidate.longitude);

      // Traffic penalty if candidate is a high-congestion hotspot placed in late afternoon slots
      const isHighTraffic = candidate.trafficCongestionLevel === 'high';
      const trafficPenalty = isHighTraffic && sequenced.length > remaining.length ? 1.8 : 0.8;

      // Priority bonus for urgent citizen reports
      const priorityBonus = candidate.priority === 'urgent' ? 0.3 : candidate.priority === 'high' ? 0.6 : 1.0;

      const score = dist * trafficPenalty * priorityBonus;

      if (score < bestScore) {
        bestScore = score;
        bestIdx = i;
      }
    }

    const nextStop = remaining.splice(bestIdx, 1)[0];
    sequenced.push(nextStop);
    currentPos = nextStop;
  }

  const optimizedStops = [startDepot, ...sequenced, endDepot];

  // 3. Calculate Fuel & Time Metrics
  const baselineDistanceKm = calculateRouteDistance(rawBaselineStops);
  const optimizedDistanceKm = calculateRouteDistance(optimizedStops);

  // Use identical physical assumptions for both sequences. Route order alone does
  // not justify improved km/L or reduced idling without measured supporting data.
  const inputs = (distanceKm: number) => ({
    distanceKm, drivingHours: distanceKm / 20, idleHours: 0,
    collectionHours: intermediateStops.length * dieselParameters.minutesPerStop / 60,
    averageLoadPercent: dieselParameters.averageLoadPercent,
  });
  const baselineInputs = inputs(baselineDistanceKm), optimizedInputs = inputs(optimizedDistanceKm);
  const baseline = calculateDiesel(baselineInputs, dieselParameters, dieselFactor);
  const optimized = calculateDiesel(optimizedInputs, dieselParameters, dieselFactor);
  const dieselEstimate: DieselPlan = { version: 1, savedAt: new Date().toISOString(), parameters: dieselParameters,
    parameterSource, distanceSource: 'Demo route; straight-line distance between stops',
    baselineInputs, optimizedInputs, baseline, optimized, modelId: dieselModelId };
  const baselineFuelLiters = Math.round(baseline.liters * 100) / 100;
  const optimizedFuelLiters = Math.round(optimized.liters * 100) / 100;
  const fuelSavingsLiters = Math.round((baseline.liters - optimized.liters) * 100) / 100;
  const fuelCostSavedPhp = Math.round((baseline.liters - optimized.liters) * dieselParameters.pricePerLiter * 100) / 100;

  const baselineDurationMins = Math.round(baseline.operatingHours * 60);
  const optimizedDurationMins = Math.round(optimized.operatingHours * 60);

  const timeSavingsMinutes = baselineDurationMins - optimizedDurationMins;
  const efficiencyGainPercent = baselineDurationMins > 0 ? Math.round(((baselineDurationMins - optimizedDurationMins) / baselineDurationMins) * 100) : 0;

  const roadPolyline = optimizedStops.map((s) => ({
    latitude: s.latitude,
    longitude: s.longitude,
  }));

  return {
    barangay,
    baselineStops: rawBaselineStops,
    optimizedStops,
    baselineDistanceKm,
    optimizedDistanceKm,
    baselineDurationMins,
    optimizedDurationMins,
    baselineFuelLiters,
    optimizedFuelLiters,
    fuelSavingsLiters,
    fuelCostSavedPhp,
    timeSavingsMinutes,
    efficiencyGainPercent,
    bottlenecksAvoided: detectedHotspots.length,
    trafficHotspots: detectedHotspots,
    roadPolyline,
    dieselEstimate,
  };
}
