import { RouteStop } from '../types/bus.js';
import { haversineDistanceMeters } from './routeMatcher.js';

export interface ETAResult {
  stopId: string;
  stopName: string;
  stopSequence: number;
  scheduledTime: string; // HH:MM IST
  predictedTime: string; // HH:MM IST
  etaMinutes: number;
  calculationType: 'OBSERVATION_BASED' | 'SCHEDULE_BASED';
  confidenceNote: string;
}

/**
 * Calculates estimated arrival times for remaining stops along a bus route.
 * Clearly differentiates live GPS observation-based ETAs from scheduled timetable predictions.
 */
export function calculateStopETAs(
  stops: RouteStop[],
  currentProgressRatio: number, // 0.0 to 1.0 along route
  currentLocation?: {
    latitude: number;
    longitude: number;
    speedKmh?: number;
    isLive: boolean;
  },
  currentServerTimeIso: string = new Date().toISOString()
): ETAResult[] {
  const now = new Date(currentServerTimeIso);
  const nowHours = now.getHours();
  const nowMinutes = now.getMinutes();
  const currentTotalMinutes = nowHours * 60 + nowMinutes;

  const totalStops = stops.length;
  if (totalStops === 0) return [];

  // Determine current stop index
  const currentStopFloatIndex = currentProgressRatio * (totalStops - 1);
  const currentStopIndex = Math.min(totalStops - 1, Math.floor(currentStopFloatIndex));

  // Default urban Indian transit pace: 22 km/h (allowing for signals & congestion)
  const effectiveSpeedKmh =
    currentLocation?.speedKmh && currentLocation.speedKmh > 5 && currentLocation.speedKmh <= 90
      ? currentLocation.speedKmh
      : 22;

  const results: ETAResult[] = [];

  for (let i = 0; i < totalStops; i++) {
    const stop = stops[i];
    const isPast = i < currentStopIndex;
    const isNext = i === Math.ceil(currentStopFloatIndex);

    // Parse scheduled time
    let scheduledMinutes = currentTotalMinutes;
    if (stop.scheduledArrivalTime) {
      const [sh, sm] = stop.scheduledArrivalTime.split(':').map(Number);
      if (!isNaN(sh) && !isNaN(sm)) {
        scheduledMinutes = sh * 60 + sm;
      }
    }

    let etaMinutes = 0;
    let calculationType: 'OBSERVATION_BASED' | 'SCHEDULE_BASED' = 'SCHEDULE_BASED';
    let note = 'Based on scheduled timetable';

    if (isPast) {
      etaMinutes = -Math.max(1, Math.round((currentStopFloatIndex - i) * 5));
      note = 'Departed';
    } else if (currentLocation && currentLocation.isLive) {
      // Calculate remaining distance in km
      calculationType = 'OBSERVATION_BASED';
      const stopDistanceMeters = haversineDistanceMeters(
        currentLocation.latitude,
        currentLocation.longitude,
        stop.latitude,
        stop.longitude
      );
      const remainingKm = Math.max(0.2, stopDistanceMeters / 1000);

      // Travel time in minutes + stop dwell buffer (1 min per intermediate stop)
      const intermediateStopsCount = Math.max(0, i - Math.floor(currentStopFloatIndex) - 1);
      const dwellDelay = intermediateStopsCount * 1.5;
      const travelTimeMinutes = (remainingKm / effectiveSpeedKmh) * 60;

      etaMinutes = Math.max(1, Math.round(travelTimeMinutes + dwellDelay));
      note = `Live estimate (~${Math.round(remainingKm * 10) / 10} km remaining at ${Math.round(effectiveSpeedKmh)} km/h)`;
    } else {
      // Fallback to schedule difference
      calculationType = 'SCHEDULE_BASED';
      etaMinutes = Math.max(0, scheduledMinutes - currentTotalMinutes);
      note = 'Timetable schedule prediction';
    }

    // Compute predicted time string HH:MM
    const predTotalMins = (currentTotalMinutes + Math.max(0, etaMinutes)) % (24 * 60);
    const predH = String(Math.floor(predTotalMins / 60)).padStart(2, '0');
    const predM = String(predTotalMins % 60).padStart(2, '0');
    const predictedTime = `${predH}:${predM}`;

    results.push({
      stopId: stop.stopId,
      stopName: stop.stopName,
      stopSequence: stop.stopSequence,
      scheduledTime: stop.scheduledArrivalTime || predictedTime,
      predictedTime,
      etaMinutes,
      calculationType,
      confidenceNote: note,
    });
  }

  return results;
}
