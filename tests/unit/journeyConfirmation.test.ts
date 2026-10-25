import { evaluateJourneyPrompt } from '../../packages/shared/src/engine/journeyConfirmationEngine.js';
import { Route } from '../../packages/shared/src/types/bus.js';

export function runJourneyConfirmationTests(assert: (desc: string, pass: boolean) => void) {
  const route: Route = {
    id: 'r-534',
    routeNumber: '534',
    routeName: 'Anand Vihar to Mehrauli',
    originStopId: 's1',
    originStopName: 'Anand Vihar',
    destinationStopId: 's2',
    destinationStopName: 'Mehrauli',
    operatorId: 'op1',
    direction: 'UP',
    distanceKm: 20,
    typicalDurationMinutes: 60,
    operatingDays: ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'],
    firstDepartureTime: '06:00',
    lastDepartureTime: '22:00',
    frequencyMinutes: 15,
    stops: [],
    verificationStatus: 'ADMIN_VERIFIED',
    serviceStatus: 'OPERATING_SCHEDULED',
    createdAt: '',
    updatedAt: '',
  };

  // Test 1: User already tracking this bus -> No prompt
  const resAlreadyTracking = evaluateJourneyPrompt(route, {
    isAlreadyTrackingThisBus: true,
    dismissedCountForRoute: 0,
    hasExplicitlyDeclined: false,
  });
  assert('Does not prompt if user already has an active tracking session', !resAlreadyTracking.shouldPrompt);

  // Test 2: User explicitly declined previously -> No prompt
  const resDeclined = evaluateJourneyPrompt(route, {
    isAlreadyTrackingThisBus: false,
    dismissedCountForRoute: 0,
    hasExplicitlyDeclined: true,
  });
  assert('Does not prompt if user previously declined', !resDeclined.shouldPrompt);

  // Test 3: Dismissal limit reached (2 dismissals) -> Muted
  const resMuted = evaluateJourneyPrompt(route, {
    isAlreadyTrackingThisBus: false,
    dismissedCountForRoute: 2,
    hasExplicitlyDeclined: false,
  });
  assert('Mutes prompt after reaching dismissal threshold', !resMuted.shouldPrompt);
}
