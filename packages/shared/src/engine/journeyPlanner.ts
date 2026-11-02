import type { JourneyCandidate, JourneyLeg, Route, RouteStop } from '../types/bus.js';
import { normalizePlaceName } from '../search/normalizer.js';
import { haversineDistanceMeters } from './routeMatcher.js';
import { getUpcomingServiceDepartures, type ServiceDepartureInstance } from './timetableEngine.js';

export interface JourneyPlannerOptions {
  currentTimeIso?: string;
  minimumTransferMinutes?: number;
  maximumTransferWaitMinutes?: number;
  maximumTransfers?: number;
  maximumResults?: number;
}

interface RouteLegPath {
  route: Route;
  boardingStop: RouteStop;
  alightingStop: RouteStop;
}

function matchesQuery(stopName: string, query: string): boolean {
  const stop = normalizePlaceName(stopName), wanted = normalizePlaceName(query);
  return !!stop && !!wanted && (stop === wanted || stop.includes(wanted) || wanted.includes(stop));
}

function sameInterchange(a: RouteStop, b: RouteStop): boolean {
  if (a.stopId && b.stopId && a.stopId === b.stopId) return true;
  const aName = normalizePlaceName(a.stopName), bName = normalizePlaceName(b.stopName);
  if (aName && aName === bName) return true;
  if (![a.latitude, a.longitude, b.latitude, b.longitude].every(Number.isFinite)) return false;
  if ((a.latitude === 0 && a.longitude === 0) || (b.latitude === 0 && b.longitude === 0)) return false;
  return haversineDistanceMeters(a.latitude, a.longitude, b.latitude, b.longitude) <= 200;
}

function enumeratePaths(
  origin: string,
  destination: string,
  routes: Route[],
  maxTransfers: number,
  maxPaths: number,
): RouteLegPath[][] {
  type IndexedStop = { route: Route; index: number; stop: RouteStop };
  const byId = new Map<string, IndexedStop[]>();
  const byName = new Map<string, IndexedStop[]>();
  const byCell = new Map<string, IndexedStop[]>();
  const cellKey = (lat: number, lon: number) => `${Math.floor(lat * 500)}:${Math.floor(lon * 500)}`;
  const add = (map: Map<string, IndexedStop[]>, key: string, value: IndexedStop) => {
    if (!key) return;
    const list = map.get(key) || [];
    list.push(value); map.set(key, list);
  };
  for (const route of routes) {
    route.stops.forEach((stop, index) => {
      const item = { route, index, stop };
      add(byId, stop.stopId, item);
      add(byName, normalizePlaceName(stop.stopName), item);
      if (Number.isFinite(stop.latitude) && Number.isFinite(stop.longitude) &&
          !(stop.latitude === 0 && stop.longitude === 0)) {
        add(byCell, cellKey(stop.latitude, stop.longitude), item);
      }
    });
  }
  const interchangeTargets = (stop: RouteStop): IndexedStop[] => {
    const candidates = [
      ...(byId.get(stop.stopId) || []),
      ...(byName.get(normalizePlaceName(stop.stopName)) || []),
    ];
    if (Number.isFinite(stop.latitude) && Number.isFinite(stop.longitude) &&
        !(stop.latitude === 0 && stop.longitude === 0)) {
      const latCell = Math.floor(stop.latitude * 500), lonCell = Math.floor(stop.longitude * 500);
      for (let lat = latCell - 1; lat <= latCell + 1; lat++) {
        for (let lon = lonCell - 1; lon <= lonCell + 1; lon++) {
          candidates.push(...(byCell.get(`${lat}:${lon}`) || []));
        }
      }
    }
    const unique = new Map<string, IndexedStop>();
    for (const item of candidates) {
      const key = item.route.id + ':' + item.index;
      if (!unique.has(key) && sameInterchange(stop, item.stop)) unique.set(key, item);
    }
    return Array.from(unique.values());
  };

  const found: RouteLegPath[][] = [];
  const visit = (route: Route, boardIndex: number, visited: Set<string>, legs: RouteLegPath[]) => {
    if (found.length >= maxPaths) return;
    const boardingStop = route.stops[boardIndex];
    for (let index = boardIndex + 1; index < route.stops.length; index++) {
      const alightingStop = route.stops[index];
      const nextLeg = { route, boardingStop, alightingStop };
      if (matchesQuery(alightingStop.stopName, destination)) {
        found.push([...legs, nextLeg]);
        if (found.length >= maxPaths) return;
        continue;
      }
      if (legs.length >= maxTransfers) continue;
      for (const target of interchangeTargets(alightingStop)) {
        if (visited.has(target.route.id) || target.index >= target.route.stops.length - 1) continue;
        const nextVisited = new Set(visited);
        nextVisited.add(target.route.id);
        visit(target.route, target.index, nextVisited, [...legs, nextLeg]);
        if (found.length >= maxPaths) return;
      }
    }
  };

  for (const route of routes) {
    for (let index = 0; index < route.stops.length - 1; index++) {
      if (!matchesQuery(route.stops[index].stopName, origin)) continue;
      visit(route, index, new Set([route.id]), []);
      if (found.length >= maxPaths) return found;
    }
  }
  return found;
}

