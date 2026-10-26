import { Router, Request, Response } from 'express';
import { repository } from '../db/repository.js';
import { discoverJourneys } from '../../../packages/shared/src/engine/routeGraph.js';
import { publicSearchLimiter } from '../middleware/rateLimiter.js';

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
  const searchResults = discoverJourneys(from, to, allRoutes);

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
