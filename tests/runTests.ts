/**
 * YatriBus Master Automated Test Runner
 * Executes all unit and integration test suites without external testing framework dependencies.
 */

import { runNormalizerTests } from './unit/normalizer.test.js';
import { runTypoSearchTests } from './unit/typoSearch.test.js';
import { runDuplicateDetectorTests } from './unit/duplicateDetector.test.js';
import { runRouteMatcherTests } from './unit/routeMatcher.test.js';
import { runConfidenceEngineTests } from './unit/confidenceEngine.test.js';
import { runStaleDetectorTests } from './unit/staleDetector.test.js';
import { runRouteGraphTests } from './unit/routeGraph.test.js';
import { runETACalculatorTests } from './unit/etaCalculator.test.js';
import { runJourneyConfirmationTests } from './unit/journeyConfirmation.test.js';
import { runTimetableVersioningTests } from './unit/timetableVersioning.test.js';
import { runBusCandidateMatcherTests } from './unit/busCandidateMatcher.test.js';
import { runTrackingSessionTests } from './unit/trackingSession.test.js';
import { runGtfsImporterTests } from './unit/gtfsImporter.test.js';
import { runJourneyPlannerTests } from './unit/journeyPlanner.test.js';
import { runTrajectoryMatcherTests } from './unit/trajectoryMatcher.test.js';
import { runTimetableEngineTests } from './unit/timetableEngine.test.js';
import { runPhase4PolicyTests } from './unit/phase4Policy.test.js';
import { runStopQrTests } from './unit/stopQr.test.js';
import { runIndiaCatalogueTests } from './unit/indiaCatalogue.test.js';
import { runPublicGtfsCatalogueTests } from './unit/publicGtfsCatalogue.test.js';

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(description: string, condition: boolean) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✓ PASS: ${description}`);
  } else {
    failedTests++;
    console.error(`  ✗ FAIL: ${description}`);
  }
}

console.log('====================================================');
console.log('🚌 YATRIBUS AUTOMATED TEST SUITE EXECUTION');
console.log('====================================================\n');

console.log('1. Testing Place-Name Normalizer & Transliterations...');
runNormalizerTests(assert);

console.log('\n2. Testing Typo-Tolerant Search & Fuzzy Matching...');
runTypoSearchTests(assert);

console.log('\n3. Testing Duplicate Stop & Route Detector...');
runDuplicateDetectorTests(assert);

console.log('\n4. Testing Spatial Route Matcher & Polyline Projections...');
runRouteMatcherTests(assert);

console.log('\n5. Testing Multi-Signal Location Confidence Engine...');
runConfidenceEngineTests(assert);

console.log('\n6. Testing Freshness & Stale-Data Detector...');
runStaleDetectorTests(assert);

console.log('\n7. Testing Transit Route Graph & Transfer Planning...');
runRouteGraphTests(assert);

console.log('\n8. Testing ETA Calculation (Live GPS vs Timetable Prediction)...');
runETACalculatorTests(assert);

console.log('\n9. Testing Journey Confirmation & Notification Policy Engine...');
runJourneyConfirmationTests(assert);

console.log('\n10. Testing Timetable Versioning & Audit Traceability...');
runTimetableVersioningTests(assert);

console.log('\n11. Testing Privacy-Safe Bus Candidate Matching & Ambiguity Handling...');
runBusCandidateMatcherTests(assert);

console.log('\n12. Testing Consent-Bound Destination Auto-Completion...');
runTrackingSessionTests(assert);

console.log('\n13. Testing GTFS ZIP Import, Calendar Exceptions & Midnight Trips...');
runGtfsImporterTests(assert);

console.log('\n14. Testing Time-Aware Multi-Transfer Journey Planning...');
runJourneyPlannerTests(assert);

console.log('\n15. Testing Multi-Sample Bus Trajectory Corroboration...');
runTrajectoryMatcherTests(assert);

console.log('\\n16. Testing India States, UTs, Government Operators & Pilot Directory...');
runIndiaCatalogueTests(assert);
runPublicGtfsCatalogueTests(assert);

console.log('\\n17. Testing Source-Aware Timetable Availability...');
runTimetableEngineTests(assert);

console.log('\\n18. Testing Phase 4 Offline Cache & Passenger Alert Policy...');
runPhase4PolicyTests(assert);

console.log('\\n19. Testing Signed Stop QR Token Security...');
runStopQrTests(assert);

console.log('\n====================================================');
console.log(`SUMMARY: ${passedTests}/${totalTests} Tests Passed (${failedTests} Failed)`);
console.log('====================================================');

if (failedTests > 0) {
  process.exit(1);
} else {
  console.log('🎉 ALL AUTOMATED TESTS VERIFIED SUCCESSFULLY!');
  process.exit(0);
}
