import { evaluateObservationFreshness, evaluateTimetableFreshness } from '../../packages/shared/src/engine/staleDetector.js';

export function runStaleDetectorTests(assert: (desc: string, pass: boolean) => void) {
  const now = new Date();

  // Test 1: Fresh observation (20 seconds ago) -> LIVE
  const freshTime = new Date(now.getTime() - 20 * 1000).toISOString();
  const freshRes = evaluateObservationFreshness(freshTime, now.toISOString(), 120, 600);
  assert('Observation under 120s is LIVE', freshRes.displayState === 'LIVE');
  assert('Fresh observation is not stale', !freshRes.isStale);

  // Test 2: Moderate age observation (250 seconds ago) -> LAST_KNOWN
  const lastKnownTime = new Date(now.getTime() - 250 * 1000).toISOString();
  const lastKnownRes = evaluateObservationFreshness(lastKnownTime, now.toISOString(), 120, 600);
  assert('Observation between 120s and 600s is LAST_KNOWN', lastKnownRes.displayState === 'LAST_KNOWN');
  assert('Last known observation is marked stale', lastKnownRes.isStale);

  // Test 3: Very old observation (800 seconds ago) -> UNAVAILABLE
  const unavailableTime = new Date(now.getTime() - 800 * 1000).toISOString();
  const unavailRes = evaluateObservationFreshness(unavailableTime, now.toISOString(), 120, 600);
  assert('Observation older than 600s is UNAVAILABLE', unavailRes.displayState === 'UNAVAILABLE');

  // Test 4: Timetable verification age check
  const oldVerified = new Date(now.getTime() - 120 * 24 * 3600 * 1000).toISOString(); // 120 days ago
  const ttFreshness = evaluateTimetableFreshness(oldVerified, now.toISOString(), 90);
  assert('Timetable verified over 90 days ago flags needsVerification', ttFreshness.needsVerification);
}
