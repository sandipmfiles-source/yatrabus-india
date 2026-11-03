import { Router, Request, Response } from 'express';
import { repository } from '../db/repository.js';
import { evaluateLocationConfidence } from '../../../packages/shared/src/engine/confidenceEngine.js';
import { evaluateJourneyPrompt } from '../../../packages/shared/src/engine/journeyConfirmationEngine.js';
import { evaluateObservationFreshness } from '../../../packages/shared/src/engine/staleDetector.js';
import { CONFIG } from '../config.js';
import { estimateTimetableBusLocation } from '../engine/timetablePosition.js';
import { rankBusCandidates } from '../engine/busCandidateMatcher.js';
import { rankTrajectoryCandidates, type TrajectorySample } from '../engine/trajectoryMatcher.js';
import { haversineDistanceMeters } from '../../../packages/shared/src/engine/routeMatcher.js';
import { publicSearchLimiter, trackingSessionLimiter } from '../middleware/rateLimiter.js';

export const trackingRouter = Router();

// POST /api/tracking/verify-bus-candidate
// Privacy-first, non-binding route verification. A single device sample never starts tracking.
trackingRouter.post('/verify-bus-candidate', publicSearchLimiter, (req: Request, res: Response) => {
  const { routeId, latitude, longitude, accuracyMeters, speedKmh, headingDegrees, timestamp, disclosuresAccepted } = req.body || {};
  if (disclosuresAccepted !== true) {
    return res.status(403).json({ error: 'Explicit consent is required to use this location sample for bus candidate matching.' });
  }
  if (!routeId || !Number.isFinite(Number(latitude)) || Number(latitude) < 6 || Number(latitude) > 38 ||
      !Number.isFinite(Number(longitude)) || Number(longitude) < 68 || Number(longitude) > 98 ||
      !Number.isFinite(Number(accuracyMeters)) || Number(accuracyMeters) <= 0 || Number(accuracyMeters) > 20000) {
    return res.status(400).json({ error: 'A valid India location, routeId and accuracyMeters are required.' });
  }
  const observedAt = timestamp ? new Date(timestamp) : new Date();
  if (!Number.isFinite(observedAt.getTime()) || Math.abs(Date.now() - observedAt.getTime()) > 2 * 60 * 1000) {
    return res.status(400).json({ error: 'Location sample is stale or has an invalid timestamp.' });
  }
  if (speedKmh !== undefined && (!Number.isFinite(Number(speedKmh)) || Number(speedKmh) < 0 || Number(speedKmh) > 180)) {
    return res.status(400).json({ error: 'Invalid speed value.' });
  }
  if (headingDegrees !== undefined && (!Number.isFinite(Number(headingDegrees)) || Number(headingDegrees) < 0 || Number(headingDegrees) >= 360)) {
    return res.status(400).json({ error: 'Invalid heading value.' });
  }
  const route = repository.getRouteById(String(routeId));
  if (!route) return res.status(404).json({ error: 'Route not found.' });
  const candidates = repository.getBusesForRoute(route.id);
  const result = rankBusCandidates(candidates, [route], {
    latitude: Number(latitude), longitude: Number(longitude), accuracyMeters: Number(accuracyMeters),
    speedKmh: speedKmh === undefined ? undefined : Number(speedKmh),
    headingDegrees: headingDegrees === undefined ? undefined : Number(headingDegrees),
    observedAt: observedAt.toISOString(),
  });
  return res.status(200).json({
    ...result,
    trackingStarted: false,
    requiresSecondSample: result.status !== 'NO_MATCH',
    privacy: 'This one-time sample is evaluated in memory and is not stored by this endpoint. A separate active journey session and explicit consent are required for ongoing sharing.',
  });
});

