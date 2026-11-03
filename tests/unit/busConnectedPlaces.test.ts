import { buildBusConnectedPlaceSuggestions, buildNearbyBusPlaceSuggestions } from '../../backend/src/engine/busConnectedPlaces.js';
import type { NormalizedGtfsFeed } from '../../backend/src/engine/publicGtfsRuntime.js';

const feed: NormalizedGtfsFeed = {
  schemaVersion: 1,
  feed: { id: 'wb-test', name: 'West Bengal Test Bus', region: 'West Bengal', mode: 'bus', official: true, importedAt: '2026-11-02T00:00:00.000Z', sourcePage: 'https://example.org/feed', attribution: 'Test attribution' },
  agency: [{ agency_id: 'wb', agency_name: 'Test Bus', agency_timezone: 'Asia/Kolkata' }],
  routes: [{ route_id: 'r1', agency_id: 'wb', route_short_name: 'WB1' }],
  stops: [
    { stop_id: 'kgp', stop_name: 'Kharagpur Bus Stand', stop_lat: 22.346, stop_lon: 87.232 },
    { stop_id: 'jgm', stop_name: 'Jhargram Bus Stand', stop_lat: 22.453, stop_lon: 86.994 },
    { stop_id: 'no-coordinates', stop_name: 'Unlocated Stop' },
    { stop_id: 'no-service', stop_name: 'No Service Stop', stop_lat: 22.4, stop_lon: 87.1 },
    { stop_id: 'town-stop', stop_name: 'Town Road Stop', stop_lat: 22.35, stop_lon: 87.24 },
  ],
  trips: [{ route_id: 'r1', service_id: 'weekday', trip_id: 't1' }],
  stopTimes: [
    { trip_id: 't1', stop_id: 'kgp', stop_sequence: 1, departure_time: '06:00:00' },
    { trip_id: 't1', stop_id: 'jgm', stop_sequence: 2, arrival_time: '07:00:00' },
    { trip_id: 't1', stop_id: 'no-coordinates', stop_sequence: 3, arrival_time: '07:15:00' },
    { trip_id: 't1', stop_id: 'town-stop', stop_sequence: 4, arrival_time: '07:20:00' },
  ],
  calendar: [{ service_id: 'weekday', monday: '1', tuesday: '1', wednesday: '1', thursday: '1', friday: '1', saturday: '0', sunday: '0', start_date: '20261102', end_date: '20261231' }],
  calendarDates: [],
};

export function runBusConnectedPlaceTests(assert: (description: string, pass: boolean) => void) {
  const matches = buildBusConnectedPlaceSuggestions([feed], 'Kharagpur', '2026-11-02');
  assert('Passenger autocomplete includes a place with an active scheduled bus stop', matches.length === 1 && matches[0].place.sourceRecordId === 'kgp');
  assert('Bus stop suggestions retain coordinates and source evidence', matches[0]?.place.latitude === 22.346 && matches[0]?.place.busServiceEvidence.activeRoutes === 1);
  assert('A place without bus stop-times is excluded', buildBusConnectedPlaceSuggestions([feed], 'No Service', '2026-11-02').length === 0);
  assert('A bus stop without coordinates is excluded from route autocomplete', buildBusConnectedPlaceSuggestions([feed], 'Unlocated', '2026-11-02').length === 0);
  assert('A town/region query returns only active, coordinate-bearing stops from that feed', buildBusConnectedPlaceSuggestions([feed], 'West Bengal', '2026-11-02').length === 2);
  assert('A place outside published feed coverage is not invented', buildBusConnectedPlaceSuggestions([feed], 'Ranchi', '2026-11-02').length === 0);
  assert('Expired or inactive service dates produce no bus-connected suggestions', buildBusConnectedPlaceSuggestions([feed], 'Kharagpur', '2027-01-01').length === 0);
  const nearby = buildNearbyBusPlaceSuggestions([feed], 22.345, 87.233, '2026-11-02', 20000, 20);
  assert('Nearby search lists major bus stands before ordinary bus stops', nearby.length === 3 && nearby[0].kind === 'BUS_STAND' && nearby[1].kind === 'BUS_STAND' && nearby[2].kind === 'BUS_STOP');
  assert('Nearby results include distance, active route count and stop coordinates', nearby[0].distanceMeters >= 0 && nearby[0].routeCount === 1 && Number.isFinite(nearby[0].place.latitude));
  assert('Nearby search excludes stops outside radius and stops without active trips', buildNearbyBusPlaceSuggestions([feed], 22.345, 87.233, '2026-11-02', 100, 20).length < nearby.length);
  assert('Nearby search returns no stale weekday-only service on Sunday', buildNearbyBusPlaceSuggestions([feed], 22.345, 87.233, '2026-11-08', 5000, 20).length === 0);

}
