import { MapCoordinate, optimizeRoadRoute, RoadRouteResult } from '@/services/roadRouteOptimizationService';
import { RoutableStop } from '@/services/routeOptimizationService';
import { parseWasteAmountToMetricTons } from '@/utils/wasteUnits';

export type ConstraintAwareStop = RoutableStop & {
  priority?: string;
  aiAnalysis?: { estimatedWeight?: string; wasteType?: string } | null;
  collectionMeasurement?: { value?: number; unit?: 'kg' | 'ton' | 'm3' } | null;
  timeWindowStart?: string;
  timeWindowEnd?: string;
};

export type RouteConstraintOptions = {
  truckCapacityTons: number | null;
  serviceWindowStart: string;
  serviceWindowEnd: string;
  trafficAware: boolean;
};

export type ConstraintRouteResult<T> = RoadRouteResult<T> & {
  deferredStops: T[];
  estimatedLoadTons: number;
  capacityTons: number | null;
  utilizationPercent: number | null;
  warnings: string[];
  constraintMethod: 'capacity-priority-time-window-road-hybrid';
  trafficAware: boolean;
  serviceWindow: { start: string; end: string };
};

const DEFAULT_STOP_TONS = 0.025;

const coordinateOf = (stop: RoutableStop): MapCoordinate | null => {
  const latitude = stop.location?.lat ?? stop.location?.latitude;
  const longitude = stop.location?.lng ?? stop.location?.longitude;
  return Number.isFinite(latitude) && Number.isFinite(longitude)
    ? { latitude: Number(latitude), longitude: Number(longitude) }
    : null;
};

