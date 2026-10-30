import { Router, Request, Response } from 'express';
import { repository } from '../db/persistentRepository.js';
import { publicSearchLimiter } from '../middleware/rateLimiter.js';

export const placesRouter = Router();

// GET /api/places/search?q=kashmere&limit=8
placesRouter.get('/search', publicSearchLimiter, (req: Request, res: Response) => {
  const query = (req.query.q as string) || '';
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 8;

  if (!query || query.trim().length === 0) {
    return res.json({ results: [] });
  }

  const results = repository.searchPlaces(query, limit);
  return res.json({ query, count: results.length, results });
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
  if (isNaN(lat) || isNaN(lon)) {
    return res.status(400).json({ error: 'Invalid coordinates' });
  }

  const stops = repository.findNearbyStops(lat, lon, radius);
  return res.json({ count: stops.length, stops });
});

// GET /api/places/:id
placesRouter.get('/:id', (req: Request, res: Response) => {
  const place = repository.getPlaceById(String(req.params.id));
  if (!place) {
    return res.status(404).json({ error: 'Place not found' });
  }
  return res.json({ place });
});
