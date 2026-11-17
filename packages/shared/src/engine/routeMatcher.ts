import { Route, RouteGeometryPoint } from '../types/bus.js';

export interface RouteMatchResult {
  distanceMeters: number;
  isMatched: boolean;
  nearestSegmentIndex: number;
  projectedLatitude: number;
  projectedLongitude: number;
  estimatedProgressRatio: number; // 0.0 to 1.0 along route
}

const EARTH_RADIUS_METERS = 6371000;

/**
 * Converts degrees to radians
 */
export function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/**
 * Converts radians to degrees
 */
export function toDegrees(radians: number): number {
  return (radians * 180) / Math.PI;
}

/**
 * Calculates Great-Circle distance between two coordinates in meters (Haversine formula)
 */
export function haversineDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_METERS * c;
}

/**
 * Calculates initial bearing from point A to point B (in degrees 0-360)
 */
export function calculateBearingDegrees(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const y = Math.sin(toRadians(lon2 - lon1)) * Math.cos(toRadians(lat2));
  const x =
    Math.cos(toRadians(lat1)) * Math.sin(toRadians(lat2)) -
    Math.sin(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.cos(toRadians(lon2 - lon1));
  const brng = toDegrees(Math.atan2(y, x));
  return (brng + 360) % 360;
}

/**
 * Projects a point onto a line segment and calculates orthogonal distance in meters.
 */
function pointToSegmentDistance(
  pLat: number,
  pLon: number,
  aLat: number,
  aLon: number,
  bLat: number,
  bLon: number
): { distance: number; projLat: number; projLon: number; t: number } {
  const segmentLen = haversineDistanceMeters(aLat, aLon, bLat, bLon);
  if (segmentLen < 1) {
    return {
      distance: haversineDistanceMeters(pLat, pLon, aLat, aLon),
      projLat: aLat,
      projLon: aLon,
      t: 0,
    };
  }

  // Linear projection in equirectangular approximation for local segment
  const x = toRadians(bLon - aLon) * Math.cos(toRadians((aLat + bLat) / 2));
  const y = toRadians(bLat - aLat);
  const px = toRadians(pLon - aLon) * Math.cos(toRadians((aLat + bLat) / 2));
  const py = toRadians(pLat - aLat);

  let t = (px * x + py * y) / (x * x + y * y);
  t = Math.max(0, Math.min(1, t));

  const projLat = aLat + t * (bLat - aLat);
  const projLon = aLon + t * (bLon - aLon);
  const dist = haversineDistanceMeters(pLat, pLon, projLat, projLon);

  return { distance: dist, projLat, projLon, t };
}

/**
 * Matches a passenger's GPS coordinate against a bus route polyline or ordered stop sequence.
 * @param lat Latitude
 * @param lon Longitude
 * @param route Bus Route with stops and optional geometry points
 * @param maxRouteDistanceMeters Distance threshold (e.g. 150m for Indian urban transit corridors)
 */
export function matchPointToRoute(
  lat: number,
  lon: number,
  route: Route,
  maxRouteDistanceMeters: number = 150
): RouteMatchResult {
  // Use geometry points if available, otherwise fallback to ordered stops
  const path: RouteGeometryPoint[] =
    route.geometry && route.geometry.length >= 2
      ? route.geometry
      : route.stops.map(s => ({ latitude: s.latitude, longitude: s.longitude }));

  if (path.length === 0) {
    return {
      distanceMeters: Infinity,
      isMatched: false,
      nearestSegmentIndex: -1,
      projectedLatitude: lat,
      projectedLongitude: lon,
      estimatedProgressRatio: 0,
    };
  }

  if (path.length === 1) {
    const dist = haversineDistanceMeters(lat, lon, path[0].latitude, path[0].longitude);
    return {
      distanceMeters: dist,
      isMatched: dist <= maxRouteDistanceMeters,
      nearestSegmentIndex: 0,
      projectedLatitude: path[0].latitude,
      projectedLongitude: path[0].longitude,
      estimatedProgressRatio: 0,
    };
  }

  let minDistance = Infinity;
  let bestSegmentIndex = 0;
  let bestProjLat = path[0].latitude;
  let bestProjLon = path[0].longitude;
  let bestSegmentT = 0;

  for (let i = 0; i < path.length - 1; i++) {
    const pA = path[i];
    const pB = path[i + 1];
    const res = pointToSegmentDistance(
      lat,
      lon,
      pA.latitude,
      pA.longitude,
      pB.latitude,
      pB.longitude
    );

    if (res.distance < minDistance) {
      minDistance = res.distance;
      bestSegmentIndex = i;
      bestProjLat = res.projLat;
      bestProjLon = res.projLon;
      bestSegmentT = res.t;
    }
  }

  // Calculate approximate route progress ratio
  const totalSegments = path.length - 1;
  const progressRatio = totalSegments > 0 ? (bestSegmentIndex + bestSegmentT) / totalSegments : 0;

  return {
    distanceMeters: Math.round(minDistance),
    isMatched: minDistance <= maxRouteDistanceMeters,
    nearestSegmentIndex: bestSegmentIndex,
    projectedLatitude: bestProjLat,
    projectedLongitude: bestProjLon,
    estimatedProgressRatio: Math.min(1.0, Math.max(0.0, progressRatio)),
  };
}

/**
 * Checks if heading matches route direction within angular tolerance (default 70 degrees).
 */
export function isHeadingConsistentWithRoute(
  observedHeading: number | undefined,
  routeHeading: number,
  toleranceDegrees: number = 70
): boolean {
  if (observedHeading === undefined || observedHeading < 0) {
    // If device doesn't report heading, neutral (cannot rule out)
    return true;
  }

  const diff = Math.abs(observedHeading - routeHeading) % 360;
  const angle = diff > 180 ? 360 - diff : diff;
  return angle <= toleranceDegrees;
}
