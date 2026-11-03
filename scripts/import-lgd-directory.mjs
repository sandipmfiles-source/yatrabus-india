import fs from 'node:fs';
import path from 'node:path';
import { gzipSync } from 'node:zlib';

// Build a compact State/district/subdistrict/block/town index from a mirror of official LGD CSV exports.
const inputDir = process.argv[2] || '/tmp/lgd';
const outputFile = process.argv[3] || 'backend/data/india-lgd-directory.json.gz';
const snapshotDate = process.argv[4] || new Date().toISOString().slice(0, 10);

function parseCsv(text) {
  const rows = [];
  let row = [], field = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\n') { row.push(field.replace(/\r$/, '')); if (row.some(v => v.trim())) rows.push(row); row = []; field = ''; }
    else field += ch;
  }
  if (field.length || row.length) { row.push(field.replace(/\r$/, '')); rows.push(row); }
  return rows;
}
function norm(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9]/g, ''); }
function column(headers, candidates) {
  const h = headers.map(norm);
  for (const candidate of candidates) {
    const exact = h.indexOf(norm(candidate));
    if (exact >= 0) return exact;
  }
  for (const candidate of candidates) {
    const wanted = norm(candidate);
    const found = h.findIndex(value => value.includes(wanted));
    if (found >= 0) return found;
  }
  return -1;
}
function readRows(filename) {
  const full = path.join(inputDir, filename);
  if (!fs.existsSync(full)) throw new Error('Missing extracted LGD file: ' + full);
  const rows = parseCsv(fs.readFileSync(full, 'utf8'));
  if (rows.length < 2) throw new Error('Empty LGD CSV: ' + filename);
  return { headers: rows[0], rows: rows.slice(1) };
}
function get(row, index) { return index < 0 ? '' : String(row[index] || '').trim(); }
const places = new Map();
const villageShards = new Map();
let villageRecordCount = 0;
function shardKey(value) {
  const first = String(value || '').normalize('NFKC').trim().toLocaleLowerCase('en-IN').match(/[\p{L}\p{N}]/u)?.[0];
  return first ? 'u' + first.codePointAt(0).toString(16) : '';
}
function add(level, code, name, state, district, subdistrict) {
  name = String(name || '').trim();
  if (!name || !code) return;
  const id = 'lgd-' + level + '-' + String(code).trim();
  if (!places.has(id)) places.set(id, { id, code: String(code).trim(), name, level, state: state || '', district: district || '', subdistrict: subdistrict || '', source: 'LGD' });
}

const villages = readRows('villages.csv');
const vh = villages.headers;
const vi = {
  stateCode: column(vh, ['State Code']), state: column(vh, ['State Name (In English)', 'State Name']),
  districtCode: column(vh, ['District Code']), district: column(vh, ['District Name (In English)', 'District Name']),
  subCode: column(vh, ['Sub-District Code', 'Subdistrict Code']), sub: column(vh, ['Sub-District Name (In English)', 'Sub-District Name', 'Subdistrict Name']),
  villageCode: column(vh, ['Village Code']), village: column(vh, ['Village Name (In Englsih)', 'Village Name (In English)', 'Village Name']),
  localName: column(vh, ['Village Name (In Local Language)', 'Village Name Local', 'Local Language Name', 'Village Name (Local)']),
};
console.log('LGD hierarchy columns validated:', JSON.stringify(vi));
for (const [key, idx] of Object.entries(vi)) if (idx < 0 && key !== 'localName') throw new Error('Village CSV missing required column: ' + key + ' headers=' + vh.join('|'));
const states = new Map(), districts = new Map(), subs = new Map();
for (const row of villages.rows) {
  const stateCode = get(row, vi.stateCode), state = get(row, vi.state);
  const districtCode = get(row, vi.districtCode), district = get(row, vi.district);
  const subCode = get(row, vi.subCode), sub = get(row, vi.sub);
  if (stateCode && state) states.set(stateCode, state);
  if (districtCode && district) districts.set(districtCode, { name: district, state, stateCode });
  if (subCode && sub) subs.set(subCode, { name: sub, state, district, districtCode });

  const villageCode = get(row, vi.villageCode);
  const villageName = get(row, vi.village);
  const localName = get(row, vi.localName);
  if (villageCode && villageName) {
    villageRecordCount++;
    const record = ['lgd-village-' + villageCode, villageCode, villageName, state, district, sub, localName, snapshotDate];
    const keys = [...new Set([shardKey(villageName), shardKey(localName)].filter(Boolean))];
    for (const key of keys) {
      if (!villageShards.has(key)) villageShards.set(key, []);
      villageShards.get(key).push(record);
    }
  }
}
if (states.size > 100 || districts.size > 1000 || subs.size > 10000) throw new Error('LGD CSV delimiter/header parsing produced impossible hierarchy counts: ' + JSON.stringify({ states: states.size, districts: districts.size, subdistricts: subs.size }));
for (const [code, name] of states) add('state', code, name, '', '', '');
for (const [code, item] of districts) add('district', code, item.name, item.state, '', '');
for (const [code, item] of subs) add('subdistrict', code, item.name, item.state, item.district, '');

