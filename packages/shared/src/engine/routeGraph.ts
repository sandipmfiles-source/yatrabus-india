import { Route, JourneyCandidate } from '../types/bus.js';
import { normalizePlaceName } from '../search/normalizer.js';

function addMinutesToTime(value: string, minutes: number): string {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return value;
  const total = (Number(match[1]) * 60 + Number(match[2]) + minutes + 1440) % 1440;
  return String(Math.floor(total / 60)).padStart(2, '0') + ':' + String(total % 60).padStart(2, '0');
}

export interface RouteSearchResult {
  directRoutes: JourneyCandidate[];
  transferRoutes: JourneyCandidate[];
  totalOptionsCount: number;
}

/**
 * Counts departures from a published first/last departure window.
 * This is an estimate when the operator publishes only a frequency, not a trip-by-trip timetable.
 */
export function estimateDailyTripCount(firstDeparture: string, lastDeparture: string, frequencyMinutes?: number): number | undefined {
  if (!frequencyMinutes || !Number.isFinite(frequencyMinutes) || frequencyMinutes <= 0) return undefined;
  const toMinutes = (value: string): number | undefined => {
    const match = /^(\d{2}):(\d{2})$/.exec(value);
    if (!match) return undefined;
    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    if (hours > 23 || minutes > 59) return undefined;
    return hours * 60 + minutes;
  };
  const first = toMinutes(firstDeparture);
  const last = toMinutes(lastDeparture);
  if (first === undefined || last === undefined || last < first) return undefined;
  return Math.floor((last - first) / frequencyMinutes) + 1;
}

/**
 * Searches transit network for direct and 1-transfer bus journeys between origin and destination stops.
 */
export function discoverJourneys(
  originStopQuery: string,
  destinationStopQuery: string,
  allRoutes: Route[],
  _currentTimeIso: string = new Date().toISOString()
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

      const timetableDepartures = (route.departures || []).filter(item => !item.isCancelled);
      const timetableDayCounts = (route.operatingDays || []).map(day =>
        timetableDepartures.filter(item => !item.operatingDays?.length || item.operatingDays.includes(day)).length
      );
      const exactTimetableCount = timetableDepartures.length
        ? (timetableDayCounts.length ? Math.max(...timetableDayCounts) : timetableDepartures.length)
        : 0;
      const exactDepartureTimes = (route.departureTimes || []).filter(time => /^([01]\d|2[0-3]):[0-5]\d$/.test(time));
      const exactTimeServices = exactDepartureTimes.map((departureTime, index) => ({
        id: `exact-${route.id}-${index}`,
        departureTime,
        busIdentifier: undefined,
        stopTimes: undefined,
      }));
      const services = timetableDepartures.length ? timetableDepartures : exactTimeServices.length ? exactTimeServices : [undefined];
      for (const service of services) {
        const boardingOffset = route.distanceKm > 0
          ? Math.round((boardingStop.distanceFromStartKm / route.distanceKm) * route.typicalDurationMinutes)
          : Math.round((originIndex / Math.max(1, route.stops.length - 1)) * route.typicalDurationMinutes);
        const arrivalOffset = route.distanceKm > 0
          ? Math.round((alightingStop.distanceFromStartKm / route.distanceKm) * route.typicalDurationMinutes)
          : Math.round((destIndex / Math.max(1, route.stops.length - 1)) * route.typicalDurationMinutes);
        const baseDeparture = service?.departureTime || route.firstDepartureTime;
        const boardingBusTime = service?.stopTimes?.find(item => item.stopId === boardingStop.stopId);
        const alightingBusTime = service?.stopTimes?.find(item => item.stopId === alightingStop.stopId);
        const depTime = boardingBusTime?.departureTime ||
          (service ? addMinutesToTime(baseDeparture, boardingOffset) : boardingStop.scheduledDepartureTime || boardingStop.scheduledArrivalTime || route.firstDepartureTime);
        const arrTime = alightingBusTime?.arrivalTime ||
          (service ? addMinutesToTime(baseDeparture, arrivalOffset) : alightingStop.scheduledArrivalTime || alightingStop.scheduledDepartureTime || route.lastDepartureTime);

        directCandidates.push({
          id: `journey-direct-${route.id}-${originIndex}-${destIndex}-${service?.id || 'frequency'}`,
          route,
          busIdentifier: service?.busIdentifier,
          departureTime: depTime,
          arrivalTime: arrTime,
          durationMinutes: durationMins,
          boardingStop,
          alightingStop,
          isDirect: true,
          transfers: [],
          confidenceScore: timetableDepartures.length ? 95 : exactDepartureTimes.length ? (route.serviceStatus === 'SCHEDULE_UNVERIFIED' ? 75 : 90) : 85,
          serviceStatus: route.serviceStatus,
          locationStatus: 'ESTIMATED',
          dailyTripCount: exactDepartureTimes.length || estimateDailyTripCount(route.firstDepartureTime, route.lastDepartureTime, route.frequencyMinutes) || exactTimetableCount || undefined,
          frequencyMinutes: route.frequencyMinutes,
          intermediateStops: route.stops.slice(originIndex + 1, destIndex),
          timetableDepartures,
        });
      }
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
            stopMatches(s.stopName, normInterchange)
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
