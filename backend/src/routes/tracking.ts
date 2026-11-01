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
      locationSource: 'GPS',
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

// POST /api/tracking/cell-observation
// Cell identifiers are accepted only for an active, explicitly consented journey.
// Cell-derived positions are always ESTIMATED, never LIVE.
trackingRouter.post('/cell-observation', async (req: Request, res: Response) => {
  const { sessionId, busId, routeId, radioType, mcc, mnc, areaCode, cellId, signalDbm, timestamp } = req.body || {};
  const isRegistered = req.body?.isRegistered !== false;
  if (!sessionId || !busId || !routeId || !['GSM', 'WCDMA', 'LTE', 'NR'].includes(radioType) ||
      !/^\\d{3}$/.test(String(mcc)) || !/^\\d{2,3}$/.test(String(mnc)) ||
      !Number.isInteger(Number(areaCode)) || Number(areaCode) < 0 ||
      !/^\\d{1,20}$/.test(String(cellId)) || !Number.isFinite(Number(signalDbm)) ||
      Number(signalDbm) < -160 || Number(signalDbm) > 0) {
    return res.status(400).json({ error: 'Invalid mobile cell observation.' });
  }

  const session = repository.getJourneySession(String(sessionId));
  const consent = repository.getConsent(String(sessionId));
  if (!session || !session.isActive || session.busId !== String(busId) || session.routeId !== String(routeId) ||
      !consent || consent.status !== 'GRANTED' || consent.disclosuresAccepted !== true) {
    return res.status(403).json({ error: 'An active, consented journey session is required.' });
  }
  if (Date.now() >= new Date(session.maxExpiryTime).getTime()) {
    repository.stopJourneySession(String(sessionId), 'SESSION_EXPIRED');
    return res.status(410).json({ error: 'Journey session expired.' });
  }

  const observedAt = timestamp ? new Date(timestamp) : new Date();
  if (!Number.isFinite(observedAt.getTime()) || Math.abs(Date.now() - observedAt.getTime()) > 5 * 60 * 1000) {
    return res.status(400).json({ error: 'Cell observation timestamp is invalid or stale.' });
  }

  const observation = {
    sessionId: String(sessionId), busId: String(busId), routeId: String(routeId),
    radioType, mcc: String(mcc), mnc: String(mnc), areaCode: Number(areaCode),
    cellId: String(cellId), signalDbm: Number(signalDbm), timestamp: observedAt.toISOString(),
  };
  repository.ingestCellTowerObservation(observation);

  // Neighboring cells improve radio-context confidence, but their tower
  // coordinates must never be mistaken for the handset/bus position.
  // Resolve only the currently registered (serving) cell for a coarse fallback.
  if (!isRegistered) {
    return res.status(202).json({ accepted: true, mapped: false, role: 'NEIGHBOR_CELL', message: 'Neighbor cell recorded for radio-context corroboration; not used as a location fix.' });
  }

  const apiKey = process.env.OPENCELLID_API_KEY;
  if (!apiKey) {
    return res.status(202).json({
      accepted: true, mapped: false, displayState: 'UNAVAILABLE',
      message: 'Cell sample received. Configure OPENCELLID_API_KEY to resolve tower coordinates.',
    });
  }

  try {
    const params = new URLSearchParams({
      key: apiKey, mcc: observation.mcc, mnc: observation.mnc,
      lac: String(observation.areaCode), cellid: observation.cellId, format: 'json',
    });
    const lookup = await fetch('https://opencellid.org/cell/get?' + params.toString(), {
      headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(5000),
    });
    if (!lookup.ok) return res.status(202).json({ accepted: true, mapped: false, message: 'Tower lookup is temporarily unavailable.' });
    const tower: any = await lookup.json();
    const latitude = Number(tower.lat), longitude = Number(tower.lon);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < 6 || latitude > 38 || longitude < 68 || longitude > 98) {
      return res.status(202).json({ accepted: true, mapped: false, message: 'This cell is not mapped in the tower database yet.' });
    }

    const route = repository.getRouteById(String(routeId));
    if (!route || route.stops.length < 2) return res.status(202).json({ accepted: true, mapped: false });
    const haversine = (aLat: number, aLon: number, bLat: number, bLon: number) => {
      const rad = (value: number) => value * Math.PI / 180;
      const dLat = rad(bLat - aLat), dLon = rad(bLon - aLon);
      const x = Math.sin(dLat / 2) ** 2 + Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLon / 2) ** 2;
      return 6371000 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
    };
    const locatedStops = route.stops.filter(stop =>
      Number.isFinite(Number(stop.latitude)) && Number.isFinite(Number(stop.longitude))
    );
    if (locatedStops.length < 2) return res.status(202).json({ accepted: true, mapped: false, message: 'Route stop coordinates are incomplete.' });
    const nearestStopDistance = Math.min(...locatedStops.map(stop =>
      haversine(latitude, longitude, Number(stop.latitude), Number(stop.longitude))
    ));
    const towerRange = Math.max(100, Math.min(10000, Number(tower.range) || 2000));
    // Reject tower locations too far from the published route corridor.
    if (nearestStopDistance > Math.max(2500, towerRange)) {
      return res.status(202).json({ accepted: true, mapped: false, message: 'Tower is outside the expected route corridor.' });
    }

    const matching = repository.getCellTowerObservationsForBus(String(busId), new Date(Date.now() - 5 * 60 * 1000).toISOString())
      .filter(item => item.mcc === observation.mcc && item.mnc === observation.mnc &&
        item.areaCode === observation.areaCode && item.cellId === observation.cellId);
    const independent = new Set(matching.map(item => item.sessionId)).size;
    const previous = repository.getBusLocation(String(busId));
    const shouldReplace = !previous || previous.displayState !== 'LIVE' ||
      !previous.lastObservedAt || Date.now() - new Date(previous.lastObservedAt).getTime() > 120000;
    if (shouldReplace) {
      repository.updateBusLocation(String(busId), {
        busId: String(busId), routeId: String(routeId), displayState: 'ESTIMATED', locationSource: 'CELL_TOWER',
        latitude, longitude, accuracyMeters: Math.max(towerRange, nearestStopDistance),
        confidenceCategory: independent >= 2 ? 'MODERATE' : 'LOW',
        confidenceScore: independent >= 2 ? 45 : 25,
        observationCount: matching.length, independentContributorsCount: independent,
        lastObservedAt: observedAt.toISOString(), isLive: false,
        statusExplanation: 'Approximate mobile tower location. Not GPS; accuracy varies by tower coverage.',
        updatedAt: new Date().toISOString(),
      });
    }
    return res.json({ accepted: true, mapped: true, displayState: 'ESTIMATED', independentContributors: independent });
  } catch (error) {
    return res.status(202).json({ accepted: true, mapped: false, message: 'Tower lookup could not be completed.' });
  }
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