// POST /api/tracking/verify-bus-candidate-series
// Multiple consented samples improve route/bus candidate ranking without persisting passenger traces.
trackingRouter.post('/verify-bus-candidate-series', publicSearchLimiter, (req: Request, res: Response) => {
  const { routeId, samples, disclosuresAccepted } = req.body || {};
  if (disclosuresAccepted !== true) {
    return res.status(403).json({ error: 'Explicit consent is required before evaluating a movement sequence.' });
  }
  if (typeof routeId !== 'string' || !routeId.trim() || !Array.isArray(samples) || samples.length < 2 || samples.length > 6) {
    return res.status(400).json({ error: 'routeId and between two and six samples are required.' });
  }
  const route = repository.getRouteById(routeId);
  if (!route) return res.status(404).json({ error: 'Route not found.' });

  const now = Date.now();
  const validated: TrajectorySample[] = [];
  for (const sample of samples) {
    if (!sample || typeof sample.sessionId !== 'string' || !sample.sessionId.trim()) {
      return res.status(400).json({ error: 'Every sample must reference an active consented journey session.' });
    }
    const session = repository.getJourneySession(sample.sessionId);
    const consent = repository.getConsent(sample.sessionId);
    if (!session || !session.isActive || session.routeId !== routeId ||
        new Date(session.maxExpiryTime).getTime() <= now ||
        !consent || consent.status !== 'GRANTED' || consent.disclosuresAccepted !== true) {
      return res.status(403).json({ error: 'Every sample must belong to an active journey with unrevoked explicit location consent for this route.' });
    }
    const timestamp = new Date(sample.timestamp);
    if (!Number.isFinite(timestamp.getTime()) || Math.abs(now - timestamp.getTime()) > 15 * 60 * 1000) {
      return res.status(400).json({ error: 'A movement sample is stale or has an invalid timestamp.' });
    }
    validated.push({
      sessionId: sample.sessionId,
      timestamp: timestamp.toISOString(),
      latitude: Number(sample.latitude),
      longitude: Number(sample.longitude),
      accuracyMeters: Number(sample.accuracyMeters),
      speedKmh: sample.speedKmh === undefined ? undefined : Number(sample.speedKmh),
      headingDegrees: sample.headingDegrees === undefined ? undefined : Number(sample.headingDegrees),
    });
  }

  const result = rankTrajectoryCandidates(repository.getBusesForRoute(routeId), [route], validated, new Date(now));
  return res.status(200).json({
    ...result,
    trackingStarted: false,
    samplesStored: false,
    privacy: 'Samples are evaluated in memory only and are not persisted by this endpoint. Existing journey consent is checked for every sample. Candidate corroboration is not proof of physical vehicle identity.',
  });
});

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
trackingRouter.post('/session/start', trackingSessionLimiter, (req: Request, res: Response) => {
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
  const validStopIds = new Set(route.stops.flatMap(stop => [stop.id, stop.stopId]));
  if (originStopId && !validStopIds.has(String(originStopId))) {
    return res.status(422).json({ error: 'originStopId must belong to the selected route.' });
  }
  if (destinationStopId && !validStopIds.has(String(destinationStopId))) {
    return res.status(422).json({ error: 'destinationStopId must belong to the selected route.' });
  }

  const sessionId = `sess-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
  const now = new Date();
  const sessionRule = repository.getAutomationRuleByCode('SESSION_SAFETY_EXPIRY');
  const configuredSessionHours = Number(sessionRule?.parameters?.maxJourneySessionHours);
  // The safety cap can be shortened by the owner, but never extended beyond
  // the hard 12-hour platform limit, even if a stored rule is misconfigured.
  const sessionHours = sessionRule?.isEnabled && Number.isFinite(configuredSessionHours)
    ? Math.max(1, Math.min(CONFIG.MAX_JOURNEY_SESSION_HOURS, configuredSessionHours))
    : CONFIG.MAX_JOURNEY_SESSION_HOURS;
  const maxExpiry = new Date(now.getTime() + sessionHours * 3600 * 1000);

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
  const locationSource = req.body?.locationSource === 'NETWORK' ? 'NETWORK' : 'GPS';

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

  // Android balanced-power location is a network/fused estimate, never a GPS LIVE fix.
  if (locationSource === 'NETWORK') {
    const networkTime = timestamp ? new Date(timestamp) : new Date();
    if (!Number.isFinite(networkTime.getTime()) || Math.abs(Date.now() - networkTime.getTime()) > 5 * 60 * 1000) {
      return res.status(400).json({ error: 'Network location timestamp is invalid or stale.' });
    }
    if (Number(accuracyMeters) > 20000) {
      return res.status(202).json({ accepted: false, reason: 'NETWORK_ACCURACY_TOO_LOW' });
    }
    const networkEvaluation = evaluateLocationConfidence(
      { latitude: Number(latitude), longitude: Number(longitude), accuracyMeters: Number(accuracyMeters),
        timestamp: networkTime.toISOString(), speedKmh, headingDegrees, sessionId },
      route, new Date().toISOString(), Math.max(1, repository.getDistinctSessionsForBus(String(busId), new Date(Date.now() - 5 * 60 * 1000).toISOString())),
      false,
      { maxAccuracyMeters: 20000, maxFreshnessLiveSeconds: 180, maxRouteDistanceMeters: 3000, maxRealisticSpeedKmh: CONFIG.MAX_SPEED_KMPH }
    );
    if (networkEvaluation.signals.routeProximityScore === 0) {
      return res.status(202).json({ accepted: false, reason: 'NETWORK_FIX_OUTSIDE_ROUTE_CORRIDOR', evaluation: networkEvaluation });
    }
    const previous = repository.getBusLocation(String(busId));
    const previousIsFreshGps = !!previous && previous.displayState === 'LIVE' && previous.locationSource === 'GPS' &&
      !!previous.lastObservedAt && Date.now() - new Date(previous.lastObservedAt).getTime() <= CONFIG.GPS_FRESHNESS_LIVE_SECONDS * 1000;
    const newerThanPrevious = !previous?.lastObservedAt || networkTime.getTime() >= new Date(previous.lastObservedAt).getTime();
    repository.ingestObservation({
      id: `obs-network-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      sessionId, busId, routeId, latitude: Number(latitude), longitude: Number(longitude),
      accuracyMeters: Number(accuracyMeters), speedKmh, headingDegrees, locationSource: 'NETWORK',
      distanceFromRouteMeters: 3000, isRouteMatched: true, isDirectionConsistent: false,
      isSpeedRealistic: true, confidenceScore: Math.min(69, networkEvaluation.score),
      confidenceCategory: networkEvaluation.score >= 50 ? 'MODERATE' : 'LOW',
      processingStatus: 'ACCEPTED', timestamp: networkTime.toISOString(), createdAt: new Date().toISOString(),
    });
    if (!previousIsFreshGps && newerThanPrevious) {
      repository.updateBusLocation(String(busId), {
        busId, routeId, displayState: 'ESTIMATED', locationSource: 'NETWORK',
        latitude: Number(latitude), longitude: Number(longitude), accuracyMeters: Number(accuracyMeters),
        speedKmh, bearing: headingDegrees, confidenceCategory: networkEvaluation.score >= 50 ? 'MODERATE' : 'LOW',
        confidenceScore: Math.min(69, networkEvaluation.score), observationCount: (previous?.observationCount || 0) + 1,
        independentContributorsCount: Math.max(1, repository.getDistinctSessionsForBus(String(busId), new Date(Date.now() - 5 * 60 * 1000).toISOString())),
        lastObservedAt: networkTime.toISOString(), isLive: false,
        statusExplanation: 'Android network/fused location estimate. Approximate only; not a confirmed GPS fix.',
        updatedAt: new Date().toISOString(),
      });
    }
    return res.json({ accepted: true, displayState: 'ESTIMATED', locationSource: 'NETWORK',
      confidenceScore: Math.min(69, networkEvaluation.score), explanation: 'Network estimate is approximate and never shown as live GPS.' });
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

  // 6. Complete a passenger's trip only after two accurate, time-separated GPS fixes
  // inside the destination geofence. Network/cell estimates never auto-complete a trip.
  let journeyCompleted = false;
  if (session.destinationStopId && Number(accuracyMeters) <= 100) {
    const destination = route.stops.find(stop =>
      stop.stopId === session.destinationStopId || stop.id === session.destinationStopId
    );
    if (destination) {
      const distanceToDestination = haversineDistanceMeters(
        Number(latitude), Number(longitude), destination.latitude, destination.longitude
      );
      journeyCompleted = repository.recordDestinationArrival(
        sessionId,
        evaluation.isPublishableAsLive && distanceToDestination <= 200,
        timestamp || new Date().toISOString()
      );
    }
  }

  // 7. If publishable, update public aggregated bus location
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
    journeyCompleted,
    sessionActive: !journeyCompleted,
    message: journeyCompleted ? 'Destination arrival was corroborated. Location sharing has been stopped automatically.' : undefined,
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
    const previousAgeMs = previous?.lastObservedAt ? Date.now() - new Date(previous.lastObservedAt).getTime() : Number.POSITIVE_INFINITY;
    const previousFreshGps = !!previous && previous.displayState === 'LIVE' && previous.locationSource === 'GPS' && previousAgeMs <= 120000;
    const previousFreshNetwork = !!previous && previous.locationSource === 'NETWORK' && previousAgeMs <= 180000;
    const shouldReplace = !previousFreshGps && !previousFreshNetwork &&
      (!previous?.lastObservedAt || observedAt.getTime() >= new Date(previous.lastObservedAt).getTime());
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
// Fresh device signals take priority; timetable interpolation is a clearly labelled fallback.
trackingRouter.get('/bus/:id/location', (req: Request, res: Response) => {
  const busId = String(req.params.id);
  const bus = repository.getBusById(busId);
  const loc = repository.getBusLocation(busId);

  if (loc?.lastObservedAt) {
    const freshnessRule = repository.getAutomationRuleByCode('GPS_FRESHNESS_MONITOR');
    const liveSeconds = freshnessRule?.isEnabled
      ? Math.max(30, Math.min(300, Number(freshnessRule.parameters?.gpsFreshnessLiveSeconds) || CONFIG.GPS_FRESHNESS_LIVE_SECONDS))
      : CONFIG.GPS_FRESHNESS_LIVE_SECONDS;
    const staleSeconds = freshnessRule?.isEnabled
      ? Math.max(liveSeconds, Math.min(1800, Number(freshnessRule.parameters?.gpsFreshnessStaleSeconds) || CONFIG.GPS_FRESHNESS_STALE_SECONDS))
      : CONFIG.GPS_FRESHNESS_STALE_SECONDS;
    const freshness = evaluateObservationFreshness(
      loc.lastObservedAt,
      new Date().toISOString(),
      liveSeconds,
      staleSeconds
    );
    if (loc.displayState === 'LIVE' && freshness.displayState !== 'LIVE') {
      loc.displayState = freshness.displayState;
      loc.isLive = false;
      loc.statusExplanation = freshness.label;
      repository.updateBusLocation(busId, loc);
    }
    const ageMs = Date.now() - new Date(loc.lastObservedAt).getTime();
    // Never replace a fresh GPS fix or a recent device estimate with timetable-only data.
    if (ageMs <= (loc.locationSource === 'GPS' ? 120000 : 180000)) return res.json(loc);
  }

  if (bus?.routeId) {
    const route = repository.getRouteById(bus.routeId);
    if (route) {
      const prediction = estimateTimetableBusLocation(bus, route, new Date(), repository.getBusesForRoute(route.id).length);
      if (prediction) return res.json(prediction);
    }
  }

  if (loc) return res.json(loc);
  return res.json({
    busId,
    displayState: 'UNAVAILABLE',
    isLive: false,
    confidenceCategory: 'LOW',
    confidenceScore: 0,
    statusExplanation: 'No current device signal or valid timetable prediction is available.',
  });
});
