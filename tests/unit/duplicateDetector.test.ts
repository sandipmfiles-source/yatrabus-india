import { checkDuplicateStop, checkDuplicateRoute } from '../../packages/shared/src/engine/duplicateDetector.js';

export function runDuplicateDetectorTests(assert: (desc: string, pass: boolean) => void) {
  // Test 1: Near-identical stop located within 40 meters
  const dupStopRes = checkDuplicateStop(
    { name: 'Kashmere Gate Metro Gate 1', latitude: 28.6675, longitude: 77.2285 },
    { name: 'ISBT Kashmere Gate Bus Stand', latitude: 28.6677, longitude: 77.2287 }
  );
  assert('Detects likely duplicate stop within close spatial distance (<50m)', dupStopRes.isLikelyDuplicate);
  assert('Generates MERGE_CANDIDATE recommendation for close duplicate', dupStopRes.recommendation === 'MERGE_CANDIDATE');

  // Test 2: Two stops with same name in different cities
  const distinctStopRes = checkDuplicateStop(
    { name: 'Gandhi Chowk', latitude: 28.6139, longitude: 77.2090 }, // Delhi
    { name: 'Gandhi Chowk', latitude: 19.0760, longitude: 72.8777 }  // Mumbai (1100 km away)
  );
  assert('Correctly flags stops with same name in different cities as DISTINCT', !distinctStopRes.isLikelyDuplicate);
  assert('Recommendation is DISTINCT for distant stops', distinctStopRes.recommendation === 'DISTINCT');
}
