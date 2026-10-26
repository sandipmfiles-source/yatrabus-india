/**
 * Geospatial Calculation Utilities for Bus Route Matching and Radius Search
 * Pure mathematical algorithms (Haversine, Cross-track distance, Point-to-Segment projection)
 * ₹0 Cost - Zero external API dependency
 */

/**
 * Convert degrees to radians
 */
export function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/**
 * Convert radians to degrees
 */
export function toDeg(rad: number): number {
  return (rad * 180) / Math.PI;
}

/**
 * Calculate Great-Circle distance between two points in meters using Haversine formula
 */
export function calculateDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // Earth radius in meters
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Calculate Great-Circle distance in kilometers
 */
export function calculateDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  return calculateDistanceMeters(lat1, lon1, lat2, lon2) / 1000;
}

/**
 * Calculate bearing in degrees from point 1 to point 2 (0° - 360°)
 */
export function calculateBearing(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const phi1 = toRad(lat1);
  const phi2 = toRad(lat2);
  const deltaLambda = toRad(lon2 - lon1);

  const y = Math.sin(deltaLambda) * Math.cos(phi2);
  const x =
    Math.cos(phi1) * Math.sin(phi2) -
    Math.sin(phi1) * Math.cos(phi2) * Math.cos(deltaLambda);

  const theta = Math.atan2(y, x);
  return (toDeg(theta) + 360) % 360;
}

/**
 * Calculate shortest perpendicular distance from a point to a line segment in meters
 */
export function distanceToSegmentMeters(
  pLat: number,
  pLon: number,
  aLat: number,
  aLon: number,
  bLat: number,
  bLon: number
): number {
  const distAB = calculateDistanceMeters(aLat, aLon, bLat, bLon);
  if (distAB === 0) {
    return calculateDistanceMeters(pLat, pLon, aLat, aLon);
  }

  // Vector projection using equirectangular approximation for small distances
  const x = (toRad(bLon - aLon) * Math.cos(toRad((aLat + bLat) / 2)));
  const y = toRad(bLat - aLat);
  const px = (toRad(pLon - aLon) * Math.cos(toRad((aLat + pLat) / 2)));
  const py = toRad(pLat - aLat);

  const dot = px * x + py * y;
  const lenSq = x * x + y * y;
  let param = -1;
  if (lenSq !== 0) param = dot / lenSq;

  let nearestLat: number;
  let nearestLon: number;

  if (param < 0) {
    nearestLat = aLat;
    nearestLon = aLon;
  } else if (param > 1) {
    nearestLat = bLat;
    nearestLon = bLon;
  } else {
    nearestLat = aLat + param * (bLat - aLat);
    nearestLon = aLon + param * (bLon - aLon);
  }

  return calculateDistanceMeters(pLat, pLon, nearestLat, nearestLon);
}

/**
 * Calculate shortest distance from a GPS observation point to a polyline in meters
 */
export function distanceToPolylineMeters(
  lat: number,
  lon: number,
  polyline: [number, number][]
): { minDistanceMeters: number; nearestSegmentIndex: number } {
  if (!polyline || polyline.length === 0) {
    return { minDistanceMeters: 999999, nearestSegmentIndex: -1 };
  }
  if (polyline.length === 1) {
    return {
      minDistanceMeters: calculateDistanceMeters(lat, lon, polyline[0][0], polyline[0][1]),
      nearestSegmentIndex: 0
    };
  }

  let minDistance = Infinity;
  let nearestIndex = 0;

  for (let i = 0; i < polyline.length - 1; i++) {
    const dist = distanceToSegmentMeters(
      lat,
      lon,
      polyline[i][0],
      polyline[i][1],
      polyline[i + 1][0],
      polyline[i + 1][1]
    );

    if (dist < minDistance) {
      minDistance = dist;
      nearestIndex = i;
    }
  }

  return { minDistanceMeters: minDistance, nearestSegmentIndex: nearestIndex };
}
