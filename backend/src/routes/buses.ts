import { Router, Request, Response } from 'express';
import { repository } from '../db/repository.js';
import { calculateStopETAs } from '../../../packages/shared/src/engine/etaCalculator.js';
import { evaluateObservationFreshness } from '../../../packages/shared/src/engine/staleDetector.js';

export const busesRouter = Router();

// GET /api/buses/:id
busesRouter.get('/:id', (req: Request, res: Response) => {
  const bus = repository.getBusById(String(req.params.id));
  if (!bus) {
    return res.status(404).json({ error: 'Bus not found' });
  }

  // Get bus location aggregate
  let loc = repository.getBusLocation(bus.id);

  // Evaluate freshness if location exists
  if (loc && loc.lastObservedAt) {
    const freshness = evaluateObservationFreshness(loc.lastObservedAt);
    if (loc.displayState === 'LIVE' && freshness.displayState !== 'LIVE') {
      loc.displayState = freshness.displayState;
      loc.isLive = false;
      loc.statusExplanation = freshness.label;
      repository.updateBusLocation(bus.id, loc);
    }
  }

  // Find associated route
  const routes = repository.getAllRoutes();
  const requestedRouteId = typeof req.query.routeId === 'string' ? req.query.routeId : '';
  const requestedRoute = requestedRouteId ? repository.getRouteById(requestedRouteId) : undefined;
  const route = requestedRoute?.operatorId === bus.operatorId
    ? requestedRoute
    : routes.find(r => r.id === bus.routeId) || routes.find(r => r.operatorId === bus.operatorId) || routes[0];
  if (!route) return res.status(404).json({ error: 'Route not found for this bus' });

  // Calculate stop ETAs
  const progressRatio = 0.35; // Default progress along corridor
  const etas = calculateStopETAs(
    route.stops,
    progressRatio,
    loc && loc.latitude && loc.longitude
      ? {
          latitude: loc.latitude,
          longitude: loc.longitude,
          speedKmh: loc.speedKmh,
          isLive: loc.isLive,
        }
      : undefined
  );

  return res.json({
    bus,
    location: loc || {
      displayState: 'UNAVAILABLE',
      isLive: false,
      confidenceScore: 0,
      confidenceCategory: 'LOW',
      statusExplanation: 'No passenger GPS observation available currently',
    },
    route,
    stopETAs: etas,
  });
});
