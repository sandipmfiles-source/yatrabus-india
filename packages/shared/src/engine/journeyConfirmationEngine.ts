import { Route, TimetableDeparture } from '../types/bus.js';
import { JourneyPromptEvaluation } from '../types/tracking.js';

export interface JourneyEngineOptions {
  windowBeforeMinutes: number; // e.g. 20 minutes prior to departure
  windowAfterMinutes: number;  // e.g. 45 minutes after scheduled start
  maxDismissalsBeforeMute: number; // e.g. 2 dismissals
}

const DEFAULT_OPTIONS: JourneyEngineOptions = {
  windowBeforeMinutes: 20,
  windowAfterMinutes: 45,
  maxDismissalsBeforeMute: 2,
};

const DAY_MAP = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'] as const;

/**
 * Evaluates whether a passenger searching or viewing a bus should be prompted with:
 * "Are you travelling on this bus?"
 * Respects user preferences, dismissal counts, and schedule plausibility.
 */
export function evaluateJourneyPrompt(
  route: Route,
  userState: {
    isAlreadyTrackingThisBus: boolean;
    dismissedCountForRoute: number;
    hasExplicitlyDeclined: boolean;
  },
  currentServerTimeIso: string = new Date().toISOString(),
  options: JourneyEngineOptions = DEFAULT_OPTIONS
): JourneyPromptEvaluation {
  // 1. If user is already tracking this bus or has an active session
  if (userState.isAlreadyTrackingThisBus) {
    return {
      shouldPrompt: false,
      reason: 'User already has an active journey tracking session',
    };
  }

  // 2. If user explicitly declined or reached dismissal limit
  if (userState.hasExplicitlyDeclined) {
    return {
      shouldPrompt: false,
      reason: 'Passenger previously declined journey prompt for this service',
    };
  }

  if (userState.dismissedCountForRoute >= options.maxDismissalsBeforeMute) {
    return {
      shouldPrompt: false,
      reason: `Prompt muted after ${userState.dismissedCountForRoute} dismissals to prevent notification spam`,
    };
  }

  // 3. Check operating days
  const now = new Date(currentServerTimeIso);
  const currentDay = DAY_MAP[now.getDay()];
  if (!route.operatingDays.includes(currentDay)) {
    return {
      shouldPrompt: false,
      reason: `Route does not operate on ${currentDay}`,
    };
  }

  // 4. Check schedule departure window
  const nowTotalMinutes = now.getHours() * 60 + now.getMinutes();

  // Parse first and last departure times
  const [firstH, firstM] = route.firstDepartureTime.split(':').map(Number);
  const [lastH, lastM] = route.lastDepartureTime.split(':').map(Number);
  const firstTotal = firstH * 60 + firstM;
  const lastTotal = lastH * 60 + lastM;

  // Check if within operating window of the route
  const isWithinWindow =
    nowTotalMinutes >= firstTotal - options.windowBeforeMinutes &&
    nowTotalMinutes <= lastTotal + options.windowAfterMinutes;

  if (!isWithinWindow) {
    return {
      shouldPrompt: false,
      reason: `Current time is outside route operational hours (${route.firstDepartureTime} - ${route.lastDepartureTime})`,
    };
  }

  // Calculate nearest departure
  let nearestDepartureTime = route.firstDepartureTime;
  let minDiff = Infinity;

  // If frequency provided, synthesize departures
  const freq = route.frequencyMinutes || 30;
  for (let t = firstTotal; t <= lastTotal; t += freq) {
    const diff = Math.abs(t - nowTotalMinutes);
    if (diff < minDiff) {
      minDiff = diff;
      const h = String(Math.floor(t / 60)).padStart(2, '0');
      const m = String(t % 60).padStart(2, '0');
      nearestDepartureTime = `${h}:${m}`;
    }
  }

  return {
    shouldPrompt: true,
    reason: `Bus scheduled around ${nearestDepartureTime}. Helpful for real-time passenger corroboration.`,
    routeId: route.id,
    routeNumber: route.routeNumber,
    scheduledDepartureTime: nearestDepartureTime,
    timeRemainingMinutes: minDiff,
  };
}
