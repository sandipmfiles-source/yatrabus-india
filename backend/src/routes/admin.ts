import { Router, Request, Response } from 'express';
import { CONFIG } from '../config.js';
import { TimetableDeparture, Route, RouteStop, Operator, Bus } from '../../../packages/shared/src/types/bus.js';
import { Place, IndianState } from '../../../packages/shared/src/types/places.js';
import { repository } from '../db/repository.js';
import { createAdminSessionToken, requireAdminAuth, verifyAdminPassword } from '../middleware/auth.js';
import { adminLoginLimiter } from '../middleware/rateLimiter.js';
import { importGtfsZip } from '../engine/gtfsImporter.js';

export const adminRouter = Router();

const ALL_OPERATING_DAYS: Route['operatingDays'] = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
function normalizeOperatingDays(value: unknown): Route['operatingDays'] {
  if (!Array.isArray(value) || value.length === 0 || value.some(day => String(day).trim().toLowerCase() === 'daily')) return ALL_OPERATING_DAYS;
  const allowed = new Set<string>(ALL_OPERATING_DAYS);
  const normalized = value.map(day => String(day).trim().slice(0, 3).toUpperCase()).filter(day => allowed.has(day));
  return normalized.length ? Array.from(new Set(normalized)) as Route['operatingDays'] : ALL_OPERATING_DAYS;
}

// POST /api/admin/login — one configured Super Admin only.
adminRouter.post('/login', adminLoginLimiter, (req: Request, res: Response) => {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }

  // Fail closed: no development/default credentials are accepted.
  if (!CONFIG.ADMIN_EMAIL || !CONFIG.ADMIN_PASSWORD_HASH || CONFIG.ADMIN_JWT_SECRET.length < 32) {
    return res.status(503).json({
      error: 'Admin login is not configured',
      message: 'The owner must configure ADMIN_EMAIL, ADMIN_PASSWORD_HASH and a 32+ character ADMIN_JWT_SECRET.',
    });
  }

  if (email !== CONFIG.ADMIN_EMAIL) {
    return res.status(401).json({ error: 'Invalid administrator credentials' });
  }

  const admin = repository.getAdminByEmail(CONFIG.ADMIN_EMAIL);
  if (!admin || !admin.isActive || admin.role !== 'SUPER_ADMIN' || !verifyAdminPassword(password)) {
    return res.status(401).json({ error: 'Invalid administrator credentials' });
  }

  const token = createAdminSessionToken(admin);
  if (!token) {
    return res.status(503).json({ error: 'Admin session signing is not configured' });
  }

  return res.json({
    token,
    expiresIn: CONFIG.ADMIN_SESSION_TTL_SECONDS,
    user: { id: admin.id, email: admin.email, name: admin.name, role: admin.role },
  });
});

// GET /api/admin/overview
adminRouter.get('/overview', requireAdminAuth('SUPER_ADMIN'), (_req: Request, res: Response) => {
  const health = repository.getSystemHealthStats();
  const recentSubmissions = repository.listSubmissions('PENDING_REVIEW').slice(0, 5);
  const recentAudit = repository.getAuditLogs(5);
  return res.json({ stats: health, recentSubmissions, recentAudit });
});

// GET /api/admin/submissions
adminRouter.get('/submissions', requireAdminAuth('SUPER_ADMIN'), (req: Request, res: Response) => {
  const status = typeof req.query.status === 'string' ? req.query.status : undefined;
  const category = typeof req.query.category === 'string' ? req.query.category : undefined;
  if (category && !['PUBLIC', 'OPERATOR'].includes(category)) return res.status(400).json({ error: 'Invalid submission category' });
  const submissions = repository.listSubmissions(status).filter(item => !category || (category === 'OPERATOR' ? item.sourceCategory === 'OPERATOR' : item.sourceCategory !== 'OPERATOR'));
  return res.json({ count: submissions.length, submissions });
});

