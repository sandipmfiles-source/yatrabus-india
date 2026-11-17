import { haversineDistanceMeters, matchPointToRoute, calculateBearingDegrees } from '../../packages/shared/src/engine/routeMatcher.js';
import { Route } from '../../packages/shared/src/types/bus.js';

export function runRouteMatcherTests(assert: (desc: string, pass: boolean) => void) {
  // Test 1: Haversine distance between two known Delhi points (~10 km)
  // Kashmere Gate to Connaught Place is approx 4.5 km
  const dist = haversineDistanceMeters(28.6675, 77.2285, 28.6315, 77.2167);
  assert('Haversine distance between Kashmere Gate and CP is ~4.1-4.3 km', dist > 4000 && dist < 4500);

  // Test 2: Point matching to route polyline
  const testRoute: Route = {
    id: 'test-route-1',
    routeNumber: '100',
    routeName: 'Test Corridor',
    originStopId: 's1',
    originStopName: 'Stop A',
    destinationStopId: 's2',
    destinationStopName: 'Stop B',
    operatorId: 'op-1',
    direction: 'UP',
    distanceKm: 10,
    typicalDurationMinutes: 30,
    operatingDays: ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'],
    firstDepartureTime: '06:00',
    lastDepartureTime: '22:00',
    stops: [
      { id: '1', routeId: 'test-route-1', stopId: 's1', stopName: 'Stop A', stopSequence: 1, latitude: 28.60, longitude: 77.20, distanceFromStartKm: 0 },
      { id: '2', routeId: 'test-route-1', stopId: 's2', stopName: 'Stop B', stopSequence: 2, latitude: 28.65, longitude: 77.20, distanceFromStartKm: 5.5 },
    ],
    geometry: [
      { latitude: 28.60, longitude: 77.20 },
      { latitude: 28.65, longitude: 77.20 },
    ],
    verificationStatus: 'ADMIN_VERIFIED',
    serviceStatus: 'OPERATING_SCHEDULED',
    createdAt: '',
    updatedAt: '',
  };

  // Coordinate directly on the segment (28.625, 77.20)
  const matchOnRoute = matchPointToRoute(28.625, 77.20, testRoute, 150);
  assert('Matches point located directly on route path', matchOnRoute.isMatched);
  assert('Calculates approximate half-way progress ratio (~0.5)', Math.abs(matchOnRoute.estimatedProgressRatio - 0.5) < 0.1);

  // Coordinate far off path (5 km away)
  const matchOffRoute = matchPointToRoute(28.625, 77.25, testRoute, 150);
  assert('Rejects point far from route (>150m)', !matchOffRoute.isMatched);
}