function localServiceDate(iso: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date(iso));
}

function materializeJourney(
  path: RouteLegPath[],
  firstService: ServiceDepartureInstance,
  services: ServiceDepartureInstance[],
): JourneyCandidate {
  const legs: JourneyLeg[] = services.map((service, index) => ({
    route: path[index].route,
    boardingStop: service.boardingStop,
    alightingStop: service.alightingStop,
    departureTime: service.departureTime,
    arrivalTime: service.arrivalTime,
    departureDayOffset: service.departureDayOffset,
    arrivalDayOffset: service.arrivalDayOffset,
    departureTimeIso: service.departureTimeIso,
    arrivalTimeIso: service.arrivalTimeIso,
    arrivalNextDay: localServiceDate(service.arrivalTimeIso) !== localServiceDate(service.departureTimeIso),
    busIdentifier: service.busIdentifier,
    serviceId: service.serviceId,
    durationMinutes: service.durationMinutes,
  }));
  const transfers = path.slice(0, -1).map((leg, index) => ({
    firstRoute: leg.route,
    transferStop: leg.alightingStop,
    secondRoute: path[index + 1].route,
    expectedWaitMinutes: Math.max(0, Math.round(
      (new Date(services[index + 1].departureTimeIso).getTime() - new Date(services[index].arrivalTimeIso).getTime()) / 60000
    )),
  }));
  const finalService = services[services.length - 1];
  const confidenceScore = Math.max(20, Math.min(98,
    Math.round(services.reduce((sum, item) => sum + item.confidenceScore, 0) / services.length - (services.length - 1) * 5)
  ));
  return {
    id: `journey-${path.map(item => item.route.id).join('-')}-${firstService.departureTimeIso}`,
    route: path[0].route,
    busIdentifier: firstService.busIdentifier,
    departureTime: firstService.departureTime,
    arrivalTime: finalService.arrivalTime,
    departureDayOffset: firstService.departureDayOffset,
    arrivalDayOffset: finalService.arrivalDayOffset,
    arrivalNextDay: localServiceDate(finalService.arrivalTimeIso) !== localServiceDate(firstService.departureTimeIso),
    durationMinutes: Math.max(1, Math.round(
      (new Date(finalService.arrivalTimeIso).getTime() - new Date(firstService.departureTimeIso).getTime()) / 60000
    )),
    boardingStop: path[0].boardingStop,
    alightingStop: path[path.length - 1].alightingStop,
    isDirect: path.length === 1,
    transfers,
    legs,
    confidenceScore,
    serviceStatus: path.every(item => item.route.serviceStatus === 'OPERATING_SCHEDULED')
      ? 'OPERATING_SCHEDULED' : 'SCHEDULE_UNVERIFIED',
    locationStatus: 'ESTIMATED',
    timetableDepartures: path[0].route.departures,
    intermediateStops: path[0].route.stops.filter(stop =>
      stop.stopSequence > path[0].boardingStop.stopSequence && stop.stopSequence < path[0].alightingStop.stopSequence
    ),
  };
}

