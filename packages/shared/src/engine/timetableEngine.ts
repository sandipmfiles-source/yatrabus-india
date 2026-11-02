import type { Route, TimetableDeparture, RouteStop } from '../types/bus.js';

export interface ServiceDepartureInstance {
  routeId: string;
  departureId?: string;
  serviceId?: string;
  busIdentifier?: string;
  boardingStop: RouteStop;
  alightingStop: RouteStop;
  departureTimeIso: string;
  arrivalTimeIso: string;
  departureTime: string;
  arrivalTime: string;
  departureDayOffset: number;
  arrivalDayOffset: number;
  durationMinutes: number;
  confidenceScore: number;
  isExactTimetable: boolean;
}

const DAY_CODES = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const IST_OFFSET_MINUTES = 330;
const DAY_MS = 24 * 60 * 60 * 1000;

function istParts(date: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
    weekday: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(date);
  const get = (key: string) => parts.find(part => part.type === key)?.value || '';
  return {
    year: Number(get('year')), month: Number(get('month')), day: Number(get('day')),
    weekday: get('weekday').toUpperCase().slice(0, 3),
    hour: Number(get('hour')), minute: Number(get('minute')), second: Number(get('second')),
  };
}

function dateKey(year: number, month: number, day: number): string {
  return String(year).padStart(4, '0') + String(month).padStart(2, '0') + String(day).padStart(2, '0');
}

function localDateAtMidnightUtc(year: number, month: number, day: number): number {
  return Date.UTC(year, month - 1, day) - IST_OFFSET_MINUTES * 60 * 1000;
}

function validClock(value: string): number | undefined {
  const match = /^(\d{1,3}):([0-5]\d)(?::([0-5]\d))?$/.exec(value);
  if (!match) return undefined;
  const hours = Number(match[1]), minutes = Number(match[2]);
  if (hours > 47) return undefined;
  return hours * 60 + minutes;
}

function activeOnDate(departure: TimetableDeparture, serviceDate: string, weekday: string): boolean {
  if (departure.removedServiceDates?.includes(serviceDate)) return false;
  if (departure.addedServiceDates?.includes(serviceDate)) return true;
  if (departure.serviceStartDate && serviceDate < departure.serviceStartDate) return false;
  if (departure.serviceEndDate && serviceDate > departure.serviceEndDate) return false;
  return Array.isArray(departure.operatingDays) && departure.operatingDays.includes(weekday as any);
}

function stopOffsetMinutes(
  departure: TimetableDeparture,
  route: Route,
  stop: RouteStop,
  kind: 'arrival' | 'departure',
  firstDepartureMinutes: number,
): number {
  const stopTime = departure.stopTimes?.find(item => item.stopId === stop.stopId);
  const value = kind === 'departure' ? stopTime?.departureTime || stopTime?.arrivalTime : stopTime?.arrivalTime || stopTime?.departureTime;
  const offset = kind === 'departure' ? stopTime?.departureDayOffset : stopTime?.arrivalDayOffset;
  if (value) {
    const parsed = validClock(value);
    if (parsed !== undefined) return (offset || 0) * 1440 + parsed;
  }
  if (route.distanceKm > 0 && route.typicalDurationMinutes > 0) {
    return firstDepartureMinutes + Math.round((stop.distanceFromStartKm / route.distanceKm) * route.typicalDurationMinutes);
  }
  const index = route.stops.findIndex(item => item.stopId === stop.stopId);
  return firstDepartureMinutes + Math.round((Math.max(0, index) / Math.max(1, route.stops.length - 1)) * route.typicalDurationMinutes);
}

function formatClock(totalMinutes: number): { time: string; dayOffset: number } {
  const dayOffset = Math.floor(totalMinutes / 1440);
  const minuteOfDay = ((totalMinutes % 1440) + 1440) % 1440;
  return {
    time: String(Math.floor(minuteOfDay / 60)).padStart(2, '0') + ':' + String(minuteOfDay % 60).padStart(2, '0'),
    dayOffset,
  };
}

/**
 * Returns exact or frequency-derived services that can carry a passenger between two ordered
 * stops. All comparisons use absolute IST instants, so 24:xx GTFS trips and midnight transfers work.
 */
