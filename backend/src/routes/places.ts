import { Router, Request, Response } from 'express';
import { readFileSync } from 'node:fs';
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
  try {
    const file = new URL('../../data/india-lgd-directory.json.gz', import.meta.url);
    const payload = JSON.parse(gunzipSync(readFileSync(file)).toString('utf8'));
    return Array.isArray(payload?.places) ? payload.places.map((row: any) => Array.isArray(row) ? ({ id: row[0], code: row[1], name: row[2], level: row[3], state: row[4], district: row[5], subdistrict: row[6] }) : row) : [];
  } catch {
    return [];
  }
})();

async function fetchLgdDirectorySuggestions(query: string) {
  const key = query.toLocaleLowerCase('en-IN');
  const cached = lgdSuggestionCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.results;

  const localMatches = lgdCatalogue
    .filter(item => String(item.name || '').toLocaleLowerCase('en-IN').includes(key))
    .sort((a, b) => {
      const aPrefix = String(a.name || '').toLocaleLowerCase('en-IN').startsWith(key) ? 0 : 1;
      const bPrefix = String(b.name || '').toLocaleLowerCase('en-IN').startsWith(key) ? 0 : 1;
      return aPrefix - bPrefix || String(a.name).localeCompare(String(b.name));
    })
    .slice(0, 8)
    .map(item => ({
      id: item.id,
      name: item.name,
      address: [item.level, item.subdistrict, item.district, item.state, 'LGD directory'].filter(Boolean).join(' · '),
      source: 'LOCAL_GOVERNMENT_DIRECTORY',
      level: item.level,
      code: item.code,
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
    return res.status(502).json({ error: 'PLACE_SEARCH_UNAVAILABLE', message: 'OpenStreetMap place search is temporarily unavailable. Use GPS or try again.' });
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
placesRouter.get('/search', publicSearchLimiter, (req: Request, res: Response) => {
  const query = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  const requestedLimit = req.query.limit ? Number.parseInt(String(req.query.limit), 10) : 8;
  const limit = Number.isFinite(requestedLimit) ? Math.max(1, Math.min(12, requestedLimit)) : 8;
  if (query.length < 2) return res.json({ query, count: 0, results: [], sources: { local: 0 } });
  const results = repository.searchPlaces(query, limit);
  return res.json({ query, count: results.length, results, sources: { local: results.length } });
});

// GET /api/places/nearby?lat=28.6675&lon=77.2285&radius=3000
placesRouter.get('/nearby', (req: Request, res: Response) => {
  const latStr = req.query.lat as string;
  const lonStr = req.query.lon as string;
  const radius = req.query.radius ? parseInt(req.query.radius as string, 10) : 3000;

  if (!latStr || !lonStr) {
    return res.status(400).json({ error: 'Missing coordinates: lat and lon required' });
  }

  const lat = parseFloat(latStr);
  const lon = parseFloat(lonStr);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || !Number.isFinite(radius) || radius < 1 || radius > 50000) {
    return res.status(400).json({ error: 'Invalid coordinates or radius' });
  }

  const stops = repository.findNearbyStops(lat, lon, radius);
  return res.json({ count: stops.length, stops });
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
