import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, basename, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { gzipSync } from 'node:zlib';

type Row = Record<string, string>;
type LgdLevel = 'STATE' | 'UNION_TERRITORY' | 'DISTRICT' | 'TEHSIL' | 'BLOCK' | 'CITY' | 'TOWN' | 'VILLAGE';

function parseCsv(source: string): Row[] {
  const rows: string[][] = [];
  let row: string[] = [], field = '', quoted = false;
  for (let i = 0; i < source.length; i++) {
    const char = source[i];
    if (quoted) {
      if (char === '"' && source[i + 1] === '"') { field += '"'; i++; }
      else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"' && field.length === 0) quoted = true;
    else if (char === ',') { row.push(field); field = ''; }
    else if (char === '\n' || char === '\r') {
      if (char === '\r' && source[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.some(value => value.trim())) rows.push(row);
      row = [];
    } else field += char;
  }
  if (quoted) throw new Error('CSV has an unterminated quoted field.');
  if (field.length || row.length) { row.push(field); if (row.some(value => value.trim())) rows.push(row); }
  if (!rows.length) return [];
  const headers = rows[0].map(value => key(value));
  if (headers.some(value => !value)) throw new Error('CSV has an empty column heading.');
  return rows.slice(1).map(values => Object.fromEntries(headers.map((header, index) => [header, (values[index] || '').trim()])));
}

function key(value: string): string {
  return value.toLocaleLowerCase('en-IN').replace(/[^a-z0-9]/g, '');
}
function value(row: Row, ...names: string[]): string {
  for (const name of names) {
    const found = row[key(name)];
    if (found) return found.trim();
  }
  return '';
}
function levelForFile(file: string): LgdLevel | undefined {
  const name = basename(file).toLowerCase().replace(/[^a-z]/g, '');
  if (name.includes('state')) return 'STATE';
  if (name.includes('district')) return 'DISTRICT';
  if (name.includes('subdistrict') || name.includes('tehsil') || name.includes('taluka')) return 'TEHSIL';
  if (name.includes('block')) return 'BLOCK';
  if (name.includes('urban') || name.includes('municipal') || name.includes('town')) return 'TOWN';
  if (name.includes('village')) return 'VILLAGE';
  return undefined;
}
function recordId(level: LgdLevel, code: string): string {
  return 'lgd-' + level.toLowerCase() + '-' + code.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 90);
}

export function convertLgdRows(rows: Row[], level: LgdLevel, snapshotDate: string) {
  const places: any[] = [];
  for (const row of rows) {
    const code = value(row, 'lgdCode', 'villageCode', 'districtCode', 'subDistrictCode', 'blockCode', 'localBodyCode', 'stateCode', 'code', 'id');
    const name = value(row, 'nameEnglish', 'stateNameEnglish', 'districtNameEnglish', 'subDistrictNameEnglish', 'villageNameEnglish', 'localBodyNameEnglish', 'name', 'villageName', 'districtName', 'subDistrictName', 'localBodyName', 'stateName');
    if (!code || !name) continue;
    const state = value(row, 'stateNameEnglish', 'stateName', 'state');
    const district = value(row, 'districtNameEnglish', 'districtName', 'district');
    const subdistrict = value(row, 'subDistrictNameEnglish', 'subdistrictName', 'subDistrictName', 'tehsilName');
    const localName = value(row, 'nameLocal', 'localLanguageName', 'villageNameLocal', 'districtNameLocal', 'localBodyNameInLocal', 'stateNameLocal', 'subDistrictNameLocal');
    const latitude = Number(value(row, 'latitude', 'lat'));
    const longitude = Number(value(row, 'longitude', 'lon', 'lng'));
    const type: LgdLevel = level === 'STATE' && value(row, 'stateOrUT') === 'U'
      ? 'UNION_TERRITORY'
      : level === 'TOWN' && /village|gram/i.test(value(row, 'localBodyType', 'category')) ? 'VILLAGE' : level;
    places.push({
      id: recordId(type, code),
      canonicalName: name,
      names: { en: name },
      placeType: type,
      ...(state ? { state } : {}),
      ...(district ? { district } : {}),
      ...(subdistrict ? { subdistrict } : {}),
      level: type,
      ...(Number.isFinite(latitude) && latitude >= 6 && latitude <= 38 ? { latitude } : {}),
      ...(Number.isFinite(longitude) && longitude >= 68 && longitude <= 98 ? { longitude } : {}),
      sourceDataset: 'INDIA_LOCAL_GOVERNMENT_DIRECTORY',
      sourceRecordId: code,
      sourceUrl: 'https://lgdirectory.gov.in/',
      sourceLicense: 'Government Open Data License - India (GODL-India)',
      sourceSnapshotDate: snapshotDate,
      verificationStatus: 'UNVERIFIED',
      aliases: localName && localName !== name ? [localName] : [],
      createdAt: snapshotDate + 'T00:00:00.000Z',
      updatedAt: snapshotDate + 'T00:00:00.000Z',
    });
  }
  return places;
}

/**
 * Convert a human-downloaded LGD export folder into the compact gzip catalogue used by
 * backend/src/routes/places.ts. By default this indexes administrative units and towns;
 * the 676k+ village roster is deliberately excluded from the runtime autocomplete file.
 */
export function buildLgdCatalogue(inputDirectory: string, outputFile: string, snapshotDate = new Date().toISOString().slice(0, 10)) {
  const files = readdirSync(inputDirectory).filter(file => file.toLowerCase().endsWith('.csv'));
  const places = new Map<string, any>();
  const counts: Record<string, number> = {};
  for (const file of files) {
    const level = levelForFile(file);
    if (!level || level === 'VILLAGE') continue;
    const rows = parseCsv(readFileSync(resolve(inputDirectory, file), 'utf8'));
    const converted = convertLgdRows(rows, level, snapshotDate);
    counts[level] = (counts[level] || 0) + converted.length;
    for (const place of converted) places.set(place.id, place);
  }
  if (!places.size) throw new Error('No LGD administrative/town records found. Expected states, districts, subdistricts, blocks or urban-local-body CSV exports.');
  const payload = {
    source: 'Ministry of Panchayati Raj — Local Government Directory',
    sourceUrl: 'https://lgdirectory.gov.in/',
    license: 'Government Open Data License - India (GODL-India)',
    snapshotDate,
    counts,
    places: Array.from(places.values()),
  };
  mkdirSync(dirname(outputFile), { recursive: true });
  writeFileSync(outputFile, gzipSync(Buffer.from(JSON.stringify(payload))));
  return { outputFile, counts, total: places.size, snapshotDate };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const input = resolve(process.argv[2] || 'data/lgd-source');
  const output = resolve(process.argv[3] || 'data/india-lgd-directory.json.gz');
  const snapshot = process.argv[4] || new Date().toISOString().slice(0, 10);
  if (!existsSync(input)) throw new Error('LGD input directory not found: ' + input);
  const result = buildLgdCatalogue(input, output, snapshot);
  console.log(JSON.stringify(result, null, 2));
}
