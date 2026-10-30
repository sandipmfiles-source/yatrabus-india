import { Router, Request, Response } from 'express';
import { repository } from '../db/repository.js';
import { publicSearchLimiter } from '../middleware/rateLimiter.js';
import { searchGooglePlaces } from '../services/googlePlaces.js';

export const placesRouter = Router();

// Local YatraBus data is authoritative and appears first. Google Places is queried
// only when the local catalogue cannot fill the requested suggestion list.
placesRouter.get('/search', publicSearchLimiter, async (req: Request, res: Response) => {
  const query = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  const requestedLimit = req.query.limit ? Number.parseInt(String(req.query.limit), 10) : 8;
  const limit = Number.isFinite(requestedLimit) ? Math.max(1, Math.min(12, requestedLimit)) : 8;

  if (query.length < 2) return res.json({ query, count: 0, results: [] });

  const localResults = repository.searchPlaces(query, limit);
  let externalResults = [] as Awaited<ReturnType<typeof searchGooglePlaces>>;
  if (localResults.length < limit) {
    try {
      externalResults = await searchGooglePlaces(query, limit - localResults.length);
    } catch (error) {
      // Google Places is an optional fallback; local search must remain available.
      console.warn('Google Places autocomplete unavailable:', error instanceof Error ? error.message : 'unknown error');
    }
  }

  const seen = new Set(localResults.map(item => item.place.canonicalName.trim().toLowerCase()));
  const merged = [...localResults, ...externalResults.filter(item => {
    const key = item.place.canonicalName.trim().toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  })].slice(0, limit);

  return res.json({
    query,
    count: merged.length,
    results: merged,
    sources: { local: localResults.length, googlePlaces: merged.length - localResults.length },
  });
});

// GET /api/places/nearby?lat=28.6675&lon=77.2285&radius=3000
placesRouter.get('/nearby', (req: Request, res: Response) => {
  const latStr = req.query.lat as string;
  const lonStr = req.query.lon as string;
  const radius = req.query.radius ? parseInt(req.query.radius as string, 10) : 3000;

  if (!latStr || !lonStr) {
    return res.status(400).json({ error: 'Missing coordinates: lat and lon required' });
  }

  const lat = parseFloat(latStr);
  const lon = parseFloat(lonStr);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || !Number.isFinite(radius) || radius < 1 || radius > 50000) {
    return res.status(400).json({ error: 'Invalid coordinates or radius' });
  }

  const stops = repository.findNearbyStops(lat, lon, radius);
  return res.json({ count: stops.length, stops });
});

// GET /api/places/:id
placesRouter.get('/:id', (req: Request, res: Response) => {
  const place = repository.getPlaceById(String(req.params.id));
  if (!place) return res.status(404).json({ error: 'Place not found' });
  return res.json({ place });
});


placesRouter.post('/route-preview', publicSearchLimiter, async (req: Request, res: Response) => {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) return res.status(503).json({ error: 'MAPS_NOT_CONFIGURED', message: 'Google Maps Routes API is not configured on the YatraBus backend.' });
  const origin = typeof req.body?.origin === 'string' ? req.body.origin.trim() : '';
  const destination = typeof req.body?.destination === 'string' ? req.body.destination.trim() : '';
  const stops = (Array.isArray(req.body?.stops) ? req.body.stops : []).filter((v: unknown): v is string => typeof v === 'string').map((v: string) => v.trim()).filter(Boolean);
  if (origin.length < 2 || destination.length < 2 || origin.length > 180 || destination.length > 180 || stops.length > 23 || stops.some((v: string) => v.length > 180)) return res.status(400).json({ error: 'INVALID_ROUTE', message: 'Enter a valid origin, destination and up to 23 stops.' });
  if (new Set([origin, ...stops, destination].map((v: string) => v.toLowerCase())).size !== stops.length + 2) return res.status(400).json({ error: 'DUPLICATE_STOPS', message: 'A place appears more than once. Check the stop sequence.' });
  try {
    const response = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': 'routes.distanceMeters,routes.duration,routes.polyline.encodedPolyline,routes.optimizedIntermediateWaypointIndex,routes.legs.distanceMeters,routes.legs.duration' }, body: JSON.stringify({ origin: { address: origin + ', India' }, destination: { address: destination + ', India' }, intermediates: stops.map((v: string) => ({ address: v + ', India' })), travelMode: 'DRIVE', routingPreference: 'TRAFFIC_AWARE', optimizeWaypointOrder: stops.length > 1, languageCode: 'en', regionCode: 'IN' }), signal: AbortSignal.timeout(9000) });
    const data = await response.json() as any;
    const route = data.routes?.[0];
    if (!response.ok || !route) return res.status(502).json({ error: 'MAPS_ROUTE_FAILED', message: data.error?.message || 'Google Maps could not calculate this road route.' });
    const indexes: number[] = route.optimizedIntermediateWaypointIndex || stops.map((_: string, i: number) => i);
    const suggestedStops = indexes.map((i: number) => stops[i]).filter(Boolean);
    return res.json({ provider: 'GOOGLE_MAPS_ROUTES', routeStatus: suggestedStops.some((v: string, i: number) => v !== stops[i]) ? 'ORDER_SUGGESTION' : 'ROAD_ROUTE_FOUND', distanceKm: typeof route.distanceMeters === 'number' ? Math.round(route.distanceMeters / 100) / 10 : null, durationSeconds: route.duration ? Number.parseInt(route.duration, 10) : null, encodedPolyline: route.polyline?.encodedPolyline || null, submittedStops: stops, suggestedStops, orderChanged: suggestedStops.some((v: string, i: number) => v !== stops[i]), disclaimer: 'Google driving-route estimate; it does not independently prove that a public bus operates on this road.' });
  } catch (error) { return res.status(502).json({ error: 'MAPS_UNAVAILABLE', message: error instanceof Error ? error.message : 'Google Maps route service is temporarily unavailable.' }); }
});
