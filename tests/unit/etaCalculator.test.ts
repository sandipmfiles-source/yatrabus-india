import { calculateStopETAs } from '../../packages/shared/src/engine/etaCalculator.js';
import { RouteStop } from '../../packages/shared/src/types/bus.js';

export function runETACalculatorTests(assert: (desc: string, pass: boolean) => void) {
  const stops: RouteStop[] = [
    { id: '1', routeId: 'r', stopId: 's1', stopName: 'Stop 1', stopSequence: 1, latitude: 28.60, longitude: 77.20, distanceFromStartKm: 0, scheduledArrivalTime: '08:00' },
    { id: '2', routeId: 'r', stopId: 's2', stopName: 'Stop 2', stopSequence: 2, latitude: 28.62, longitude: 77.20, distanceFromStartKm: 2.5, scheduledArrivalTime: '08:10' },
    { id: '3', routeId: 'r', stopId: 's3', stopName: 'Stop 3', stopSequence: 3, latitude: 28.65, longitude: 77.20, distanceFromStartKm: 6.0, scheduledArrivalTime: '08:25' },
  ];

  // Test 1: Live Observation ETA calculation
  const liveETAs = calculateStopETAs(
    stops,
    0.3, // 30% along route (near Stop 2)
    { latitude: 28.615, longitude: 77.20, speedKmh: 24, isLive: true }
  );

  assert('Returns ETA entries for all stops', liveETAs.length === stops.length);
  const remainingStop = liveETAs[2];
  assert('Calculation type is OBSERVATION_BASED when live GPS is active', remainingStop.calculationType === 'OBSERVATION_BASED');
  assert('Confidence note mentions live estimate and remaining km', remainingStop.confidenceNote.includes('Live estimate'));
  assert('Fresh GPS ETA includes an explicit confidence score', remainingStop.confidenceScore >= 55 && ['MODERATE', 'HIGH'].includes(remainingStop.confidenceCategory));

  // Test 2: Schedule-based ETA fallback (no live GPS)
  const scheduleETAs = calculateStopETAs(stops, 0.0, undefined);
  assert('Calculation type is SCHEDULE_BASED when no GPS available', scheduleETAs[1].calculationType === 'SCHEDULE_BASED');

  const staleETAs = calculateStopETAs(
    stops, 0.3,
    { latitude: 28.615, longitude: 77.20, speedKmh: 24, accuracyMeters: 15, observedAtIso: '2026-11-02T01:00:00.000Z', isLive: true },
    '2026-11-02T02:00:00.000Z'
  );
  assert('Stale GPS cannot be used for a live ETA', staleETAs[2].calculationType === 'SCHEDULE_BASED' && staleETAs[2].confidenceScore < 55);
  const istETAs = calculateStopETAs(stops, 0, undefined, '2026-11-02T02:00:00.000Z');
  assert('ETA clock uses Indian Standard Time rather than server UTC', istETAs[1].predictedTime === '08:10');
}
