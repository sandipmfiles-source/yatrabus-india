import { Router, Request, Response } from 'express';
import { timingSafeEqual } from 'node:crypto';
import { repository } from '../db/persistentRepository.js';
import { createAdminToken, requireAdminAuth } from '../middleware/auth.js';
import { CONFIG } from '../config.js';
import { Bus, Operator, Route, RouteStop } from '../../../packages/shared/src/types/bus.js';
import { CommunitySubmission } from '../../../packages/shared/src/types/contribution.js';
import { Place } from '../../../packages/shared/src/types/places.js';
import { haversineDistanceMeters } from '../../../packages/shared/src/engine/routeMatcher.js';

export const adminRouter = Router();

const ALL_DAYS: Route['operatingDays'] = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

function communityOperator(stateName: string): Operator {
  const existing = repository.getAllOperators().find(operator =>
    operator.operatorType === 'COMMUNITY_COOPERATIVE' &&
    operator.serviceArea.toLowerCase() === stateName.toLowerCase()
  );
  if (existing) return existing;
  const now = new Date().toISOString();
  const slug = stateName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  return repository.addOperator({
    id: `op-community-${slug}`,
    name: `Community Bus Operators - ${stateName}`,
    shortCode: 'COMM',
    operatorType: 'COMMUNITY_COOPERATIVE',
    serviceArea: stateName,
    verificationStatus: 'COMMUNITY_LISTED',
    isClaimed: false,
    sourceDataset: 'COMMUNITY_SUBMISSIONS',
    createdAt: now,
    updatedAt: now,
  });
}

function normalizedDays(value: unknown): Route['operatingDays'] {
  if (!Array.isArray(value) || value.length === 0 || value.some(day => String(day).toLowerCase() === 'daily')) return ALL_DAYS;
  const aliases: Record<string, Route['operatingDays'][number]> = {
    MON: 'MON', MONDAY: 'MON', TUE: 'TUE', TUESDAY: 'TUE', WED: 'WED', WEDNESDAY: 'WED',
    THU: 'THU', THURSDAY: 'THU', FRI: 'FRI', FRIDAY: 'FRI', SAT: 'SAT', SATURDAY: 'SAT',
    SUN: 'SUN', SUNDAY: 'SUN',
  };
  const days = value.map(day => aliases[String(day).trim().toUpperCase()]).filter(Boolean);
  return days.length ? Array.from(new Set(days)) : ALL_DAYS;
}