/**
 * Time-aware transit planner. It supports direct journeys and up to two transfers,
 * checks actual service calendars, honours GTFS 24:xx times, and rejects missed connections.
 * This is timetable planning, not a claim of live vehicle availability.
 */
export function planJourneys(
  origin: string,
  destination: string,
  allRoutes: Route[],
  options: JourneyPlannerOptions = {},
): { directRoutes: JourneyCandidate[]; transferRoutes: JourneyCandidate[]; totalOptionsCount: number } {
  if (!origin.trim() || !destination.trim()) return { directRoutes: [], transferRoutes: [], totalOptionsCount: 0 };
  const currentTimeIso = options.currentTimeIso || new Date().toISOString();
  if (!Number.isFinite(new Date(currentTimeIso).getTime())) return { directRoutes: [], transferRoutes: [], totalOptionsCount: 0 };
  const maxTransfers = Math.max(0, Math.min(2, options.maximumTransfers ?? 2));
  const maxResults = Math.max(1, Math.min(30, options.maximumResults ?? 8));
  const minimumTransfer = Math.max(3, Math.min(30, options.minimumTransferMinutes ?? 8));
  const maximumWait = Math.max(minimumTransfer, Math.min(180, options.maximumTransferWaitMinutes ?? 90));
  const usableRoutes = allRoutes.filter(route => Array.isArray(route.stops) && route.stops.length >= 2 &&
    Array.isArray(route.operatingDays) && route.operatingDays.length > 0).slice(0, 500);
  const paths = enumeratePaths(origin, destination, usableRoutes, maxTransfers, 500);
  const directRoutes: JourneyCandidate[] = [], transferRoutes: JourneyCandidate[] = [];

  for (const path of paths) {
    const firstServices = getUpcomingServiceDepartures(
      path[0].route, path[0].boardingStop.stopId, path[0].alightingStop.stopId,
      currentTimeIso, { daysAhead: 7, maxResults: 8 },
    );
    for (const firstService of firstServices) {
      const chosen: ServiceDepartureInstance[] = [firstService];
      let connected = true;
      for (let index = 1; index < path.length; index++) {
        const previous = chosen[index - 1];
        const earliest = new Date(new Date(previous.arrivalTimeIso).getTime() + minimumTransfer * 60000);
        const nextServices = getUpcomingServiceDepartures(
          path[index].route, path[index].boardingStop.stopId, path[index].alightingStop.stopId,
          earliest.toISOString(), { daysAhead: 7, maxResults: 8 },
        );
        const next = nextServices.find(service => {
          const wait = (new Date(service.departureTimeIso).getTime() - new Date(previous.arrivalTimeIso).getTime()) / 60000;
          return wait >= minimumTransfer && wait <= maximumWait;
        });
        if (!next) { connected = false; break; }
        chosen.push(next);
      }
      if (!connected) continue;
      const candidate = materializeJourney(path, firstService, chosen);
      const target = path.length === 1 ? directRoutes : transferRoutes;
      if (!target.some(item => item.id === candidate.id)) target.push(candidate);
      if (directRoutes.length >= maxResults && transferRoutes.length >= maxResults) break;
    }
    if (directRoutes.length >= maxResults && transferRoutes.length >= maxResults) break;
  }

  directRoutes.sort((a, b) => a.durationMinutes - b.durationMinutes || b.confidenceScore - a.confidenceScore);
  transferRoutes.sort((a, b) => a.durationMinutes - b.durationMinutes || b.confidenceScore - a.confidenceScore);
  return {
    directRoutes: directRoutes.slice(0, maxResults),
    transferRoutes: transferRoutes.slice(0, maxResults),
    totalOptionsCount: directRoutes.length + transferRoutes.length,
  };
}