export function getUpcomingServiceDepartures(
  route: Route,
  boardingStopId: string,
  alightingStopId: string,
  fromIso: string,
  options: { daysAhead?: number; maxResults?: number } = {},
): ServiceDepartureInstance[] {
  const from = new Date(fromIso);
  if (!Number.isFinite(from.getTime())) return [];
  const boardingIndex = route.stops.findIndex(stop => stop.stopId === boardingStopId || stop.id === boardingStopId);
  const alightingIndex = route.stops.findIndex(stop => stop.stopId === alightingStopId || stop.id === alightingStopId);
  if (boardingIndex < 0 || alightingIndex <= boardingIndex) return [];
  const boardingStop = route.stops[boardingIndex], alightingStop = route.stops[alightingIndex];
  const fromParts = istParts(from);
  const startUtc = localDateAtMidnightUtc(fromParts.year, fromParts.month, fromParts.day);
  const daysAhead = Math.max(0, Math.min(14, options.daysAhead ?? 7));
  const maxResults = Math.max(1, Math.min(100, options.maxResults ?? 20));
  const results: ServiceDepartureInstance[] = [];

  for (let dayOffset = 0; dayOffset <= daysAhead; dayOffset++) {
    const date = new Date(startUtc + dayOffset * DAY_MS);
    const serviceParts = istParts(date);
    const year = serviceParts.year, month = serviceParts.month, day = serviceParts.day;
    const weekday = serviceParts.weekday;
    const serviceDate = dateKey(year, month, day);
    const midnight = startUtc + dayOffset * DAY_MS;
    const candidates: Array<{ departure?: TimetableDeparture; firstMinutes: number; duration: number; busIdentifier?: string; confidence: number }> = [];

    if (route.departures?.length) {
      for (const departure of route.departures) {
        if (departure.isCancelled || !activeOnDate(departure, serviceDate, weekday)) continue;
        const clock = validClock(departure.departureTime);
        if (clock === undefined) continue;
        const firstMinutes = (departure.departureDayOffset || 0) * 1440 + clock;
        const lastClock = validClock(departure.arrivalTime);
        const lastStopTime = departure.stopTimes?.find(item => item.stopId === alightingStop.stopId);
        const lastValue = lastStopTime?.arrivalTime || lastStopTime?.departureTime;
        const lastOffset = lastStopTime?.arrivalDayOffset ?? lastStopTime?.departureDayOffset ?? 0;
        const lastParsed = lastValue ? validClock(lastValue) : lastClock;
        const lastMinutes = lastParsed === undefined ? firstMinutes + route.typicalDurationMinutes : lastOffset * 1440 + lastParsed;
        candidates.push({
          departure, firstMinutes, duration: Math.max(1, lastMinutes - firstMinutes),
          busIdentifier: departure.busIdentifier, confidence: departure.confidenceScore,
        });
      }
    } else {
      const first = validClock(route.firstDepartureTime), last = validClock(route.lastDepartureTime);
      if (first !== undefined && last !== undefined && Array.isArray(route.operatingDays) && route.operatingDays.includes(weekday as any)) {
        const end = last < first ? last + 1440 : last;
        const frequency = route.frequencyMinutes && route.frequencyMinutes > 0 ? route.frequencyMinutes : undefined;
        const step = frequency || Math.max(1, end - first + 1);
        for (let minute = first; minute <= end && candidates.length < 100; minute += step) {
          candidates.push({ firstMinutes: minute, duration: route.typicalDurationMinutes, confidence: 55 });
          if (!frequency) break;
        }
      }
    }

    for (const candidate of candidates) {
      const boardOffset = candidate.departure
        ? stopOffsetMinutes(candidate.departure, route, boardingStop, 'departure', candidate.firstMinutes)
        : candidate.firstMinutes + Math.round((boardingStop.distanceFromStartKm / Math.max(0.1, route.distanceKm)) * route.typicalDurationMinutes);
      const alightOffset = candidate.departure
        ? stopOffsetMinutes(candidate.departure, route, alightingStop, 'arrival', candidate.firstMinutes)
        : candidate.firstMinutes + Math.round((alightingStop.distanceFromStartKm / Math.max(0.1, route.distanceKm)) * route.typicalDurationMinutes);
      if (alightOffset <= boardOffset) continue;
      const departureMs = midnight + boardOffset * 60 * 1000;
      const arrivalMs = midnight + alightOffset * 60 * 1000;
      if (departureMs < from.getTime() - 30 * 1000) continue;
      const board = formatClock(boardOffset), alight = formatClock(alightOffset);
      results.push({
        routeId: route.id, departureId: candidate.departure?.id, serviceId: candidate.departure?.serviceId,
        busIdentifier: candidate.busIdentifier, boardingStop, alightingStop,
        departureTimeIso: new Date(departureMs).toISOString(), arrivalTimeIso: new Date(arrivalMs).toISOString(),
        departureTime: board.time, arrivalTime: alight.time,
        departureDayOffset: board.dayOffset, arrivalDayOffset: alight.dayOffset,
        durationMinutes: Math.max(1, Math.round((arrivalMs - departureMs) / 60000)),
        confidenceScore: candidate.confidence,
        isExactTimetable: !!candidate.departure && (!candidate.departure.isFrequencyBased || candidate.departure.exactTimes === true),
      });
    }
  }
  return results.sort((a, b) => a.departureTimeIso.localeCompare(b.departureTimeIso)).slice(0, maxResults);
}
