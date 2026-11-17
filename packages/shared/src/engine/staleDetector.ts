import { LocationDisplayState } from '../types/tracking.js';

export interface ObservationFreshnessResult {
  displayState: LocationDisplayState;
  ageSeconds: number;
  label: string;
  isStale: boolean;
}

export interface TimetableFreshnessResult {
  needsVerification: boolean;
  ageDays: number;
  label: string;
}

/**
 * Evaluates the freshness of a GPS observation and determines appropriate display state.
 */
export function evaluateObservationFreshness(
  observationTimestampIso: string | undefined,
  currentServerTimeIso: string = new Date().toISOString(),
  liveThresholdSeconds: number = 120,
  staleThresholdSeconds: number = 600
): ObservationFreshnessResult {
  if (!observationTimestampIso) {
    return {
      displayState: 'UNAVAILABLE',
      ageSeconds: Infinity,
      label: 'No location data',
      isStale: true,
    };
  }

  const nowMs = new Date(currentServerTimeIso).getTime();
  const obsMs = new Date(observationTimestampIso).getTime();
  const ageSeconds = Math.max(0, Math.floor((nowMs - obsMs) / 1000));

  if (ageSeconds <= liveThresholdSeconds) {
    return {
      displayState: 'LIVE',
      ageSeconds,
      label: ageSeconds < 10 ? 'Live now' : `Updated ${ageSeconds}s ago`,
      isStale: false,
    };
  }

  if (ageSeconds <= staleThresholdSeconds) {
    const mins = Math.floor(ageSeconds / 60);
    return {
      displayState: 'LAST_KNOWN',
      ageSeconds,
      label: `Last observed ${mins}m ago`,
      isStale: true,
    };
  }

  return {
    displayState: 'UNAVAILABLE',
    ageSeconds,
    label: 'Location unavailable (stale > 10m)',
    isStale: true,
  };
}

/**
 * Checks if a timetable schedule is due for community/admin re-verification.
 */
export function evaluateTimetableFreshness(
  lastVerifiedAtIso: string,
  currentServerTimeIso: string = new Date().toISOString(),
  reverificationIntervalDays: number = 90
): TimetableFreshnessResult {
  const nowMs = new Date(currentServerTimeIso).getTime();
  const verifiedMs = new Date(lastVerifiedAtIso).getTime();
  const ageDays = Math.max(0, Math.floor((nowMs - verifiedMs) / (1000 * 60 * 60 * 24)));

  if (ageDays > reverificationIntervalDays) {
    return {
      needsVerification: true,
      ageDays,
      label: `Schedule verified ${ageDays} days ago — community confirmation requested`,
    };
  }

  return {
    needsVerification: false,
    ageDays,
    label: `Verified schedule (${ageDays} days ago)`,
  };
}
