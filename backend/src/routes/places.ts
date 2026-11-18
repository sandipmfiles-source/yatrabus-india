import { Router, Request, Response } from 'express';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { repository } from '../db/repository.js';
import { publicSearchLimiter } from '../middleware/rateLimiter.js';

export const placesRouter = Router();

const geocodeCache = new Map<string, { expiresAt: number; results: any[] }>();
let lastGeocodeRequestAt = 0;
const lgdSuggestionCache = new Map<string, { expiresAt: number; results: any[] }>();
let blockDirectoryPromise: Promise<any[]> | null = null;

function normaliseDirectoryRows(payload: any, query: string) {
  const data = payload?.data || {};
  const groups: [string, string][] = [
    ['states', 'State / UT'],
    ['districts', 'District'],
    ['subdistricts', 'Sub-district / Tehsil'],
    ['urban_local_bodies', 'City / Town'],
    ['villages', 'Village'],
    ['blocks', 'Block'],
  ];
  const needle = query.toLocaleLowerCase('en-IN');
  const results: any[] = [];
  for (const [key, level] of groups) {
    const rows = Array.isArray(data[key]) ? data[key] : [];
    for (const row of rows) {
      const name = String(row?.name || '').trim();
      if (!name || !name.toLocaleLowerCase('en-IN').includes(needle)) continue;
      const parents = [row.subdistrictName, row.districtName, row.stateName].filter(Boolean);
      results.push({
        id: 'lgd-' + key + '-' + String(row.code || name) + '-' + String(row.districtCode || ''),
        name,
        address: [level, ...parents].join(' · ') + ' · Government Local Government Directory',
        latitude: Number.isFinite(Number(row.latitude)) ? Number(row.latitude) : undefined,
        longitude: Number.isFinite(Number(row.longitude)) ? Number(row.longitude) : undefined,
        source: 'LOCAL_GOVERNMENT_DIRECTORY',
        level,
      });
    }
  }
  return results;
}

async function loadBlockDirectory() {
  if (!blockDirectoryPromise) {
    blockDirectoryPromise = (async () => {
      const response = await fetch('https://raw.githubusercontent.com/planemad/india-local-government-directory/main/administrative/blocks.csv', {
        signal: AbortSignal.timeout(6000),
        headers: { 'User-Agent': 'YatraBusIndia/1.0' },
      });
      if (!response.ok) throw new Error('Block directory download failed');
      const csv = await response.text();
      return csv.split(/\r?\n/).slice(1).map(line => {
        const cols = line.split(',').map(value => value.trim().replace(/^"|"$/g, ''));
        return { code: cols[5], name: cols[7], districtName: cols[4], stateName: cols[2] };
      }).filter(row => row.name);
    })().catch(error => { blockDirectoryPromise = null; throw error; });
  }
  return blockDirectoryPromise;
}

const lgdCatalogue = (() => {
  const normaliseRows = (rows: any[], metadata: any = {}) => rows.map((row: any) => Array.isArray(row)
    ? ({
        id: row[0], code: row[1], name: row[2], level: row[3], state: row[4],
        district: row[5], subdistrict: row[6], localName: row[7], snapshotDate: row[8] || metadata.snapshotDate,
        sourceUrl: metadata.sourceUrl, sourceLicense: metadata.sourceLicense,
      })
    : ({
        id: row.id, code: row.sourceRecordId || row.code, name: row.canonicalName || row.name,
        level: row.level || row.placeType, state: row.state, district: row.district, subdistrict: row.subdistrict,
        localName: row.localName, snapshotDate: row.sourceSnapshotDate || metadata.snapshotDate,
        sourceUrl: row.sourceUrl || metadata.sourceUrl, sourceLicense: row.sourceLicense || metadata.sourceLicense,
        latitude: row.latitude, longitude: row.longitude,
      }));
  const merged = new Map<string, any>();
  const addRows = (payload: any) => {
    const rows = Array.isArray(payload?.places) ? normaliseRows(payload.places, payload) : [];
    for (const row of rows) {
      if (!row.id) continue;
      const existing = merged.get(row.id);
      // Prefer the newest dated source snapshot for the same LGD code.
      if (!existing || String(row.snapshotDate || '') >= String(existing.snapshotDate || '')) merged.set(row.id, row);
    }
  };
  try {
    const directory = fileURLToPath(new URL('../../../data/lgd-index/', import.meta.url));
    const files = readdirSync(directory).filter(name => name.toLowerCase().endsWith('.json'));
    for (const name of files) addRows(JSON.parse(readFileSync(resolve(directory, name), 'utf8')));
  } catch {
    // The compact split index is optional when a deployment uses only the compressed snapshot.
  }
  try {
    const file = new URL('../../data/india-lgd-directory.json.gz', import.meta.url);
    addRows(JSON.parse(gunzipSync(readFileSync(file)).toString('utf8')));
  } catch {
    // A deployment without the optional gzip snapshot still uses any available split indexes.
  }
  return Array.from(merged.values());
})();;

