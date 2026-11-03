import { isServiceActive, type NormalizedGtfsFeed } from './publicGtfsRuntime.js';

export type BusConnectedPlaceSuggestion = {
  place: {
    id: string;
    canonicalName: string;
    names: { en: string };
    placeType: 'BUS_STOP';
    latitude: number;
    longitude: number;
    sourceDataset: 'ACTIVE_GTFS_BUS_SERVICE';
    sourceRecordId: string;
    sourceUrl?: string;
    sourceLicense?: string | null;
    sourceSnapshotDate?: string;
    verificationStatus: 'UNVERIFIED';
    busServiceEvidence: {
      feedId: string;
      feedName: string;
      region: string;
      sourceType: 'OFFICIAL_PUBLISHER' | 'COMMUNITY_DERIVED';
      activeRoutes: number;
      activeTrips: number;
      serviceDate: string;
      attribution?: string | null;
    };
    roadEvidence: 'BUS_SERVICE_STOP_COORDINATE';
  };
  matchScore: number;
  matchType: 'EXACT' | 'PREFIX' | 'CONTAINS' | 'REGION';
  displayLabel: string;
  subtitle: string;
};

const normalize = (value: unknown) => String(value || '').normalize('NFKC').trim().toLocaleLowerCase('en-IN');

export function buildBusConnectedPlaceSuggestions(
  feeds: NormalizedGtfsFeed[],
  query: string,
  serviceDate: string,
  limit = 8,
): BusConnectedPlaceSuggestion[] {
  const needle = normalize(query);
  if (needle.length < 2) return [];
  const output = new Map<string, BusConnectedPlaceSuggestion>();

  for (const feed of feeds) {
    if (feed.feed.mode && !feed.feed.mode.toLocaleLowerCase('en-IN').includes('bus')) continue;
    const region = String(feed.feed.region || '');
    const regionMatch = normalize(region).includes(needle);
    const activeTrips = new Map(
      feed.trips
        .filter(trip => isServiceActive(feed, trip.service_id, serviceDate))
        .map(trip => [trip.trip_id, trip]),
    );
    if (!activeTrips.size) continue;

    const routesByStop = new Map<string, Set<string>>();
    const tripsByStop = new Map<string, Set<string>>();
    for (const row of feed.stopTimes) {
      const trip = activeTrips.get(row.trip_id);
      if (!trip) continue;
      if (!routesByStop.has(row.stop_id)) routesByStop.set(row.stop_id, new Set());
      if (!tripsByStop.has(row.stop_id)) tripsByStop.set(row.stop_id, new Set());
      routesByStop.get(row.stop_id)!.add(trip.route_id);
      tripsByStop.get(row.stop_id)!.add(trip.trip_id);
    }

    for (const stop of feed.stops) {
      const latitude = Number(stop.stop_lat);
      const longitude = Number(stop.stop_lon);
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude) ||
          latitude < 6 || latitude > 38 || longitude < 68 || longitude > 98) continue;
      const activeRoutes = routesByStop.get(stop.stop_id);
      const activeStopTrips = tripsByStop.get(stop.stop_id);
      if (!activeRoutes?.size || !activeStopTrips?.size) continue;

      const stopName = String(stop.stop_name || '').trim();
      const stopMatch = normalize(stopName);
      const stopMatches = stopMatch.includes(needle);
      if (!stopMatches && !regionMatch) continue;

      const id = 'gtfs-stop-' + feed.feed.id + '-' + stop.stop_id;
      const exact = stopMatch === needle;
      const prefix = stopMatch.startsWith(needle);
      const matchType = exact ? 'EXACT' : prefix ? 'PREFIX' : stopMatches ? 'CONTAINS' : 'REGION';
      const place: BusConnectedPlaceSuggestion['place'] = {
        id,
        canonicalName: stopName,
        names: { en: stopName },
        placeType: 'BUS_STOP',
        latitude,
        longitude,
        sourceDataset: 'ACTIVE_GTFS_BUS_SERVICE',
        sourceRecordId: stop.stop_id,
        sourceUrl: feed.feed.sourcePage,
        sourceLicense: feed.feed.licenseUrl ? 'See source licence' : null,
        sourceSnapshotDate: feed.feed.importedAt,
        verificationStatus: 'UNVERIFIED',
        busServiceEvidence: {
          feedId: feed.feed.id,
          feedName: feed.feed.name,
          region,
          sourceType: feed.feed.official ? 'OFFICIAL_PUBLISHER' : 'COMMUNITY_DERIVED',
          activeRoutes: activeRoutes.size,
          activeTrips: activeStopTrips.size,
          serviceDate,
          attribution: feed.feed.attribution,
        },
        roadEvidence: 'BUS_SERVICE_STOP_COORDINATE',
      };
      output.set(id, {
        place,
        matchScore: exact ? 120 : prefix ? 110 : stopMatches ? 100 : 80,
        matchType,
        displayLabel: stopName,
        subtitle: [region, activeRoutes.size + ' active routes', feed.feed.official ? 'official source' : 'community feed'].join(' · '),
      });
    }
  }

  return [...output.values()]
    .sort((a, b) => b.matchScore - a.matchScore || a.displayLabel.localeCompare(b.displayLabel, 'en-IN'))
    .slice(0, Math.max(1, Math.min(12, Math.floor(limit) || 8)));
}

