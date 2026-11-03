import type { Route } from '../types/bus.js';
import type { ETAResult } from './etaCalculator.js';

export interface Phase4AlertCandidate {
  key: string;
  title: string;
  body: string;
}

export function isVerifiedOfflineRoute(route: Route): boolean {
  return route.timetableDataStatus === 'SCHEDULED' &&
    Boolean(route.timetableSource?.trim()) &&
    /^https:\/\//i.test(route.timetableSourceUrl || '') &&
    Boolean(route.timetableVerifiedAt) &&
    Array.isArray(route.stops) && route.stops.length > 0;
}

function clockMinutes(value: string): number | null {
  const match = /^([01]\d|2[0-3]):[0-5]\d$/.exec(value || '');
  return match ? Number(value.slice(0, 2)) * 60 + Number(value.slice(3, 5)) : null;
}

export function getJourneyAlertCandidates(
  route: Route,
  isFreshLiveGps: boolean,
  etas: ETAResult[],
  now: Date = new Date(),
): Phase4AlertCandidate[] {
  const alerts: Phase4AlertCandidate[] = [];
  const day = now.toISOString().slice(0, 10);
  if (isFreshLiveGps) {
    for (const eta of etas) {
      if (eta.calculationType !== 'OBSERVATION_BASED' || eta.confidenceScore < 55) continue;
      if (eta.etaMinutes >= 0 && eta.etaMinutes <= 5) {
        alerts.push({
          key: 'arrival:' + route.id + ':' + eta.stopId,
          title: 'Bus approaching your stop',
          body: eta.stopName + ' is about ' + Math.max(1, eta.etaMinutes) + ' minutes away based on fresh GPS.',
        });
      }
      const scheduled = clockMinutes(eta.scheduledTime);
      const predicted = clockMinutes(eta.predictedTime);
      if (scheduled !== null && predicted !== null && predicted - scheduled >= 10) {
        alerts.push({
          key: 'delay:' + route.id + ':' + eta.stopId + ':' + day,
          title: 'Possible bus delay',
          body: eta.stopName + ' may be at least ' + (predicted - scheduled) + ' minutes late. This is an estimate from live observations.',
        });
      }
    }
  }
  if (['DISRUPTION_REPORTED', 'ROUTE_CHANGED', 'POSSIBLE_DELAY', 'POSSIBLY_DISCONTINUED', 'CONFIRMED_DISCONTINUED'].includes(route.serviceStatus)) {
    alerts.push({
      key: 'service:' + route.id + ':' + route.serviceStatus,
      title: 'Bus service update',
      body: 'Current route status: ' + route.serviceStatus + '. Check the operator for confirmation.',
    });
  }
  if ((route.departures || []).some(departure => departure.isCancelled && departure.dataStatus === 'SCHEDULED')) {
    alerts.push({
      key: 'cancelled:' + route.id,
      title: 'Scheduled departure cancelled',
      body: 'A source-verified departure on this route is marked cancelled. Check the current timetable before travelling.',
    });
  }
  return alerts;
}
