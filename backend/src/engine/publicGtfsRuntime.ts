import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export type NormalizedGtfsFeed = {
  schemaVersion: number;
  feed: { id: string; name: string; region?: string; mode?: string; official?: boolean; attribution?: string | null; sourcePage?: string; licenseUrl?: string | null; importedAt?: string; sha256?: string };
  agency: Array<{ agency_id?: string; agency_name?: string; agency_timezone?: string }>;
  routes: Array<{ route_id: string; agency_id?: string; route_short_name?: string; route_long_name?: string; route_type?: string }>;
  stops: Array<{ stop_id: string; stop_name: string; stop_lat?: number; stop_lon?: number; location_type?: string; parent_station?: string }>;
  trips: Array<{ route_id: string; service_id: string; trip_id: string; trip_headsign?: string; direction_id?: string }>;
  stopTimes: Array<{ trip_id: string; arrival_time?: string; departure_time?: string; stop_id: string; stop_sequence: number }>;
  calendar: Array<{ service_id: string; monday: string; tuesday: string; wednesday: string; thursday: string; friday: string; saturday: string; sunday: string; start_date: string; end_date: string }>;
  calendarDates: Array<{ service_id: string; date: string; exception_type: string }>;
  frequencies?: Array<{ trip_id: string; start_time: string; end_time: string; headway_secs: number; exact_times?: string }>;
  counts?: Record<string, number>;
  serviceDateRange?: { start: string | null; end: string | null };
};

export type TimetableResult = {
  feedId: string; feedName: string; region?: string; sourceUrl?: string; sourceType: 'OFFICIAL_PUBLISHER' | 'COMMUNITY_DERIVED';
  verificationStatus: 'UNVERIFIED'; importedAt?: string; attribution?: string | null;
  routeId: string; routeName: string; tripId: string; headsign?: string;
  fromStop: { id: string; name: string }; toStop: { id: string; name: string };
  departureTime: string; arrivalTime: string; departureDayOffset: number; arrivalDayOffset: number;
  serviceDate: string; timezone: string; dataType: 'GTFS_STATIC'; liveVehiclePositionsAvailable: false;
};

const dayFields = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;
const compactDate = (date: string) => date.replaceAll('-', '');
export const isValidGtfsServiceDate = (date: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const parsed = new Date(date + 'T12:00:00Z');
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date;
};
export function isServiceActive(feed: NormalizedGtfsFeed, serviceId: string, date: string): boolean {
  if (!isValidGtfsServiceDate(date)) return false;
  const compact = compactDate(date);
  const exceptions = feed.calendarDates.filter(row => row.service_id === serviceId && row.date === compact);
  if (exceptions.some(row => row.exception_type === '1')) return true;
  if (exceptions.some(row => row.exception_type === '2')) return false;
  const calendar = feed.calendar.find(row => row.service_id === serviceId);
  if (!calendar || compact < calendar.start_date || compact > calendar.end_date) return false;
  const weekday = new Date(date + 'T12:00:00Z').getUTCDay();
  return calendar[dayFields[weekday]] === '1';
}

function timeParts(value?: string) {
  if (!value || !/^\d{1,3}:\d{2}:\d{2}$/.test(value)) return null;
  const [hours, minutes, seconds] = value.split(':').map(Number);
  if (minutes > 59 || seconds > 59) return null;
  return { value: String(hours % 24).padStart(2, '0') + ':' + String(minutes).padStart(2, '0'), dayOffset: Math.floor(hours / 24), minutes: (hours % 24) * 60 + minutes };
}
function normalizedStopName(value: string) { return value.normalize('NFKC').trim().toLocaleLowerCase('en-IN'); }
function matchStop(feed: NormalizedGtfsFeed, query: string) {
  const q = normalizedStopName(query);
  return feed.stops.filter(stop => stop.stop_id === query || normalizedStopName(stop.stop_name) === q);
}
function routeLabel(route: NormalizedGtfsFeed['routes'][number]) {
  return [route.route_short_name, route.route_long_name].filter(Boolean).join(' — ') || route.route_id;
}