async function fetchLgdDirectorySuggestions(query: string) {
  const key = query.toLocaleLowerCase('en-IN');
  const cached = lgdSuggestionCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.results;

  const localMatches = (lgdCatalogue as any[])
    .filter((item: any) => String(item.name || '').toLocaleLowerCase('en-IN').includes(key) ||
      String(item.localName || '').toLocaleLowerCase('en-IN').includes(key))
    .sort((a: any, b: any) => {
      const aPrefix = String(a.name || '').toLocaleLowerCase('en-IN').startsWith(key) ? 0 : 1;
      const bPrefix = String(b.name || '').toLocaleLowerCase('en-IN').startsWith(key) ? 0 : 1;
      return aPrefix - bPrefix || String(a.name).localeCompare(String(b.name));
    })
    .slice(0, 8)
    .map((item: any) => ({
      id: item.id,
      name: item.name,
      address: [item.level, item.subdistrict, item.district, item.state, 'LGD snapshot ' + (item.snapshotDate || 'date unknown')].filter(Boolean).join(' · '),
      source: 'LOCAL_GOVERNMENT_DIRECTORY',
      level: item.level,
      code: item.code,
      localName: item.localName,
      snapshotDate: item.snapshotDate,
      sourceUrl: item.sourceUrl || 'https://lgdirectory.gov.in/',
      sourceLicense: item.sourceLicense || 'Government Open Data License - India (GODL-India)',
    }));

  let fallback: any[] = [];
  if (localMatches.length < 8) {
    try {
      const url = 'https://lgd-json-api.vercel.app/api/search?q=' + encodeURIComponent(query) + '&limit=8';
      const response = await fetch(url, {
        headers: { 'User-Agent': 'YatraBusIndia/1.0', 'Accept': 'application/json' },
        signal: AbortSignal.timeout(5000),
      });
      if (response.ok) fallback = normaliseDirectoryRows(await response.json() as any, query);
    } catch {
      // The bundled LGD catalogue remains available even when the optional mirror is offline.
    }
  }
  const results = Array.from(new Map([...localMatches, ...fallback].map(item => [item.id, item])).values()).slice(0, 8);
  if (lgdSuggestionCache.size > 500) lgdSuggestionCache.delete(lgdSuggestionCache.keys().next().value as string);
  lgdSuggestionCache.set(key, { expiresAt: Date.now() + 24 * 60 * 60 * 1000, results });
  return results;
}


