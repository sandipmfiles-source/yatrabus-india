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

console.log('\n====================================================');
console.log(`SUMMARY: ${passedTests}/${totalTests} Tests Passed (${failedTests} Failed)`);
console.log('====================================================');

if (failedTests > 0) {
  process.exit(1);
} else {
  console.log('🎉 ALL AUTOMATED TESTS VERIFIED SUCCESSFULLY!');
  process.exit(0);
}
