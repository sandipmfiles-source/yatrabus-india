import { discoverJourneys, estimateDailyTripCount } from '../../packages/shared/src/engine/routeGraph.js';
import { Route } from '../../packages/shared/src/types/bus.js';

export function runRouteGraphTests(assert: (desc: string, pass: boolean) => void) {
  const routes: Route[] = [
    // Route 1: Stop A -> Stop B -> Stop C
    {
      id: 'r1',
      routeNumber: '101',
      routeName: 'A to C via B',
      originStopId: 'sa',
      originStopName: 'Stop A',
      destinationStopId: 'sc',
      destinationStopName: 'Stop C',
      operatorId: 'op1',
      direction: 'UP',
      distanceKm: 15,
      typicalDurationMinutes: 45,
      operatingDays: ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'],
      firstDepartureTime: '06:00',
      lastDepartureTime: '22:00',
      stops: [
        { id: '1', routeId: 'r1', stopId: 'sa', stopName: 'Stop A', stopSequence: 1, latitude: 28.60, longitude: 77.20, distanceFromStartKm: 0 },
        { id: '2', routeId: 'r1', stopId: 'sb', stopName: 'Stop B (Interchange)', stopSequence: 2, latitude: 28.65, longitude: 77.20, distanceFromStartKm: 7 },
        { id: '3', routeId: 'r1', stopId: 'sc', stopName: 'Stop C', stopSequence: 3, latitude: 28.70, longitude: 77.20, distanceFromStartKm: 15 },
      ],
      verificationStatus: 'ADMIN_VERIFIED',
      serviceStatus: 'OPERATING_SCHEDULED',
      createdAt: '',
      updatedAt: '',
    },
    // Route 2: Stop B -> Stop D
    {
      id: 'r2',
      routeNumber: '202',
      routeName: 'B to D',
      originStopId: 'sb',
      originStopName: 'Stop B (Interchange)',
      destinationStopId: 'sd',
      destinationStopName: 'Stop D',
      operatorId: 'op1',
      direction: 'UP',
      distanceKm: 10,
      typicalDurationMinutes: 30,
      operatingDays: ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'],
      firstDepartureTime: '06:00',
      lastDepartureTime: '22:00',
      stops: [
        { id: '4', routeId: 'r2', stopId: 'sb', stopName: 'Stop B (Interchange)', stopSequence: 1, latitude: 28.65, longitude: 77.20, distanceFromStartKm: 0 },
        { id: '5', routeId: 'r2', stopId: 'sd', stopName: 'Stop D', stopSequence: 2, latitude: 28.68, longitude: 77.25, distanceFromStartKm: 10 },
      ],
      verificationStatus: 'ADMIN_VERIFIED',
      serviceStatus: 'OPERATING_SCHEDULED',
      createdAt: '',
      updatedAt: '',
    },
  ];

  assert('Counts departures from first/last service times and frequency', estimateDailyTripCount('06:00', '22:00', 20) === 49);
  assert('Does not invent trip counts when frequency is missing', estimateDailyTripCount('06:00', '22:00') === undefined);
  assert('Rejects invalid timetable windows', estimateDailyTripCount('22:00', '06:00', 20) === undefined);

  // Direct Search: Stop A to Stop C
  const directResult = discoverJourneys('Stop A', 'Stop C', routes);
  assert('Discovers direct route from Stop A to Stop C', directResult.directRoutes.length === 1);
  assert('Direct route has isDirect=true', directResult.directRoutes[0].isDirect);
  assert('Direct route includes its intermediate stops', directResult.directRoutes[0].intermediateStops?.length === 1);
  assert('Direct route exposes estimated daily trips from frequency', directResult.directRoutes[0].dailyTripCount === 49);

  // Transfer Search: Stop A to Stop D (via Interchange Stop B)
  const transferResult = discoverJourneys('Stop A', 'Stop D', routes);
  assert('Discovers 1-transfer route from Stop A to Stop D', transferResult.transferRoutes.length >= 1);
  assert('Transfer route identifies Stop B as transfer point', transferResult.transferRoutes[0].transfers[0].transferStop.stopName.includes('Stop B'));
}
