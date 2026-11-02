import { Router, Request, Response } from 'express';
import { repository } from '../db/repository.js';
import { calculateStopETAs } from '../../../packages/shared/src/engine/etaCalculator.js';
import { evaluateObservationFreshness } from '../../../packages/shared/src/engine/staleDetector.js';
import { matchPointToRoute } from '../../../packages/shared/src/engine/routeMatcher.js';

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
  if (requestedRouteId && (!requestedRoute || bus.routeId !== requestedRouteId)) {
    return res.status(404).json({ error: 'This bus is not linked to the requested route.' });
  }
  const route = requestedRoute || routes.find(r => r.id === bus.routeId);
  if (!route) return res.status(404).json({ error: 'Route not found for this bus' });

  // Derive progress from the actual route geometry; never use a hard-coded 35% position.
  const hasCoordinates = loc && Number.isFinite(loc.latitude) && Number.isFinite(loc.longitude);
  const routeMatch = hasCoordinates && loc.isLive
    ? matchPointToRoute(loc.latitude!, loc.longitude!, route, Math.max(250, (loc.accuracyMeters || 50) * 2))
    : undefined;
  const progressRatio = routeMatch?.isMatched ? routeMatch.estimatedProgressRatio : 0;
  const etas = calculateStopETAs(
    route.stops,
    progressRatio,
    hasCoordinates
      ? {
          latitude: loc!.latitude!,
          longitude: loc!.longitude!,
          speedKmh: loc!.speedKmh,
          accuracyMeters: loc!.accuracyMeters,
          observedAtIso: loc!.lastObservedAt,
          isLive: loc!.isLive,
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
