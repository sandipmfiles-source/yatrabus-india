import { formatGtfsTime, getStopDepartures, isServiceActive, isValidGtfsServiceDate, searchGtfsJourneys, type NormalizedGtfsFeed } from '../../backend/src/engine/publicGtfsRuntime.js';

const sample: NormalizedGtfsFeed = {
  schemaVersion: 1,
  feed: { id: 'wb-demo', name: 'West Bengal Demo', region: 'West Bengal', official: false, importedAt: '2026-11-03T00:00:00.000Z', attribution: 'Demo attribution' },
  agency: [{ agency_id: 'wb', agency_name: 'Demo Transit', agency_timezone: 'Asia/Kolkata' }],
  routes: [{ route_id: 'r1', agency_id: 'wb', route_short_name: 'WB1', route_long_name: 'Kharagpur - Jhargram' }],
  stops: [
    { stop_id: 'kgp', stop_name: 'Kharagpur' },
    { stop_id: 'mid', stop_name: 'Midway' },
    { stop_id: 'jgm', stop_name: 'Jhargram' },
  ],
  trips: [{ route_id: 'r1', service_id: 'weekday', trip_id: 't1', trip_headsign: 'Jhargram' }],
  stopTimes: [
    { trip_id: 't1', stop_id: 'kgp', stop_sequence: 1, departure_time: '23:50:00', arrival_time: '23:50:00' },
    { trip_id: 't1', stop_id: 'mid', stop_sequence: 2, departure_time: '24:10:00', arrival_time: '24:08:00' },
    { trip_id: 't1', stop_id: 'jgm', stop_sequence: 3, departure_time: '24:40:00', arrival_time: '24:40:00' },
  ],
  calendar: [{ service_id: 'weekday', monday: '1', tuesday: '1', wednesday: '1', thursday: '1', friday: '1', saturday: '0', sunday: '0', start_date: '20261102', end_date: '20261231' }],
  calendarDates: [{ service_id: 'weekday', date: '20261103', exception_type: '2' }],
};

export function runPublicGtfsRuntimeTests(assert: (description: string, pass: boolean) => void) {
  assert('GTFS API date validation accepts a real leap-day date', isValidGtfsServiceDate('2028-02-29'));
  assert('GTFS API date validation rejects impossible month days', !isValidGtfsServiceDate('2026-02-31'));
  assert('GTFS API date validation rejects malformed dates', !isValidGtfsServiceDate('03-11-2026'));
  assert('GTFS route detail clock formatter converts after-midnight times with day offset', formatGtfsTime('24:40:00')?.time === '00:40' && formatGtfsTime('24:40:00')?.dayOffset === 1);
  assert('GTFS service calendar activates a weekday within its date range', isServiceActive(sample, 'weekday', '2026-11-02'));
  assert('GTFS calendar_dates removal overrides a normal weekday', !isServiceActive(sample, 'weekday', '2026-11-03'));
  assert('GTFS calendar_dates addition activates an otherwise inactive service date', isServiceActive({
    ...sample, calendarDates: [{ service_id: 'weekday', date: '20261107', exception_type: '1' }],
  }, 'weekday', '2026-11-07'));
  assert('GTFS service is inactive outside calendar start/end dates', !isServiceActive(sample, 'weekday', '2027-01-01'));
  const journeys = searchGtfsJourneys([sample], 'Kharagpur', 'Jhargram', '2026-11-02');
  assert('Passenger search matches stop names and returns a direct trip', journeys.length === 1 && journeys[0].tripId === 't1');
  assert('GTFS times after midnight retain service-day offsets', journeys[0]?.departureTime === '23:50' && journeys[0]?.arrivalTime === '00:40' && journeys[0]?.arrivalDayOffset === 1);
  assert('Passenger results preserve timezone, provenance and unverified status', journeys[0]?.timezone === 'Asia/Kolkata' && journeys[0]?.sourceType === 'COMMUNITY_DERIVED' && journeys[0]?.verificationStatus === 'UNVERIFIED');
  assert('Static timetable results never claim live GPS positions', journeys[0]?.dataType === 'GTFS_STATIC' && journeys[0]?.liveVehiclePositionsAvailable === false);
  assert('Search does not return a trip on a removed service date', searchGtfsJourneys([sample], 'Kharagpur', 'Jhargram', '2026-11-03').length === 0);
  const departures = getStopDepartures([sample], 'kgp', '2026-11-02');
  assert('Departure board resolves a stop ID and returns its scheduled departure', departures.length === 1 && departures[0].departureTime === '23:50');
  assert('Passenger search caps result limits at 50', searchGtfsJourneys([sample], 'Kharagpur', 'Jhargram', '2026-11-02', 500).length <= 50);
  let rejected = false;
  try { searchGtfsJourneys([sample], 'Kharagpur', 'Jhargram', 'not-a-date'); } catch { rejected = true; }
  assert('Passenger search rejects malformed service dates', rejected);
  let impossibleRejected = false;
  try { searchGtfsJourneys([sample], 'Kharagpur', 'Jhargram', '2026-02-31'); } catch { impossibleRejected = true; }
  assert('Passenger search rejects impossible calendar dates', impossibleRejected);
}