// POST /api/admin/submissions/:id/review
adminRouter.post('/submissions/:id/review', requireAdminAuth('SUPER_ADMIN'), (req: Request, res: Response) => {
  const { decision, reason, verifyTimetable } = req.body;
  const adminId = (req as any).admin.id;

  if (!decision || !['ADMIN_VERIFIED', 'COMMUNITY_CORROBORATED', 'REJECTED'].includes(decision)) {
    return res.status(400).json({ error: 'Valid review decision required' });
  }

  const reviewReason = typeof reason === 'string' ? reason.trim().slice(0, 1000) : '';

  // A new route is published only after an explicit Super Admin approval.
  const pendingSubmission = repository.listSubmissions().find(item => item.id === String(req.params.id));
  if (!pendingSubmission) return res.status(404).json({ error: 'Submission not found' });
  if (pendingSubmission.status !== 'PENDING_REVIEW') {
    return res.status(409).json({ error: 'This submission has already been reviewed.' });
  }
  const evidenceUrl = typeof pendingSubmission.proposedData?.evidenceUrl === 'string' ? pendingSubmission.proposedData.evidenceUrl.trim() : '';
  const hasHttpsEvidence = /^https:\/\//i.test(evidenceUrl);
  if (verifyTimetable === true && (decision !== 'ADMIN_VERIFIED' || !hasHttpsEvidence)) {
    return res.status(422).json({ error: 'Timetable verification requires Super Admin approval and a valid HTTPS official evidence link.' });
  }
  if (decision === 'ADMIN_VERIFIED' && pendingSubmission.entityType === 'STOP' && pendingSubmission.submissionType === 'ADD_STOP') {
    const data = pendingSubmission.proposedData || {};
    const canonicalName = typeof data.name === 'string' ? data.name.trim().slice(0, 160) : '';
    const latitude = Number(data.latitude ?? data.originLatitude);
    const longitude = Number(data.longitude ?? data.originLongitude);
    if (canonicalName.length < 2 || !Number.isFinite(latitude) || latitude < 6 || latitude > 38 ||
        !Number.isFinite(longitude) || longitude < 68 || longitude > 98) {
      return res.status(422).json({ error: 'A bus stop name and valid India latitude/longitude are required.' });
    }
    const duplicate = repository.searchPlaces(canonicalName, 8).some(item =>
      item.place.canonicalName.toLocaleLowerCase() === canonicalName.toLocaleLowerCase()
    );
    if (duplicate) return res.status(409).json({ error: 'A place with this exact name already exists. Review the existing place instead of creating a duplicate.' });
    const now = new Date().toISOString();
    const place: Place = {
      id: `place-community-${pendingSubmission.id}`,
      canonicalName,
      names: { en: canonicalName, hi: canonicalName, bn: canonicalName },
      placeType: 'BUS_STOP',
      district: typeof data.district === 'string' ? data.district.trim().slice(0, 100) : undefined,
      state: typeof data.state === 'string' ? data.state as IndianState : undefined,
      latitude,
      longitude,
      sourceDataset: 'COMMUNITY_SUBMISSION',
      sourceRecordId: pendingSubmission.referenceId,
      sourceLicense: 'Community contribution',
      verificationStatus: 'ADMIN_VERIFIED',
      aliases: [],
      createdAt: now,
      updatedAt: now,
    };
    repository.addPlace(place);
  }
  if (decision === 'ADMIN_VERIFIED' && pendingSubmission.proposedData?.action === 'UPDATE_ROUTE') {
    const data = pendingSubmission.proposedData;
    const route = pendingSubmission.targetEntityId
      ? repository.getRouteById(pendingSubmission.targetEntityId)
      : (typeof data.routeNumber === 'string' ? repository.getRouteByNumber(data.routeNumber) : undefined);
    const stopsInput = Array.isArray(data.stops) ? data.stops : [];
    const validTime = (value: unknown) => typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
    const distanceKm = Number(data.distanceKm);
    const durationMinutes = Number(data.typicalDurationMinutes);
    if (!route || stopsInput.length < 2 || !validTime(data.firstDepartureTime) || !validTime(data.lastDepartureTime) ||
        !Number.isFinite(distanceKm) || distanceKm <= 0 || !Number.isFinite(durationMinutes) || durationMinutes <= 0) {
      return res.status(422).json({ error: 'Route update needs an existing route, two or more stops, valid service times, distance and duration.' });
    }
    if (stopsInput.some((stop: any) => typeof stop?.name !== 'string' || stop.name.trim().length < 2 ||
        !Number.isFinite(Number(stop.latitude)) || Number(stop.latitude) < -90 || Number(stop.latitude) > 90 ||
        !Number.isFinite(Number(stop.longitude)) || Number(stop.longitude) < -180 || Number(stop.longitude) > 180)) {
      return res.status(422).json({ error: 'Every route stop must have a name and valid coordinates.' });
    }
    const updateStopNames = stopsInput.map((stop: any) => String(stop.name).trim().toLocaleLowerCase());
    const updateStopCoordinates = stopsInput.map((stop: any) => `${Number(stop.latitude).toFixed(5)},${Number(stop.longitude).toFixed(5)}`);
    if (new Set(updateStopNames).size !== updateStopNames.length || new Set(updateStopCoordinates).size !== updateStopCoordinates.length) {
      return res.status(422).json({ error: 'Route stops must have unique names and coordinates in travel order.' });
    }
    let distanceFromStartKm = 0;
    const requestedDepartureTimes = Array.isArray(data.departureTimes)
      ? data.departureTimes.map((time: unknown) => String(time).trim()).filter(Boolean).sort()
      : route.departureTimes;
    if (requestedDepartureTimes && (requestedDepartureTimes.some((time: string) => !validTime(time)) || new Set(requestedDepartureTimes).size !== requestedDepartureTimes.length)) {
      return res.status(422).json({ error: 'Exact departure times must be unique 24-hour HH:MM values.' });
    }
    const updatedStops: RouteStop[] = stopsInput.map((stop: any, index: number) => {
      if (index > 0) {
        const previous = stopsInput[index - 1];
        const lat1 = Number(previous.latitude) * Math.PI / 180;
        const lat2 = Number(stop.latitude) * Math.PI / 180;
        const dLat = lat2 - lat1;
        const dLon = (Number(stop.longitude) - Number(previous.longitude)) * Math.PI / 180;
        const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
        distanceFromStartKm += 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      }
      return {
        id: `${route.id}-stop-${index + 1}`,
        routeId: route.id,
        stopId: `${route.id}-place-${index + 1}`,
        stopName: stop.name.trim().slice(0, 120),
        stopSequence: index + 1,
        latitude: Number(stop.latitude),
        longitude: Number(stop.longitude),
        distanceFromStartKm: Number(distanceFromStartKm.toFixed(2)),
        scheduledArrivalTime: validTime(stop.arrivalTime) ? stop.arrivalTime : undefined,
        scheduledDepartureTime: validTime(stop.departureTime) ? stop.departureTime : undefined,
        scheduleSourceName: verifyTimetable === true ? 'Super Admin-reviewed community submission' : undefined,
        scheduleSourceUrl: verifyTimetable === true ? evidenceUrl : undefined,
        scheduleVerifiedAt: verifyTimetable === true ? new Date().toISOString() : undefined,
      };
    });
    repository.addRoute({
      ...route,
      routeNumber: typeof data.routeNumber === 'string' ? data.routeNumber.trim().slice(0, 40) : route.routeNumber,
      routeName: typeof data.routeName === 'string' ? data.routeName.trim().slice(0, 160) : route.routeName,
      originStopId: updatedStops[0].stopId,
      originStopName: updatedStops[0].stopName,
      destinationStopId: updatedStops[updatedStops.length - 1].stopId,
      destinationStopName: updatedStops[updatedStops.length - 1].stopName,
      distanceKm,
      typicalDurationMinutes: durationMinutes,
      firstDepartureTime: data.firstDepartureTime,
      lastDepartureTime: data.lastDepartureTime,
      direction: data.direction === 'DOWN' || data.direction === 'CIRCULAR' ? data.direction : data.direction === 'UP' ? 'UP' : route.direction,
      operatingDays: Array.isArray(data.operatingDays) ? normalizeOperatingDays(data.operatingDays) : route.operatingDays,
      departureTimes: requestedDepartureTimes,
      frequencyMinutes: Number.isFinite(Number(data.frequencyMinutes)) && Number(data.frequencyMinutes) > 0
        ? Number(data.frequencyMinutes) : undefined,
      timetableSource: verifyTimetable === true ? 'Super Admin-reviewed community submission' : route.timetableSource,
      timetableSourceUrl: verifyTimetable === true ? evidenceUrl : route.timetableSourceUrl,
      timetableVerifiedAt: verifyTimetable === true ? new Date().toISOString() : route.timetableVerifiedAt,
      timetableDataStatus: verifyTimetable === true ? 'SCHEDULED' : route.timetableDataStatus || 'UNAVAILABLE',
      departures: verifyTimetable === true ? route.departures?.map(departure => ({
        ...departure, sourceName: 'Super Admin-reviewed community submission',
        sourceUrl: evidenceUrl, sourceVerifiedAt: new Date().toISOString(), dataStatus: 'SCHEDULED' as const,
      })) : route.departures,
      serviceStatus: 'SCHEDULE_UNVERIFIED',
      stops: updatedStops,
      geometry: updatedStops.map(stop => ({ latitude: stop.latitude, longitude: stop.longitude })),
      updatedAt: new Date().toISOString(),
    });
  }

  if (decision === 'ADMIN_VERIFIED' && pendingSubmission.submissionType === 'SUGGEST_ROUTE' &&
      pendingSubmission.entityType === 'ROUTE') {
    const data = pendingSubmission.proposedData || {};
    const routeNumber = typeof data.routeNumber === 'string' ? data.routeNumber.trim() : '';
    const routeName = typeof data.routeName === 'string' ? data.routeName.trim() : '';
    const operatorName = typeof data.operatorName === 'string' ? data.operatorName.trim() : '';
    const stopsInput = Array.isArray(data.stops) ? data.stops : [];
    const validTime = (value: unknown) => typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
    const distanceKm = Number(data.distanceKm);
    const durationMinutes = Number(data.typicalDurationMinutes);
    const departureTimes = Array.isArray(data.departureTimes)
      ? data.departureTimes.map((time: unknown) => String(time).trim()).filter(Boolean).sort()
      : [];
    if (departureTimes.some((time: string) => !validTime(time)) || new Set(departureTimes).size !== departureTimes.length) {
      return res.status(422).json({ error: 'Exact departure times must be unique 24-hour HH:MM values.' });
    }
    if (!routeNumber || !routeName || !operatorName || stopsInput.length < 2 ||
        !validTime(data.firstDepartureTime) || !validTime(data.lastDepartureTime) ||
        !Number.isFinite(distanceKm) || distanceKm <= 0 ||
        !Number.isFinite(durationMinutes) || durationMinutes <= 0) {
      return res.status(422).json({ error: 'Route details are incomplete. Add route number, name, operator, at least two stops, valid service times, distance and duration.' });
    }
    if (repository.getRouteByNumber(routeNumber)) {
      return res.status(409).json({ error: 'A route with this route number already exists.' });
    }
    const stopsAreValid = stopsInput.every((stop: any) =>
      typeof stop?.name === 'string' && stop.name.trim().length > 1 &&
      Number.isFinite(Number(stop.latitude)) && Number(stop.latitude) >= -90 && Number(stop.latitude) <= 90 &&
      Number.isFinite(Number(stop.longitude)) && Number(stop.longitude) >= -180 && Number(stop.longitude) <= 180
    );
    if (!stopsAreValid) {
      return res.status(422).json({ error: 'Every stop must have a name and valid latitude/longitude coordinates.' });
    }
    const createStopNames = stopsInput.map((stop: any) => String(stop.name).trim().toLocaleLowerCase());
    const createStopCoordinates = stopsInput.map((stop: any) => `${Number(stop.latitude).toFixed(5)},${Number(stop.longitude).toFixed(5)}`);
    if (new Set(createStopNames).size !== createStopNames.length || new Set(createStopCoordinates).size !== createStopCoordinates.length) {
      return res.status(422).json({ error: 'Route stops must have unique names and coordinates in travel order.' });
    }
    const now = new Date().toISOString();
    let operator = repository.getOperatorByName(operatorName);
    if (!operator) {
      const createdOperator: Operator = {
        id: `operator-community-${pendingSubmission.id}`,
        name: operatorName.slice(0, 100),
        operatorType: 'PRIVATE_FLEET',
        serviceArea: String(data.state || 'India').slice(0, 80),
        verificationStatus: 'COMMUNITY_LISTED',
        isClaimed: false,
        sourceDataset: 'COMMUNITY_SUBMISSION',
        createdAt: now,
        updatedAt: now,
      };
      operator = repository.addOperator(createdOperator);
    }
    const routeId = `route-community-${pendingSubmission.id}`;
    let distanceFromStartKm = 0;
    const stops: RouteStop[] = stopsInput.map((stop: any, index: number) => {
      if (index > 0) {
        const previous = stopsInput[index - 1];
        const lat1 = Number(previous.latitude) * Math.PI / 180;
        const lat2 = Number(stop.latitude) * Math.PI / 180;
        const dLat = lat2 - lat1;
        const dLon = (Number(stop.longitude) - Number(previous.longitude)) * Math.PI / 180;
        const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
        distanceFromStartKm += 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      }
      return {
        id: `${routeId}-stop-${index + 1}`,
        routeId,
        stopId: `${routeId}-place-${index + 1}`,
        stopName: stop.name.trim().slice(0, 120),
        stopSequence: index + 1,
        latitude: Number(stop.latitude),
        longitude: Number(stop.longitude),
        distanceFromStartKm: Number(distanceFromStartKm.toFixed(2)),
        scheduledArrivalTime: validTime(stop.arrivalTime) ? stop.arrivalTime : undefined,
        scheduledDepartureTime: validTime(stop.departureTime) ? stop.departureTime : undefined,
        scheduleSourceName: verifyTimetable === true ? 'Super Admin-reviewed community submission' : undefined,
        scheduleSourceUrl: verifyTimetable === true ? evidenceUrl : undefined,
        scheduleVerifiedAt: verifyTimetable === true ? new Date().toISOString() : undefined,
      };
    });
    const route: Route = {
      id: routeId,
      routeNumber: routeNumber.slice(0, 40),
      routeName: routeName.slice(0, 160),
      originStopId: stops[0].stopId,
      originStopName: stops[0].stopName,
      destinationStopId: stops[stops.length - 1].stopId,
      destinationStopName: stops[stops.length - 1].stopName,
      operatorId: operator.id,
      operatorName: operator.name,
      contributedBy: pendingSubmission.contributorDisplayName || pendingSubmission.contributorNote || undefined,
      direction: data.direction === 'DOWN' || data.direction === 'CIRCULAR' ? data.direction : 'UP',
      distanceKm,
      typicalDurationMinutes: durationMinutes,
      operatingDays: normalizeOperatingDays(data.operatingDays),
      firstDepartureTime: data.firstDepartureTime,
      lastDepartureTime: data.lastDepartureTime,
      frequencyMinutes: Number.isFinite(Number(data.frequencyMinutes)) && Number(data.frequencyMinutes) > 0
        ? Number(data.frequencyMinutes) : undefined,
      departureTimes: departureTimes.length ? departureTimes : undefined,
      stops,
      geometry: stops.map(stop => ({ latitude: stop.latitude, longitude: stop.longitude })),
      verificationStatus: 'ADMIN_VERIFIED',
      timetableSource: verifyTimetable === true ? 'Super Admin-reviewed community submission' : undefined,
      timetableSourceUrl: verifyTimetable === true ? evidenceUrl : undefined,
      timetableVerifiedAt: verifyTimetable === true ? now : undefined,
      timetableDataStatus: verifyTimetable === true ? 'SCHEDULED' : 'UNAVAILABLE',
      serviceStatus: 'SCHEDULE_UNVERIFIED',
      createdAt: now,
      updatedAt: now,
    };
    repository.addRoute(route);
  }

  // Only an explicit, admin-approved timetable contribution becomes publicly searchable.
  if (decision === 'ADMIN_VERIFIED' && pendingSubmission?.proposedData?.action === 'CORRECT_STOP_TIME') {
    const data = pendingSubmission.proposedData;
    const route = typeof data.routeNumber === 'string' ? repository.getRouteByNumber(data.routeNumber) : undefined;
    const validTime = (value: unknown) => typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
    const field = data.field === 'scheduledDepartureTime' ? 'scheduledDepartureTime' : 'scheduledArrivalTime';
    if (!route || !validTime(data.value)) return res.status(422).json({ error: 'A valid route and HH:MM stop time are required.' });
    const stopExists = route.stops.some(stop => stop.id === data.stopId || stop.stopId === data.stopId);
    if (!stopExists) return res.status(404).json({ error: 'The selected stop is not part of this route.' });
    const updatedRoute: Route = {
      ...route,
      stops: route.stops.map(stop => (stop.id === data.stopId || stop.stopId === data.stopId)
        ? {
            ...stop, [field]: data.value,
            ...(verifyTimetable === true ? {
              scheduleSourceName: 'Super Admin-reviewed community submission',
              scheduleSourceUrl: evidenceUrl,
              scheduleVerifiedAt: new Date().toISOString(),
            } : {}),
          }
        : stop),
      updatedAt: new Date().toISOString(),
    };
    repository.addRoute(updatedRoute);
  }

  if (decision === 'ADMIN_VERIFIED' && pendingSubmission?.proposedData?.action === 'CORRECT_STOP_NAME') {
    const data = pendingSubmission.proposedData;
    const route = typeof data.routeNumber === 'string' ? repository.getRouteByNumber(data.routeNumber) : undefined;
    const value = typeof data.value === 'string' ? data.value.trim().slice(0, 120) : '';
    if (!route || value.length < 2) return res.status(422).json({ error: 'A valid route and stop name are required.' });
    const stopExists = route.stops.some(stop => stop.id === data.stopId || stop.stopId === data.stopId);
    if (!stopExists) return res.status(404).json({ error: 'The selected stop is not part of this route.' });
    repository.addRoute({
      ...route,
      stops: route.stops.map(stop => (stop.id === data.stopId || stop.stopId === data.stopId)
        ? { ...stop, stopName: value }
        : stop),
      updatedAt: new Date().toISOString(),
    });
  }

  if (decision === 'ADMIN_VERIFIED' && pendingSubmission?.proposedData?.action === 'UPDATE_BUS_TIMETABLE') {
    const data = pendingSubmission.proposedData;
    const route = typeof data.routeNumber === 'string' ? repository.getRouteByNumber(data.routeNumber) : undefined;
    const validTime = (value: unknown) => typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
    if (!route || !data.busIdentifier || !validTime(data.departureTime) || !validTime(data.arrivalTime)) {
      return res.status(422).json({ error: 'Valid route, bus name, departure and arrival times are required.' });
    }
    const oldBusIdentifier = typeof data.originalBusIdentifier === 'string' && data.originalBusIdentifier.trim()
      ? data.originalBusIdentifier.trim() : String(data.busIdentifier);
    const stopTimes = (Array.isArray(data.stops) ? data.stops : []).flatMap((input: any) => {
      const matched = typeof input?.name === 'string'
        ? route.stops.find(stop => stop.stopName.trim().toLowerCase() === input.name.trim().toLowerCase())
        : undefined;
      if (!matched) return [];
      return [{
        stopId: matched.stopId,
        arrivalTime: validTime(input.arrivalTime) ? input.arrivalTime : undefined,
        departureTime: validTime(input.departureTime) ? input.departureTime : undefined,
      }];
    });
    const departureVerification = verifyTimetable === true ? {
      sourceName: 'Super Admin-reviewed community submission',
      sourceUrl: evidenceUrl,
      sourceVerifiedAt: new Date().toISOString(),
    } : undefined;
    if (!repository.updateTimetableDeparture(route.id, oldBusIdentifier, data.departureTime, data.arrivalTime, String(data.busIdentifier), stopTimes, departureVerification)) {
      return res.status(404).json({ error: 'Existing timetable departure was not found for this bus.' });
    }
    const targetBus = pendingSubmission.targetEntityId ? repository.getBusById(pendingSubmission.targetEntityId) : undefined;
    if (targetBus) repository.addBus({
      ...targetBus,
      publicIdentifier: String(data.busIdentifier).trim().slice(0, 80),
      operatorName: typeof data.operatorName === 'string' ? data.operatorName.trim().slice(0, 120) : targetBus.operatorName,
      contributedBy: pendingSubmission.contributorDisplayName || targetBus.contributedBy,
      serviceStatus: 'SCHEDULE_UNVERIFIED',
      updatedAt: new Date().toISOString(),
    });
    // Verifying one departure does not prove that the entire route is operating today.
  }

  if (decision === 'ADMIN_VERIFIED' && pendingSubmission?.submissionType === 'DELETE_BUS') {
    const busId = pendingSubmission.targetEntityId || '';
    const proposedIdentifier = typeof pendingSubmission.proposedData?.busIdentifier === 'string'
      ? pendingSubmission.proposedData.busIdentifier.trim().toLocaleLowerCase() : '';
    const routeNumber = typeof pendingSubmission.proposedData?.routeNumber === 'string'
      ? pendingSubmission.proposedData.routeNumber.trim() : '';
    const route = routeNumber ? repository.getRouteByNumber(routeNumber) : undefined;
    const bus = (busId ? repository.getBusById(busId) : undefined) ||
      (proposedIdentifier && route
        ? repository.getAllBuses().find(item => item.isActive && item.routeId === route.id &&
            item.publicIdentifier.trim().toLocaleLowerCase() === proposedIdentifier)
        : undefined);
    if (!bus) return res.status(404).json({ error: 'Matching active bus record was not found. Check the route number and exact bus name / number before approving removal.' });
    repository.addBus({ ...bus, isActive: false, updatedAt: new Date().toISOString() });
  }

  if (decision === 'ADMIN_VERIFIED' && pendingSubmission?.proposedData?.timetableEntry === true) {
    const data = pendingSubmission.proposedData;
    const route = typeof data.routeNumber === 'string' ? repository.getRouteByNumber(data.routeNumber) : undefined;
    if (!route) {
      return res.status(422).json({ error: 'Route number was not found. Add and verify the route before approving this bus timetable entry.' });
    }
    const validTime = (value: unknown) => typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
    if (typeof data.departureTime !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(data.departureTime) ||
        typeof data.arrivalTime !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(data.arrivalTime)) {
      return res.status(422).json({ error: 'A valid departure and arrival time are required before publishing.' });
    }
    const requestedDays = Array.isArray(data.operatingDays)
      ? data.operatingDays.map((day: unknown) => String(day).trim().slice(0, 3).toUpperCase())
        .filter((day: string) => ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'].includes(day))
      : [];
    const days = (requestedDays.length ? Array.from(new Set(requestedDays)) : route.operatingDays) as TimetableDeparture['operatingDays'];
    const stopTimes = (Array.isArray(data.stops) ? data.stops : []).flatMap((input: any) => {
      const matched = typeof input?.name === 'string'
        ? route.stops.find(stop => stop.stopName.trim().toLowerCase() === input.name.trim().toLowerCase())
        : undefined;
      if (!matched) return [];
      return [{
        stopId: matched.stopId,
        arrivalTime: validTime(input.arrivalTime) ? input.arrivalTime : undefined,
        departureTime: validTime(input.departureTime) ? input.departureTime : undefined,
      }];
    });
    const departure: TimetableDeparture = {
      id: `departure-${pendingSubmission.id}`,
      timetableId: route.id,
      departureTime: data.departureTime,
      arrivalTime: data.arrivalTime,
      busIdentifier: typeof data.busIdentifier === 'string' ? data.busIdentifier.trim().slice(0, 80) : undefined,
      stopTimes,
      operatingDays: days.length ? days : ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'],
      confidenceScore: 100,
      sourceName: verifyTimetable === true ? 'Super Admin-reviewed community submission' : undefined,
      sourceUrl: verifyTimetable === true ? evidenceUrl : undefined,
      sourceVerifiedAt: verifyTimetable === true ? new Date().toISOString() : undefined,
      dataStatus: verifyTimetable === true ? 'SCHEDULED' : 'UNAVAILABLE',
      isCancelled: false,
    };
    if (!repository.addTimetableDeparture(route.id, departure, Number(data.frequencyMinutes))) {
      return res.status(409).json({ error: 'This bus and departure time already exist on the selected route.' });
    }
    // One reviewed departure is not proof that the complete route is operating as scheduled.
    const busIdentifier = typeof data.busIdentifier === 'string' ? data.busIdentifier.trim().slice(0, 80) : '';
    if (busIdentifier && !repository.getBusesForRoute(route.id).some(bus => bus.publicIdentifier.toLowerCase() === busIdentifier.toLowerCase())) {
      const now = new Date().toISOString();
      const bus: Bus = {
        id: `bus-community-${pendingSubmission.id}`,
        routeId: route.id,
        publicIdentifier: busIdentifier,
        operatorId: route.operatorId,
        operatorName: route.operatorName,
        contributedBy: pendingSubmission.contributorDisplayName || pendingSubmission.contributorNote || undefined,
        vehicleType: 'ORDINARY',
        hasCustomSvgIllustration: true,
        serviceStatus: 'SCHEDULE_UNVERIFIED',
        verificationStatus: 'ADMIN_VERIFIED',
        isActive: true,
        createdAt: now,
        updatedAt: now,
      };
      repository.addBus(bus);
    }
  }

  const success = repository.updateSubmissionReview(
    String(req.params.id),
    decision,
    reviewReason || 'Reviewed by Super Admin',
    adminId
  );
  if (!success) return res.status(404).json({ error: 'Submission not found' });

  repository.createAuditLog({
    id: `audit-${Date.now()}`,
    entityType: 'SUBMISSION',
    entityId: String(req.params.id),
    action: decision === 'REJECTED' ? 'DELETE' : 'VERIFY',
    actorId: adminId,
    actorRole: 'SUPER_ADMIN',
    reason: reviewReason || undefined,
    timestamp: new Date().toISOString(),
  });

  return res.json({ success: true, message: `Submission marked as ${decision}` });
});

// GET /api/admin/buses?q= — protected fleet search for the sole Super Admin.
adminRouter.get('/buses', requireAdminAuth('SUPER_ADMIN'), (req: Request, res: Response) => {
  const query = typeof req.query.q === 'string' ? req.query.q.trim().toLowerCase() : '';
  const routes = repository.getAllRoutes();
  const buses = repository.getAllBuses().map(bus => ({
    bus,
    routes: routes.filter(route => route.operatorId === bus.operatorId),
  })).filter(item => !query ||
    item.bus.publicIdentifier.toLowerCase().includes(query) ||
    (item.bus.operatorName || '').toLowerCase().includes(query) ||
    item.routes.some(route => route.routeNumber.toLowerCase().includes(query) || route.routeName.toLowerCase().includes(query))
  );
  return res.json({ count: buses.length, buses });
});

// PUT /api/admin/buses/:id — Super Admin edits a bus record.
adminRouter.put('/buses/:id', requireAdminAuth('SUPER_ADMIN'), (req: Request, res: Response) => {
  const existing = repository.getBusById(String(req.params.id));
  if (!existing) return res.status(404).json({ error: 'Bus not found' });
  const data = req.body || {};
  const publicIdentifier = typeof data.publicIdentifier === 'string' ? data.publicIdentifier.trim().slice(0, 80) : existing.publicIdentifier;
  if (!publicIdentifier) return res.status(400).json({ error: 'Bus name or number is required' });
  const updated: Bus = {
    ...existing,
    publicIdentifier,
    operatorName: typeof data.operatorName === 'string' ? data.operatorName.trim().slice(0, 120) : existing.operatorName,
    vehicleType: ['ORDINARY','EXPRESS','SEMI_DELUXE','DELUXE_AC','ELECTRIC_AC','VOLVO_SCANIA','SLEEPER','MINI_FEEDER'].includes(data.vehicleType) ? data.vehicleType : existing.vehicleType,
    serviceStatus: ['OPERATING_SCHEDULED','SCHEDULE_UNVERIFIED','POSSIBLE_DELAY','ROUTE_CHANGED','DISRUPTION_REPORTED','POSSIBLY_DISCONTINUED','CONFIRMED_DISCONTINUED','STATUS_UNKNOWN'].includes(data.serviceStatus) ? data.serviceStatus : existing.serviceStatus,
    isActive: typeof data.isActive === 'boolean' ? data.isActive : existing.isActive,
    updatedAt: new Date().toISOString(),
  };
  repository.addBus(updated);
  return res.json({ success: true, bus: updated });
});

// GET /api/admin/routes?q= — Super Admin route/timetable review queue.
adminRouter.get('/routes', requireAdminAuth('SUPER_ADMIN'), (req: Request, res: Response) => {
  const query = typeof req.query.q === 'string' ? req.query.q.trim().toLocaleLowerCase() : '';
  const routes = repository.getAllRoutes().filter(route => !query || [
    route.routeNumber, route.routeName, route.originStopName, route.destinationStopName,
    route.operatorName, route.timetableSource,
  ].filter(Boolean).join(' ').toLocaleLowerCase().includes(query));
  return res.json({
    count: routes.length,
    routes: routes.slice(0, 200).map(route => ({
      ...route,
      timetableDataStatus: route.timetableDataStatus || 'UNAVAILABLE',
    })),
  });
});

// PUT /api/admin/routes/:id — full route and stop timetable edit.
adminRouter.put('/routes/:id', requireAdminAuth('SUPER_ADMIN'), (req: Request, res: Response) => {
  const existing = repository.getRouteById(String(req.params.id));
  if (!existing) return res.status(404).json({ error: 'Route not found' });
  const data = req.body || {};
  const validTime = (value: unknown) => typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
  const stops = Array.isArray(data.stops) ? data.stops : existing.stops;
  if (!stops.length || stops.some((stop: any) => typeof stop?.stopName !== 'string' || !stop.stopName.trim() ||
      !Number.isFinite(Number(stop.latitude)) || !Number.isFinite(Number(stop.longitude)))) {
    return res.status(422).json({ error: 'Every route stop must have a name and valid coordinates.' });
  }
  const confirmTimetableVerification = data.confirmTimetableVerification === true;
  const verificationReason = typeof data.verificationReason === 'string' ? data.verificationReason.trim().slice(0, 500) : '';
  const timetableSource = typeof data.timetableSource === 'string' ? data.timetableSource.trim().slice(0, 180) : existing.timetableSource;
  const timetableSourceUrl = typeof data.timetableSourceUrl === 'string' ? data.timetableSourceUrl.trim().slice(0, 500) : existing.timetableSourceUrl;
  if (data.timetableDataStatus === 'SCHEDULED' && !confirmTimetableVerification) {
    return res.status(403).json({ error: 'A timetable can only be marked SCHEDULED through explicit Super Admin verification.' });
  }
  if (timetableSourceUrl && !/^https:\/\//i.test(timetableSourceUrl)) {
    return res.status(422).json({ error: 'Timetable source URL must use HTTPS.' });
  }
  if (confirmTimetableVerification && (
      !timetableSource || !timetableSourceUrl ||
      verificationReason.length < 10
  )) {
    return res.status(422).json({ error: 'Timetable verification requires a named source, HTTPS source URL and a reason of at least 10 characters.' });
  }
  if (data.timetableDataStatus !== undefined && !['SCHEDULED', 'UNAVAILABLE'].includes(data.timetableDataStatus)) {
    return res.status(422).json({ error: 'Timetable data status must be SCHEDULED or UNAVAILABLE. Live GPS is tracked separately.' });
  }
  const now = new Date().toISOString();
  const { confirmTimetableVerification: _confirm, verificationReason: _reason, ...routeData } = data;
  const updated: Route = {
    ...existing,
    ...routeData,
    id: existing.id,
    operatorId: existing.operatorId,
    routeNumber: typeof data.routeNumber === 'string' ? data.routeNumber.trim().slice(0, 40) : existing.routeNumber,
    routeName: typeof data.routeName === 'string' ? data.routeName.trim().slice(0, 160) : existing.routeName,
    firstDepartureTime: validTime(data.firstDepartureTime) ? data.firstDepartureTime : existing.firstDepartureTime,
    lastDepartureTime: validTime(data.lastDepartureTime) ? data.lastDepartureTime : existing.lastDepartureTime,
    direction: data.direction === 'UP' || data.direction === 'DOWN' || data.direction === 'CIRCULAR' ? data.direction : existing.direction,
    timetableSource,
    timetableSourceUrl,
    timetableDataStatus: confirmTimetableVerification ? 'SCHEDULED' : data.timetableDataStatus === 'UNAVAILABLE' ? 'UNAVAILABLE' : existing.timetableDataStatus,
    timetableVerifiedAt: confirmTimetableVerification ? now : data.timetableDataStatus === 'UNAVAILABLE' ? undefined : existing.timetableVerifiedAt,
    departures: existing.departures?.map(departure => confirmTimetableVerification ? ({
      ...departure, sourceName: timetableSource, sourceUrl: timetableSourceUrl,
      sourceVerifiedAt: now, dataStatus: 'SCHEDULED' as const,
    }) : data.timetableDataStatus === 'UNAVAILABLE' ? ({
      ...departure, dataStatus: 'UNAVAILABLE' as const, sourceVerifiedAt: undefined,
    }) : departure),
    verificationStatus: confirmTimetableVerification ? 'ADMIN_VERIFIED' : existing.verificationStatus,
    serviceStatus: confirmTimetableVerification ? 'SCHEDULE_UNVERIFIED' : existing.serviceStatus,
    stops,
    updatedAt: now,
  };
  repository.addRoute(updated);
  repository.createAuditLog({
    id: `audit-${Date.now()}`, entityType: 'ROUTE_TIMETABLE', entityId: existing.id,
    action: confirmTimetableVerification ? 'VERIFY' : 'UPDATE',
    actorId: (req as any).admin.id, actorRole: 'SUPER_ADMIN',
    reason: confirmTimetableVerification ? verificationReason : 'Updated route or timetable metadata.',
    previousPayload: { timetableSource: existing.timetableSource, timetableSourceUrl: existing.timetableSourceUrl, timetableDataStatus: existing.timetableDataStatus, timetableVerifiedAt: existing.timetableVerifiedAt },
    newPayload: { timetableSource: updated.timetableSource, timetableSourceUrl: updated.timetableSourceUrl, timetableDataStatus: updated.timetableDataStatus, timetableVerifiedAt: updated.timetableVerifiedAt },
    timestamp: now,
  });
  return res.json({ success: true, route: updated });
});

// GET /api/admin/duplicates
adminRouter.get('/duplicates', requireAdminAuth('SUPER_ADMIN'), (_req: Request, res: Response) => {
  const candidates = repository.listDuplicateCandidates();
  return res.json({ count: candidates.length, candidates });
});

// POST /api/admin/duplicates/:id/resolve
adminRouter.post('/duplicates/:id/resolve', requireAdminAuth('SUPER_ADMIN'), (req: Request, res: Response) => {
  const { resolution } = req.body;
  const adminId = (req as any).admin.id;
  if (!['MERGED', 'REJECTED_DIFFERENT'].includes(resolution)) {
    return res.status(400).json({ error: 'Valid duplicate resolution required' });
  }
  const success = repository.resolveDuplicateCandidate(String(req.params.id), resolution, adminId);
  if (!success) return res.status(404).json({ error: 'Duplicate candidate not found' });
  repository.createAuditLog({
    id: `audit-${Date.now()}`, entityType: 'DUPLICATE_CANDIDATE', entityId: String(req.params.id),
    action: resolution === 'MERGED' ? 'MERGE' : 'UPDATE', actorId: adminId, actorRole: 'SUPER_ADMIN',
    reason: `Resolved duplicate candidate as ${resolution}`, timestamp: new Date().toISOString(),
  });
  return res.json({ success: true, resolution });
});

// GET /api/admin/places?q= — protected directory search over the backend catalogue.
adminRouter.get('/places', requireAdminAuth('SUPER_ADMIN'), (req: Request, res: Response) => {
  const query = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  const results = repository.searchPlaces(query, 100);
  return res.json({ count: results.length, places: results.map(item => item.place) });
});

// GET /api/admin/tracking — protected bus-level tracking overview; never returns passenger traces.
adminRouter.get('/tracking', requireAdminAuth('SUPER_ADMIN'), (_req: Request, res: Response) => {
  const services: Array<{ route: Route; bus: Bus | null; location: any }> = [];
  for (const route of repository.getAllRoutes()) {
    const buses = repository.getBusesForRoute(route.id);
    if (!buses.length) {
      services.push({ route, bus: null, location: null });
      continue;
    }
    for (const bus of buses) {
      services.push({ route, bus, location: repository.getBusLocation(bus.id) || null });
    }
  }
  return res.json({ count: services.length, services });
});

// GET /api/admin/automation/rules
adminRouter.get('/automation/rules', requireAdminAuth('SUPER_ADMIN'), (_req: Request, res: Response) => {
  const rules = repository.getAutomationRules();
  return res.json({ count: rules.length, rules });
});

// PUT /api/admin/automation/rules/:id
adminRouter.put('/automation/rules/:id', requireAdminAuth('SUPER_ADMIN'), (req: Request, res: Response) => {
  const { isEnabled, parameters } = req.body;
  if (typeof isEnabled !== 'boolean' || !parameters || typeof parameters !== 'object' || Array.isArray(parameters)) {
    return res.status(400).json({ error: 'isEnabled and a parameters object are required.' });
  }

  const rule = repository.getAutomationRules().find(item => item.id === String(req.params.id));
  if (!rule) return res.status(404).json({ error: 'Automation rule not found' });

  const allowedKeys: Record<string, string[]> = {
    GPS_FRESHNESS_MONITOR: ['gpsFreshnessLiveSeconds', 'gpsFreshnessStaleSeconds'],
    SESSION_SAFETY_EXPIRY: ['maxJourneySessionHours'],
    DUPLICATE_STOP_SCANNER: ['duplicateSimilarityThreshold', 'duplicateMaxDistanceMeters'],
    AUTO_PUBLISH_MINOR_TIMETABLE: ['autoPublishLowRiskMinorCorrections'],
  };
  const allowed = allowedKeys[rule.ruleCode];
  if (!allowed) return res.status(403).json({ error: 'This automation rule is not available for runtime editing.' });
  if (Object.keys(parameters).some(key => !allowed.includes(key))) {
    return res.status(400).json({ error: 'Unknown automation parameter supplied.' });
  }

  if (rule.ruleCode === 'AUTO_PUBLISH_MINOR_TIMETABLE') {
    if (isEnabled || parameters.autoPublishLowRiskMinorCorrections === true) {
      return res.status(403).json({ error: 'Automatic timetable publishing is locked off. Every timetable change requires Super Admin review.' });
    }
  }

  const merged = { ...rule.parameters, ...parameters };
  const numeric = (key: string) => Number(merged[key as keyof typeof merged]);
  if (rule.ruleCode === 'GPS_FRESHNESS_MONITOR') {
    const live = numeric('gpsFreshnessLiveSeconds');
    const stale = numeric('gpsFreshnessStaleSeconds');
    if (!Number.isFinite(live) || live < 30 || live > 300 || !Number.isFinite(stale) || stale < live || stale > 1800) {
      return res.status(422).json({ error: 'GPS freshness must be 30–300 seconds and stale time must be at least the live threshold and no more than 1800 seconds.' });
    }
  } else if (rule.ruleCode === 'SESSION_SAFETY_EXPIRY') {
    const hours = numeric('maxJourneySessionHours');
    if (!Number.isFinite(hours) || hours < 1 || hours > 12) {
      return res.status(422).json({ error: 'Journey session duration must be between 1 and 12 hours.' });
    }
  } else if (rule.ruleCode === 'DUPLICATE_STOP_SCANNER') {
    const distance = numeric('duplicateMaxDistanceMeters');
    const threshold = numeric('duplicateSimilarityThreshold');
    if (!Number.isFinite(distance) || distance < 25 || distance > 400 || !Number.isFinite(threshold) || threshold < 0.5 || threshold > 0.99) {
      return res.status(422).json({ error: 'Duplicate scanning distance must be 25–400 metres and similarity threshold must be 0.50–0.99.' });
    }
  }

  const success = repository.updateAutomationRule(rule.id, isEnabled, parameters);
  if (!success) return res.status(404).json({ error: 'Automation rule could not be updated.' });
  const adminId = (req as any).admin.id;
  repository.createAuditLog({
    id: `audit-${Date.now()}`, entityType: 'AUTOMATION_RULE', entityId: rule.id,
    action: 'UPDATE', actorId: adminId, actorRole: 'SUPER_ADMIN',
    reason: `Automation rule ${isEnabled ? 'enabled' : 'disabled'} with validated runtime parameters`, timestamp: new Date().toISOString(),
  });
  return res.json({ success: true, message: 'Automation rule updated' });
});

// POST /api/admin/gtfs/preview — parse and validate a GTFS ZIP without changing live data.
adminRouter.post('/gtfs/preview', requireAdminAuth('SUPER_ADMIN'), (req: Request, res: Response) => {
  const zipBase64 = typeof req.body?.zipBase64 === 'string' ? req.body.zipBase64 : '';
  if (!zipBase64) return res.status(400).json({ error: 'zipBase64 is required.' });
  try {
    const result = importGtfsZip(zipBase64);
    const routeConflicts = result.routes.filter(route => repository.getRouteById(route.id)).map(route => route.id);
    const operatorConflicts = result.operators.filter(operator => repository.getOperatorByName(operator.name)).map(operator => operator.name);
    return res.status(result.errors.length ? 422 : 200).json({
      valid: result.errors.length === 0 && routeConflicts.length === 0 && operatorConflicts.length === 0,
      stats: result.stats,
      errors: result.errors,
      warnings: result.warnings,
      routeConflicts,
      operatorConflicts,
      reviewPolicy: 'Preview only. Imported routes remain UNVERIFIED and SCHEDULE_UNVERIFIED. No bus identity is inferred from GTFS trip IDs.',
    });
  } catch (error) {
    return res.status(400).json({ error: error instanceof Error ? error.message : 'Invalid GTFS ZIP archive.' });
  }
});

// POST /api/admin/gtfs/import — explicit Super Admin apply after a successful preview.
adminRouter.post('/gtfs/import', requireAdminAuth('SUPER_ADMIN'), (req: Request, res: Response) => {
  if (req.body?.confirmImport !== true) {
    return res.status(400).json({ error: 'Set confirmImport=true only after reviewing the GTFS preview.' });
  }
  const zipBase64 = typeof req.body?.zipBase64 === 'string' ? req.body.zipBase64 : '';
  if (!zipBase64) return res.status(400).json({ error: 'zipBase64 is required.' });
  try {
    const result = importGtfsZip(zipBase64);
    if (result.errors.length) return res.status(422).json({ error: 'GTFS validation failed; no data was imported.', errors: result.errors, warnings: result.warnings });
    const routeConflicts = result.routes.filter(route => repository.getRouteById(route.id)).map(route => route.id);
    const operatorConflicts = result.operators.filter(operator => repository.getOperatorByName(operator.name)).map(operator => operator.name);
    if (routeConflicts.length || operatorConflicts.length) {
      return res.status(409).json({ error: 'Import conflicts with existing route or operator records; no data was imported.', routeConflicts, operatorConflicts });
    }

    result.operators.forEach(operator => repository.addOperator(operator));
    result.routes.forEach(route => repository.addRoute(route));
    const adminId = (req as any).admin.id;
    repository.createAuditLog({
      id: `audit-${Date.now()}`, entityType: 'GTFS_IMPORT', entityId: result.routes.map(route => route.id).join(',').slice(0, 180),
      action: 'CREATE', actorId: adminId, actorRole: 'SUPER_ADMIN',
      reason: `Imported ${result.routes.length} unverified GTFS routes and ${result.stats.trips} trips; timetable verification remains pending.`,
      timestamp: new Date().toISOString(),
    });
    return res.status(201).json({
      success: true, stats: result.stats, warnings: result.warnings,
      importedRouteIds: result.routes.map(route => route.id),
      verificationStatus: 'UNVERIFIED',
      message: 'GTFS data imported as unverified timetable proposals. Verify official source, stop patterns and operating dates before marking any service as verified.',
    });
  } catch (error) {
    return res.status(400).json({ error: error instanceof Error ? error.message : 'Invalid GTFS ZIP archive.' });
  }
});

// GET /api/admin/audit-logs
adminRouter.get('/audit-logs', requireAdminAuth('SUPER_ADMIN'), (req: Request, res: Response) => {
  const requestedLimit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
  const limit = Number.isFinite(requestedLimit) ? Math.min(200, Math.max(1, requestedLimit)) : 50;
  const logs = repository.getAuditLogs(limit);
  return res.json({ count: logs.length, logs });
});

// GET /api/admin/health — private; never expose internal admin health publicly.
adminRouter.get('/health', requireAdminAuth('SUPER_ADMIN'), (_req: Request, res: Response) => {
  return res.json(repository.getSystemHealthStats());
});