function publishVerifiedRoute(submission: CommunitySubmission): Route {
  const data = submission.proposedData || {};
  const origin = String(data.origin || '').trim();
  const destination = String(data.destination || '').trim();
  const routeNumber = String(data.routeNumber || '').trim();
  const exactDepartureTimes = Array.isArray(data.departureTimes) ? data.departureTimes.map((time: unknown) => String(time).trim()).filter(Boolean).sort() : [];
  if (exactDepartureTimes.some((time: string) => !/^([01]\d|2[0-3]):[0-5]\d$/.test(time))) {
    throw new Error('Exact departures must use 24-hour HH:MM format.');
  }
  const firstDepartureTime = exactDepartureTimes[0] || String(data.firstDepartureTime || '').trim();
  const lastDepartureTime = exactDepartureTimes[exactDepartureTimes.length - 1] || String(data.lastDepartureTime || '').trim();
  const originLatitude = Number(data.originLatitude);
  const originLongitude = Number(data.originLongitude);
  const destinationLatitude = Number(data.destinationLatitude);
  const destinationLongitude = Number(data.destinationLongitude);

  if (!origin || !destination || !routeNumber || !firstDepartureTime || !lastDepartureTime) {
    throw new Error('Route name, origin, destination, route number and first/last departure times are required.');
  }
  if (![originLatitude, originLongitude, destinationLatitude, destinationLongitude].every(Number.isFinite) ||
      Math.abs(originLatitude) > 90 || Math.abs(destinationLatitude) > 90 ||
      Math.abs(originLongitude) > 180 || Math.abs(destinationLongitude) > 180) {
    throw new Error('Valid origin and destination GPS coordinates are required before publishing this route.');
  }

  const routeId = `route-community-${submission.id}`;
  const now = new Date().toISOString();
  const operator = communityOperator(String(data.state || 'West Bengal'));
  const intermediate = Array.isArray(data.intermediateStops) ? data.intermediateStops : [];
  const rawStops = [
    { stopName: origin, latitude: originLatitude, longitude: originLongitude, scheduledDepartureTime: firstDepartureTime },
    ...intermediate,
    { stopName: destination, latitude: destinationLatitude, longitude: destinationLongitude, scheduledArrivalTime: lastDepartureTime },
  ];

  let distanceKm = 0;
  const stops: RouteStop[] = rawStops.map((stop: any, index: number) => {
    const latitude = Number(stop.latitude);
    const longitude = Number(stop.longitude);
    if (stop.latitude === null || stop.latitude === undefined || stop.latitude === '' || stop.longitude === null || stop.longitude === undefined || stop.longitude === '' || !String(stop.stopName || '').trim() || !Number.isFinite(latitude) || !Number.isFinite(longitude) ||
        Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
      throw new Error(`Intermediate stop ${index} is missing a valid name or GPS coordinates. Use Name|latitude|longitude|HH:MM in the form.`);
    }
    if (index > 0) {
      const previous = rawStops[index - 1];
      distanceKm += haversineDistanceMeters(Number(previous.latitude), Number(previous.longitude), latitude, longitude) / 1000;
    }
    const stopId = `${routeId}-place-${index + 1}`;
    return {
      id: `${routeId}-stop-${index + 1}`,
      routeId,
      stopId,
      stopName: String(stop.stopName).trim(),
      stopSequence: index + 1,
      latitude,
      longitude,
      distanceFromStartKm: Number(distanceKm.toFixed(2)),
      scheduledArrivalTime: stop.scheduledArrivalTime || undefined,
      scheduledDepartureTime: stop.scheduledDepartureTime || undefined,
    };
  });

  stops.forEach(stop => {
    const place: Place = {
      id: stop.stopId,
      canonicalName: stop.stopName,
      names: { en: stop.stopName },
      placeType: 'BUS_STOP',
      district: String(data.district || data.state || 'West Bengal'),
      state: String(data.state || 'West Bengal') as Place['state'],
      latitude: stop.latitude,
      longitude: stop.longitude,
      sourceDataset: 'COMMUNITY_SUBMISSIONS',
      sourceLicense: 'Community Submitted',
      verificationStatus: 'ADMIN_VERIFIED',
      aliases: [],
      createdAt: now,
      updatedAt: now,
    };
    repository.addPlace(place);
  });

  const route: Route = {
    id: routeId,
    routeNumber,
    routeName: `${origin} to ${destination}`,
    originStopId: stops[0].stopId,
    originStopName: origin,
    destinationStopId: stops[stops.length - 1].stopId,
    destinationStopName: destination,
    operatorId: operator.id,
    operatorName: operator.name,
    direction: 'UP',
    distanceKm: Number((Number(data.distanceKm) || distanceKm).toFixed(2)),
    typicalDurationMinutes: Math.max(1, Number(data.typicalDurationMinutes) || 60),
    operatingDays: normalizedDays(data.operatingDays),
    firstDepartureTime,
    lastDepartureTime,
    frequencyMinutes: Number(data.frequencyMinutes) > 0 ? Number(data.frequencyMinutes) : undefined,
    departureTimes: exactDepartureTimes.length ? exactDepartureTimes : undefined,
    stops,
    geometry: stops.map(stop => ({ latitude: stop.latitude, longitude: stop.longitude })),
    verificationStatus: 'ADMIN_VERIFIED',
    serviceStatus: 'OPERATING_SCHEDULED',
    createdAt: now,
    updatedAt: now,
  };
  return repository.addRoute(route);
}

function publishVerifiedStop(submission: CommunitySubmission): Place {
  const data = submission.proposedData || {};
  const name = String(data.name || '').trim();
  const latitude = Number(data.originLatitude);
  const longitude = Number(data.originLongitude);
  if (!name || data.originLatitude === undefined || data.originLongitude === undefined ||
      !Number.isFinite(latitude) || !Number.isFinite(longitude) ||
      Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
    throw new Error('A stop name and valid GPS coordinates are required before publishing this stop.');
  }
  const now = new Date().toISOString();
  return repository.addPlace({
    id: `place-community-${submission.id}`,
    canonicalName: name,
    names: { en: name },
    placeType: 'BUS_STOP',
    district: String(data.district || data.state || 'West Bengal'),
    state: String(data.state || 'West Bengal') as Place['state'],
    latitude,
    longitude,
    sourceDataset: 'COMMUNITY_SUBMISSIONS',
    sourceLicense: 'Community Submitted',
    verificationStatus: 'ADMIN_VERIFIED',
    aliases: [],
    createdAt: now,
    updatedAt: now,
  });
}

