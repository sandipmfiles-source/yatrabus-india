import { Router, Request, Response } from 'express';
import { repository } from '../db/repository.js';
import { evaluateLocationConfidence } from '../../../packages/shared/src/engine/confidenceEngine.js';
import { evaluateJourneyPrompt } from '../../../packages/shared/src/engine/journeyConfirmationEngine.js';
import { evaluateObservationFreshness } from '../../../packages/shared/src/engine/staleDetector.js';
import { CONFIG } from '../config.js';

export const trackingRouter = Router();

// POST /api/tracking/evaluate-prompt
trackingRouter.post('/evaluate-prompt', (req: Request, res: Response) => {
  const { routeId, isAlreadyTracking, dismissedCount, hasDeclined } = req.body;

  const route = repository.getRouteById(routeId);
  if (!route) {
    return res.status(404).json({ error: 'Route not found' });
  }

  const evaluation = evaluateJourneyPrompt(route, {
    isAlreadyTrackingThisBus: !!isAlreadyTracking,
    dismissedCountForRoute: dismissedCount || 0,
    hasExplicitlyDeclined: !!hasDeclined,
  });

  return res.json(evaluation);
});

// POST /api/tracking/consent
trackingRouter.post('/consent', (req: Request, res: Response) => {
  const { sessionId, status, disclosuresAccepted } = req.body;

  if (!sessionId || !['GRANTED', 'REVOKED'].includes(status)) {
    return res.status(400).json({ error: 'A valid sessionId and consent status (GRANTED or REVOKED) are required.' });
  }
  const session = repository.getJourneySession(sessionId);
  if (!session || !session.isActive) return res.status(404).json({ error: 'Active journey session not found.' });
  if (status === 'GRANTED' && disclosuresAccepted !== true) {
    return res.status(400).json({ error: 'Explicit tracking disclosures must be accepted before location sharing can start.' });
  }

  repository.recordConsent({
    sessionId,
    scope: 'JOURNEY_TRACKING',
    status,
    grantedAt: status === 'GRANTED' ? new Date().toISOString() : undefined,
    revokedAt: status === 'REVOKED' ? new Date().toISOString() : undefined,
    userAgentSnippet: req.headers['user-agent']?.substring(0, 100),
    disclosuresAccepted: disclosuresAccepted === true,
  });
  if (status === 'REVOKED') repository.stopJourneySession(sessionId, 'CONSENT_REVOKED');

  return res.json({ success: true, sessionId, status });
});

