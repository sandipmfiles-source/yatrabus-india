import { Router, Request, Response } from 'express';
import { repository } from '../db/repository.js';
import { publicSearchLimiter } from '../middleware/rateLimiter.js';

export const placesRouter = Router();

const geocodeCache = new Map<string, { expiresAt: number; results: any[] }>();
let lastGeocodeRequestAt = 0;

// Free OpenStreetMap Nominatim suggestions. Queries are cached and throttled to respect
// the public service usage policy; selected coordinates are sent with route submissions.
placesRouter.get('/geocode-search', publicSearchLimiter, async (req: Request, res: Response) => {
  const query = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  if (query.length < 3 || query.length > 120) return res.json({ query, results: [] });
  const key = query.toLocaleLowerCase();
  const cached = geocodeCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return res.json({ query, results: cached.results, cache: 'HIT' });
  const waitMs = 1100 - (Date.now() - lastGeocodeRequestAt);
  if (waitMs > 0) await new Promise(resolve => setTimeout(resolve, waitMs));
  lastGeocodeRequestAt = Date.now();
  try {
    const url = 'https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&countrycodes=in&limit=6&q=' + encodeURIComponent(query);
    const response = await fetch(url, {
      headers: { 'User-Agent': 'YatraBusIndia/1.0 (+https://github.com/sandipmfiles-source/yatrabus-india)', 'Accept-Language': 'en,hi,bn' },
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) return res.status(502).json({ error: 'PLACE_SEARCH_UNAVAILABLE', message: 'OpenStreetMap place search is temporarily unavailable. Use GPS or try again.' });
    const data = await response.json() as any[];
    const results = (Array.isArray(data) ? data : []).map(item => ({
      id: String(item.place_id),
      name: String(item.name || item.display_name?.split(',')[0] || query),
      address: String(item.display_name || ''),
      latitude: Number(item.lat),
      longitude: Number(item.lon),
      source: 'OPENSTREETMAP_NOMINATIM',
    })).filter(item => Number.isFinite(item.latitude) && Number.isFinite(item.longitude));
    if (geocodeCache.size > 500) geocodeCache.delete(geocodeCache.keys().next().value as string);
    geocodeCache.set(key, { expiresAt: Date.now() + 24 * 60 * 60 * 1000, results });
    return res.json({ query, results, source: 'OPENSTREETMAP_NOMINATIM', attribution: '© OpenStreetMap contributors' });
  } catch {
    return res.status(502).json({ error: 'PLACE_SEARCH_UNAVAILABLE', message: 'OpenStreetMap place search is temporarily unavailable. Use GPS or try again.' });
  }
});

// Resolve a GPS point to a readable place/road name using free OpenStreetMap data.
placesRouter.get('/reverse-geocode', publicSearchLimiter, async (req: Request, res: Response) => {
  const latitude = Number(req.query.lat);
  const longitude = Number(req.query.lon);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < 6 || latitude > 38 || longitude < 68 || longitude > 98) {
    return res.status(400).json({ error: 'INVALID_COORDINATES', message: 'Valid India GPS coordinates are required.' });
  }
  const key = latitude.toFixed(4) + ',' + longitude.toFixed(4);
  const cached = geocodeCache.get('reverse:' + key);
  if (cached && cached.expiresAt > Date.now() && cached.results[0]) return res.json({ place: cached.results[0], cache: 'HIT' });
  const waitMs = 1100 - (Date.now() - lastGeocodeRequestAt);
  if (waitMs > 0) await new Promise(resolve => setTimeout(resolve, waitMs));
  lastGeocodeRequestAt = Date.now();
  try {
    const url = 'https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=18&addressdetails=1&lat=' + latitude + '&lon=' + longitude;
    const response = await fetch(url, { headers: { 'User-Agent': 'YatraBusIndia/1.0 (+https://github.com/sandipmfiles-source/yatrabus-india)', 'Accept-Language': 'en,hi,bn' }, signal: AbortSignal.timeout(10000) });
    if (!response.ok) return res.status(502).json({ error: 'REVERSE_GEOCODE_UNAVAILABLE', message: 'GPS coordinates saved, but the place name could not be fetched.' });
    const data = await response.json() as any;
    const address = data.address || {};
    const name = data.name || address.bus_stop || address.road || address.suburb || address.village || address.town || address.city || address.county || '';
    const place = name ? { name: String(name), address: String(data.display_name || ''), latitude, longitude, source: 'OPENSTREETMAP_NOMINATIM' } : null;
    geocodeCache.set('reverse:' + key, { expiresAt: Date.now() + 24 * 60 * 60 * 1000, results: place ? [place] : [] });
    return res.json({ place, attribution: '© OpenStreetMap contributors' });
  } catch {
    return res.status(502).json({ error: 'REVERSE_GEOCODE_UNAVAILABLE', message: 'GPS coordinates saved, but the place name could not be fetched.' });
  }
});

