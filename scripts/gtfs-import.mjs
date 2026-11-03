#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const ROOT = process.cwd();
const REGISTRY = path.join(ROOT, 'data/gtfs/sources.json');
const OUT = path.resolve(process.env.GTFS_OUTPUT_DIR || 'artifacts/gtfs');
const MAX_DOWNLOAD = 100 * 1024 * 1024;
const MAX_UNPACKED = 500 * 1024 * 1024;
const REQUIRED = ['agency.txt', 'stops.txt', 'routes.txt', 'trips.txt', 'stop_times.txt'];

function csv(text) {
  const rows = [];
  let row = [], cell = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"' && cell.length === 0) quoted = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n') { row.push(cell.replace(/\r$/, '')); rows.push(row); row = []; cell = ''; }
    else cell += c;
  }
  if (cell.length || row.length) { row.push(cell.replace(/\r$/, '')); rows.push(row); }
  if (!rows.length) return [];
  const headers = rows.shift().map((v, i) => (i === 0 ? v.replace(/^\uFEFF/, '') : v).trim());
  return rows.filter(r => r.some(v => v !== '')).map(r => Object.fromEntries(headers.map((h, i) => [h, r[i] ?? ''])));
}
const asNumber = v => v === '' || v == null ? null : Number.isFinite(Number(v)) ? Number(v) : null;
const pick = (row, keys) => Object.fromEntries(keys.filter(k => row[k] !== undefined).map(k => [k, row[k]]));
async function main() {
  const registry = JSON.parse(await readFile(REGISTRY, 'utf8'));
  const enabled = registry.feeds.filter(f => f.status === 'enabled');
  await mkdir(OUT, { recursive: true });
  const results = [];
  for (const feed of enabled) {
    const work = await mkdtemp(path.join(tmpdir(), 'yatribus-gtfs-'));
    try {
      const zip = path.join(work, 'feed.zip');
      const response = await fetch(feed.url, { redirect: 'follow', signal: AbortSignal.timeout(90000), headers: { 'user-agent': 'YatraBus-India-GTFS-Importer/1.0' } });
      if (!response.ok) throw new Error('HTTP ' + response.status);
      const declared = Number(response.headers.get('content-length') || 0);
      if (declared > MAX_DOWNLOAD) throw new Error('Feed exceeds 100 MB download limit');
      const bytes = Buffer.from(await response.arrayBuffer());
      if (bytes.length > MAX_DOWNLOAD) throw new Error('Feed exceeds 100 MB download limit');
      await writeFile(zip, bytes);
      await execFileAsync('unzip', ['-q', '-o', zip, '-d', path.join(work, 'unpacked')], { timeout: 120000 });
      const unpacked = path.join(work, 'unpacked');
      const files = await readdir(unpacked, { recursive: true });
      const total = (await Promise.all(files.map(async f => { try { return (await stat(path.join(unpacked, f))).size; } catch { return 0; } }))).reduce((a,b)=>a+b,0);
      if (total > MAX_UNPACKED) throw new Error('Unpacked feed exceeds 500 MB limit');
      const locate = async name => {
        const found = files.find(f => path.basename(f) === name);
        if (!found) throw new Error('Missing required GTFS file: ' + name);
        return csv(await readFile(path.join(unpacked, found), 'utf8'));
      };
      const [agency, stops, routes, trips, stopTimes] = await Promise.all(REQUIRED.map(locate));
      const optional = async name => { const found = files.find(f => path.basename(f) === name); return found ? csv(await readFile(path.join(unpacked, found), 'utf8')) : []; };
      const [calendar, calendarDates, frequencies, transfers, shapes] = await Promise.all(['calendar.txt','calendar_dates.txt','frequencies.txt','transfers.txt','shapes.txt'].map(optional));
      const stopIds = new Set(stops.map(s => s.stop_id).filter(Boolean));
      const routeIds = new Set(routes.map(r => r.route_id).filter(Boolean));
      const tripIds = new Set(trips.map(t => t.trip_id).filter(Boolean));
      const unknownStopRefs = stopTimes.filter(s => !stopIds.has(s.stop_id)).length;
      const unknownTripRefs = stopTimes.filter(s => !tripIds.has(s.trip_id)).length;
      const unknownRouteRefs = trips.filter(t => !routeIds.has(t.route_id)).length;
      if (!agency.length || !stops.length || !routes.length || !trips.length || !stopTimes.length) throw new Error('Required GTFS tables are empty');
      if (unknownStopRefs || unknownTripRefs || unknownRouteRefs) throw new Error('Referential integrity failure: stop=' + unknownStopRefs + ', trip=' + unknownTripRefs + ', route=' + unknownRouteRefs);
      const normalized = {
        schemaVersion: 1,
        feed: { id: feed.id, name: feed.name, region: feed.region, mode: feed.mode, official: feed.official, sourcePage: feed.sourcePage, licenseUrl: feed.licenseUrl, catalogUrl: feed.catalogUrl, importedAt: new Date().toISOString(), sha256: createHash('sha256').update(bytes).digest('hex'), bytes: bytes.length },
        agency: agency.map(a => pick(a, ['agency_id','agency_name','agency_url','agency_timezone','agency_lang','agency_phone'])),
        routes: routes.map(r => pick(r, ['route_id','agency_id','route_short_name','route_long_name','route_desc','route_type','route_url','route_color','route_text_color'])),
        stops: stops.map(s => ({...pick(s, ['stop_id','stop_code','stop_name','stop_desc','stop_url','location_type','parent_station','wheelchair_boarding']), ...Object.fromEntries(['stop_lat','stop_lon'].filter(k => s[k] !== '').map(k => [k, asNumber(s[k])]))})),
        trips: trips.map(t => pick(t, ['route_id','service_id','trip_id','trip_headsign','trip_short_name','direction_id','block_id','shape_id','wheelchair_accessible','bikes_allowed'])),
        stopTimes: stopTimes.map(s => ({...pick(s, ['trip_id','arrival_time','departure_time','stop_id','stop_headsign','pickup_type','drop_off_type','timepoint']), stop_sequence: asNumber(s.stop_sequence)})),
        calendar: calendar.map(c => ({...pick(c, ['service_id','monday','tuesday','wednesday','thursday','friday','saturday','sunday','start_date','end_date'])})),
        calendarDates: calendarDates.map(c => pick(c, ['service_id','date','exception_type'])),
        frequencies: frequencies.map(f => ({...pick(f, ['trip_id','start_time','end_time','exact_times']), headway_secs: asNumber(f.headway_secs)})),
        transfers: transfers.map(t => pick(t, ['from_stop_id','to_stop_id','from_route_id','to_route_id','from_trip_id','to_trip_id','transfer_type','min_transfer_time'])),
        shapes: shapes.length ? { pointCount: shapes.length } : null,
        counts: { agencies: agency.length, routes: routes.length, stops: stops.length, trips: trips.length, stopTimes: stopTimes.length, calendar: calendar.length, calendarDates: calendarDates.length, frequencies: frequencies.length, transfers: transfers.length, shapePoints: shapes.length }
      };
      const outFile = path.join(OUT, feed.id + '.json');
      await writeFile(outFile, JSON.stringify(normalized));
      results.push({ id: feed.id, status: 'imported', counts: normalized.counts, sha256: normalized.feed.sha256, output: path.basename(outFile) });
      console.log('IMPORTED ' + feed.id + ': ' + JSON.stringify(normalized.counts));
    } catch (error) {
      results.push({ id: feed.id, status: 'failed', error: String(error.message || error) });
      console.error('FAILED ' + feed.id + ': ' + String(error.message || error));
    } finally { await rm(work, { recursive: true, force: true }); }
  }
  const report = { generatedAt: new Date().toISOString(), policy: 'Only enabled feeds are downloaded. Public availability is not treated as a redistribution licence.', results };
  await writeFile(path.join(OUT, 'import-report.json'), JSON.stringify(report, null, 2));
  if (results.some(r => r.status === 'failed')) process.exitCode = 1;
}
main().catch(error => { console.error(error); process.exit(1); });
