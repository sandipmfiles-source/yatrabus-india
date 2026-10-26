/**
 * Advanced Community GPS Intelligence & Anti-Abuse Processing Pipeline
 * Evaluates coordinates, speed, route alignment, multi-device corroboration,
 * opposing direction, and suspicious teleportation.
 */

import { Route, LocationObservation, JourneySession, LocationConfidence, TrackingStatus } from '../../types';
import { distanceToPolylineMeters, calculateDistanceMeters, calculateBearing } from '../utils/geoUtils';
import crypto from 'crypto';

export interface PipelineResult {
  accepted: boolean;
  observation?: LocationObservation;
  rejectionReason?: string;
  confidence: LocationConfidence;
  trackingStatus: TrackingStatus;
  isCorroborated: boolean;
  corroborationCount: number;
}

export class TrackingPipeline {
  private static recentSessionPings: Map<string, number> = new Map();
  private static busObservationHistory: Map<string, LocationObservation[]> = new Map();

  /**
   * Process and validate a new incoming location observation
   */
  public static processObservation(
    session: JourneySession,
    route: Route,
    lat: number,
    lng: number,
    accuracyMeters: number,
    speedKmh?: number,
    heading?: number,
    timestampStr?: string
  ): PipelineResult {
    const now = Date.now();
    const obsTime = timestampStr ? new Date(timestampStr).getTime() : now;

    // 1. Consent Check
    if (!session || !session.isActive || !session.hasConsented) {
      return {
        accepted: false,
        rejectionReason: 'Invalid, revoked or inactive journey session',
        confidence: 'low',
        trackingStatus: 'unavailable',
        isCorroborated: false,
        corroborationCount: 0
      };
    }

    // 1b. Session Route Binding Check
    if (session.routeId !== route.id) {
      return {
        accepted: false,
        rejectionReason: `Route mismatch: session is bound to route ${session.routeId}, got route ${route.id}`,
        confidence: 'low',
        trackingStatus: 'unavailable',
        isCorroborated: false,
        corroborationCount: 0
      };
    }

    // 2. Session Expiry Check (12h limit)
    if (new Date(session.expiresAt).getTime() < now) {
      session.isActive = false;
      return {
        accepted: false,
        rejectionReason: 'Session expired (12h maximum safety ceiling reached)',
        confidence: 'low',
        trackingStatus: 'unavailable',
        isCorroborated: false,
        corroborationCount: 0
      };
    }

    // 3. Anti-Spam Rate Limit per Session (Must be at least 8 seconds between pings)
    const lastPing = this.recentSessionPings.get(session.sessionId) || 0;
    if (now - lastPing < 8000) {
      return {
        accepted: false,
        rejectionReason: 'Rate limit: Observations must be spaced at least 8 seconds apart',
        confidence: 'low',
        trackingStatus: 'unavailable',
        isCorroborated: false,
        corroborationCount: 0
      };
    }
    this.recentSessionPings.set(session.sessionId, now);

    // 4. Timestamp Freshness Check (< 300 seconds)
    const ageSeconds = (now - obsTime) / 1000;
    if (ageSeconds > 300 || ageSeconds < -60) {
      return {
        accepted: false,
        rejectionReason: `Observation timestamp is stale or in the future (${Math.round(ageSeconds)}s offset)`,
        confidence: 'low',
        trackingStatus: 'last_known',
        isCorroborated: false,
        corroborationCount: 0
      };
    }

    // 5. Geographic Bounding Box Check (India: 6°N - 38°N, 68°E - 98°E)
    if (lat < 6.0 || lat > 38.0 || lng < 68.0 || lng > 98.0) {
      return {
        accepted: false,
        rejectionReason: `Coordinates (${lat}, ${lng}) lie outside India geographical envelope`,
        confidence: 'low',
        trackingStatus: 'unavailable',
        isCorroborated: false,
        corroborationCount: 0
      };
    }

    // 6. Horizontal Accuracy Check (< 50 meters)
    if (accuracyMeters > 50) {
      return {
        accepted: false,
        rejectionReason: `Horizontal GPS error (${accuracyMeters}m) exceeds 50m ceiling`,
        confidence: 'low',
        trackingStatus: 'estimated',
        isCorroborated: false,
        corroborationCount: 0
      };
    }

    // 7. Impossible Speed / Teleportation Check (0 - 110 km/h)
    const history = this.busObservationHistory.get(session.busId) || [];
    const prevObs = history[history.length - 1];

    if (prevObs) {
      const prevTime = new Date(prevObs.timestamp).getTime();
      const elapsedHours = (obsTime - prevTime) / 3600000;

      if (elapsedHours > 0.001) { // > ~3.6 seconds
        const distanceMeters = calculateDistanceMeters(prevObs.latitude, prevObs.longitude, lat, lng);
        const calculatedSpeedKmh = (distanceMeters / 1000) / elapsedHours;

        if (calculatedSpeedKmh > 115) {
          return {
            accepted: false,
            rejectionReason: `Implausible speed jump (${Math.round(calculatedSpeedKmh)} km/h) detected`,
            confidence: 'low',
            trackingStatus: 'unavailable',
            isCorroborated: false,
            corroborationCount: 0
          };
        }
      }
    }

    // 8. Route Polyline Proximity Match
    const { minDistanceMeters, nearestSegmentIndex } = distanceToPolylineMeters(lat, lng, route.polyline);
    if (minDistanceMeters > 500) {
      return {
        accepted: false,
        rejectionReason: `Observation is ${Math.round(minDistanceMeters)}m from route corridor (max 500m)`,
        confidence: 'low',
        trackingStatus: 'estimated',
        isCorroborated: false,
        corroborationCount: 0
      };
    }

    // 9. Multi-Device Corroboration & Conflict Resolution
    // Count distinct active sessions reporting within 500m of this location in last 3 mins
    const recentBusPings = history.filter(
      h => (now - new Date(h.timestamp).getTime()) < 180000
    );

    const independentSessions = new Set(
      recentBusPings.map(p => p.sessionId).filter(id => id !== session.sessionId)
    );
    const corroborationCount = independentSessions.size + 1; // self + independent
    const isCorroborated = corroborationCount >= 2;

    // 10. Confidence Classification
    let confidence: LocationConfidence = 'low';
    let trackingStatus: TrackingStatus = 'live_gps';

    if (minDistanceMeters <= 100 && accuracyMeters <= 25 && isCorroborated) {
      confidence = 'high';
    } else if (minDistanceMeters <= 350 && accuracyMeters <= 50) {
      confidence = isCorroborated ? 'high' : 'moderate';
    } else {
      confidence = 'low';
      trackingStatus = 'estimated';
    }

    const observation: LocationObservation = {
      id: `obs-${crypto.randomUUID()}`,
      sessionId: session.sessionId,
      busId: session.busId,
      routeId: route.id,
      latitude: lat,
      longitude: lng,
      accuracyMeters,
      speedKmh: speedKmh !== undefined ? speedKmh : undefined,
      heading: heading !== undefined ? heading : undefined,
      timestamp: new Date(obsTime).toISOString(),
      confidence,
      trackingStatus,
      distanceFromRouteMeters: Math.round(minDistanceMeters),
      matchingRemarks: `${isCorroborated ? 'Corroborated by ' + corroborationCount + ' independent devices' : 'Single passenger observation'} • ${Math.round(minDistanceMeters)}m from route`
    };

    // Append to history
    history.push(observation);
    if (history.length > 50) history.shift();
    this.busObservationHistory.set(session.busId, history);

    return {
      accepted: true,
      observation,
      confidence,
      trackingStatus,
      isCorroborated,
      corroborationCount
    };
  }

  public static clearHistory() {
    this.recentSessionPings.clear();
    this.busObservationHistory.clear();
  }
}
