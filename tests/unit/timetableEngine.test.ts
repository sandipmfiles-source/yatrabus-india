import type { Route } from '../../packages/shared/src/types/bus.js';
import { getUpcomingServiceDepartures } from '../../packages/shared/src/engine/timetableEngine.js';

const route: Route = {
  id: 'gtfs-test', routeNumber: 'GT1', routeName: 'Test overnight service',
  originStopId: 'a', originStopName: 'A', destinationStopId: 'b', destinationStopName: 'B',
  operatorId: 'op', direction: 'UP', distanceKm: 10, typicalDurationMinutes: 50,
  operatingDays: ['MON', 'TUE', 'WED'], firstDepartureTime: '23:50', lastDepartureTime: '23:50',
  stops: [
    { id: 's1', routeId: 'gtfs-test', stopId: 'a', stopName: 'A', stopSequence: 1, latitude: 22.3, longitude: 87.2, distanceFromStartKm: 0 },
    { id: 's2', routeId: 'gtfs-test', stopId: 'b', stopName: 'B', stopSequence: 2, latitude: 22.4, longitude: 87.3, distanceFromStartKm: 10 },
  ],
  departures: [{
    id: 'trip-1', tripId: 'trip-1', timetableId: 'gtfs-test',
    departureTime: '23:50', arrivalTime: '00:40', departureDayOffset: 0,
    stopTimes: [
      { stopId: 'a', departureTime: '23:50', departureDayOffset: 0 },
      { stopId: 'b', arrivalTime: '00:40', arrivalDayOffset: 1 },
    ],
    operatingDays: ['MON', 'TUE', 'WED'],
    removedServiceDates: ['20261103'],
    addedServiceDates: ['20261108'],
    serviceStartDate: '20261102', serviceEndDate: '20261130',
    confidenceScore: 90, isCancelled: false,
  }],
  verificationStatus: 'UNVERIFIED', serviceStatus: 'SCHEDULE_UNVERIFIED', createdAt: '', updatedAt: '',
};

export function runTimetableEngineTests(assert: (description: string, pass: boolean) => void) {
  const mondayEvening = getUpcomingServiceDepartures(route, 'a', 'b', '2026-11-02T17:00:00.000Z');
  assert('Timetable engine finds the Monday evening departure', mondayEvening.length > 0);
  assert('GTFS arrival after midnight is represented as the next IST day', mondayEvening[0]?.arrivalDayOffset === 1 && mondayEvening[0]?.arrivalTime === '00:40');

  const removedTuesday = getUpcomingServiceDepartures(route, 'a', 'b', '2026-11-03T17:00:00.000Z', { daysAhead: 0 });
  assert('GTFS calendar_dates removal suppresses a regular weekday trip', removedTuesday.length === 0);

  const addedSunday = getUpcomingServiceDepartures(route, 'a', 'b', '2026-11-08T17:00:00.000Z', { daysAhead: 0 });
  assert('GTFS calendar_dates addition can activate an otherwise inactive service date', addedSunday.length > 0);

  const invalid = getUpcomingServiceDepartures(route, 'missing', 'b', '2026-11-02T17:00:00.000Z');
  assert('Timetable engine rejects stop IDs not belonging to the route', invalid.length === 0);
}
