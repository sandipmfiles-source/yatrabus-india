import { inflateRawSync } from 'node:zlib';
import type { Operator, Route, RouteStop, TimetableDeparture } from '../../../packages/shared/src/types/bus.js';

export interface GtfsImportResult {
  operators: Operator[];
  routes: Route[];
  errors: string[];
  warnings: string[];
  stats: { agencies: number; routes: number; trips: number; stops: number; calendars: number };
}

type CsvRow = Record<string, string>;
type ZipEntry = { name: string; data: Buffer };

const DAY_COLUMNS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;
const DAY_CODES: Route['operatingDays'] = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
const MAX_COMPRESSED_BYTES = 10 * 1024 * 1024;
const MAX_UNCOMPRESSED_BYTES = 30 * 1024 * 1024;
const MAX_ENTRIES = 250;

function safeText(value: unknown, max = 180): string {
  return String(value ?? '').trim().slice(0, max);
}

function parseZip(base64: string): Map<string, string> {
  if (typeof base64 !== 'string' || base64.length < 32 || base64.length > Math.ceil(MAX_COMPRESSED_BYTES * 4 / 3) + 16) {
    throw new Error('GTFS ZIP must be a non-empty archive no larger than 10 MB.');
  }
  const buffer = Buffer.from(base64, 'base64');
  if (buffer.length < 22 || buffer.length > MAX_COMPRESSED_BYTES) throw new Error('GTFS ZIP size is invalid.');
  let eocd = -1;
  for (let i = buffer.length - 22; i >= Math.max(0, buffer.length - 65557); i--) {
    if (buffer.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('Invalid ZIP archive: end-of-central-directory record not found.');
  const entryCount = buffer.readUInt16LE(eocd + 10);
  const centralSize = buffer.readUInt32LE(eocd + 12);
  const centralOffset = buffer.readUInt32LE(eocd + 16);
  if (!entryCount || entryCount > MAX_ENTRIES || centralOffset + centralSize > buffer.length) {
    throw new Error('GTFS ZIP has an invalid or excessive directory.');
  }
  const files = new Map<string, string>();
  let offset = centralOffset;
  let expandedTotal = 0;
  for (let index = 0; index < entryCount; index++) {
    if (offset + 46 > buffer.length || buffer.readUInt32LE(offset) !== 0x02014b50) {
      throw new Error('Invalid ZIP central directory entry.');
    }
    const flags = buffer.readUInt16LE(offset + 8);
    const method = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const uncompressedSize = buffer.readUInt32LE(offset + 24);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localOffset = buffer.readUInt32LE(offset + 42);
    const name = buffer.toString('utf8', offset + 46, offset + 46 + nameLength).replace(/\\/g, '/');
    offset += 46 + nameLength + extraLength + commentLength;
    if (!name || name.endsWith('/') || name.startsWith('/') || name.split('/').includes('..')) continue;
    const basename = name.split('/').pop()!.toLowerCase();
    if (!basename.endsWith('.txt')) continue;
    if ((flags & 1) !== 0 || (method !== 0 && method !== 8)) throw new Error(`Unsupported ZIP encryption/compression for ${basename}.`);
    if (uncompressedSize > MAX_UNCOMPRESSED_BYTES || expandedTotal + uncompressedSize > MAX_UNCOMPRESSED_BYTES) {
      throw new Error('GTFS ZIP expands beyond the 30 MB safety limit.');
    }
    if (localOffset + 30 > buffer.length || buffer.readUInt32LE(localOffset) !== 0x04034b50) {
      throw new Error(`Invalid local ZIP header for ${basename}.`);
    }
    const localNameLength = buffer.readUInt16LE(localOffset + 26);
    const localExtraLength = buffer.readUInt16LE(localOffset + 28);
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    const dataEnd = dataStart + compressedSize;
    if (dataEnd > buffer.length) throw new Error(`Truncated ZIP data for ${basename}.`);
    const compressed = buffer.subarray(dataStart, dataEnd);
    const data = method === 0 ? Buffer.from(compressed) : inflateRawSync(compressed, { maxOutputLength: Math.max(1, uncompressedSize + 1) });
    if (data.length !== uncompressedSize) throw new Error(`Uncompressed size mismatch for ${basename}.`);
    expandedTotal += data.length;
    if (files.has(basename)) throw new Error(`GTFS archive contains duplicate ${basename} files.`);
    files.set(basename, data.toString('utf8').replace(/^\uFEFF/, ''));
  }
  return files;
}

/** RFC-4180 CSV parser; handles quoted commas, escaped quotes and newlines. */
export function parseGtfsCsv(source: string): CsvRow[] {
  const rows: string[][] = [];
  let row: string[] = [], field = '', quoted = false;
  for (let i = 0; i < source.length; i++) {
    const ch = source[i];
    if (quoted) {
      if (ch === '"' && source[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"' && field.length === 0) quoted = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && source[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.some(value => value.trim() !== '')) rows.push(row);
      row = [];
    } else field += ch;
  }
  if (quoted) throw new Error('GTFS CSV contains an unterminated quoted field.');
  if (field.length || row.length) { row.push(field); if (row.some(value => value.trim() !== '')) rows.push(row); }
  if (!rows.length) return [];
  const headers = rows[0].map(value => value.trim());
  if (headers.some(value => !value)) throw new Error('GTFS CSV has an empty column heading.');
  return rows.slice(1).map(values => Object.fromEntries(headers.map((header, i) => [header, (values[i] ?? '').trim()])));
}

function parseGtfsTime(value: string): { time: string; dayOffset: number; absoluteMinutes: number } | undefined {
  const match = /^(\d{1,3}):(\d{2}):(\d{2})$/.exec(value.trim());
  if (!match) return undefined;
  const hours = Number(match[1]), minutes = Number(match[2]), seconds = Number(match[3]);
  if (hours > 47 || minutes > 59 || seconds > 59) return undefined;
  const absoluteMinutes = hours * 60 + minutes + (seconds >= 30 ? 1 : 0);
  return {
    time: String(Math.floor((absoluteMinutes % 1440) / 60)).padStart(2, '0') + ':' + String(absoluteMinutes % 60).padStart(2, '0'),
    dayOffset: Math.floor(absoluteMinutes / 1440),
    absoluteMinutes,
  };
}

function validDate(value?: string): boolean {
  if (!value || !/^\d{8}$/.test(value)) return false;
  const year = Number(value.slice(0, 4)), month = Number(value.slice(4, 6)), day = Number(value.slice(6, 8));
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}
function weekdayForGtfsDate(value: string): Route['operatingDays'][number] | undefined {
  if (!validDate(value)) return undefined;
  const date = new Date(Date.UTC(Number(value.slice(0, 4)), Number(value.slice(4, 6)) - 1, Number(value.slice(6, 8))));
  return DAY_CODES[(date.getUTCDay() + 6) % 7];
}
function timeFromAbsoluteMinutes(value: number): string {
  const minutes = ((value % 1440) + 1440) % 1440;
  return String(Math.floor(minutes / 60)).padStart(2, '0') + ':' + String(minutes % 60).padStart(2, '0');
}
function serviceDays(row?: CsvRow): Route['operatingDays'] {
  if (!row) return [];
  return DAY_COLUMNS.flatMap((key, index) => row[key] === '1' ? [DAY_CODES[index]] : []);
}
function haversineKm(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }): number {
  const rad = (n: number) => n * Math.PI / 180;
  const dLat = rad(b.latitude - a.latitude), dLon = rad(b.longitude - a.longitude);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}
function slug(value: string): string {
  return value.normalize('NFKD').replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 70) || 'feed';
}

export function importGtfsZip(base64: string, now = new Date()): GtfsImportResult {
  const files = parseZip(base64);
  const required = ['agency.txt', 'routes.txt', 'stops.txt', 'trips.txt', 'stop_times.txt'];
  const errors = required.filter(name => !files.has(name)).map(name => `Missing required GTFS file: ${name}`);
  if (errors.length) return { operators: [], routes: [], errors, warnings: [], stats: { agencies: 0, routes: 0, trips: 0, stops: 0, calendars: 0 } };

  let agencies: CsvRow[], sourceRoutes: CsvRow[], stops: CsvRow[], trips: CsvRow[], stopTimes: CsvRow[];
  let calendars: CsvRow[] = [], calendarDates: CsvRow[] = [], shapes: CsvRow[] = [], frequencies: CsvRow[] = [];
  try {
    agencies = parseGtfsCsv(files.get('agency.txt')!);
    sourceRoutes = parseGtfsCsv(files.get('routes.txt')!);
    stops = parseGtfsCsv(files.get('stops.txt')!);
    trips = parseGtfsCsv(files.get('trips.txt')!);
    stopTimes = parseGtfsCsv(files.get('stop_times.txt')!);
    if (files.has('calendar.txt')) calendars = parseGtfsCsv(files.get('calendar.txt')!);
    if (files.has('calendar_dates.txt')) calendarDates = parseGtfsCsv(files.get('calendar_dates.txt')!);
    if (files.has('shapes.txt')) shapes = parseGtfsCsv(files.get('shapes.txt')!);
    if (files.has('frequencies.txt')) frequencies = parseGtfsCsv(files.get('frequencies.txt')!);
  } catch (error) {
    return { operators: [], routes: [], errors: [error instanceof Error ? error.message : 'Could not parse GTFS CSV.'], warnings: [], stats: { agencies: 0, routes: 0, trips: 0, stops: 0, calendars: 0 } };
  }

  const warnings: string[] = [];
  const stopById = new Map(stops.map(row => [row.stop_id, row]));
  const agencyById = new Map(agencies.map(row => [row.agency_id || 'default', row]));
  const routeById = new Map(sourceRoutes.map(row => [row.route_id, row]));
  const tripById = new Map(trips.map(row => [row.trip_id, row]));
  const calendarByService = new Map(calendars.map(row => [row.service_id, row]));
  const exceptionsByService = new Map<string, { added: string[]; removed: string[] }>();
  for (const row of calendarDates) {
    if (!validDate(row.date) || !row.service_id || !['1', '2'].includes(row.exception_type)) {
      warnings.push('Ignored invalid calendar_dates row.');
      continue;
    }
    const item = exceptionsByService.get(row.service_id) || { added: [], removed: [] };
    (row.exception_type === '1' ? item.added : item.removed).push(row.date);
    exceptionsByService.set(row.service_id, item);
  }

  const operatorById = new Map<string, Operator>();
  for (const agency of agencies) {
    const agencyId = agency.agency_id || 'default';
    const name = safeText(agency.agency_name, 120);
    if (!name || !safeText(agency.agency_url) || !/^https:\/\//i.test(agency.agency_url)) {
      warnings.push(`Skipped agency ${agencyId}: agency_name and HTTPS agency_url are required.`);
      continue;
    }
    const id = `gtfs-operator-${slug(agencyId)}`;
    operatorById.set(agencyId, {
      id, name, shortCode: safeText(agencyId, 24) || undefined,
      operatorType: 'PRIVATE_FLEET', serviceArea: 'India',
      contactWebsite: safeText(agency.agency_url, 300),
      verificationStatus: 'COMMUNITY_LISTED', isClaimed: false,
      sourceDataset: 'GTFS_STATIC_IMPORT_UNVERIFIED',
      createdAt: now.toISOString(), updatedAt: now.toISOString(),
    });
  }
  if (!operatorById.size) errors.push('No valid agency with an HTTPS official website was found.');

  const shapePoints = new Map<string, Array<{ sequence: number; latitude: number; longitude: number }>>();
  for (const row of shapes) {
    const lat = Number(row.shape_pt_lat), lon = Number(row.shape_pt_lon), sequence = Number(row.shape_pt_sequence);
    if (!row.shape_id || !Number.isFinite(lat) || !Number.isFinite(lon) || !Number.isFinite(sequence) || lat < 6 || lat > 38 || lon < 68 || lon > 98) continue;
    const list = shapePoints.get(row.shape_id) || [];
    list.push({ sequence, latitude: lat, longitude: lon }); shapePoints.set(row.shape_id, list);
  }

  const frequenciesByTrip = new Map<string, CsvRow[]>();
  for (const row of frequencies) {
    const list = frequenciesByTrip.get(row.trip_id) || [];
    list.push(row); frequenciesByTrip.set(row.trip_id, list);
  }
  const stopTimesByTrip = new Map<string, CsvRow[]>();
  for (const row of stopTimes) {
    const list = stopTimesByTrip.get(row.trip_id) || []; list.push(row); stopTimesByTrip.set(row.trip_id, list);
  }
  const groupedTrips = new Map<string, Array<{ trip: CsvRow; times: CsvRow[] }>>();
  for (const trip of trips) {
    const routeRow = routeById.get(trip.route_id), times = (stopTimesByTrip.get(trip.trip_id) || []).slice()
      .sort((a, b) => Number(a.stop_sequence) - Number(b.stop_sequence));
    if (!routeRow || times.length < 2) { warnings.push(`Skipped trip ${safeText(trip.trip_id, 80)}: route or ordered stop_times missing.`); continue; }
    const agencyId = routeRow.agency_id || agencies[0]?.agency_id || 'default';
    if (!operatorById.has(agencyId)) { warnings.push(`Skipped trip ${safeText(trip.trip_id, 80)}: agency is not valid.`); continue; }
    const direction = trip.direction_id === '1' ? 'DOWN' : 'UP';
    const key = `${agencyId}|${routeRow.route_id}|${direction}`;
    const list = groupedTrips.get(key) || []; list.push({ trip, times }); groupedTrips.set(key, list);
  }

  const resultRoutes: Route[] = [];
  for (const [key, items] of groupedTrips) {
    const [agencyId, sourceRouteId, direction] = key.split('|');
    const sourceRoute = routeById.get(sourceRouteId)!;
    const firstTrip = items.slice().sort((a, b) => a.times.length - b.times.length)[0];
    const orderedStopRows = firstTrip.times.map(time => stopById.get(time.stop_id)).filter((row): row is CsvRow => !!row);
    if (orderedStopRows.length < 2) { warnings.push(`Skipped route ${sourceRouteId}: fewer than two valid stops.`); continue; }
    const routeId = `gtfs-${slug(agencyId)}-${slug(sourceRouteId)}-${direction.toLowerCase()}`;
    const routeStops: RouteStop[] = [];
    let distanceFromStartKm = 0;
    let previous: { latitude: number; longitude: number } | undefined;
    for (let index = 0; index < orderedStopRows.length; index++) {
      const row = orderedStopRows[index];
      const latitude = Number(row.stop_lat), longitude = Number(row.stop_lon);
      if (!row.stop_id || !safeText(row.stop_name) || !Number.isFinite(latitude) || !Number.isFinite(longitude) ||
          latitude < 6 || latitude > 38 || longitude < 68 || longitude > 98) {
        warnings.push(`Skipped route ${sourceRouteId}: invalid stop coordinates or name.`);
        routeStops.length = 0; break;
      }
      const point = { latitude, longitude };
      if (previous) distanceFromStartKm += haversineKm(previous, point);
      previous = point;
      routeStops.push({
        id: `${routeId}-stop-${index + 1}`, routeId, stopId: row.stop_id,
        stopName: safeText(row.stop_name, 120), stopSequence: index + 1,
        latitude, longitude, distanceFromStartKm: Number(distanceFromStartKm.toFixed(2)),
      });
    }
    if (routeStops.length < 2) continue;

    const departures: TimetableDeparture[] = [];
    const daySet = new Set<Route['operatingDays'][number]>();
    let minDuration = Number.POSITIVE_INFINITY, maxDuration = 0;
    const routeHeadways: number[] = [];
    for (const item of items) {
      const serviceId = item.trip.service_id;
      const calendar = calendarByService.get(serviceId);
      const days = serviceDays(calendar);
      days.forEach(day => daySet.add(day));
      const exceptions = exceptionsByService.get(serviceId) || { added: [], removed: [] };
      exceptions.added.forEach(date => { const day = weekdayForGtfsDate(date); if (day) daySet.add(day); });
      const validTimes = item.times.map(row => ({
        row, arrival: parseGtfsTime(row.arrival_time || ''), departure: parseGtfsTime(row.departure_time || ''),
      }));
      if (validTimes.some(value => !value.arrival && !value.departure)) { warnings.push(`Skipped trip ${safeText(item.trip.trip_id, 80)}: invalid stop time.`); continue; }
      const firstTime = validTimes[0].departure || validTimes[0].arrival;
      const lastTime = validTimes[validTimes.length - 1].arrival || validTimes[validTimes.length - 1].departure;
      if (!firstTime || !lastTime || lastTime.absoluteMinutes < firstTime.absoluteMinutes) { warnings.push(`Skipped trip ${safeText(item.trip.trip_id, 80)}: invalid trip time sequence.`); continue; }
      minDuration = Math.min(minDuration, lastTime.absoluteMinutes - firstTime.absoluteMinutes);
      maxDuration = Math.max(maxDuration, lastTime.absoluteMinutes - firstTime.absoluteMinutes);
      const frequencyRows = frequenciesByTrip.get(item.trip.trip_id) || [];
      const addTripDeparture = (absoluteStart: number, frequencyRow?: CsvRow, frequencyIndex = 0) => {
        const shift = absoluteStart - firstTime.absoluteMinutes;
        const shiftedStopTimes = validTimes.map(value => {
          const arrivalAbsolute = value.arrival ? value.arrival.absoluteMinutes + shift : undefined;
          const departureAbsolute = value.departure ? value.departure.absoluteMinutes + shift : undefined;
          return {
            stopId: value.row.stop_id,
            arrivalTime: arrivalAbsolute === undefined ? undefined : timeFromAbsoluteMinutes(arrivalAbsolute),
            departureTime: departureAbsolute === undefined ? undefined : timeFromAbsoluteMinutes(departureAbsolute),
            arrivalDayOffset: arrivalAbsolute === undefined ? undefined : Math.floor(arrivalAbsolute / 1440),
            departureDayOffset: departureAbsolute === undefined ? undefined : Math.floor(departureAbsolute / 1440),
          };
        });
        const shiftedArrival = lastTime.absoluteMinutes + shift;
        const exactTimes = frequencyRow?.exact_times === '1';
        const headwaySeconds = frequencyRow ? Number(frequencyRow.headway_secs) : undefined;
        departures.push({
          id: frequencyRow
            ? `gtfs-trip-${slug(item.trip.trip_id)}-freq-${frequencyIndex}-${absoluteStart}`
            : `gtfs-trip-${slug(item.trip.trip_id)}`,
          timetableId: routeId,
          departureTime: timeFromAbsoluteMinutes(absoluteStart),
          arrivalTime: timeFromAbsoluteMinutes(shiftedArrival),
          departureDayOffset: Math.floor(absoluteStart / 1440),
          // GTFS trip_headsign describes a destination sign, not a unique physical bus.
          tripId: safeText(item.trip.trip_id, 100),
          stopTimes: shiftedStopTimes,
          operatingDays: days,
          serviceId,
          serviceStartDate: validDate(calendar?.start_date) ? calendar!.start_date : undefined,
          serviceEndDate: validDate(calendar?.end_date) ? calendar!.end_date : undefined,
          addedServiceDates: exceptions.added,
          removedServiceDates: exceptions.removed,
          isFrequencyBased: !!frequencyRow,
          exactTimes: frequencyRow ? exactTimes : undefined,
          headwaySeconds,
          confidenceScore: frequencyRow && !exactTimes ? 55 : 75,
          isCancelled: false,
        });
      };

      if (frequencyRows.length) {
        frequencyRows.forEach((frequencyRow, frequencyIndex) => {
          const start = parseGtfsTime(frequencyRow.start_time || '');
          const end = parseGtfsTime(frequencyRow.end_time || '');
          const headwaySeconds = Number(frequencyRow.headway_secs);
          if (!start || !end || end.absoluteMinutes <= start.absoluteMinutes ||
              !Number.isInteger(headwaySeconds) || headwaySeconds < 60 || headwaySeconds > 7200 ||
              !['0', '1', ''].includes(frequencyRow.exact_times || '')) {
            warnings.push(`Ignored invalid GTFS frequency window for trip ${safeText(item.trip.trip_id, 80)}.`);
            return;
          }
          routeHeadways.push(headwaySeconds);
          const stepMinutes = headwaySeconds / 60;
          let generated = 0;
          for (let minute = start.absoluteMinutes; minute < end.absoluteMinutes && generated < 500; minute += stepMinutes) {
            addTripDeparture(Math.round(minute), frequencyRow, frequencyIndex);
            generated++;
          }
          if (generated >= 500) warnings.push(`Frequency window for trip ${safeText(item.trip.trip_id, 80)} was capped at 500 departures.`);
        });
      } else {
        addTripDeparture(firstTime.absoluteMinutes);
      }
    }
    if (!departures.length) { warnings.push(`Route ${sourceRouteId} has no valid trips and was skipped.`); continue; }
    const routeCalendar = items.map(item => calendarByService.get(item.trip.service_id)).filter(Boolean) as CsvRow[];
    const startDates = routeCalendar.map(row => row.start_date).filter(validDate).sort();
    const endDates = routeCalendar.map(row => row.end_date).filter(validDate).sort();
    const departureMinute = (item: TimetableDeparture) => (item.departureDayOffset || 0) * 1440 +
      Number(item.departureTime.slice(0, 2)) * 60 + Number(item.departureTime.slice(3));
    const firstDepartureMinute = Math.min(...departures.map(departureMinute));
    const lastDepartureMinute = Math.max(...departures.map(departureMinute));
    const stopPatternKeys = new Set(items.map(item => item.times.map(row => row.stop_id).join('|')));
    if (stopPatternKeys.size > 1) warnings.push(`Route ${sourceRouteId} has ${stopPatternKeys.size} stop patterns; imported route shape uses the first trip's stop order while each trip retains its own stop_times.`);
    const shapeId = firstTrip.trip.shape_id;
    const geometry = shapeId ? (shapePoints.get(shapeId) || []).sort((a, b) => a.sequence - b.sequence).map(({ latitude, longitude }) => ({ latitude, longitude })) : undefined;
    const operator = operatorById.get(agencyId)!;
    resultRoutes.push({
      id: routeId,
      routeNumber: safeText(sourceRoute.route_short_name, 40) || safeText(sourceRoute.route_id, 40),
      routeName: safeText(sourceRoute.route_long_name, 160) || safeText(sourceRoute.route_short_name, 80) || safeText(sourceRoute.route_id, 80),
      originStopId: routeStops[0].stopId, originStopName: routeStops[0].stopName,
      destinationStopId: routeStops[routeStops.length - 1].stopId, destinationStopName: routeStops[routeStops.length - 1].stopName,
      operatorId: operator.id, operatorName: operator.name,
      direction: direction as Route['direction'],
      distanceKm: Number(distanceFromStartKm.toFixed(2)),
      typicalDurationMinutes: Math.max(1, Math.round((minDuration + maxDuration) / 2)),
      operatingDays: DAY_CODES.filter(day => daySet.has(day)),
      firstDepartureTime: timeFromAbsoluteMinutes(firstDepartureMinute),
      lastDepartureTime: timeFromAbsoluteMinutes(lastDepartureMinute),
      departures: departures.sort((a, b) => departureMinute(a) - departureMinute(b)),
      frequencyMinutes: routeHeadways.length && new Set(routeHeadways).size === 1 ? Math.max(1, Math.round(routeHeadways[0] / 60)) : undefined,
      stops: routeStops,
      geometry: geometry && geometry.length >= 2 ? geometry : undefined,
      verificationStatus: 'UNVERIFIED',
      serviceStatus: 'SCHEDULE_UNVERIFIED',
      createdAt: now.toISOString(), updatedAt: now.toISOString(),
    });
  }

  const routeIdCounts = new Map<string, number>();
  resultRoutes.forEach(route => routeIdCounts.set(route.id, (routeIdCounts.get(route.id) || 0) + 1));
  for (const [id, count] of routeIdCounts) if (count > 1) errors.push(`GTFS route IDs collide after safe normalization: ${id}.`);
  const operatorIdCounts = new Map<string, number>();
  Array.from(operatorById.values()).forEach(operator => operatorIdCounts.set(operator.id, (operatorIdCounts.get(operator.id) || 0) + 1));
  for (const [id, count] of operatorIdCounts) if (count > 1) errors.push(`GTFS agency IDs collide after safe normalization: ${id}.`);
  for (const route of resultRoutes) {
    const tripIds = route.departures?.map(item => item.id) || [];
    if (new Set(tripIds).size !== tripIds.length) errors.push(`GTFS trip IDs collide after safe normalization within route ${route.id}.`);
  }

  if (!resultRoutes.length) errors.push('No importable routes were found. Check stop coordinates, trips and stop_times.');
  if (!calendars.length && !calendarDates.length) warnings.push('No calendar.txt or calendar_dates.txt found; service-day availability cannot be verified and imported trips have no operating-day guarantee.');
  return {
    operators: Array.from(operatorById.values()), routes: resultRoutes, errors, warnings,
    stats: { agencies: operatorById.size, routes: resultRoutes.length, trips: departuresCount(resultRoutes), stops: new Set(resultRoutes.flatMap(route => route.stops.map(stop => stop.stopId))).size, calendars: calendars.length + calendarDates.length },
  };
}

function departuresCount(routes: Route[]): number {
  return routes.reduce((total, route) => total + (route.departures?.length || 0), 0);
}