// Free OpenStreetMap Nominatim suggestions. Queries are cached and throttled to respect
// the public service usage policy; selected coordinates are sent with route submissions.
placesRouter.get('/geocode-search', publicSearchLimiter, async (req: Request, res: Response) => {
  const query = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  if (query.length < 3 || query.length > 120) return res.json({ query, results: [] });
  const key = query.toLocaleLowerCase();
  const cached = geocodeCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return res.json({ query, results: cached.results, cache: 'HIT' });
  const directoryResults = await fetchLgdDirectorySuggestions(query);
  const waitMs = 1100 - (Date.now() - lastGeocodeRequestAt);
  if (waitMs > 0) await new Promise(resolve => setTimeout(resolve, waitMs));
  lastGeocodeRequestAt = Date.now();
  try {
    const url = 'https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&countrycodes=in&limit=6&q=' + encodeURIComponent(query);
    const response = await fetch(url, {
      headers: { 'User-Agent': 'YatraBusIndia/1.0 (+https://github.com/sandipmfiles-source/yatrabus-india)', 'Accept-Language': 'en,hi,bn' },
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) return res.json({ query, results: directoryResults, source: 'LOCAL_GOVERNMENT_DIRECTORY', attribution: 'Government Local Government Directory' });
    const data = await response.json() as any[];
    const mapResults = (Array.isArray(data) ? data : []).map(item => ({
      id: String(item.place_id),
      name: String(item.name || item.display_name?.split(',')[0] || query),
      address: String(item.display_name || ''),
      latitude: Number(item.lat),
      longitude: Number(item.lon),
      source: 'OPENSTREETMAP_NOMINATIM',
      level: 'Mapped place',
    })).filter(item => Number.isFinite(item.latitude) && Number.isFinite(item.longitude));
    const merged = [...directoryResults, ...mapResults];
    const results = Array.from(new Map(merged.map(item => [item.id, item])).values()).slice(0, 12);
    if (geocodeCache.size > 500) geocodeCache.delete(geocodeCache.keys().next().value as string);
    geocodeCache.set(key, { expiresAt: Date.now() + 24 * 60 * 60 * 1000, results });
    return res.json({ query, results, source: 'LGD + OPENSTREETMAP', attribution: 'Government Local Government Directory · © OpenStreetMap contributors' });
  } catch {
    return res.json({ query, results: directoryResults, source: 'LOCAL_GOVERNMENT_DIRECTORY', attribution: 'Ministry of Panchayati Raj · Local Government Directory' });
  }
});

// Resolve a GPS point to a readable place/road name using free OpenStreetMap data.
placesRouter.get('/reverse-geocode', publicSearchLimiter, async (req: Request, res: Response) => {
  const latitude = Number(req.query.lat);
  const longitude = Number(req.query.lon);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < 6 || latitude > 38 || longitude < 68 || longitude > 98) {
    return res.status(400).json({ error: 'INVALID_COORDINATES', message: 'Valid India GPS coordinates are required.' });
  }
  const key = latitude.toFixed(4) + ',' + longitude.toFixed(4);
  const cached = geocodeCache.get('reverse:' + key);
  if (cached && cached.expiresAt > Date.now() && cached.results[0]) return res.json({ place: cached.results[0], cache: 'HIT' });
  const waitMs = 1100 - (Date.now() - lastGeocodeRequestAt);
  if (waitMs > 0) await new Promise(resolve => setTimeout(resolve, waitMs));
  lastGeocodeRequestAt = Date.now();
  try {
    const url = 'https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=18&addressdetails=1&lat=' + latitude + '&lon=' + longitude;
    const response = await fetch(url, { headers: { 'User-Agent': 'YatraBusIndia/1.0 (+https://github.com/sandipmfiles-source/yatrabus-india)', 'Accept-Language': 'en,hi,bn' }, signal: AbortSignal.timeout(10000) });
    if (!response.ok) return res.status(502).json({ error: 'REVERSE_GEOCODE_UNAVAILABLE', message: 'GPS coordinates saved, but the place name could not be fetched.' });
    const data = await response.json() as any;
    const address = data.address || {};
    const name = data.name || address.bus_stop || address.road || address.suburb || address.village || address.town || address.city || address.county || '';
    const place = name ? { name: String(name), address: String(data.display_name || ''), latitude, longitude, source: 'OPENSTREETMAP_NOMINATIM' } : null;
    geocodeCache.set('reverse:' + key, { expiresAt: Date.now() + 24 * 60 * 60 * 1000, results: place ? [place] : [] });
    return res.json({ place, attribution: '© OpenStreetMap contributors' });
  } catch {
    return res.status(502).json({ error: 'REVERSE_GEOCODE_UNAVAILABLE', message: 'GPS coordinates saved, but the place name could not be fetched.' });
  }
});

