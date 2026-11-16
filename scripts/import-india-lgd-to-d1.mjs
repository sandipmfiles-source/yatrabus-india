#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';

const SOURCE_URL = 'https://lgdirectory.gov.in/';
const SOURCE_NAME = 'Ministry of Panchayati Raj - Local Government Directory';
const SOURCE_LICENSE = 'Government Open Data License - India (GODL-India)';
const LEVELS = new Set(['state', 'district', 'subdistrict', 'block', 'town']);
const MINIMUM_COUNTS = { state: 28, district: 700, subdistrict: 6000, block: 6000, town: 3000 };

function fail(message) {
  console.error('LGD import validation failed: ' + message);
  process.exitCode = 1;
}

function sqlString(value) {
  if (value === null || value === undefined) return 'NULL';
  return "'" + String(value).replace(/'/g, "''") + "'";
}

function normaliseRow(row, snapshotDate) {
  if (!Array.isArray(row) || row.length < 7) throw new Error('Each LGD record must contain at least 7 fields.');
  const [idValue, codeValue, nameValue, levelValue, stateValue, districtValue, subdivisionValue] = row;
  const id = String(idValue || '').trim();
  const code = String(codeValue || '').trim();
  const name = String(nameValue || '').normalize('NFC').replace(/\s+/g, ' ').trim();
  const level = String(levelValue || '').trim().toLowerCase();
  if (!id || !code || !name || !LEVELS.has(level)) throw new Error('Invalid LGD row: ' + JSON.stringify(row));
  if (!id.startsWith('lgd-' + level + '-')) throw new Error('Unexpected LGD identifier for ' + level + ': ' + id);

  const state = String(stateValue || (level === 'state' ? name : '')).trim() || 'India';
  const district = String(districtValue || (level === 'district' ? name : '') || (level === 'state' ? name : '')).trim() || state;
  const subdivision = String(subdivisionValue || '').trim() || null;
  const payload = {
    id,
    canonicalName: name,
    placeType: level,
    state,
    district,
    subdivision,
    sourceDataset: 'INDIA_LGD',
    sourceRecordId: code,
    sourceUrl: SOURCE_URL,
    sourceLicense: SOURCE_LICENSE,
    sourceSnapshotDate: snapshotDate,
    verificationStatus: 'published_unverified',
    busServiceVerified: false,
    aliases: []
  };
  return {
    id,
    canonical_name: name,
    place_type: level.toUpperCase(),
    state,
    district,
    subdivision,
    source_dataset: 'INDIA_LGD',
    verification_status: 'published_unverified',
    last_updated: snapshotDate,
    aliases_json: '[]',
    payload_json: JSON.stringify(payload)
  };
}

function validateSnapshot(snapshot) {
  if (!snapshot || snapshot.source !== SOURCE_NAME) throw new Error('Unexpected source name.');
  if (snapshot.sourceUrl !== SOURCE_URL) throw new Error('Unexpected source URL.');
  if (snapshot.sourceLicense !== SOURCE_LICENSE) throw new Error('Unexpected source license.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(snapshot.snapshotDate || '') || Number.isNaN(Date.parse(snapshot.snapshotDate))) {
    throw new Error('Snapshot date is missing or invalid.');
  }
  if (!Array.isArray(snapshot.places)) throw new Error('Snapshot places must be an array.');
  if (snapshot.places.length < 15000) throw new Error('Snapshot is unexpectedly small: ' + snapshot.places.length);
  const counts = {};
  const ids = new Set();
  const rows = snapshot.places.map((row) => {
    const item = normaliseRow(row, snapshot.snapshotDate);
    if (ids.has(item.id)) throw new Error('Duplicate LGD ID: ' + item.id);
    ids.add(item.id);
    const level = item.place_type.toLowerCase();
    counts[level] = (counts[level] || 0) + 1;
    return item;
  });
  for (const [level, minimum] of Object.entries(MINIMUM_COUNTS)) {
    if ((counts[level] || 0) < minimum) {
      throw new Error('Incomplete ' + level + ' catalogue: found ' + (counts[level] || 0) + ', expected at least ' + minimum);
    }
  }
  for (const [level, count] of Object.entries(counts)) {
    if (Number(snapshot.counts?.[level]) !== count) {
      throw new Error('Snapshot manifest count mismatch for ' + level + ': manifest=' + snapshot.counts?.[level] + ', actual=' + count);
    }
  }
  return { rows, counts };
}

function buildSql(row) {
  const columns = [
    row.id, row.canonical_name, row.place_type, row.state, row.district,
    row.subdivision, row.source_dataset, row.verification_status,
    row.last_updated, row.aliases_json, row.payload_json
  ];
  return '(' + columns.map(sqlString).join(', ') + ')';
}

function writeBatches(rows, outputDir) {
  fs.mkdirSync(outputDir, { recursive: true });
  const rowsPerStatement = 100;
  const statementsPerFile = 25;
  const statements = [];
  for (let i = 0; i < rows.length; i += rowsPerStatement) {
    const group = rows.slice(i, i + rowsPerStatement);
    statements.push(
      'INSERT INTO places (id, canonical_name, place_type, state, district, subdivision, source_dataset, verification_status, last_updated, aliases_json, payload_json) VALUES\n' +
      group.map(buildSql).join(',\n') +
      '\nON CONFLICT(id) DO NOTHING;'
    );
  }
  const files = [];
  for (let i = 0; i < statements.length; i += statementsPerFile) {
    const name = 'lgd-' + String(files.length + 1).padStart(3, '0') + '.sql';
    fs.writeFileSync(path.join(outputDir, name), statements.slice(i, i + statementsPerFile).join('\n\n') + '\n');
    files.push(name);
  }
  return files;
}

function selfTest() {
  const row = normaliseRow(['lgd-district-123', '123', 'Jhargram', 'district', 'West Bengal', 'Jhargram', ''], '2026-11-03');
  if (row.place_type !== 'DISTRICT' || row.state !== 'West Bengal' || !row.payload_json.includes('"busServiceVerified":false')) {
    throw new Error('Self-test failed to preserve India LGD metadata and unverified bus status.');
  }
  if (!buildSql(row).includes("'lgd-district-123'")) throw new Error('Self-test SQL generation failed.');
  if (!sqlString("O'Brien").includes("O''Brien")) throw new Error('Self-test SQL escaping failed.');
  console.log('LGD D1 importer self-test passed.');
}

if (process.argv.includes('--self-test')) {
  selfTest();
} else {
  const inputIndex = process.argv.indexOf('--input');
  const outputIndex = process.argv.indexOf('--output-dir');
  if (inputIndex < 0 || outputIndex < 0) {
    console.error('Usage: node scripts/import-india-lgd-to-d1.mjs --input <snapshot.json.gz> --output-dir <directory>');
    process.exit(2);
  }
  try {
    const inputPath = process.argv[inputIndex + 1];
    const outputDir = process.argv[outputIndex + 1];
    const compressed = fs.readFileSync(inputPath);
    const sha256 = createHash('sha256').update(compressed).digest('hex');
    const snapshot = JSON.parse(gunzipSync(compressed).toString('utf8'));
    const { rows, counts } = validateSnapshot(snapshot);
    const files = writeBatches(rows, outputDir);
    const manifest = {
      source: SOURCE_NAME,
      sourceUrl: SOURCE_URL,
      sourceLicense: SOURCE_LICENSE,
      snapshotDate: snapshot.snapshotDate,
      importedAt: new Date().toISOString(),
      sourceSha256: sha256,
      totalRecords: rows.length,
      counts,
      sqlFiles: files,
      policy: 'LGD administrative names are not proof of bus service, a bus stop, route, or timetable. Existing rows are never overwritten.'
    };
    fs.writeFileSync(path.join(outputDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
    console.log(JSON.stringify(manifest, null, 2));
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error));
  }
}