// POST /api/tracking/session/start
trackingRouter.post('/session/start', (req: Request, res: Response) => {
  const { busId, routeId, originStopId, destinationStopId } = req.body;

  if (!busId || !routeId) {
    return res.status(400).json({ error: 'busId and routeId are required' });
  }
  const bus = repository.getBusById(String(busId));
  const route = repository.getRouteById(String(routeId));
  if (!route) return res.status(404).json({ error: 'Route not found' });
  if (!bus || !bus.isActive || bus.routeId !== routeId) {
    return res.status(422).json({ error: 'Live tracking is available only for an active bus explicitly linked to this route.' });
  }

  const sessionId = `sess-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
  const now = new Date();
  const maxExpiry = new Date(now.getTime() + CONFIG.MAX_JOURNEY_SESSION_HOURS * 3600 * 1000);

  const session = repository.createJourneySession({
    sessionId,
    busId,
    routeId,
    originStopId,
    destinationStopId,
    startTime: now.toISOString(),
    lastActiveTime: now.toISOString(),
    maxExpiryTime: maxExpiry.toISOString(),
    isActive: true,
    isConfirmedPassenger: true,
    observationsContributedCount: 0,
  });

  return res.json({ session });
});

// POST /api/tracking/session/stop
trackingRouter.post('/session/stop', (req: Request, res: Response) => {
  const { sessionId, reason } = req.body;

  if (!sessionId) {
    return res.status(400).json({ error: 'sessionId required' });
  }

  const success = repository.stopJourneySession(sessionId, reason || 'USER_STOPPED');
  return res.json({ success, sessionId });
});

// POST /api/tracking/observation
// Ingests passenger GPS observations through the Multi-Signal Confidence Pipeline
trackingRouter.post('/observation', (req: Request, res: Response) => {
  const { sessionId, busId, routeId, latitude, longitude, accuracyMeters, speedKmh, headingDegrees, timestamp } = req.body;

  if (!sessionId || !busId || !routeId || latitude === undefined || longitude === undefined || accuracyMeters === undefined) {
    return res.status(400).json({ error: 'Missing mandatory observation attributes' });
  }

  // 1. Verify active journey session and consent
  const session = repository.getJourneySession(sessionId);
  if (!session || !session.isActive) {
    return res.status(403).json({ error: 'Invalid or inactive journey session' });
  }
  if (session.busId !== busId || session.routeId !== routeId) {
    return res.status(403).json({ error: 'Observation does not match the active journey session.' });
  }
  const consent = repository.getConsent(sessionId);
  if (!consent || consent.status !== 'GRANTED' || consent.disclosuresAccepted !== true) {
    return res.status(403).json({ error: 'Explicit location-sharing consent is required before sending GPS observations.' });
  }
  if (!Number.isFinite(Number(latitude)) || Number(latitude) < -90 || Number(latitude) > 90 ||
      !Number.isFinite(Number(longitude)) || Number(longitude) < -180 || Number(longitude) > 180 ||
      !Number.isFinite(Number(accuracyMeters)) || Number(accuracyMeters) <= 0) {
    return res.status(400).json({ error: 'Invalid GPS coordinates or accuracy.' });
  }
  if (Date.now() >= new Date(session.maxExpiryTime).getTime()) {
    repository.stopJourneySession(sessionId, 'SESSION_EXPIRED');
    return res.status(410).json({ error: 'Journey tracking session has expired. Start a new session if you still want to share.' });
  }

  // 2. Fetch associated route
  const route = repository.getRouteById(routeId);
  if (!route) {
    return res.status(404).json({ error: 'Route not found' });
  }

  // 3. Count independent corroborating sessions for this bus within last 5 minutes
  const fiveMinsAgoIso = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const independentSessionsCount = Math.max(1, repository.getDistinctSessionsForBus(busId, fiveMinsAgoIso));

  // 4. Run deterministic multi-signal confidence evaluation
  const evaluation = evaluateLocationConfidence(
    {
      latitude,
      longitude,
      accuracyMeters,
      timestamp: timestamp || new Date().toISOString(),
      speedKmh,
      headingDegrees,
      sessionId,
    },
    route,
    new Date().toISOString(),
    independentSessionsCount,
    false,
    {
      maxAccuracyMeters: CONFIG.GPS_ACCURACY_THRESHOLD_METERS,
      maxFreshnessLiveSeconds: CONFIG.GPS_FRESHNESS_LIVE_SECONDS,
      maxRouteDistanceMeters: 150,
      maxRealisticSpeedKmh: CONFIG.MAX_SPEED_KMPH,
    }
  );

  // 5. Ingest observation into internal store
  repository.ingestObservation({
    id: `obs-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    sessionId,
    busId,
    routeId,
    latitude,
    longitude,
    accuracyMeters,
    speedKmh,
    headingDegrees,
    distanceFromRouteMeters: evaluation.signals.routeProximityScore >= 12 ? 35 : 160,
    isRouteMatched: evaluation.signals.routeProximityScore >= 12,
    isDirectionConsistent: evaluation.signals.directionScore > 0,
    isSpeedRealistic: evaluation.signals.speedPlausibilityScore > 0,
    confidenceScore: evaluation.score,
    confidenceCategory: evaluation.category,
    processingStatus: evaluation.isPublishableAsLive ? 'ACCEPTED' : 'HELD_FOR_REVIEW',
    rejectionReason: evaluation.rejectionReason,
    timestamp: timestamp || new Date().toISOString(),
    createdAt: new Date().toISOString(),
  });

  // 6. If publishable, update public aggregated bus location
  if (evaluation.isPublishableAsLive) {
    repository.updateBusLocation(busId, {
      busId,
      routeId,
      displayState: 'LIVE',
      latitude,
      longitude,
      accuracyMeters,
      bearing: headingDegrees,
      speedKmh,
      confidenceCategory: evaluation.category,
      confidenceScore: evaluation.score,
      observationCount: (repository.getBusLocation(busId)?.observationCount || 0) + 1,
      independentContributorsCount: independentSessionsCount,
      lastObservedAt: timestamp || new Date().toISOString(),
      isLive: true,
      statusExplanation: evaluation.explanation,
      updatedAt: new Date().toISOString(),
    });
  }

  return res.json({
    accepted: evaluation.isPublishableAsLive,
    evaluation,
  });
});

// GET /api/tracking/bus/:id/location
trackingRouter.get('/bus/:id/location', (req: Request, res: Response) => {
  const loc = repository.getBusLocation(String(req.params.id));
  if (!loc) {
    return res.json({
      busId: String(req.params.id),
      displayState: 'UNAVAILABLE',
      isLive: false,
      confidenceCategory: 'LOW',
      confidenceScore: 0,
      statusExplanation: 'No passenger location observation reported recently',
    });
  }

  // Freshness check
  if (loc.lastObservedAt) {
    const freshness = evaluateObservationFreshness(loc.lastObservedAt);
    if (loc.displayState === 'LIVE' && freshness.displayState !== 'LIVE') {
      loc.displayState = freshness.displayState;
      loc.isLive = false;
      loc.statusExplanation = freshness.label;
      repository.updateBusLocation(String(req.params.id), loc);
    }
  }

  return res.json(loc);
});