// Free local catalogue search. External paid geocoding is deliberately not required.
placesRouter.get('/search', publicSearchLimiter, async (req: Request, res: Response) => {
  const query = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  const requestedLimit = req.query.limit ? Number.parseInt(String(req.query.limit), 10) : 8;
  const limit = Number.isFinite(requestedLimit) ? Math.max(1, Math.min(12, requestedLimit)) : 8;
  if (query.length < 2) return res.json({ query, count: 0, results: [], sources: { local: 0, lgd: 0 } });

  // The bundled LGD snapshot is the full administrative search catalogue. Include it
  // in the main autocomplete endpoint, not only in map/geocoding search.
  const localResults = repository.searchPlaces(query, limit);
  const directoryResults = await fetchLgdDirectorySuggestions(query);
  const needle = query.toLocaleLowerCase('en-IN');
  const importedAt = new Date().toISOString();
  const lgdResults = directoryResults.map((item: any) => {
    const name = String(item.name || '').trim();
    const level = String(item.level || 'Administrative area');
    const exact = name.toLocaleLowerCase('en-IN') === needle;
    const prefix = name.toLocaleLowerCase('en-IN').startsWith(needle);
    const levelKey = level.toLocaleLowerCase('en-IN').replace(/[^a-z]/g, '');
    const typeByLevel: Record<string, string> = {
      state: 'STATE', stateut: 'STATE', unionterritory: 'UNION_TERRITORY', district: 'DISTRICT',
      subdistrict: 'TEHSIL', subdistricttehsil: 'TEHSIL', tehsil: 'TEHSIL',
      block: 'BLOCK', urbanlocalbody: 'CITY', citytown: 'TOWN', town: 'TOWN', village: 'VILLAGE',
    };
    const place = {
      id: String(item.id),
      canonicalName: name,
      names: { en: name },
      placeType: typeByLevel[levelKey] || 'LOCALITY',
      state: item.state || undefined,
      district: item.district || undefined,
      sourceDataset: 'INDIA_LOCAL_GOVERNMENT_DIRECTORY',
      sourceRecordId: item.code ? String(item.code) : undefined,
      sourceLicense: 'Government Open Data License - India (GODL-India)',
      sourceUrl: item.sourceUrl || 'https://lgdirectory.gov.in/',
      sourceSnapshotDate: item.snapshotDate,
      verificationStatus: 'UNVERIFIED',
      aliases: item.localName ? [String(item.localName)] : [],
      createdAt: importedAt,
      updatedAt: importedAt,
    };
    return {
      place,
      matchScore: exact ? 100 : prefix ? 88 : 74,
      matchType: exact ? 'EXACT' : 'PREFIX',
      displayLabel: name,
      subtitle: String(item.address || level + ' · LGD directory'),
    };
  });
  const merged = new Map<string, any>();
  for (const result of [...localResults, ...lgdResults]) {
    const id = result?.place?.id;
    if (id && !merged.has(id)) merged.set(id, result);
  }
  const results = Array.from(merged.values())
    .sort((a, b) => b.matchScore - a.matchScore || String(a.displayLabel).localeCompare(String(b.displayLabel), 'en-IN'))
    .slice(0, limit);
  return res.json({
    query,
    count: results.length,
    results,
    sources: { local: localResults.length, lgd: lgdResults.length },
    attribution: 'Ministry of Panchayati Raj · Local Government Directory · Government Open Data License - India',
  });
});

