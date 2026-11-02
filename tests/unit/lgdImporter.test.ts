import { convertLgdRows } from '../../data/import-scripts/importLgdDirectory.js';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

export function runLgdImporterTests(assert: (description: string, pass: boolean) => void) {
  const units = convertLgdRows([
    { statecode: '35', statename: 'ANDAMAN AND NICOBAR ISLANDS', stateorut: 'U' },
    { statecode: '28', statename: 'ANDHRA PRADESH', stateorut: 'S' },
  ], 'STATE', '2026-11-03');
  assert('LGD importer distinguishes Union Territories from States', units.some(item => item.placeType === 'UNION_TERRITORY') && units.some(item => item.placeType === 'STATE'));

  const towns = convertLgdRows([
    { localbodycode: '1234', localbodyname: 'KHARAGPUR MUNICIPALITY', localbodynameinlocal: 'খড়গপুর পৌরসভা', statename: 'WEST BENGAL' },
  ], 'TOWN', '2026-11-03');
  assert('LGD importer preserves urban local-body code and local-language alias', towns[0]?.sourceRecordId === '1234' && towns[0]?.aliases.includes('খড়গপুর পৌরসভা'));
  assert('LGD importer never fabricates coordinates when the source has none', towns[0]?.latitude === undefined && towns[0]?.longitude === undefined);
  assert('LGD imported places retain GODL source metadata and remain unverified', towns[0]?.sourceLicense.includes('GODL-India') === true &&
    towns[0]?.sourceUrl === 'https://lgdirectory.gov.in/' && towns[0]?.verificationStatus === 'UNVERIFIED');

  const indexDirectory = resolve(process.cwd(), 'data/lgd-index');
  const indexFiles = readdirSync(indexDirectory).filter(file => file.endsWith('.json'));
  const indexPayloads = indexFiles.map(file => JSON.parse(readFileSync(resolve(indexDirectory, file), 'utf8')));
  const indexedPlaces = indexPayloads.flatMap(payload => payload.places || []);
  assert('Bundled LGD JSON indexes are present and contain all 14,207 baseline records', indexFiles.length === 4 && indexedPlaces.length === 14207);
  assert('Every bundled LGD record retains a code, level and 2022 snapshot marker', indexedPlaces.every(row =>
    Array.isArray(row) && !!row[0] && !!row[1] && !!row[2] && !!row[3] && row[8] === '2022-03-11'
  ));
}
