import type { Bus, Route } from '../../packages/shared/src/types/bus.js';
import { rankTrajectoryCandidates } from '../../backend/src/engine/trajectoryMatcher.js';

const route: Route = {
  id: 'route-wb-1', routeNumber: 'WB1', routeName: 'Kharagpur to Jhargram',
  originStopId: 'a', originStopName: 'Kharagpur', destinationStopId: 'b', destinationStopName: 'Jhargram',
  operatorId: 'op', direction: 'UP', distanceKm: 20, typicalDurationMinutes: 35,
  operatingDays: ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'],
  firstDepartureTime: '05:00', lastDepartureTime: '23:00', frequencyMinutes: 30,
  stops: [
    { id: 's1', routeId: 'route-wb-1', stopId: 'a', stopName: 'Kharagpur', stopSequence: 1, latitude: 22.346, longitude: 87.232, distanceFromStartKm: 0 },
    { id: 's2', routeId: 'route-wb-1', stopId: 'b', stopName: 'Jhargram', stopSequence: 2, latitude: 22.453, longitude: 86.994, distanceFromStartKm: 20 },
  ],
  geometry: [{ latitude: 22.346, longitude: 87.232 }, { latitude: 22.453, longitude: 86.994 }],
  verificationStatus: 'ADMIN_VERIFIED', serviceStatus: 'OPERATING_SCHEDULED', createdAt: '', updatedAt: '',
};
const bus: Bus = {
  id: 'bus-1', publicIdentifier: 'WB-01', operatorId: 'op', routeId: route.id, vehicleType: 'ORDINARY',
  hasCustomSvgIllustration: true, serviceStatus: 'OPERATING_SCHEDULED', verificationStatus: 'ADMIN_VERIFIED',
  isActive: true, createdAt: '', updatedAt: '',
};
export function runTrajectoryMatcherTests(assert: (description: string, pass: boolean) => void) {
  const now = new Date('2026-11-02T04:00:00.000Z');
  const samples = [
    { sessionId: 's-a', timestamp: '2026-11-02T03:58:00.000Z', latitude: 22.375, longitude: 87.166, accuracyMeters: 12, speedKmh: 35, headingDegrees: 295 },
    { sessionId: 's-a', timestamp: '2026-11-02T04:00:00.000Z', latitude: 22.385, longitude: 87.144, accuracyMeters: 15, speedKmh: 35, headingDegrees: 295 },
  ];
  const matched = rankTrajectoryCandidates([bus], [route], samples, now);
  assert('Two consented time-separated samples corroborate a bus candidate', matched.status === 'CORROBORATED_CANDIDATE' && matched.selected?.busId === bus.id);
  assert('Trajectory result explicitly avoids claiming physical identity verification', matched.explanation.includes('not proof of physical vehicle identity'));
  const one = rankTrajectoryCandidates([bus], [route], samples.slice(0, 1), now);
  assert('A single sample cannot corroborate a bus identity', one.status === 'INSUFFICIENT_SAMPLES');
  const stale = rankTrajectoryCandidates([bus], [route], samples.map(item => ({ ...item, timestamp: '2026-11-02T03:00:00.000Z' })), now);
  assert('Stale or insufficiently separated samples are rejected', stale.status === 'NO_MATCH');
}
