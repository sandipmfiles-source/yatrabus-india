/**
 * YatriBus Shared Types - Consent, Journey Tracking, Confidence & Location Aggregates
 */

export type ConfidenceCategory = 'LOW' | 'MODERATE' | 'HIGH';

export type LocationDisplayState =
  | 'LIVE'          // Fresh GPS passing route match and accuracy thresholds (< 120s)
  | 'LAST_KNOWN'    // Valid recent observation, but > 120s and < 600s old
  | 'ESTIMATED'     // Algorithmic estimate from timetable and average pace
  | 'UNAVAILABLE';  // No reliable GPS or prediction available

export type ConsentStatus = 'NOT_ASKED' | 'GRANTED' | 'DECLINED' | 'REVOKED';

export interface ConsentRecord {
  sessionId: string;
  scope: 'JOURNEY_TRACKING';
  status: ConsentStatus;
  grantedAt?: string;
  revokedAt?: string;
  ipHash?: string; // Anonymized hash for anti-abuse rate limits only
  userAgentSnippet?: string;
  disclosuresAccepted: boolean;
}

export interface JourneySession {
  sessionId: string;
  busId: string;
  routeId: string;
  originStopId?: string;
  destinationStopId?: string;
  startTime: string;
  lastActiveTime: string;
  maxExpiryTime: string; // Safety limit: Max 12 hours from start
  isActive: boolean;
  isConfirmedPassenger: boolean;
  observationsContributedCount: number;
  stoppedReason?: 'USER_STOPPED' | 'SESSION_EXPIRED' | 'JOURNEY_COMPLETED' | 'CONSENT_REVOKED';
}

export interface RawLocationObservationPayload {
  sessionId: string;
  busId: string;
  routeId: string;
  latitude: number;
  longitude: number;
  accuracyMeters: number;
  speedKmh?: number;
  headingDegrees?: number;
  timestamp: string; // ISO 8601
}

export interface LocationObservation {
  id: string;
  sessionId: string;
  busId: string;
  routeId: string;
  latitude: number;
  longitude: number;
  accuracyMeters: number;
  speedKmh?: number;
  headingDegrees?: number;
  timestamp: string;
  distanceFromRouteMeters: number;
  isRouteMatched: boolean;
  isDirectionConsistent: boolean;
  isSpeedRealistic: boolean;
  confidenceScore: number; // 0 - 100
  confidenceCategory: ConfidenceCategory;
  processingStatus: 'ACCEPTED' | 'HELD_FOR_REVIEW' | 'REJECTED';
  rejectionReason?: string;
  createdAt: string;
}

export interface AggregatedBusLocation {
  busId: string;
  routeId: string;
  displayState: LocationDisplayState;
  latitude?: number;
  longitude?: number;
  accuracyMeters?: number;
  bearing?: number;
  speedKmh?: number;
  confidenceCategory: ConfidenceCategory;
  confidenceScore: number;
  observationCount: number;
  independentContributorsCount: number; // Count of distinct sessions corroborating
  lastObservedAt?: string;
  estimatedNextStopName?: string;
  estimatedArrivalMinutes?: number;
  isLive: boolean; // TRUE only if displayState === 'LIVE'
  statusExplanation: string;
  updatedAt: string;
}

export interface JourneyPromptEvaluation {
  shouldPrompt: boolean;
  reason: string;
  busId?: string;
  routeId?: string;
  routeNumber?: string;
  scheduledDepartureTime?: string;
  timeRemainingMinutes?: number;
}