function publishVerifiedBus(submission: CommunitySubmission): Bus {
  const data = submission.proposedData || {};
  const publicIdentifier = String(data.name || data.routeNumber || '').trim();
  if (!publicIdentifier) throw new Error('Bus name or route number is required before publishing.');
  const route = repository.getAllRoutes().find(candidate =>
    candidate.routeNumber.toLowerCase() === String(data.routeNumber || '').trim().toLowerCase() &&
    candidate.originStopName.toLowerCase() === String(data.origin || '').trim().toLowerCase() &&
    candidate.destinationStopName.toLowerCase() === String(data.destination || '').trim().toLowerCase()
  );
  if (!route) throw new Error('Approve the matching route and timetable before publishing this bus.');
  const now = new Date().toISOString();
  return repository.addBus({
    id: `bus-community-${submission.id}`,
    publicIdentifier,
    operatorId: route.operatorId,
    routeId: route.id,
    operatorName: route.operatorName || 'Transit Operator',
    vehicleType: 'ORDINARY',
    hasCustomSvgIllustration: true,
    serviceStatus: 'SCHEDULE_UNVERIFIED',
    verificationStatus: 'ADMIN_VERIFIED',
    isActive: true,
    createdAt: now,
    updatedAt: now,
  });
}


// POST /api/admin/login
adminRouter.post('/login', (req: Request, res: Response) => {
  const { email, password } = req.body;
  const expectedPassword = Buffer.from(CONFIG.INITIAL_ADMIN_PASSWORD || '');
  const suppliedPassword = Buffer.from(String(password || ''));
  const passwordMatches = expectedPassword.length > 0 &&
    expectedPassword.length === suppliedPassword.length &&
    timingSafeEqual(expectedPassword, suppliedPassword);

  if (!email || String(email).toLowerCase() !== CONFIG.INITIAL_ADMIN_EMAIL.toLowerCase() || !passwordMatches) {
    return res.status(401).json({ error: 'Invalid administrator credentials' });
  }

  const admin = repository.getAdminByEmail(CONFIG.INITIAL_ADMIN_EMAIL);
  if (!admin || !admin.isActive || admin.role !== 'SUPER_ADMIN') {
    return res.status(403).json({ error: 'Super Admin account is unavailable or inactive' });
  }

  return res.json({
    token: createAdminToken(admin),
    user: { id: admin.id, email: admin.email, name: admin.name, role: admin.role },
  });
});

// GET /api/admin/overview
adminRouter.get('/overview', requireAdminAuth(), (req: Request, res: Response) => {
  const health = repository.getSystemHealthStats();
  const recentSubmissions = repository.listSubmissions('PENDING_REVIEW').slice(0, 5);
  const recentAudit = repository.getAuditLogs(5);

  return res.json({
    stats: health,
    recentSubmissions,
    recentAudit,
  });
});

// GET /api/admin/submissions
adminRouter.get('/submissions', requireAdminAuth(), (req: Request, res: Response) => {
  const status = req.query.status as string;
  const submissions = repository.listSubmissions(status);
  return res.json({ count: submissions.length, submissions });
});

