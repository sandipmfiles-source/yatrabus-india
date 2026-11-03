import { Router, Request, Response } from 'express';
import { repository } from '../db/repository.js';
import { planJourneys } from '../../../packages/shared/src/engine/journeyPlanner.js';
import { publicSearchLimiter } from '../middleware/rateLimiter.js';
import { CONFIG } from '../config.js';
import { verifyStopQrToken } from '../engine/stopQr.js';

export const routesRouter = Router();

// GET /api/routes/search?from=Anand+Vihar&to=Mehrauli
routesRouter.get('/search', publicSearchLimiter, (req: Request, res: Response) => {
  const from = (req.query.from as string) || '';
  const to = (req.query.to as string) || '';

  if (!from || !to) {
    return res.status(400).json({
      error: 'Missing required query parameters: from and to must be specified',
    });
  }

  const allRoutes = repository.getAllRoutes();
  // Expand aliases and fuzzy place-name matches from the local India place catalogue.
  const originNames = [from, ...repository.searchPlaces(from, 6).map(item => item.place.canonicalName)];
  const destinationNames = [to, ...repository.searchPlaces(to, 6).map(item => item.place.canonicalName)];
  const directById = new Map<string, any>();
  const transfersById = new Map<string, any>();
  for (const originName of Array.from(new Set(originNames))) {
    for (const destinationName of Array.from(new Set(destinationNames))) {
      const result = planJourneys(originName, destinationName, allRoutes, {
        currentTimeIso: new Date().toISOString(),
        maximumTransfers: 2,
        minimumTransferMinutes: 8,
        maximumTransferWaitMinutes: 90,
        maximumResults: 8,
      });
      result.directRoutes.forEach(item => directById.set(item.id, item));
      result.transferRoutes.forEach(item => transfersById.set(item.id, item));
    }
  }
  const searchResults = { directRoutes: Array.from(directById.values()), transferRoutes: Array.from(transfersById.values()) };

  return res.json({
    from,
    to,
    directCount: searchResults.directRoutes.length,
    transferCount: searchResults.transferRoutes.length,
    directRoutes: searchResults.directRoutes,
    transferRoutes: searchResults.transferRoutes,
  });
});

// GET /api/routes
routesRouter.get('/', (req: Request, res: Response) => {
  const all = repository.getAllRoutes();
  return res.json({ count: all.length, routes: all });
});

// GET /api/routes/qr/verify?token=YB1... — verify an admin-issued stop QR.
routesRouter.get('/qr/verify', (req: Request, res: Response) => {
  const token = typeof req.query.token === 'string' ? req.query.token : '';
  if (!token || token.length > 2048 || !CONFIG.ADMIN_JWT_SECRET || CONFIG.ADMIN_JWT_SECRET.length < 32) {
    return res.status(400).json({ verified: false, error: 'A valid YatraBus stop QR token is required.' });
  }
  const payload = verifyStopQrToken(token, CONFIG.ADMIN_JWT_SECRET);
  if (!payload) return res.status(403).json({ verified: false, error: 'This stop QR is invalid or expired.' });
  const route = repository.getRouteById(payload.routeId);
  if (!route || route.verificationStatus !== 'ADMIN_VERIFIED') {
    return res.status(404).json({ verified: false, error: 'The verified route record is no longer available.' });
  }
  const stop = route.stops.find(item => item.id === payload.stopId);
  const place = stop ? repository.getPlaceById(stop.stopId) : undefined;
  if (!stop || !place || place.verificationStatus !== 'ADMIN_VERIFIED' ||
      !Number.isFinite(place.latitude) || !Number.isFinite(place.longitude) ||
      place.latitude! < 6 || place.latitude! > 38 || place.longitude! < 68 || place.longitude! > 98) {
    return res.status(404).json({ verified: false, error: 'The Super Admin-verified place record is no longer available.' });
  }
  return res.json({
    verified: true,
    format: 'YB1',
    routeId: route.id,
    routeName: route.routeName,
    stopId: stop.id,
    stopName: stop.stopName,
    latitude: place.latitude,
    longitude: place.longitude,
    issuedAt: new Date(payload.issuedAt).toISOString(),
    expiresAt: new Date(payload.expiresAt).toISOString(),
    verificationStatus: 'ADMIN_VERIFIED',
  });
});

// GET /api/routes/:id
routesRouter.get('/:id', (req: Request, res: Response) => {
  const route = repository.getRouteById(String(req.params.id));
  if (!route) {
    return res.status(404).json({ error: 'Route not found' });
  }

  const buses = repository.getBusesForRoute(route.id);

  return res.json({
    route,
    stopsCount: route.stops.length,
    buses,
  });
});
