import { Router } from 'express';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildPublicGtfsCatalogue } from '../engine/gtfsCatalogue.js';
import { getStopDepartures, isServiceActive, isValidGtfsServiceDate, loadNormalizedGtfsFeeds, searchGtfsJourneys } from '../engine/publicGtfsRuntime.js';

export const timetableRouter = Router();

function parseLimit(value: unknown) {
  if (value === undefined) return 20;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= 50 ? parsed : null;
}
function serviceDate(value: unknown) {
  return typeof value === 'string' && isValidGtfsServiceDate(value) ? value : null;
}
function getFeeds() { return loadNormalizedGtfsFeeds(); }

// GET /api/timetable/feeds — feed provenance plus the actual locally installed snapshot state.
timetableRouter.get('/feeds', (_req, res) => {
  try {
    const registryPath = resolve(process.cwd(), 'data/gtfs/sources.json');
    const registry = JSON.parse(readFileSync(registryPath, 'utf8'));
    const catalogue = buildPublicGtfsCatalogue(registry);
    const installed = getFeeds();
    const installedIds = new Set(installed.map(feed => feed.feed.id));
    const feeds = catalogue.feeds.map(feed => ({
      ...feed,
      snapshotInstalled: installedIds.has(feed.id),
      snapshotImportedAt: installed.find(item => item.feed.id === feed.id)?.feed.importedAt || null,
    }));
    res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
    res.setHeader('X-Timetable-Data-Type', 'GTFS-STATIC');
    return res.json({
      ...catalogue,
      feeds,
      snapshot: { ...catalogue.snapshot, status: installed.length ? 'SNAPSHOT_AVAILABLE' : 'SNAPSHOT_NOT_INSTALLED' },
      counts: { ...catalogue.counts, installedFeeds: installed.length },
    });
  } catch {
    return res.status(503).json({
      error: 'The public timetable source catalogue is temporarily unavailable.',
      timetableStatus: 'UNAVAILABLE',
      liveVehiclePositionsAvailable: false,
    });
  }
});

// GET /api/timetable/search?from=...&to=...&date=YYYY-MM-DD&limit=20
timetableRouter.get('/search', (req, res) => {
  const from = typeof req.query.from === 'string' ? req.query.from.trim() : '';
  const to = typeof req.query.to === 'string' ? req.query.to.trim() : '';
  const date = serviceDate(req.query.date);
  const limit = parseLimit(req.query.limit);
  if (!from || !to || !date || limit === null) {
    return res.status(400).json({ error: 'Required: from, to, valid date (YYYY-MM-DD); limit must be 1–50.' });
  }
  const feeds = getFeeds();
  if (!feeds.length) return res.status(503).json({ timetableStatus: 'UNAVAILABLE', error: 'No validated GTFS snapshot is installed on this server.', results: [], liveVehiclePositionsAvailable: false });
  try {
    const results = searchGtfsJourneys(feeds, from, to, date, limit);
    res.setHeader('Cache-Control', 'public, max-age=30, stale-while-revalidate=60');
    res.setHeader('X-Timetable-Data-Type', 'GTFS-STATIC');
    return res.json({ timetableStatus: results.length ? 'SCHEDULED_UNVERIFIED' : 'NO_SERVICE_FOUND', dataType: 'GTFS_STATIC', serviceDate: date, resultCount: results.length, results, liveVehiclePositionsAvailable: false });
  } catch {
    return res.status(400).json({ error: 'Invalid timetable search parameters.' });
  }
});

// GET /api/timetable/stops/:stopId/departures?date=YYYY-MM-DD&limit=20
timetableRouter.get('/stops/:stopId/departures', (req, res) => {
  const date = serviceDate(req.query.date);
  const limit = parseLimit(req.query.limit);
  if (!date || limit === null || !req.params.stopId.trim()) return res.status(400).json({ error: 'Required: stopId and valid date (YYYY-MM-DD); limit must be 1–50.' });
  const feeds = getFeeds();
  if (!feeds.length) return res.status(503).json({ timetableStatus: 'UNAVAILABLE', error: 'No validated GTFS snapshot is installed on this server.', departures: [], liveVehiclePositionsAvailable: false });
  const departures = getStopDepartures(feeds, req.params.stopId, date, limit);
  return res.json({ timetableStatus: departures.length ? 'SCHEDULED_UNVERIFIED' : 'NO_SERVICE_FOUND', dataType: 'GTFS_STATIC', serviceDate: date, resultCount: departures.length, departures, liveVehiclePositionsAvailable: false });
});

// GET /api/timetable/routes/:routeId?feedId=optional-feed-id
timetableRouter.get('/routes/:routeId', (req, res) => {
  const feeds = getFeeds();
  const requestedFeedId = typeof req.query.feedId === 'string' ? req.query.feedId : undefined;
  const matches = feeds.filter(feed =>
    (!requestedFeedId || feed.feed.id === requestedFeedId) &&
    feed.routes.some(item => item.route_id === req.params.routeId)
  );
  if (matches.length > 1) {
    return res.status(409).json({ error: 'Route ID exists in multiple feeds; provide the feedId query parameter.' });
  }
  const feed = matches[0];
  if (!feed) return res.status(404).json({ error: 'Route not found in installed GTFS snapshots.' });
  const route = feed.routes.find(item => item.route_id === req.params.routeId)!;
  const agency = feed.agency.find(item => !item.agency_id || item.agency_id === route.agency_id);
  const trips = feed.trips.filter(item => item.route_id === route.route_id &&
    (!requestedDate || (requestedDate && isServiceActive(feed, item.service_id, requestedDate))));
  const tripIds = new Set(trips.map(item => item.trip_id));
  const stopsById = new Map(feed.stops.map(stop => [stop.stop_id, stop]));
  const stopTimes = feed.stopTimes.filter(item => tripIds.has(item.trip_id))
    .sort((a, b) => a.trip_id.localeCompare(b.trip_id) || a.stop_sequence - b.stop_sequence);
  return res.json({
    route: { id: route.route_id, shortName: route.route_short_name, longName: route.route_long_name, routeType: route.route_type },
    feed: { id: feed.feed.id, name: feed.feed.name, official: !!feed.feed.official, verificationStatus: 'UNVERIFIED', importedAt: feed.feed.importedAt, attribution: feed.feed.attribution },
    agencyTimezone: agency?.agency_timezone || 'UNKNOWN',
    ...(requestedDate ? { serviceDate: requestedDate, timetableStatus: trips.length ? 'SCHEDULED_UNVERIFIED' : 'NO_SERVICE_FOUND' } : {}),
    trips: trips.map(trip => ({
      tripId: trip.trip_id, serviceId: trip.service_id, headsign: trip.trip_headsign,
      stopTimes: stopTimes.filter(row => row.trip_id === trip.trip_id).map(row => ({
        stopId: row.stop_id, stopName: stopsById.get(row.stop_id)?.stop_name || row.stop_id,
        stopSequence: row.stop_sequence, arrivalTime: row.arrival_time || null, departureTime: row.departure_time || null,
      })),
    })),
    dataType: 'GTFS_STATIC', liveVehiclePositionsAvailable: false,
  });
});