export function searchGtfsJourneys(feeds: NormalizedGtfsFeed[], from: string, to: string, date: string, requestedLimit = 20): TimetableResult[] {
  if (!isValidGtfsServiceDate(date)) throw new Error('date must be a valid YYYY-MM-DD service date');
  if (!from.trim() || !to.trim()) throw new Error('from and to are required');
  if (normalizedStopName(from) === normalizedStopName(to)) return [];
  const limit = Math.max(1, Math.min(50, Math.floor(requestedLimit) || 20));
  const results: TimetableResult[] = [];
  for (const feed of feeds) {
    const origins = new Map(matchStop(feed, from).map(stop => [stop.stop_id, stop]));
    const destinations = new Map(matchStop(feed, to).map(stop => [stop.stop_id, stop]));
    if (!origins.size || !destinations.size) continue;
    const stops = new Map(feed.stops.map(stop => [stop.stop_id, stop]));
    const routes = new Map(feed.routes.map(route => [route.route_id, route]));
    const activeTrips = feed.trips.filter(trip => isServiceActive(feed, trip.service_id, date));
    const tripIds = new Set(activeTrips.map(trip => trip.trip_id));
    const byTrip = new Map<string, typeof feed.stopTimes>();
    for (const row of feed.stopTimes) {
      if (!tripIds.has(row.trip_id)) continue;
      const list = byTrip.get(row.trip_id) || [];
      list.push(row); byTrip.set(row.trip_id, list);
    }
    const tripMap = new Map(activeTrips.map(trip => [trip.trip_id, trip]));
    for (const [tripId, rows] of byTrip) {
      rows.sort((a, b) => a.stop_sequence - b.stop_sequence);
      for (let i = 0; i < rows.length; i++) {
        const origin = origins.get(rows[i].stop_id);
        if (!origin) continue;
        const departure = timeParts(rows[i].departure_time || rows[i].arrival_time);
        if (!departure) continue;
        for (let j = i + 1; j < rows.length; j++) {
          const destination = destinations.get(rows[j].stop_id);
          if (!destination) continue;
          const arrival = timeParts(rows[j].arrival_time || rows[j].departure_time);
          if (!arrival || arrival.dayOffset * 1440 + arrival.minutes < departure.dayOffset * 1440 + departure.minutes) continue;
          const trip = tripMap.get(tripId)!;
          const route = routes.get(trip.route_id);
          if (!route) continue;
          const agency = feed.agency.find(a => !a.agency_id || a.agency_id === route.agency_id);
          results.push({
            feedId: feed.feed.id, feedName: feed.feed.name, region: feed.feed.region, sourceUrl: feed.feed.sourcePage,
            sourceType: feed.feed.official ? 'OFFICIAL_PUBLISHER' : 'COMMUNITY_DERIVED',
            verificationStatus: 'UNVERIFIED', importedAt: feed.feed.importedAt, attribution: feed.feed.attribution,
            routeId: route.route_id, routeName: routeLabel(route), tripId, headsign: trip.trip_headsign,
            fromStop: { id: origin.stop_id, name: origin.stop_name }, toStop: { id: destination.stop_id, name: destination.stop_name },
            departureTime: departure.value, arrivalTime: arrival.value,
            departureDayOffset: departure.dayOffset, arrivalDayOffset: arrival.dayOffset,
            serviceDate: date, timezone: agency?.agency_timezone || 'UNKNOWN',
            dataType: 'GTFS_STATIC', liveVehiclePositionsAvailable: false,
          });
          break;
        }
      }
    }
  }
  return results.sort((a, b) => a.departureDayOffset - b.departureDayOffset || a.departureTime.localeCompare(b.departureTime)).slice(0, limit);
}

export function getStopDepartures(feeds: NormalizedGtfsFeed[], stopQuery: string, date: string, requestedLimit = 20) {
  if (!isValidGtfsServiceDate(date)) throw new Error('date must be a valid YYYY-MM-DD service date');
  if (!stopQuery.trim()) throw new Error('stop is required');
  const limit = Math.max(1, Math.min(50, Math.floor(requestedLimit) || 20));
  const output: Array<Record<string, unknown>> = [];
  for (const feed of feeds) {
    const matched = matchStop(feed, stopQuery);
    if (!matched.length) continue;
    const stopIds = new Set(matched.map(stop => stop.stop_id));
    const trips = new Map(feed.trips.filter(t => isServiceActive(feed, t.service_id, date)).map(t => [t.trip_id, t]));
    const routes = new Map(feed.routes.map(r => [r.route_id, r]));
    for (const row of feed.stopTimes) {
      if (!stopIds.has(row.stop_id) || !trips.has(row.trip_id)) continue;
      const departure = timeParts(row.departure_time || row.arrival_time);
      const trip = trips.get(row.trip_id)!;
      const route = routes.get(trip.route_id);
      if (!departure || !route) continue;
      output.push({
        feedId: feed.feed.id, feedName: feed.feed.name, sourceType: feed.feed.official ? 'OFFICIAL_PUBLISHER' : 'COMMUNITY_DERIVED',
        verificationStatus: 'UNVERIFIED', importedAt: feed.feed.importedAt,
        stop: { id: row.stop_id, name: matched.find(s => s.stop_id === row.stop_id)?.stop_name },
        routeId: route.route_id, routeName: routeLabel(route), tripId: trip.trip_id, headsign: trip.trip_headsign,
        departureTime: departure.value, departureDayOffset: departure.dayOffset, serviceDate: date,
        timezone: feed.agency.find(a => !a.agency_id || a.agency_id === route.agency_id)?.agency_timezone || 'UNKNOWN',
        dataType: 'GTFS_STATIC', liveVehiclePositionsAvailable: false,
      });
    }
  }
  return output.sort((a, b) => Number(a.departureDayOffset) - Number(b.departureDayOffset) || String(a.departureTime).localeCompare(String(b.departureTime))).slice(0, limit);
}

export function loadNormalizedGtfsFeeds(directory = process.env.GTFS_DATA_DIR || resolve(process.cwd(), 'artifacts/gtfs')): NormalizedGtfsFeed[] {
  let names: string[];
  try { names = readdirSync(directory).filter(name => /^[a-z0-9][a-z0-9_-]{0,79}\.json$/i.test(name) && name !== 'import-report.json'); }
  catch { return []; }
  const feeds: NormalizedGtfsFeed[] = [];
  for (const name of names.slice(0, 100)) {
    try {
      const value = JSON.parse(readFileSync(resolve(directory, name), 'utf8')) as NormalizedGtfsFeed;
      if (value.schemaVersion !== 1 || !value.feed?.id || !Array.isArray(value.stops) || !Array.isArray(value.routes) ||
          !Array.isArray(value.trips) || !Array.isArray(value.stopTimes) || !Array.isArray(value.calendar) ||
          !Array.isArray(value.calendarDates) || !Array.isArray(value.agency)) continue;
      feeds.push(value);
    } catch { /* Ignore invalid individual snapshots; never fail the whole API process. */ }
  }
  return feeds;
}