// GET /api/places/nearby?lat=22.467&lon=86.990&radius=4000
// Combine the local verified catalogue with mapped individual bus stops and terminals.
// The old implementation only queried the small in-memory catalogue and returned 10 rows,
// which hid ordinary roadside stops and almost every mapped stop not in the seed data.
const nearbyCache = new Map<string, { expiresAt: number; stops: any[]; source: string }>();
const distanceBetweenMeters = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const toRad = (value: number) => value * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

placesRouter.get('/nearby', publicSearchLimiter, async (req: Request, res: Response) => {
  const lat = Number(req.query.lat);
  const lon = Number(req.query.lon);
  const radius = req.query.radius ? Number.parseInt(String(req.query.radius), 10) : 4000;
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < 6 || lat > 38 || lon < 68 || lon > 98 ||
      !Number.isFinite(radius) || radius < 100 || radius > 15000) {
    return res.status(400).json({ error: 'INVALID_NEARBY_QUERY', message: 'Valid India coordinates and a radius between 100m and 15km are required.' });
  }

  const cacheKey = lat.toFixed(3) + ',' + lon.toFixed(3) + ':' + radius;
  const cached = nearbyCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return res.json({ count: cached.stops.length, stops: cached.stops, source: cached.source, cache: 'HIT', radiusMeters: radius });
  }

  const localStops = repository.findNearbyStops(lat, lon, radius).map(item => ({
    place: item.place,
    distanceMeters: item.distanceMeters,
    source: item.place.sourceDataset || 'YATRIBUS_DIRECTORY',
    stopKind: item.place.placeType,
  }));

  let mappedStops: any[] = [];
  let source = 'YATRIBUS_DIRECTORY';
  try {
    const query = '[out:json][timeout:20];(' +
      'nwr(around:' + radius + ',' + lat + ',' + lon + ')[highway=bus_stop];' +
      'nwr(around:' + radius + ',' + lat + ',' + lon + ')[amenity=bus_station];' +
      'nwr(around:' + radius + ',' + lat + ',' + lon + ')[public_transport=platform][bus=yes];' +
      'nwr(around:' + radius + ',' + lat + ',' + lon + ')[public_transport=station][bus=yes];' +
      ');out center tags;';
    const response = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8', 'User-Agent': 'YatraBusIndia/1.0 (+https://github.com/sandipmfiles-source/yatrabus-india)' },
      body: 'data=' + encodeURIComponent(query),
      signal: AbortSignal.timeout(22000),
    });
    if (response.ok) {
      const payload = await response.json() as any;
      mappedStops = (Array.isArray(payload.elements) ? payload.elements : []).map((element: any) => {
        const tags = element.tags || {};
        const latitude = Number(element.lat ?? element.center?.lat);
        const longitude = Number(element.lon ?? element.center?.lon);
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
        const distanceMeters = Math.round(distanceBetweenMeters(lat, lon, latitude, longitude));
        if (distanceMeters > radius) return null;
        const station = tags.amenity === 'bus_station' || tags.public_transport === 'station';
        const name = String(tags.name || tags['name:en'] || tags['name:hi'] || tags['name:bn'] || (station ? 'Bus terminal' : 'Bus stop')).trim();
        const place = {
          id: 'osm-' + String(element.type) + '-' + String(element.id),
          canonicalName: name,
          names: { en: name, hi: tags['name:hi'], bn: tags['name:bn'] },
          placeType: station ? 'BUS_TERMINAL' : 'BUS_STOP',
          latitude,
          longitude,
          district: tags['addr:district'] || tags['addr:city'] || tags['addr:town'] || undefined,
          state: tags['addr:state'] || undefined,
          sourceDataset: 'OPENSTREETMAP',
          sourceRecordId: String(element.type) + '/' + String(element.id),
          sourceLicense: 'ODbL',
          sourceUrl: 'https://www.openstreetmap.org/' + String(element.type) + '/' + String(element.id),
          verificationStatus: 'UNVERIFIED',
          aliases: [tags.operator, tags.network, tags.ref].filter(Boolean).map(String),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        return { place, distanceMeters, source: 'OPENSTREETMAP', stopKind: place.placeType };
      }).filter(Boolean);
      source = 'YATRIBUS_DIRECTORY + OPENSTREETMAP';
    }
  } catch {
    // Keep local results available when the public OpenStreetMap Overpass service is busy.
  }

  const merged = new Map<string, any>();
  for (const item of [...localStops, ...mappedStops]) {
    const place = item.place;
    const normalizedName = String(place?.canonicalName || '').trim().toLocaleLowerCase('en-IN');
    const key = place?.latitude !== undefined && place?.longitude !== undefined && normalizedName && normalizedName !== 'bus stop' && normalizedName !== 'bus terminal'
      ? normalizedName + '|' + place.latitude.toFixed(4) + ',' + place.longitude.toFixed(4)
      : String(place?.id || '');
    if (key && !merged.has(key)) merged.set(key, item);
  }
  const stops = Array.from(merged.values())
    .sort((a, b) => a.distanceMeters - b.distanceMeters);
  if (nearbyCache.size > 300) nearbyCache.delete(nearbyCache.keys().next().value as string);
  nearbyCache.set(cacheKey, { expiresAt: Date.now() + 5 * 60 * 1000, stops, source });
  return res.json({ count: stops.length, stops, source, cache: 'MISS', radiusMeters: radius, attribution: '© OpenStreetMap contributors' });
});

