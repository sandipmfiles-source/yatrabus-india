/**
 * Route Graph Network & Multi-Criteria Journey Discovery Service
 * Supports Direct routes, 1-transfer connections, interchange walking buffers,
 * and transparent multi-signal journey ranking.
 */

import { Route, Place, RouteStop } from '../../types';
import { calculateDistanceKm, calculateDistanceMeters } from '../utils/geoUtils';

export interface JourneySegment {
  route: Route;
  boardStop: RouteStop;
  alightStop: RouteStop;
  segmentDurationMinutes: number;
}

export interface PlannedJourney {
  journeyType: 'direct' | 'transfer';
  segments: JourneySegment[];
  interchangePlace?: Place;
  transferWalkMeters?: number;
  transferWaitMinutes?: number;
  totalDurationMinutes: number;
  totalDistanceKm: number;
  totalStopsCount: number;
  confidenceScore: number; // 0 to 100
  rankingSummary: string;
}

export class RouteGraphService {
  /**
   * Find candidate journeys between originPlaceId and destinationPlaceId
   * Uses graph traversal across stop sequences and interchange transfer points.
   */
  public static planJourney(
    originId: string,
    destinationId: string,
    allRoutes: Route[],
    allPlaces: Map<string, Place>
  ): PlannedJourney[] {
    const journeys: PlannedJourney[] = [];

    // 1. DIRECT JOURNEYS (0 Transfers)
    for (const route of allRoutes) {
      const boardIdx = route.stops.findIndex(s => s.stopId === originId);
      const alightIdx = route.stops.findIndex(s => s.stopId === destinationId);

      if (boardIdx !== -1 && alightIdx !== -1 && alightIdx > boardIdx) {
        const boardStop = route.stops[boardIdx];
        const alightStop = route.stops[alightIdx];
        const durationMins = alightStop.arrivalOffsetMinutes - boardStop.departureOffsetMinutes;
        const distanceKm = alightStop.distanceFromOriginKm - boardStop.distanceFromOriginKm;

        journeys.push({
          journeyType: 'direct',
          segments: [
            {
              route,
              boardStop,
              alightStop,
              segmentDurationMinutes: Math.max(10, durationMins)
            }
          ],
          totalDurationMinutes: Math.max(10, durationMins),
          totalDistanceKm: Math.max(1.0, distanceKm),
          totalStopsCount: alightIdx - boardIdx + 1,
          confidenceScore: 95, // Direct route high reliability
          rankingSummary: 'Direct Route • No Transfers Required'
        });
      }
    }

    // 2. TRANSFER-BASED JOURNEYS (1 Transfer via Interchange)
    // Find where Route A and Route B share a stop or have nearby stops (< 500m walking distance)
    for (const routeA of allRoutes) {
      const boardIdxA = routeA.stops.findIndex(s => s.stopId === originId);
      if (boardIdxA === -1) continue;

      for (let i = boardIdxA + 1; i < routeA.stops.length; i++) {
        const transferStopA = routeA.stops[i];

        for (const routeB of allRoutes) {
          if (routeB.id === routeA.id) continue;

          for (let j = 0; j < routeB.stops.length - 1; j++) {
            const transferStopB = routeB.stops[j];
            const alightIdxB = routeB.stops.findIndex(s => s.stopId === destinationId);

            if (alightIdxB === -1 || alightIdxB <= j) continue;

            // Check if transfer is at exact same place or close walking interchange (< 500m)
            let walkDistanceMeters = 0;
            if (transferStopA.stopId === transferStopB.stopId) {
              walkDistanceMeters = 0;
            } else {
              walkDistanceMeters = calculateDistanceMeters(
                transferStopA.latitude,
                transferStopA.longitude,
                transferStopB.latitude,
                transferStopB.longitude
              );
            }

            if (walkDistanceMeters <= 500) {
              const interchangePlace = allPlaces.get(transferStopA.stopId);
              const durationA = transferStopA.arrivalOffsetMinutes - routeA.stops[boardIdxA].departureOffsetMinutes;
              const durationB = routeB.stops[alightIdxB].arrivalOffsetMinutes - transferStopB.departureOffsetMinutes;
              const transferWaitMins = 12; // 12-minute typical transfer window

              const totalDuration = durationA + durationB + transferWaitMins + Math.round(walkDistanceMeters / 80);
              const totalDistance = (transferStopA.distanceFromOriginKm - routeA.stops[boardIdxA].distanceFromOriginKm) +
                (routeB.stops[alightIdxB].distanceFromOriginKm - transferStopB.distanceFromOriginKm);

              journeys.push({
                journeyType: 'transfer',
                segments: [
                  {
                    route: routeA,
                    boardStop: routeA.stops[boardIdxA],
                    alightStop: transferStopA,
                    segmentDurationMinutes: durationA
                  },
                  {
                    route: routeB,
                    boardStop: transferStopB,
                    alightStop: routeB.stops[alightIdxB],
                    segmentDurationMinutes: durationB
                  }
                ],
                interchangePlace,
                transferWalkMeters: Math.round(walkDistanceMeters),
                transferWaitMinutes: transferWaitMins,
                totalDurationMinutes: totalDuration,
                totalDistanceKm: parseFloat(totalDistance.toFixed(1)),
                totalStopsCount: (i - boardIdxA + 1) + (alightIdxB - j + 1),
                confidenceScore: 80,
                rankingSummary: `1 Transfer at ${interchangePlace?.canonicalName || 'Interchange'} (~${Math.round(walkDistanceMeters)}m walk)`
              });
            }
          }
        }
      }
    }

    // Sort by ranking: Direct first, then lowest duration, then least stops
    journeys.sort((a, b) => {
      if (a.journeyType !== b.journeyType) {
        return a.journeyType === 'direct' ? -1 : 1;
      }
      return a.totalDurationMinutes - b.totalDurationMinutes;
    });

    return journeys;
  }
}
