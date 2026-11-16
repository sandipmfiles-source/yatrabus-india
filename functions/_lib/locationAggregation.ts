export type RawLocationObservation = {
  id: string;
  session_id: string;
  bus_id: string;
  route_id: string;
  latitude: number;
  longitude: number;
  accuracy: number | null;
  speed: number | null;
  heading: number | null;
  observed_at: string;
};

export type AggregatedBusLocation = {
  id: string;
  sessionId: string;
  busId: string;
  routeId: string;
  latitude: number;
  longitude: number;
  accuracyMeters: number;
  speedKmh?: number;
  heading?: number;
  timestamp: string;
  confidence: "high" | "low";
  trackingStatus: "live_gps" | "estimated";
  distanceFromRouteMeters: number;
  contributorCount: number;
  isCorroborated: boolean;
  matchingRemarks: string;
  source: "consented_passenger_reports";
};

type Point = { latitude: number; longitude: number };

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  if (!sorted.length) return 0;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function round(value: number, places: number): number {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

function haversineMeters(a: Point, b: Point): number {
  const radians = (value: number) => value * Math.PI / 180;
  const dLat = radians(b.latitude - a.latitude);
  const dLon = radians(b.longitude - a.longitude);
  const lat1 = radians(a.latitude);
  const lat2 = radians(b.latitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function pointToSegmentMeters(point: Point, start: Point, end: Point): number {
  const meanLat = (point.latitude + start.latitude + end.latitude) / 3 * Math.PI / 180;
  const xScale = 111320 * Math.cos(meanLat);
  const yScale = 110540;
  const px = point.longitude * xScale;
  const py = point.latitude * yScale;
  const ax = start.longitude * xScale;
  const ay = start.latitude * yScale;
  const bx = end.longitude * xScale;
  const by = end.latitude * yScale;
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSquared = dx * dx + dy * dy;
  const t = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSquared));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

function distanceToRouteMeters(point: Point, polyline: number[][]): number {
  if (polyline.length < 2) return 0;
  let best = Number.POSITIVE_INFINITY;
  for (let index = 1; index < polyline.length; index++) {
    const a = polyline[index - 1];
    const b = polyline[index];
    if (!Array.isArray(a) || !Array.isArray(b) || a.length < 2 || b.length < 2) continue;
    const start = { latitude: Number(a[0]), longitude: Number(a[1]) };
    const end = { latitude: Number(b[0]), longitude: Number(b[1]) };
    if (![start.latitude, start.longitude, end.latitude, end.longitude].every(Number.isFinite)) continue;
    best = Math.min(best, pointToSegmentMeters(point, start, end));
  }
  return Number.isFinite(best) ? Math.round(best) : 0;
}

function circularMeanHeading(values: number[]): number | undefined {
  if (!values.length) return undefined;
  const x = values.reduce((sum, value) => sum + Math.cos(value * Math.PI / 180), 0);
  const y = values.reduce((sum, value) => sum + Math.sin(value * Math.PI / 180), 0);
  return round((Math.atan2(y, x) * 180 / Math.PI + 360) % 360, 0);
}

export function aggregateBusLocation(
  rows: RawLocationObservation[],
  busId: string,
  routeId: string,
  polyline: number[][] = [],
  nowMs = Date.now()
): AggregatedBusLocation | null {
  const latestBySession = new Map<string, RawLocationObservation>();
  for (const row of rows) {
    const time = Date.parse(row.observed_at);
    const age = nowMs - time;
    if (!row.session_id || !Number.isFinite(time) || age < -30000 || age > 120000) continue;
    if (!Number.isFinite(row.latitude) || !Number.isFinite(row.longitude)) continue;
    if (row.latitude < 6 || row.latitude > 38 || row.longitude < 68 || row.longitude > 98) continue;
    if (row.accuracy === null || !Number.isFinite(row.accuracy) || row.accuracy < 0 || row.accuracy > 500) continue;
    const current = latestBySession.get(row.session_id);
    if (!current || Date.parse(row.observed_at) > Date.parse(current.observed_at)) latestBySession.set(row.session_id, row);
  }

  const points = [...latestBySession.values()].sort((a, b) => Date.parse(b.observed_at) - Date.parse(a.observed_at));
  if (!points.length) return null;

  const corroborationCandidates = points.filter(row =>
    nowMs - Date.parse(row.observed_at) <= 60000 && Number(row.accuracy) <= 150
  );
  const medianPoint = {
    latitude: median(corroborationCandidates.map(row => row.latitude)),
    longitude: median(corroborationCandidates.map(row => row.longitude))
  };
  const cluster = corroborationCandidates.filter(row =>
    haversineMeters(row, medianPoint) <= 300
  );
  const corroborated = cluster.length >= 2;
  const selected = corroborated ? cluster : [points[0]];
  const latitude = corroborated
    ? round(selected.reduce((sum, row) => sum + row.latitude, 0) / selected.length, 4)
    : round(selected[0].latitude, 3);
  const longitude = corroborated
    ? round(selected.reduce((sum, row) => sum + row.longitude, 0) / selected.length, 4)
    : round(selected[0].longitude, 3);
  const accuracyMeters = Math.round(median(selected.map(row => Number(row.accuracy))));
  const speedValues = selected.map(row => row.speed).filter((value): value is number => value !== null && Number.isFinite(value));
  const headingValues = selected.map(row => row.heading).filter((value): value is number => value !== null && Number.isFinite(value));
  const timestamp = selected.reduce((latest, row) =>
    Date.parse(row.observed_at) > Date.parse(latest) ? row.observed_at : latest, selected[0].observed_at
  );
  const position = { latitude, longitude };
  const routeDistance = distanceToRouteMeters(position, polyline);
  const remarks = corroborated
    ? `Position corroborated by ${cluster.length} independent, consented passenger devices within 300 metres.`
    : points.length > 1
      ? `Approximate position from the latest consented report; ${points.length} reports did not form a reliable agreement.`
      : "Approximate position from one consented passenger report; not independently confirmed.";

  return {
    id: `aggregate-${busId}-${timestamp}`,
    sessionId: "public-aggregate",
    busId,
    routeId,
    latitude,
    longitude,
    accuracyMeters,
    ...(speedValues.length ? { speedKmh: round(median(speedValues), 1) } : {}),
    ...(headingValues.length ? { heading: circularMeanHeading(headingValues) } : {}),
    timestamp,
    confidence: corroborated ? "high" : "low",
    trackingStatus: corroborated ? "live_gps" : "estimated",
    distanceFromRouteMeters: routeDistance,
    contributorCount: corroborated ? cluster.length : points.length,
    isCorroborated: corroborated,
    matchingRemarks: remarks,
    source: "consented_passenger_reports"
  };
}