export type NearbyBusPlace = {
  place: { id: string; canonicalName: string; district?: string; state?: string; latitude: number; longitude: number };
  distanceMeters: number;
  kind: 'BUS_STAND' | 'BUS_STOP';
  feedName: string;
  routeCount: number;
};

export function buildNearbyBusPlaceSuggestions(
  feeds: NormalizedGtfsFeed[],
  latitude: number,
  longitude: number,
  serviceDate: string,
  radiusMeters = 5000,
  limit = 20,
): NearbyBusPlace[] {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) ||
      latitude < 6 || latitude > 38 || longitude < 68 || longitude > 98) return [];
  const toRadians = (value: number) => value * Math.PI / 180;
  const distance = (lat: number, lon: number) => {
    const dLat = toRadians(lat - latitude), dLon = toRadians(lon - longitude);
    const a = Math.sin(dLat / 2) ** 2 +
      Math.cos(toRadians(latitude)) * Math.cos(toRadians(lat)) * Math.sin(dLon / 2) ** 2;
    return 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };
  const results: NearbyBusPlace[] = [];
  for (const feed of feeds) {
    if (feed.feed.mode && !feed.feed.mode.toLocaleLowerCase('en-IN').includes('bus')) continue;
    const activeTrips = new Map(feed.trips
      .filter(trip => isServiceActive(feed, trip.service_id, serviceDate))
      .map(trip => [trip.trip_id, trip]));
    if (!activeTrips.size) continue;
    const routesByStop = new Map<string, Set<string>>();
    for (const row of feed.stopTimes) {
      const trip = activeTrips.get(row.trip_id);
      if (!trip) continue;
      if (!routesByStop.has(row.stop_id)) routesByStop.set(row.stop_id, new Set());
      routesByStop.get(row.stop_id)!.add(trip.route_id);
    }
    for (const stop of feed.stops) {
      const lat = Number(stop.stop_lat), lon = Number(stop.stop_lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < 6 || lat > 38 || lon < 68 || lon > 98) continue;
      const routes = routesByStop.get(stop.stop_id);
      if (!routes?.size) continue;
      const meters = distance(lat, lon);
      if (meters > radiusMeters) continue;
      const name = String(stop.stop_name || '').trim();
      const major = /\b(isbt|bus\s*(stand|station|terminal|depot)|terminal|depot)\b/i.test(name);
      results.push({
        place: { id: 'gtfs-stop-' + feed.feed.id + '-' + stop.stop_id, canonicalName: name,
          latitude: lat, longitude: lon, district: feed.feed.region || undefined },
        distanceMeters: Math.round(meters),
        kind: major ? 'BUS_STAND' : 'BUS_STOP',
        feedName: feed.feed.name,
        routeCount: routes.size,
      });
    }
  }
  return results.sort((a, b) =>
    (a.kind === b.kind ? 0 : a.kind === 'BUS_STAND' ? -1 : 1) ||
    a.distanceMeters - b.distanceMeters || a.place.canonicalName.localeCompare(b.place.canonicalName, 'en-IN')
  ).slice(0, Math.max(1, Math.min(40, limit)));
}
