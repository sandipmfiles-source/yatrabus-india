import type { Route } from '../../packages/shared/src/types/bus.js';
import type { ETAResult } from '../../packages/shared/src/engine/etaCalculator.js';
import { getJourneyAlertCandidates, isVerifiedOfflineRoute } from '../../packages/shared/src/engine/phase4Policy.js';

export function runPhase4PolicyTests(assert: (description: string, pass: boolean) => void) {
  const baseRoute = {
    id: 'route-phase4',
    routeNumber: 'P4',
    routeName: 'Jhargram to Kharagpur',
    originStopId: 'a',
    originStopName: 'Jhargram',
    destinationStopId: 'b',
    destinationStopName: 'Kharagpur',
    operatorId: 'op-test',
    direction: 'UP',
    distanceKm: 40,
    typicalDurationMinutes: 90,
    operatingDays: ['MON','TUE','WED','THU','FRI','SAT','SUN'],
    firstDepartureTime: '06:00',
    lastDepartureTime: '20:00',
    stops: [{ id: 's1', routeId: 'route-phase4', stopId: 's1', stopName: 'Jhargram', stopSequence: 1, latitude: 22, longitude: 87, distanceFromStartKm: 0 }],
    verificationStatus: 'ADMIN_VERIFIED',
    serviceStatus: 'OPERATING_SCHEDULED',
    timetableDataStatus: 'SCHEDULED',
    timetableSource: 'Official operator timetable',
    timetableSourceUrl: 'https://example.gov.in/timetable',
    timetableVerifiedAt: '2026-11-03T00:00:00.000Z',
  } as Route;

  assert('Only a source-backed SCHEDULED route is eligible for offline cache', isVerifiedOfflineRoute(baseRoute));
  assert('Offline cache rejects a route without an HTTPS source URL', !isVerifiedOfflineRoute({ ...baseRoute, timetableSourceUrl: 'http://example.gov.in' }));
  assert('Offline cache rejects UNAVAILABLE sample timetables', !isVerifiedOfflineRoute({ ...baseRoute, timetableDataStatus: 'UNAVAILABLE' }));

  const eta = {
    stopId: 's2', stopName: 'Kharagpur', stopSequence: 2,
    scheduledTime: '10:00', predictedTime: '10:15', etaMinutes: 4,
    calculationType: 'OBSERVATION_BASED', confidenceNote: 'fresh GPS',
    confidenceScore: 80, confidenceCategory: 'HIGH',
  } as ETAResult;
  const liveAlerts = getJourneyAlertCandidates(baseRoute, true, [eta], new Date('2026-11-03T05:00:00.000Z'));
  assert('Fresh confident GPS may create an arrival alert', liveAlerts.some(item => item.key.startsWith('arrival:')));
  assert('A 15-minute live prediction delay creates a delay alert', liveAlerts.some(item => item.key.startsWith('delay:')));
  const offlineAlerts = getJourneyAlertCandidates(baseRoute, false, [eta]);
  assert('Stale/offline ETA never creates an arrival or delay alert', offlineAlerts.length === 0);
  const lowConfidence = getJourneyAlertCandidates(baseRoute, true, [{ ...eta, confidenceScore: 20 }] as ETAResult[]);
  assert('Low-confidence GPS never creates an arrival or delay alert', lowConfidence.length === 0);
  const cancelledRoute = { ...baseRoute, departures: [{ id: 'd1', timetableId: 't1', departureTime: '06:00', arrivalTime: '07:00', operatingDays: ['MON'], confidenceScore: 90, isCancelled: true, dataStatus: 'SCHEDULED' }] } as Route;
  assert('Source-verified cancellation creates a service alert', getJourneyAlertCandidates(cancelledRoute, false, []).some(item => item.key.startsWith('cancelled:')));
  const disruptionRoute = { ...baseRoute, serviceStatus: 'DISRUPTION_REPORTED' } as Route;
  assert('Recorded route disruption creates a service alert', getJourneyAlertCandidates(disruptionRoute, false, []).some(item => item.key.startsWith('service:')));
}