// Free local catalogue search. External paid geocoding is deliberately not required.
placesRouter.get('/search', publicSearchLimiter, (req: Request, res: Response) => {
  const query = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  const requestedLimit = req.query.limit ? Number.parseInt(String(req.query.limit), 10) : 8;
  const limit = Number.isFinite(requestedLimit) ? Math.max(1, Math.min(12, requestedLimit)) : 8;
  if (query.length < 2) return res.json({ query, count: 0, results: [], sources: { local: 0 } });
  const results = repository.searchPlaces(query, limit);
  return res.json({ query, count: results.length, results, sources: { local: results.length } });
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



function resolveRoutePoint(value: unknown): { name: string; latitude: number; longitude: number } | null {
  if (typeof value !== 'string') return null;
  const parts = value.split('|').map(part => part.trim());
  const name = parts[0] || '';
  if (name.length < 2 || name.length > 180) return null;
  if (parts.length >= 3 && parts[1] && parts[2]) {
    const latitude = Number(parts[1]);
    const longitude = Number(parts[2]);
    if (Number.isFinite(latitude) && Number.isFinite(longitude) && latitude >= 6 && latitude <= 38 && longitude >= 68 && longitude <= 98) {
      return { name, latitude, longitude };
    }
    return null;
  }
  const matches = repository.searchPlaces(name, 8)
    .filter(item => item.matchScore >= 95 && Number.isFinite(item.place.latitude) && Number.isFinite(item.place.longitude));
  if (matches.length !== 1) return null;
  const place = matches[0].place;
  return { name: place.canonicalName, latitude: place.latitude!, longitude: place.longitude! };
}

const osrmRouteCache = new Map<string, { expiresAt: number; payload: Record<string, unknown> }>();
let lastOsrmRequestAt = 0;

placesRouter.post('/route-preview', publicSearchLimiter, async (req: Request, res: Response) => {
  const originRaw = typeof req.body?.origin === 'string' ? req.body.origin.trim() : '';
  const destinationRaw = typeof req.body?.destination === 'string' ? req.body.destination.trim() : '';
  const stopsRaw = (Array.isArray(req.body?.stops) ? req.body.stops : [])
    .filter((value: unknown): value is string => typeof value === 'string')
    .map((value: string) => value.trim()).filter(Boolean);
  if (stopsRaw.length > 98) return res.status(400).json({ error: 'TOO_MANY_STOPS', message: 'This free road-routing service supports up to 98 intermediate stops per route check. Your stop list can still be saved for admin review.' });
  const points = [originRaw, ...stopsRaw, destinationRaw].map(resolveRoutePoint);
  const missingIndex = points.findIndex(point => point === null);
  if (missingIndex >= 0) {
    const field = missingIndex === 0 ? 'starting place' : missingIndex === points.length - 1 ? 'destination' : 'intermediate stop';
    return res.status(422).json({
      error: 'PLACE_COORDINATES_REQUIRED',
      message: 'Could not find exact coordinates for the ' + field + '. Use a saved YatraBus place or enter it as Name | latitude | longitude.',
    });
  }
  const resolved = points as { name: string; latitude: number; longitude: number }[];
  const names = resolved.map(point => point.name.toLocaleLowerCase());
  if (new Set(names).size !== names.length) return res.status(400).json({ error: 'DUPLICATE_STOPS', message: 'A place appears more than once. Check the stop sequence.' });
  const coordinates = resolved.map(point => point.longitude + ',' + point.latitude).join(';');
  const cached = osrmRouteCache.get(coordinates);
  if (cached && cached.expiresAt > Date.now()) return res.json({ ...cached.payload, cache: 'HIT' });
  if (Date.now() - lastOsrmRequestAt < 1100) return res.status(429).json({ error: 'ROUTE_RATE_LIMIT', message: 'Please wait a moment before checking another route.' });
  lastOsrmRequestAt = Date.now();
  try {
    const url = 'https://router.project-osrm.org/route/v1/driving/' + coordinates + '?overview=full&geometries=polyline&steps=false&alternatives=false';
    const response = await fetch(url, {
      headers: { 'User-Agent': 'YatraBusIndia/1.0 (+https://github.com/sandipmfiles-source/yatrabus-india)' },
      signal: AbortSignal.timeout(12000),
    });
    const data = await response.json() as any;
    const route = data.routes?.[0];
    if (!response.ok || data.code !== 'Ok' || !route) {
      return res.status(502).json({ error: 'OSRM_ROUTE_FAILED', message: 'OpenStreetMap routing could not connect every stop in the submitted order. Check the coordinates and stop sequence.' });
    }
    const payload = {
      provider: 'OPENSTREETMAP_OSRM',
      routeStatus: 'ROAD_ROUTE_FOUND_IN_SUBMITTED_ORDER',
      distanceKm: Math.round(route.distance / 100) / 10,
      durationSeconds: Math.round(route.duration),
      encodedPolyline: route.geometry || null,
      submittedStops: resolved.slice(1, -1).map(point => point.name),
      points: resolved.map(point => ({ name: point.name, latitude: point.latitude, longitude: point.longitude })),
      orderChanged: false,
      disclaimer: 'OpenStreetMap road-network estimate via OSRM. It confirms a drivable road path in the submitted order, not that a public bus operates on it. Timetable and route publication still require Super Admin review.',
      attribution: '© OpenStreetMap contributors · Routing by OSRM',
    };
    if (osrmRouteCache.size > 200) {
      const firstKey = osrmRouteCache.keys().next().value;
      if (firstKey) osrmRouteCache.delete(firstKey);
    }
    osrmRouteCache.set(coordinates, { expiresAt: Date.now() + 10 * 60 * 1000, payload });
    return res.json({ ...payload, cache: 'MISS' });
  } catch {
    return res.status(502).json({ error: 'OSRM_UNAVAILABLE', message: 'The free OpenStreetMap routing demo is temporarily unavailable. You can still enter the route details manually.' });
  }
});