// POST /api/admin/submissions/:id/review
adminRouter.post('/submissions/:id/review', requireAdminAuth(), (req: Request, res: Response) => {
  const { decision, reason } = req.body; // 'COMMUNITY_CORROBORATED' | 'ADMIN_VERIFIED' | 'REJECTED'
  const adminId = (req as any).admin?.id || 'admin-default';

  if (!decision || !['ADMIN_VERIFIED', 'COMMUNITY_CORROBORATED', 'REJECTED'].includes(decision)) {
    return res.status(400).json({ error: 'Valid review decision required' });
  }

  const submission = repository.getSubmissionById(String(req.params.id));
  if (!submission) {
    return res.status(404).json({ error: 'Submission not found' });
  }

  let publishedEntity: Record<string, unknown> | null = null;
  if (decision === 'ADMIN_VERIFIED') {
    try {
      if (submission.entityType === 'ROUTE') {
        const route = publishVerifiedRoute(submission);
        publishedEntity = { type: 'ROUTE', id: route.id };
      } else if (submission.entityType === 'STOP') {
        const place = publishVerifiedStop(submission);
        publishedEntity = { type: 'STOP', id: place.id };
      } else if (submission.entityType === 'BUS') {
        const bus = publishVerifiedBus(submission);
        publishedEntity = { type: 'BUS', id: bus.id };
      } else if (submission.entityType === 'TIMETABLE') {
        if (!submission.targetEntityId) throw new Error('Open the timetable correction from a specific route so it can be linked correctly.');
        const route = repository.getRouteById(submission.targetEntityId);
        if (!route) throw new Error('Target route was not found for this timetable correction.');
        const proposedTimes = Array.isArray(submission.proposedData.departureTimes)
          ? submission.proposedData.departureTimes.map((time: unknown) => String(time).trim()).filter(Boolean).sort()
          : [];
        if (proposedTimes.some((time: string) => !/^([01]\d|2[0-3]):[0-5]\d$/.test(time))) {
          throw new Error('Exact departures must use 24-hour HH:MM format.');
        }
        const updated = {
          ...route,
          firstDepartureTime: proposedTimes[0] || String(submission.proposedData.firstDepartureTime || submission.proposedData.departureTime || route.firstDepartureTime),
          lastDepartureTime: proposedTimes[proposedTimes.length - 1] || String(submission.proposedData.lastDepartureTime || route.lastDepartureTime),
          frequencyMinutes: Number(submission.proposedData.frequencyMinutes) > 0 ? Number(submission.proposedData.frequencyMinutes) : route.frequencyMinutes,
          departureTimes: proposedTimes.length ? proposedTimes : route.departureTimes,
          operatingDays: Array.isArray(submission.proposedData.operatingDays) ? normalizedDays(submission.proposedData.operatingDays) : route.operatingDays,
          updatedAt: new Date().toISOString(),
        };
        repository.updateRoute(updated);
        publishedEntity = { type: 'TIMETABLE', id: updated.id };
      }
    } catch (error: any) {
      return res.status(422).json({ error: error?.message || 'Submission cannot be published yet.' });
    }
  }

  const success = repository.updateSubmissionReview(String(req.params.id), decision, reason || 'Reviewed by administrator', adminId);
  if (!success) {
    return res.status(404).json({ error: 'Submission not found' });
  }

  repository.createAuditLog({
    id: `audit-${Date.now()}`,
    entityType: 'SUBMISSION',
    entityId: String(req.params.id),
    action: decision === 'REJECTED' ? 'DELETE' : 'VERIFY',
    actorId: adminId,
    actorRole: 'SUPER_ADMIN',
    reason,
    timestamp: new Date().toISOString(),
  });

  return res.json({ success: true, message: `Submission marked as ${decision}`, publishedEntity });
});

// GET /api/admin/duplicates
adminRouter.get('/duplicates', requireAdminAuth(), (req: Request, res: Response) => {
  const candidates = repository.listDuplicateCandidates();
  return res.json({ count: candidates.length, candidates });
});

// POST /api/admin/duplicates/:id/resolve
adminRouter.post('/duplicates/:id/resolve', requireAdminAuth(), (req: Request, res: Response) => {
  const { resolution } = req.body; // 'MERGED' | 'REJECTED_DIFFERENT'
  const adminId = (req as any).admin?.id || 'admin-default';

  const success = repository.resolveDuplicateCandidate(String(req.params.id), resolution, adminId);
  if (!success) {
    return res.status(404).json({ error: 'Duplicate candidate not found' });
  }

  return res.json({ success: true, resolution });
});

// GET /api/admin/automation/rules
adminRouter.get('/automation/rules', requireAdminAuth(), (req: Request, res: Response) => {
  const rules = repository.getAutomationRules();
  return res.json({ count: rules.length, rules });
});

// PUT /api/admin/automation/rules/:id
adminRouter.put('/automation/rules/:id', requireAdminAuth(), (req: Request, res: Response) => {
  const { isEnabled, parameters } = req.body;

  const success = repository.updateAutomationRule(String(req.params.id), isEnabled, parameters || {});
  if (!success) {
    return res.status(404).json({ error: 'Automation rule not found' });
  }

  return res.json({ success: true, message: 'Automation rule updated' });
});

// GET /api/admin/audit-logs
adminRouter.get('/audit-logs', requireAdminAuth(), (req: Request, res: Response) => {
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
  const logs = repository.getAuditLogs(limit);
  return res.json({ count: logs.length, logs });
});

// GET /api/admin/health
adminRouter.get('/health', (req: Request, res: Response) => {
  const health = repository.getSystemHealthStats();
  return res.json(health);
});