// GET /api/places/:id
placesRouter.get('/:id', (req: Request, res: Response) => {
  const place = repository.getPlaceById(String(req.params.id));
  if (!place) return res.status(404).json({ error: 'Place not found' });
  return res.json({ place });
});



function resolveRoutePoint(value: unknown): { name: string; latitude: number; longitude: number } | null {
  if (typeof value !== 'string') return null;
  const parts = value.split('|').map(part => part.trim());
  const name = parts[0] || '';
  if (name.length < 2 || name.length > 180) return null;
  if (parts.length >= 3 && parts[1] && parts[2]) {
    const latitude = Number(parts[1]);
    const longitude = Number(parts[2]);
    if (Number.isFinite(latitude) && Number.isFinite(longitude) && latitude >= 6 && latitude <= 38 && longitude >= 68 && longitude <= 98) {
      return { name, latitude, longitude };
    }
    return null;
  }
  const matches = repository.searchPlaces(name, 8)
    .filter(item => item.matchScore >= 95 && Number.isFinite(item.place.latitude) && Number.isFinite(item.place.longitude));
  if (matches.length !== 1) return null;
  const place = matches[0].place;
  return { name: place.canonicalName, latitude: place.latitude!, longitude: place.longitude! };
}

const osrmRouteCache = new Map<string, { expiresAt: number; payload: Record<string, unknown> }>();
let lastOsrmRequestAt = 0;