function importNamedFile(filename, level, nameCandidates, codeCandidates, parentCandidates) {
  const parsed = readRows(filename), h = parsed.headers;
  const ni = column(h, nameCandidates), ci = column(h, codeCandidates);
  const stateI = column(h, ['State Name (In English)', 'State Name']);
  const districtI = column(h, ['District Name (In English)', 'District Name']);
  if (ni < 0 || ci < 0) throw new Error(filename + ' missing name/code headers: ' + h.join('|'));
  for (const row of parsed.rows) add(level, get(row, ci), get(row, ni), get(row, stateI), get(row, districtI), '');
}
importNamedFile('blocks.csv', 'block', ['Block Name (In English)', 'Block Name'], ['Block Code']);
importNamedFile('urban_local_bodies.csv', 'town', ['Local Body Name (In English)', 'Urban Local Body Name', 'Local Body Name'], ['Local Body Code', 'Urban Local Body Code']);

const all = [...places.values()];
const counts = {};
for (const item of all) counts[item.level] = (counts[item.level] || 0) + 1;
const compactPlaces = all.map(item => [item.id, item.code, item.name, item.level, item.state, item.district, item.subdistrict]);
console.log('Prepared LGD records:', all.length, 'counts:', JSON.stringify(counts));
const payload = {
  source: 'Ministry of Panchayati Raj - Local Government Directory',
  sourceUrl: 'https://lgdirectory.gov.in/',
  sourceLicense: 'Government Open Data License - India (GODL-India)',
  snapshotDate,
  importedAt: new Date().toISOString(),
  counts,
  places: compactPlaces,
};
fs.mkdirSync(path.dirname(outputFile), { recursive: true });
fs.writeFileSync(outputFile, gzipSync(Buffer.from(JSON.stringify(payload)), { level: 9 }));

// Keep the complete village roster in first-character shards. The backend loads only
// the matching shard on demand, avoiding a 676k-row scan or loading the whole roster
// into memory for every autocomplete request.
const villageOutputDir = path.join(path.dirname(outputFile), 'lgd-villages');
fs.rmSync(villageOutputDir, { recursive: true, force: true });
fs.mkdirSync(villageOutputDir, { recursive: true });
const shardCounts = {};
for (const [key, rows] of villageShards) {
  const shardPayload = {
    source: payload.source,
    sourceUrl: payload.sourceUrl,
    sourceLicense: payload.sourceLicense,
    snapshotDate,
    level: 'VILLAGE',
    places: rows,
  };
  const shardPath = path.join(villageOutputDir, key + '.json.gz');
  fs.writeFileSync(shardPath, gzipSync(Buffer.from(JSON.stringify(shardPayload)), { level: 9 }));
  shardCounts[key] = rows.length;
}
const villageManifest = {
  source: payload.source,
  sourceUrl: payload.sourceUrl,
  sourceLicense: payload.sourceLicense,
  snapshotDate,
  totalVillages: villageRecordCount,
  shardCount: villageShards.size,
  shardCounts,
  searchStrategy: 'lazy first-Unicode-character shards; English and local-language names',
};
fs.writeFileSync(path.join(villageOutputDir, 'manifest.json'), JSON.stringify(villageManifest, null, 2) + '\n');
console.log(JSON.stringify({
  outputFile,
  bytes: fs.statSync(outputFile).size,
  total: all.length,
  counts,
  villageRecords: villageRecordCount,
  villageShards: villageShards.size,
  villageIndexBytes: fs.readdirSync(villageOutputDir).reduce((sum, name) => sum + fs.statSync(path.join(villageOutputDir, name)).size, 0),
}, null, 2));
