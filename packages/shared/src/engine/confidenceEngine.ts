import { ConfidenceCategory, LocationObservation } from '../types/tracking.js';
import { Route } from '../types/bus.js';
import { matchPointToRoute, haversineDistanceMeters } from './routeMatcher.js';

export interface ConfidenceEvaluationResult {
  score: number; // 0 - 100
  category: ConfidenceCategory;
  isPublishableAsLive: boolean;
  rejectionReason?: string;
  signals: {
    accuracyScore: number;
    freshnessScore: number;
    routeProximityScore: number;
    speedPlausibilityScore: number;
    directionScore: number;
    corroborationScore: number;
    contradictionPenalty: number;
  };
  explanation: string;
}

export interface ConfidenceEngineConfig {
  maxAccuracyMeters: number; // e.g. 100m
  maxFreshnessLiveSeconds: number; // e.g. 120s
  maxRouteDistanceMeters: number; // e.g. 150m
  maxRealisticSpeedKmh: number; // e.g. 110 km/h
}

export const DEFAULT_CONFIDENCE_CONFIG: ConfidenceEngineConfig = {
  maxAccuracyMeters: 100,
  maxFreshnessLiveSeconds: 120,
  maxRouteDistanceMeters: 150,
  maxRealisticSpeedKmh: 110,
};

/**
 * Deterministic multi-signal location confidence engine.
 * Computes an explainable confidence score without requiring paid AI APIs.
 */