const haversineKm = (a: MapCoordinate, b: MapCoordinate) => {
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const dLat = radians(b.latitude - a.latitude);
  const dLng = radians(b.longitude - a.longitude);
  const value = Math.sin(dLat / 2) ** 2
    + Math.cos(radians(a.latitude)) * Math.cos(radians(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
};

const priorityRank = (stop: ConstraintAwareStop) => {
  const explicit = String(stop.priority || '').toLowerCase();
  const wasteType = String(stop.aiAnalysis?.wasteType || '').toLowerCase();
  if (explicit === 'urgent' || wasteType.includes('hazard')) return 0;
  if (explicit === 'high') return 1;
  if (explicit === 'low') return 3;
  return 2;
};

const timeMinutes = (value: string | undefined, fallback: number) => {
  const match = String(value || '').match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return fallback;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59 ? hours * 60 + minutes : fallback;
};

const createdTime = (value: unknown) => {
  if (typeof value === 'string' || typeof value === 'number') return new Date(value).getTime() || 0;
  if (value && typeof (value as { toMillis?: () => number }).toMillis === 'function') {
    return (value as { toMillis: () => number }).toMillis();
  }
  return Date.now();
};

const estimatedTons = (stop: ConstraintAwareStop) => {
  const measurement = stop.collectionMeasurement;
  if (measurement && Number(measurement.value) > 0 && measurement.unit) {
    const parsed = parseWasteAmountToMetricTons(`${measurement.value} ${measurement.unit}`);
    if (parsed !== null) return parsed;
  }
  return parseWasteAmountToMetricTons(stop.aiAnalysis?.estimatedWeight) ?? DEFAULT_STOP_TONS;
};

function constraintOrder<T extends ConstraintAwareStop>(
  stops: T[],
  origin: MapCoordinate | null,
  windowStart: number,
  windowEnd: number,
): T[] {
  const remaining = [...stops];
  const ordered: T[] = [];
  let current = origin;
  let elapsedMinutes = 0;

  while (remaining.length) {
    let bestIndex = 0;
    let bestScore = Number.POSITIVE_INFINITY;
    remaining.forEach((stop, index) => {
      const coordinate = coordinateOf(stop);
      const distance = current && coordinate ? haversineKm(current, coordinate) : 25;
      const stopWindowEnd = Math.max(0, timeMinutes(stop.timeWindowEnd, windowEnd) - windowStart);
      const projectedArrival = elapsedMinutes + distance * 3;
      const latenessPenalty = Math.max(0, projectedArrival - stopWindowEnd) * 4;
      const score = distance + priorityRank(stop) * 18 + latenessPenalty + createdTime(stop.createdAt) / 1e15;
      if (score < bestScore) {
        bestScore = score;
        bestIndex = index;
      }
    });
    const selected = remaining.splice(bestIndex, 1)[0];
    const next = coordinateOf(selected);
    if (current && next) elapsedMinutes += haversineKm(current, next) * 3 + 8;
    current = next || current;
    ordered.push(selected);
  }
  return ordered;
}

export async function buildConstraintAwareRoute<T extends ConstraintAwareStop>(
  stops: T[],
  origin: MapCoordinate | null,
  options: RouteConstraintOptions,
): Promise<ConstraintRouteResult<T>> {
  const capacity = options.truckCapacityTons && options.truckCapacityTons > 0 ? options.truckCapacityTons : null;
  let startMinutes = timeMinutes(options.serviceWindowStart, 8 * 60);
  let endMinutes = timeMinutes(options.serviceWindowEnd, 17 * 60);
  const warnings: string[] = [];
  if (endMinutes <= startMinutes) {
    warnings.push('The service window end must be later than its start; 08:00-17:00 timing assumptions were used.');
    startMinutes = 8 * 60;
    endMinutes = 17 * 60;
  }

  const ranked = [...stops].sort((a, b) => {
    const priorityDifference = priorityRank(a) - priorityRank(b);
    if (priorityDifference !== 0) return priorityDifference;
    const windowDifference = timeMinutes(a.timeWindowEnd, endMinutes) - timeMinutes(b.timeWindowEnd, endMinutes);
    return windowDifference || createdTime(a.createdAt) - createdTime(b.createdAt);
  });

  const accepted: T[] = [];
  const deferred: T[] = [];
  let load = 0;
  ranked.forEach(stop => {
    const stopLoad = estimatedTons(stop);
    if (capacity !== null && load + stopLoad > capacity) deferred.push(stop);
    else {
      accepted.push(stop);
      load += stopLoad;
    }
  });

  if (capacity === null) warnings.push('The assigned truck has no numeric capacity; capacity enforcement was skipped.');
  if (deferred.length) warnings.push(`${deferred.length} stop${deferred.length === 1 ? '' : 's'} deferred because the estimated load exceeds truck capacity.`);
  const missingWeight = accepted.filter(stop => {
    const measurement = stop.collectionMeasurement;
    const measured = measurement && Number(measurement.value) > 0 && measurement.unit
      ? parseWasteAmountToMetricTons(`${measurement.value} ${measurement.unit}`)
      : null;
    return measured === null && parseWasteAmountToMetricTons(stop.aiAnalysis?.estimatedWeight) === null;
  }).length;
  if (missingWeight) warnings.push(`${missingWeight} stop${missingWeight === 1 ? '' : 's'} use the 25 kg planning fallback because no weight estimate is available.`);

  const ordered = constraintOrder(accepted, origin, startMinutes, endMinutes);
  const road = await optimizeRoadRoute(ordered, origin, {
    optimizeWaypointOrder: false,
    trafficAware: options.trafficAware,
  });

  return {
    ...road,
    deferredStops: deferred,
    estimatedLoadTons: Math.round(load * 1000) / 1000,
    capacityTons: capacity,
    utilizationPercent: capacity ? Math.round((load / capacity) * 1000) / 10 : null,
    warnings,
    constraintMethod: 'capacity-priority-time-window-road-hybrid',
    trafficAware: options.trafficAware,
    serviceWindow: {
      start: `${String(Math.floor(startMinutes / 60)).padStart(2, '0')}:${String(startMinutes % 60).padStart(2, '0')}`,
      end: `${String(Math.floor(endMinutes / 60)).padStart(2, '0')}:${String(endMinutes % 60).padStart(2, '0')}`,
    },
  };
}
