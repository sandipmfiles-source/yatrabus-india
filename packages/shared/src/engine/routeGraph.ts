import { Route, RouteStop, JourneyCandidate } from '../types/bus.js';
import { normalizePlaceName } from '../search/normalizer.js';

export interface RouteSearchResult {
  directRoutes: JourneyCandidate[];
  transferRoutes: JourneyCandidate[];
  totalOptionsCount: number;
}

/**
 * Searches transit network for direct and 1-transfer bus journeys between origin and destination stops.
 */
export function discoverJourneys(
  originStopQuery: string,
  destinationStopQuery: string,
  allRoutes: Route[],
  currentTimeIso: string = new Date().toISOString()
): RouteSearchResult {
  const normOrigin = normalizePlaceName(originStopQuery);
  const normDest = normalizePlaceName(destinationStopQuery);

  const directCandidates: JourneyCandidate[] = [];
  const transferCandidates: JourneyCandidate[] = [];

  // Helper: check if stop name matches query tokens
  const stopMatches = (stopName: string, normQuery: string): boolean => {
    const norm = normalizePlaceName(stopName);
    return norm === normQuery || norm.includes(normQuery) || normQuery.includes(norm);
  };

  // 1. Direct Routes Search
  for (const route of allRoutes) {
    let originIndex = -1;
    let destIndex = -1;

    for (let i = 0; i < route.stops.length; i++) {
      const stop = route.stops[i];
      if (originIndex === -1 && stopMatches(stop.stopName, normOrigin)) {
        originIndex = i;
      }
      if (originIndex !== -1 && i > originIndex && stopMatches(stop.stopName, normDest)) {
        destIndex = i;
        break;
      }
    }

    if (originIndex !== -1 && destIndex !== -1 && destIndex > originIndex) {
      const boardingStop = route.stops[originIndex];
      const alightingStop = route.stops[destIndex];

      const stopsCount = destIndex - originIndex;
      const durationMins = Math.round(
        (stopsCount / Math.max(1, route.stops.length - 1)) * route.typicalDurationMinutes
      );

      const depTime = boardingStop.scheduledArrivalTime || route.firstDepartureTime;
      const arrTime = alightingStop.scheduledArrivalTime || route.lastDepartureTime;

      directCandidates.push({
        id: `journey-direct-${route.id}-${originIndex}-${destIndex}`,
        route,
        departureTime: depTime,
        arrivalTime: arrTime,
        durationMinutes: durationMins,
        boardingStop,
        alightingStop,
        isDirect: true,
        transfers: [],
        confidenceScore: 85,
        serviceStatus: route.serviceStatus,
        locationStatus: 'ESTIMATED',
      });
    }
  }

  // 2. Transfer Routes Search (1 transfer via common interchange stop)
  // If direct routes are few (<= 2), compute feasible transfers
  if (directCandidates.length <= 2) {
    for (const routeA of allRoutes) {
      // Find origin on Route A
      const originIdxA = routeA.stops.findIndex(s => stopMatches(s.stopName, normOrigin));
      if (originIdxA === -1) continue;

      for (let i = originIdxA + 1; i < routeA.stops.length; i++) {
        const potentialInterchange = routeA.stops[i];
        const normInterchange = normalizePlaceName(potentialInterchange.stopName);

        // Find route B passing through this interchange and reaching destination
        for (const routeB of allRoutes) {
          if (routeA.id === routeB.id) continue;

          const interchangeIdxB = routeB.stops.findIndex(s =>
            stopMatches(s.stops ? s.stopName : '', normInterchange)
          );
          if (interchangeIdxB === -1) continue;

          const destIdxB = routeB.stops.findIndex(
            (s, idx) => idx > interchangeIdxB && stopMatches(s.stopName, normDest)
          );
          if (destIdxB === -1) continue;

          // Feasible 1-transfer connection found!
          const boardingStop = routeA.stops[originIdxA];
          const transferStop = potentialInterchange;
          const alightingStop = routeB.stops[destIdxB];

          const leg1Mins = Math.round(
            ((i - originIdxA) / Math.max(1, routeA.stops.length - 1)) * routeA.typicalDurationMinutes
          );
          const leg2Mins = Math.round(
            ((destIdxB - interchangeIdxB) / Math.max(1, routeB.stops.length - 1)) *
              routeB.typicalDurationMinutes
          );
          const waitMins = 12; // Typical urban transit interchange wait time
          const totalDuration = leg1Mins + waitMins + leg2Mins;

          transferCandidates.push({
            id: `journey-transfer-${routeA.id}-${routeB.id}`,
            route: routeA,
            departureTime: boardingStop.scheduledArrivalTime || routeA.firstDepartureTime,
            arrivalTime: alightingStop.scheduledArrivalTime || routeB.lastDepartureTime,
            durationMinutes: totalDuration,
            boardingStop,
            alightingStop,
            isDirect: false,
            transfers: [
              {
                firstRoute: routeA,
                transferStop,
                secondRoute: routeB,
                expectedWaitMinutes: waitMins,
              },
            ],
            confidenceScore: 70,
            serviceStatus: 'OPERATING_SCHEDULED',
            locationStatus: 'ESTIMATED',
          });

          if (transferCandidates.length >= 4) break;
        }
        if (transferCandidates.length >= 4) break;
      }
    }
  }

  return {
    directRoutes: directCandidates,
    transferRoutes: transferCandidates,
    totalOptionsCount: directCandidates.length + transferCandidates.length,
  };
}