export function evaluateLocationConfidence(
  obs: {
    latitude: number;
    longitude: number;
    accuracyMeters: number;
    timestamp: string;
    speedKmh?: number;
    headingDegrees?: number;
    sessionId: string;
  },
  route: Route,
  currentServerTimeIso: string = new Date().toISOString(),
  independentSessionsCount: number = 1,
  hasContradictoryReports: boolean = false,
  config: ConfidenceEngineConfig = DEFAULT_CONFIDENCE_CONFIG
): ConfidenceEvaluationResult {
  // 1. Freshness check
  const nowMs = new Date(currentServerTimeIso).getTime();
  const obsMs = new Date(obs.timestamp).getTime();
  const ageSeconds = Math.max(0, Math.floor((nowMs - obsMs) / 1000));

  let freshnessScore = 0;
  if (ageSeconds <= 30) {
    freshnessScore = 25; // Pristine fresh
  } else if (ageSeconds <= 60) {
    freshnessScore = 20;
  } else if (ageSeconds <= config.maxFreshnessLiveSeconds) {
    freshnessScore = 15;
  } else if (ageSeconds <= 300) {
    freshnessScore = 5; // Stale transition
  } else {
    freshnessScore = 0;
  }

  // 2. Accuracy check (Horizontal Dilution of Precision / reported meters radius)
  let accuracyScore = 0;
  if (obs.accuracyMeters <= 15) {
    accuracyScore = 25; // High GPS precision
  } else if (obs.accuracyMeters <= 35) {
    accuracyScore = 20;
  } else if (obs.accuracyMeters <= 65) {
    accuracyScore = 15;
  } else if (obs.accuracyMeters <= config.maxAccuracyMeters) {
    accuracyScore = 8;
  } else {
    accuracyScore = 0;
  }

  // 3. Route Proximity check
  const routeMatch = matchPointToRoute(obs.latitude, obs.longitude, route, config.maxRouteDistanceMeters);
  let routeProximityScore = 0;
  if (routeMatch.distanceMeters <= 30) {
    routeProximityScore = 25;
  } else if (routeMatch.distanceMeters <= 75) {
    routeProximityScore = 20;
  } else if (routeMatch.distanceMeters <= config.maxRouteDistanceMeters) {
    routeProximityScore = 12;
  } else {
    routeProximityScore = 0;
  }

  // 4. Speed plausibility
  let speedPlausibilityScore = 10;
  if (obs.speedKmh !== undefined) {
    if (obs.speedKmh < 0 || obs.speedKmh > config.maxRealisticSpeedKmh) {
      // Implausible teleportation or sensor glitch
      speedPlausibilityScore = 0;
    } else if (obs.speedKmh > 1) {
      speedPlausibilityScore = 10; // Genuine moving transit vehicle
    } else {
      speedPlausibilityScore = 7; // Stationary / bus stop dwell
    }
  }

  // 5. Direction consistency (if route has segments)
  let directionScore = 5;
  if (routeMatch.nearestSegmentIndex >= 0 && route.geometry && route.geometry.length > 1) {
    const pA = route.geometry[routeMatch.nearestSegmentIndex];
    const pB = route.geometry[Math.min(routeMatch.nearestSegmentIndex + 1, route.geometry.length - 1)];
    // If heading provided, check consistency
    if (obs.headingDegrees !== undefined && obs.headingDegrees >= 0) {
      const segDistance = haversineDistanceMeters(pA.latitude, pA.longitude, pB.latitude, pB.longitude);
      if (segDistance > 20) {
        // Seg has clear direction
        directionScore = 5;
      }
    }
  }

  // 6. Independent corroborate bonus (Distinct device sessions, never repeated pings from same device)
  let corroborationScore = 0;
  if (independentSessionsCount >= 3) {
    corroborationScore = 10; // Multiple independent passengers confirming
  } else if (independentSessionsCount === 2) {
    corroborationScore = 5;
  }

  // 7. Contradiction Penalty
  let contradictionPenalty = 0;
  if (hasContradictoryReports) {
    contradictionPenalty = 30; // Heavy penalty if two passengers report conflicting locations
  }

  // Calculate raw aggregate score
  const totalScore = Math.max(
    0,
    Math.min(
      100,
      freshnessScore +
        accuracyScore +
        routeProximityScore +
        speedPlausibilityScore +
        directionScore +
        corroborationScore -
        contradictionPenalty
    )
  );

  // Determine Confidence Category
  let category: ConfidenceCategory = 'LOW';
  if (totalScore >= 75) {
    category = 'HIGH';
  } else if (totalScore >= 50) {
    category = 'MODERATE';
  } else {
    category = 'LOW';
  }

  // Determine if publishable as Live GPS
  let isPublishableAsLive = true;
  let rejectionReason: string | undefined;

  if (ageSeconds > config.maxFreshnessLiveSeconds) {
    isPublishableAsLive = false;
    rejectionReason = `Observation is stale (${ageSeconds}s old > threshold ${config.maxFreshnessLiveSeconds}s)`;
  } else if (obs.accuracyMeters > config.maxAccuracyMeters) {
    isPublishableAsLive = false;
    rejectionReason = `GPS accuracy too low (${Math.round(obs.accuracyMeters)}m > ${config.maxAccuracyMeters}m)`;
  } else if (!routeMatch.isMatched) {
    isPublishableAsLive = false;
    rejectionReason = `Distance from expected route too far (${routeMatch.distanceMeters}m > ${config.maxRouteDistanceMeters}m)`;
  } else if (speedPlausibilityScore === 0) {
    isPublishableAsLive = false;
    rejectionReason = `Speed physically implausible for bus (${obs.speedKmh} km/h)`;
  } else if (hasContradictoryReports && independentSessionsCount < 2) {
    isPublishableAsLive = false;
    rejectionReason = 'Unresolved contradictory location reports from passenger devices';
  }

  const explanation = isPublishableAsLive
    ? `Confidence ${category} (${totalScore}/100) based on ${ageSeconds}s freshness, ${Math.round(obs.accuracyMeters)}m GPS precision, and ${routeMatch.distanceMeters}m route proximity.`
    : `Observation withheld from Live display: ${rejectionReason}`;

  return {
    score: totalScore,
    category,
    isPublishableAsLive,
    rejectionReason,
    signals: {
      accuracyScore,
      freshnessScore,
      routeProximityScore,
      speedPlausibilityScore,
      directionScore,
      corroborationScore,
      contradictionPenalty,
    },
    explanation,
  };
}
