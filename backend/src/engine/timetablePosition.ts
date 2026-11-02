import type { Bus, Route, RouteStop, TimetableDeparture } from '../../../packages/shared/src/types/bus.js';
import type { AggregatedBusLocation } from '../../../packages/shared/src/types/tracking.js';

const IST = 'Asia/Kolkata';
const dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

function istClock(now: Date) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: IST, hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(now);
  const get = (type: string) => Number(parts.find(part => part.type === type)?.value || 0);
  return get('hour') * 60 + get('minute') + get('second') / 60;
}

function istDay(now: Date) {
  const day = new Intl.DateTimeFormat('en-US', { timeZone: IST, weekday: 'short' }).format(now).toUpperCase();
  return dayNames.includes(day) ? day : 'MON';
}

function clockMinutes(value?: string): number | undefined {
  if (!value || !/^\d{1,2}:\d{2}$/.test(value)) return undefined;
  const [hour, minute] = value.split(':').map(Number);
  if (hour > 23 || minute > 59) return undefined;
  return hour * 60 + minute;
}

function departureForBus(route: Route, bus: Bus, day: string, routeBusCount: number): TimetableDeparture | undefined {
  const candidates = (route.departures || []).filter(item =>
    !item.isCancelled && item.operatingDays.includes(day as any) &&
    item.busIdentifier?.trim().toLowerCase() === bus.publicIdentifier.trim().toLowerCase()
  );
  if (candidates.length) return candidates.sort((a, b) => a.departureTime.localeCompare(b.departureTime))[0];
  // A shared route timetable cannot identify which of several physical buses is running.
  if (routeBusCount > 1) return undefined;
  return (route.departures || []).filter(item => !item.isCancelled && item.operatingDays.includes(day as any) && !item.busIdentifier)
    .sort((a, b) => a.departureTime.localeCompare(b.departureTime))[0];
}

function stopClock(stop: RouteStop, departure?: TimetableDeparture): number | undefined {
  const override = departure?.stopTimes?.find(item => item.stopId === stop.stopId);
  return clockMinutes(override?.departureTime || override?.arrivalTime || stop.scheduledDepartureTime || stop.scheduledArrivalTime);
}

function interpolate(a: number, b: number, ratio: number) {
  return a + (b - a) * ratio;
}

/** Schedule-only route position. It is always ESTIMATED, never a GPS/live fix. */
export function estimateTimetableBusLocation(
  bus: Bus,
  route: Route,
  now = new Date(),
  routeBusCount = 1,
): AggregatedBusLocation | undefined {
  if (!bus.isActive || !bus.routeId || bus.routeId !== route.id || route.stops.length < 2) return undefined;
  const stops = [...route.stops].sort((a, b) => a.stopSequence - b.stopSequence);
  if (stops.some(stop => !Number.isFinite(stop.latitude) || !Number.isFinite(stop.longitude))) return undefined;

  const departure = departureForBus(route, bus, istDay(now), routeBusCount);
  if (routeBusCount > 1 && !(route.departures || []).some(item => !item.isCancelled && item.operatingDays.includes(istDay(now) as any) && item.busIdentifier?.trim().toLowerCase() === bus.publicIdentifier.trim().toLowerCase())) return undefined;
  if (routeBusCount > 1 && !(route.departures || []).length) return undefined;
  const originTime = clockMinutes(departure?.departureTime || route.firstDepartureTime);
  if (originTime === undefined) return undefined;
  const nowMinutes = istClock(now);
  let elapsed = nowMinutes - originTime;
  if (elapsed < -2) return undefined;
  // Account for services that cross midnight.
  if (elapsed < 0) elapsed += 1440;

  const totalDuration = Math.max(1, departure
    ? Math.max(1, (clockMinutes(departure.arrivalTime) ?? (originTime + route.typicalDurationMinutes)) - originTime)
    : route.typicalDurationMinutes);
  const elapsedMinutes = Math.min(elapsed, totalDuration);
  if (elapsed > totalDuration + 20) return undefined;

  const timedStops = stops.map(stop => ({ stop, minute: stopClock(stop, departure) }))
    .filter((item): item is { stop: RouteStop; minute: number } => item.minute !== undefined);
  let latitude: number;
  let longitude: number;
  let nextStop: RouteStop | undefined;
  let etaMinutes: number | undefined;

  if (timedStops.length >= 2) {
    const schedule = timedStops.map(item => ({
      stop: item.stop,
      minute: ((item.minute - originTime) + 1440) % 1440,
    })).sort((a, b) => a.minute - b.minute);
    let left = schedule[0], right = schedule[1];
    for (let i = 0; i < schedule.length - 1; i++) {
      if (elapsedMinutes >= schedule[i].minute && elapsedMinutes <= schedule[i + 1].minute) {
        left = schedule[i]; right = schedule[i + 1]; break;
      }
      if (elapsedMinutes > schedule[i + 1].minute) { left = schedule[i + 1]; right = schedule[i + 1]; }
    }
    const span = Math.max(1, right.minute - left.minute);
    const ratio = Math.max(0, Math.min(1, (elapsedMinutes - left.minute) / span));
    latitude = interpolate(left.stop.latitude, right.stop.latitude, ratio);
    longitude = interpolate(left.stop.longitude, right.stop.longitude, ratio);
    nextStop = schedule.find(item => item.minute > elapsedMinutes)?.stop;
    const next = schedule.find(item => item.minute > elapsedMinutes);
    etaMinutes = next ? Math.max(0, Math.round(next.minute - elapsedMinutes)) : undefined;
  } else {
    const ratio = Math.max(0, Math.min(1, elapsedMinutes / totalDuration));
    const totalDistance = Math.max(0.1, route.distanceKm);
    const targetDistance = ratio * totalDistance;
    let left = stops[0], right = stops[stops.length - 1];
    for (let i = 0; i < stops.length - 1; i++) {
      if (targetDistance >= stops[i].distanceFromStartKm && targetDistance <= stops[i + 1].distanceFromStartKm) {
        left = stops[i]; right = stops[i + 1]; break;
      }
    }
    const span = Math.max(0.01, right.distanceFromStartKm - left.distanceFromStartKm);
    const part = Math.max(0, Math.min(1, (targetDistance - left.distanceFromStartKm) / span));
    latitude = interpolate(left.latitude, right.latitude, part);
    longitude = interpolate(left.longitude, right.longitude, part);
    nextStop = stops.find(stop => stop.distanceFromStartKm > targetDistance);
    etaMinutes = nextStop ? Math.max(0, Math.round((nextStop.distanceFromStartKm - targetDistance) / totalDistance * totalDuration)) : undefined;
  }

  return {
    busId: bus.id, routeId: route.id, displayState: 'ESTIMATED', locationSource: 'TIMETABLE',
    latitude, longitude, accuracyMeters: 5000,
    confidenceCategory: 'LOW', confidenceScore: 20,
    observationCount: 0, independentContributorsCount: 0,
    estimatedNextStopName: nextStop?.stopName,
    estimatedArrivalMinutes: etaMinutes,
    isLive: false,
    statusExplanation: 'Timetable-based route prediction only. No current GPS, network or cell-tower fix is available; actual bus position may differ substantially.',
    updatedAt: now.toISOString(),
  };
}
