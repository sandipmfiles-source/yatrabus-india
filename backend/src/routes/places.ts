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
