import { RouteStop } from '../types/bus.js';
import { haversineDistanceMeters } from './routeMatcher.js';

export interface ETAResult {
  stopId: string;
  stopName: string;
  stopSequence: number;
  scheduledTime: string;
  predictedTime: string;
  etaMinutes: number;
  calculationType: 'OBSERVATION_BASED' | 'SCHEDULE_BASED';
  confidenceNote: string;
  confidenceScore: number;
  confidenceCategory: 'LOW' | 'MODERATE' | 'HIGH';
}

function getIstClock(date: Date): { hours: number; minutes: number } {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(date);
  return {
    hours: Number(parts.find(item => item.type === 'hour')?.value || 0),
    minutes: Number(parts.find(item => item.type === 'minute')?.value || 0),
  };
}

function confidenceCategory(score: number): ETAResult['confidenceCategory'] {
  return score >= 80 ? 'HIGH' : score >= 55 ? 'MODERATE' : 'LOW';
}

/**
 * Produces stop ETAs with an explicit confidence estimate.
 * Live GPS is used only when the observation is fresh; stale fixes fall back to timetable estimates.
 */
export function calculateStopETAs(
  stops: RouteStop[],
  currentProgressRatio: number,
  currentLocation?: {
    latitude: number;
    longitude: number;
    speedKmh?: number;
    accuracyMeters?: number;
    observedAtIso?: string;
    isLive: boolean;
  },
  currentServerTimeIso: string = new Date().toISOString()
): ETAResult[] {
  const now = new Date(currentServerTimeIso);
  if (!Number.isFinite(now.getTime()) || stops.length === 0) return [];
  const clock = getIstClock(now);
  const currentTotalMinutes = clock.hours * 60 + clock.minutes;
  const totalStops = stops.length;
  const progress = Math.max(0, Math.min(1, Number.isFinite(currentProgressRatio) ? currentProgressRatio : 0));
  const currentStopFloatIndex = progress * (totalStops - 1);
  const currentStopIndex = Math.min(totalStops - 1, Math.floor(currentStopFloatIndex));
  const speed = currentLocation?.speedKmh;
  const effectiveSpeedKmh = speed !== undefined && Number.isFinite(speed) && speed > 5 && speed <= 90 ? speed : 22;
  const observedAt = currentLocation?.observedAtIso ? new Date(currentLocation.observedAtIso).getTime() : undefined;
  const observationAgeSeconds = observedAt === undefined ? undefined : (now.getTime() - observedAt) / 1000;
  const observationFresh = currentLocation?.isLive === true &&
    (observationAgeSeconds === undefined || (observationAgeSeconds >= -30 && observationAgeSeconds <= 120));
  const firstDistance = stops[0].distanceFromStartKm;
  const lastDistance = stops[stops.length - 1].distanceFromStartKm;
  const hasUsableDistances = Number.isFinite(firstDistance) && Number.isFinite(lastDistance) && lastDistance > firstDistance;
  const routeDistance = hasUsableDistances ? lastDistance - firstDistance : 0;
  const currentDistance = hasUsableDistances ? firstDistance + progress * routeDistance : 0;

  return stops.map((stop, index) => {
    const isPast = index < currentStopIndex;
    let scheduledMinutes = currentTotalMinutes;
    const scheduledValue = stop.scheduledArrivalTime || '';
    const timeMatch = /^([01]\\d|2[0-3]):[0-5]\\d$/.exec(scheduledValue);
    if (timeMatch) {
      const [hours, minutes] = scheduledValue.split(':').map(Number);
      scheduledMinutes = hours * 60 + minutes;
    }

    let etaMinutes = 0;
    let calculationType: ETAResult['calculationType'] = 'SCHEDULE_BASED';
    let note = 'Timetable schedule prediction; no fresh GPS observation is available.';
    let confidence = stop.scheduledArrivalTime ? 48 : 30;

    if (isPast) {
      etaMinutes = -Math.max(1, Math.round((currentStopFloatIndex - index) * 5));
      note = 'Bus has passed this stop according to the current route progress.';
      confidence = 70;
    } else if (currentLocation && observationFresh) {
      calculationType = 'OBSERVATION_BASED';
      let remainingKm: number;
      if (hasUsableDistances) {
        remainingKm = Math.max(0, stop.distanceFromStartKm - currentDistance);
      } else {
        const distanceMeters = haversineDistanceMeters(
          currentLocation.latitude, currentLocation.longitude, stop.latitude, stop.longitude,
        );
        remainingKm = Math.max(0.1, distanceMeters / 1000);
      }
      const intermediateStopsCount = Math.max(0, index - Math.floor(currentStopFloatIndex) - 1);
      const dwellDelay = intermediateStopsCount * 1.5;
      etaMinutes = Math.max(0, Math.round((remainingKm / effectiveSpeedKmh) * 60 + dwellDelay));
      confidence = 62;
      if (speed !== undefined && Number.isFinite(speed) && speed > 5 && speed <= 90) confidence += 8;
      if (currentLocation.accuracyMeters !== undefined && currentLocation.accuracyMeters <= 30) confidence += 12;
      else if (currentLocation.accuracyMeters !== undefined && currentLocation.accuracyMeters <= 100) confidence += 6;
      if (observationAgeSeconds !== undefined && observationAgeSeconds <= 60) confidence += 8;
      if (stop.scheduledArrivalTime) confidence += 3;
      note = `Fresh GPS estimate (Live estimate): about ${remainingKm.toFixed(1)} km remaining at ${Math.round(effectiveSpeedKmh)} km/h; confidence reflects fix accuracy and age.`;
    } else {
      const difference = scheduledMinutes - currentTotalMinutes;
      etaMinutes = difference < -720 ? difference + 1440 : Math.max(0, difference);
      if (currentLocation?.isLive && !observationFresh) {
        note = 'GPS observation is stale; showing timetable prediction instead.';
        confidence = 25;
      }
    }

    const predictedTotal = ((currentTotalMinutes + Math.max(0, etaMinutes)) % 1440 + 1440) % 1440;
    const predictedTime = String(Math.floor(predictedTotal / 60)).padStart(2, '0') + ':' + String(predictedTotal % 60).padStart(2, '0');
    const boundedConfidence = Math.max(0, Math.min(95, Math.round(confidence)));
    return {
      stopId: stop.stopId,
      stopName: stop.stopName,
      stopSequence: stop.stopSequence,
      scheduledTime: stop.scheduledArrivalTime || predictedTime,
      predictedTime,
      etaMinutes,
      calculationType,
      confidenceNote: note,
      confidenceScore: boundedConfidence,
      confidenceCategory: confidenceCategory(boundedConfidence),
    };
  });
}
