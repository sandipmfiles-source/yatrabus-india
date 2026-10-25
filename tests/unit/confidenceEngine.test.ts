import { evaluateLocationConfidence } from '../../packages/shared/src/engine/confidenceEngine.js';
import { Route } from '../../packages/shared/src/types/bus.js';

export function runConfidenceEngineTests(assert: (desc: string, pass: boolean) => void) {
  const mockRoute: Route = {
    id: 'r-test',
    routeNumber: '534',
    routeName: 'Anand Vihar to Mehrauli',
    originStopId: 's1',
    originStopName: 'Anand Vihar',
    destinationStopId: 's2',
    destinationStopName: 'Mehrauli',
    operatorId: 'op-1',
    direction: 'UP',
    distanceKm: 20,
    typicalDurationMinutes: 60,
    operatingDays: ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'],
    firstDepartureTime: '06:00',
    lastDepartureTime: '22:00',
    stops: [
      { id: '1', routeId: 'r-test', stopId: 's1', stopName: 'Anand Vihar', stopSequence: 1, latitude: 28.6469, longitude: 77.3160, distanceFromStartKm: 0 },
      { id: '2', routeId: 'r-test', stopId: 's2', stopName: 'Mehrauli', stopSequence: 2, latitude: 28.5180, longitude: 77.1850, distanceFromStartKm: 20 },
    ],
    geometry: [
      { latitude: 28.6469, longitude: 77.3160 },
      { latitude: 28.5180, longitude: 77.1850 },
    ],
    verificationStatus: 'ADMIN_VERIFIED',
    serviceStatus: 'OPERATING_SCHEDULED',
    createdAt: '',
    updatedAt: '',
  };

  const nowIso = new Date().toISOString();

  // Test 1: High accuracy, fresh observation, directly on route
  const highConfResult = evaluateLocationConfidence(
    {
      latitude: 28.6469,
      longitude: 77.3160,
      accuracyMeters: 10,
      timestamp: nowIso,
      speedKmh: 25,
      sessionId: 'sess-1',
    },
    mockRoute,
    nowIso,
    2 // 2 independent corroborations
  );

  assert('High accuracy & fresh observation receives HIGH or MODERATE confidence', highConfResult.category === 'HIGH' || highConfResult.category === 'MODERATE');
  assert('Publishable as Live observation', highConfResult.isPublishableAsLive);

  // Test 2: Stale observation (300 seconds old)
  const staleTimeIso = new Date(Date.now() - 300 * 1000).toISOString();
  const staleResult = evaluateLocationConfidence(
    {
      latitude: 28.6469,
      longitude: 77.3160,
      accuracyMeters: 10,
      timestamp: staleTimeIso,
      speedKmh: 25,
      sessionId: 'sess-1',
    },
    mockRoute,
    nowIso
  );

  assert('Observation older than 120s is NOT publishable as Live', !staleResult.isPublishableAsLive);
  assert('Rejection reason mentions staleness', staleResult.rejectionReason?.includes('stale') === true);

  // Test 3: Physically impossible speed (e.g. 180 km/h)
  const impossibleSpeedResult = evaluateLocationConfidence(
    {
      latitude: 28.6469,
      longitude: 77.3160,
      accuracyMeters: 10,
      timestamp: nowIso,
      speedKmh: 250, // 250 km/h is impossible for bus
      sessionId: 'sess-1',
    },
    mockRoute,
    nowIso
  );

  assert('Rejects observation with physically impossible vehicle speed', !impossibleSpeedResult.isPublishableAsLive);
}