placesRouter.post('/route-preview', publicSearchLimiter, async (req: Request, res: Response) => {
  const originRaw = typeof req.body?.origin === 'string' ? req.body.origin.trim() : '';
  const destinationRaw = typeof req.body?.destination === 'string' ? req.body.destination.trim() : '';
  const stopsRaw = (Array.isArray(req.body?.stops) ? req.body.stops : [])
    .filter((value: unknown): value is string => typeof value === 'string')
    .map((value: string) => value.trim()).filter(Boolean);
  if (stopsRaw.length > 998) return res.status(400).json({ error: 'TOO_MANY_STOPS', message: 'This route contains too many stops for one contribution. Please split unusually long routes into separate services.' });
  const points = [originRaw, ...stopsRaw, destinationRaw].map(resolveRoutePoint);
  const missingIndex = points.findIndex(point => point === null);
  if (missingIndex >= 0) {
    const field = missingIndex === 0 ? 'starting place' : missingIndex === points.length - 1 ? 'destination' : 'intermediate stop';
    return res.status(422).json({
      error: 'PLACE_COORDINATES_REQUIRED',
      message: 'Could not find exact coordinates for the ' + field + '. Use a saved YatraBus place or enter it as Name | latitude | longitude.',
    });
  }
  const resolved = points as { name: string; latitude: number; longitude: number }[];
  const names = resolved.map(point => point.name.toLocaleLowerCase());
  if (new Set(names).size !== names.length) return res.status(400).json({ error: 'DUPLICATE_STOPS', message: 'A place appears more than once. Check the stop sequence.' });
  const coordinates = resolved.map(point => point.longitude + ',' + point.latitude).join(';');
  const cached = osrmRouteCache.get(coordinates);
  if (cached && cached.expiresAt > Date.now()) return res.json({ ...cached.payload, cache: 'HIT' });
  if (Date.now() - lastOsrmRequestAt < 1100) return res.status(429).json({ error: 'ROUTE_RATE_LIMIT', message: 'Please wait a moment before checking another route.' });
  lastOsrmRequestAt = Date.now();
  try {
    // The public OSRM demo limits waypoints per request. Validate long routes
    // in overlapping chunks so the stop count follows the actual bus service.
    let totalDistanceMeters = 0;
    let totalDurationSeconds = 0;
    for (let start = 0; start < resolved.length - 1; start += 99) {
      const chunk = resolved.slice(start, Math.min(start + 100, resolved.length));
      const waitMs = 1100 - (Date.now() - lastOsrmRequestAt);
      if (start > 0 && waitMs > 0) await new Promise(resolve => setTimeout(resolve, waitMs));
      const chunkCoordinates = chunk.map(point => point.longitude + ',' + point.latitude).join(';');
      const url = 'https://router.project-osrm.org/route/v1/driving/' + chunkCoordinates + '?overview=false&steps=false&alternatives=false';
      const response = await fetch(url, {
        headers: { 'User-Agent': 'YatraBusIndia/1.0 (+https://github.com/sandipmfiles-source/yatrabus-india)' },
        signal: AbortSignal.timeout(20000),
      });
      lastOsrmRequestAt = Date.now();
      const data = await response.json() as any;
      const route = data.routes?.[0];
      if (!response.ok || data.code !== 'Ok' || !route) {
        return res.status(502).json({ error: 'OSRM_ROUTE_FAILED', message: 'OpenStreetMap could not connect every stop in the submitted order. Check the selected stop locations and sequence.' });
      }
      totalDistanceMeters += Number(route.distance) || 0;
      totalDurationSeconds += Number(route.duration) || 0;
    }
    const payload = {
      provider: 'OPENSTREETMAP_OSRM',
      routeStatus: 'ROAD_ROUTE_FOUND_IN_SUBMITTED_ORDER',
      distanceKm: Math.round(totalDistanceMeters / 100) / 10,
      durationSeconds: Math.round(totalDurationSeconds),
      encodedPolyline: null,
      submittedStops: resolved.slice(1, -1).map(point => point.name),
      points: resolved.map(point => ({ name: point.name, latitude: point.latitude, longitude: point.longitude })),
      orderChanged: false,
      disclaimer: 'OpenStreetMap road-network estimate via OSRM. It confirms a drivable road path in the submitted order, not that a public bus operates on it. Timetable and route publication still require Super Admin review.',
      attribution: '© OpenStreetMap contributors · Routing by OSRM',
    };
    if (osrmRouteCache.size > 200) {
      const firstKey = osrmRouteCache.keys().next().value;
      if (firstKey) osrmRouteCache.delete(firstKey);
    }
    osrmRouteCache.set(coordinates, { expiresAt: Date.now() + 10 * 60 * 1000, payload });
    return res.json({ ...payload, cache: 'MISS' });
  } catch {
    return res.status(502).json({ error: 'OSRM_UNAVAILABLE', message: 'The free OpenStreetMap demo routing service is temporarily unavailable. Please try again.' });
  }});
