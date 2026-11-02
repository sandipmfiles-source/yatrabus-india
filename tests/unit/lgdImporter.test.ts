import { convertLgdRows } from '../../data/import-scripts/importLgdDirectory.js';

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
}
