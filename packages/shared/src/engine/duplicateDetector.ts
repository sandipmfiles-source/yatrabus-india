import { Bus, Operator, Route, RouteStop } from '../types/bus.js';
import { Place } from '../types/places.js';
import { haversineDistanceMeters } from './routeMatcher.js';
import { calculateTokenSimilarity, levenshteinDistance } from '../search/typoSearch.js';
import { normalizePlaceName } from '../search/normalizer.js';

export interface DuplicateDetectionResult {
  isLikelyDuplicate: boolean;
  similarityScore: number; // 0 - 100
  matchingFactors: string[];
  recommendation: 'MERGE_CANDIDATE' | 'DISTINCT' | 'REQUIRES_MANUAL_REVIEW';
}

/**
 * Detects potential duplicate bus stops based on geographic distance and name similarity.
 */
export function checkDuplicateStop(
  stopA: { name: string; latitude: number; longitude: number; state?: string },
  stopB: { name: string; latitude: number; longitude: number; state?: string }
): DuplicateDetectionResult {
  const distMeters = haversineDistanceMeters(
    stopA.latitude,
    stopA.longitude,
    stopB.latitude,
    stopB.longitude
  );

  const nameSim = calculateTokenSimilarity(stopA.name, stopB.name);
  const matchingFactors: string[] = [];

  let score = 0;

  if (distMeters <= 50) {
    score += 50;
    matchingFactors.push(`Extremely close geographic distance (${Math.round(distMeters)}m)`);
  } else if (distMeters <= 150) {
    score += 35;
    matchingFactors.push(`Close geographic distance (${Math.round(distMeters)}m)`);
  } else if (distMeters <= 400) {
    score += 15;
    matchingFactors.push(`Nearby area (${Math.round(distMeters)}m)`);
  }

  if (nameSim >= 0.85) {
    score += 50;
    matchingFactors.push(`Near-identical stop name (${Math.round(nameSim * 100)}% match)`);
  } else if (nameSim >= 0.6) {
    score += 30;
    matchingFactors.push(`Significant name token overlap (${Math.round(nameSim * 100)}% match)`);
  }

  const finalScore = Math.min(100, score);
  let recommendation: DuplicateDetectionResult['recommendation'] = 'DISTINCT';

  if (finalScore >= 75) {
    recommendation = 'MERGE_CANDIDATE';
  } else if (finalScore >= 50) {
    recommendation = 'REQUIRES_MANUAL_REVIEW';
  }

  return {
    isLikelyDuplicate: finalScore >= 65,
    similarityScore: finalScore,
    matchingFactors,
    recommendation,
  };
}

/**
 * Detects potential duplicate bus routes based on route number, origin/destination, and operator.
 */
export function checkDuplicateRoute(routeA: Route, routeB: Route): DuplicateDetectionResult {
  const matchingFactors: string[] = [];
  let score = 0;

  // Compare route numbers (e.g. "534" vs "534")
  const numA = normalizePlaceName(routeA.routeNumber);
  const numB = normalizePlaceName(routeB.routeNumber);
  if (numA === numB && numA.length > 0) {
    score += 40;
    matchingFactors.push(`Identical route number (${routeA.routeNumber})`);
  }

  // Compare operator
  if (routeA.operatorId === routeB.operatorId) {
    score += 20;
    matchingFactors.push('Operated by same transit agency');
  }

  // Compare origin and destination
  const origSim = calculateTokenSimilarity(routeA.originStopName, routeB.originStopName);
  const destSim = calculateTokenSimilarity(routeA.destinationStopName, routeB.destinationStopName);

  if (origSim >= 0.8 && destSim >= 0.8) {
    score += 40;
    matchingFactors.push('Matching origin and destination terminal stops');
  } else if (origSim >= 0.6 || destSim >= 0.6) {
    score += 20;
    matchingFactors.push('Partial terminus match');
  }

  const finalScore = Math.min(100, score);
  let recommendation: DuplicateDetectionResult['recommendation'] = 'DISTINCT';

  if (finalScore >= 80) {
    recommendation = 'MERGE_CANDIDATE';
  } else if (finalScore >= 55) {
    recommendation = 'REQUIRES_MANUAL_REVIEW';
  }

  return {
    isLikelyDuplicate: finalScore >= 70,
    similarityScore: finalScore,
    matchingFactors,
    recommendation,
  };
}
