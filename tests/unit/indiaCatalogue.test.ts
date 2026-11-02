import { INDIA_ADMINISTRATIVE_UNITS, INDIA_STATE_COUNT, INDIA_UT_COUNT } from '../../packages/shared/src/data/indiaCatalogue.js';
import { INDIA_GOVERNMENT_OPERATORS } from '../../packages/shared/src/data/indiaGovernmentOperators.js';
import { INDIA_ADMIN_AREA_PLACES } from '../../backend/src/db/indiaAdminAreas.js';
import { LGD_INDEX_METADATA } from '../../packages/shared/src/data/lgdSnapshot.js';

export function runIndiaCatalogueTests(assert: (description: string, pass: boolean) => void) {
  const states = INDIA_ADMINISTRATIVE_UNITS.filter(item => item.kind === 'STATE');
  const uts = INDIA_ADMINISTRATIVE_UNITS.filter(item => item.kind === 'UNION_TERRITORY');
  assert('Administrative catalogue contains exactly 28 States', INDIA_STATE_COUNT === 28 && states.length === 28);
  assert('Administrative catalogue contains exactly 8 Union Territories', INDIA_UT_COUNT === 8 && uts.length === 8);
  assert('All 36 administrative unit names are unique', new Set(INDIA_ADMINISTRATIVE_UNITS.map(item => item.name)).size === 36);
  assert('Every administrative unit has a capital and HTTPS government reference', INDIA_ADMINISTRATIVE_UNITS.every(item => !!item.capital && /^https:\/\//.test(item.officialReference)));
  assert('Bundled LGD snapshot exposes its historical date and 14,207 record count', LGD_INDEX_METADATA.snapshotDate === '2022-03-11' && LGD_INDEX_METADATA.totalRecords === 14207);
  assert('Bundled LGD snapshot includes 4,814 urban local bodies', LGD_INDEX_METADATA.urbanLocalBodies === 4814);
  assert('Seasonal and shared capital distinctions are retained', INDIA_ADMINISTRATIVE_UNITS.some(item => item.name === 'Jammu and Kashmir' && item.capitalNote?.includes('winter capital')) &&
    INDIA_ADMINISTRATIVE_UNITS.some(item => item.name === 'Uttarakhand' && item.capitalNote?.includes('summer capital')));

  assert('Government operator catalogue contains multiple independently named undertakings', INDIA_GOVERNMENT_OPERATORS.length >= 25);
  assert('Government operator IDs are unique', new Set(INDIA_GOVERNMENT_OPERATORS.map(item => item.id)).size === INDIA_GOVERNMENT_OPERATORS.length);
  assert('Operator entries are directory candidates, never auto-claimed or auto-verified', INDIA_GOVERNMENT_OPERATORS.every(item =>
    item.verificationStatus === 'COMMUNITY_LISTED' && item.isClaimed === false && !!item.sourceDataset
  ));
  assert('Every operator has a service area and traceable source website when supplied', INDIA_GOVERNMENT_OPERATORS.every(item =>
    !!item.serviceArea && (!item.sourceUrl || /^https:\/\//.test(item.sourceUrl))
  ));

  const pilotTowns = INDIA_ADMIN_AREA_PLACES.filter(item => item.id.startsWith('wb-pilot-town-'));
  assert('West Bengal pilot corridor has a searchable town index', pilotTowns.length >= 12);
  assert('Pilot towns remain unverified and do not invent coordinates', pilotTowns.every(item =>
    item.verificationStatus === 'UNVERIFIED' && item.latitude === undefined && item.longitude === undefined
  ));
  const pilotTerminals = INDIA_ADMIN_AREA_PLACES.filter(item => item.id.startsWith('wb-pilot-terminal-'));
  assert('West Bengal pilot includes source-linked official bus terminal references', pilotTerminals.length >= 12 && pilotTerminals.every(item =>
    item.placeType === 'BUS_TERMINAL' && item.sourceUrl?.includes('transport.wb.gov.in') &&
    item.sourceSnapshotDate === '2017-03-03' && item.verificationStatus === 'UNVERIFIED'
  ));
  assert('Historical terminal records do not invent coordinates', pilotTerminals.every(item => item.latitude === undefined && item.longitude === undefined));
  assert('Every administrative state/UT and capital has source provenance', INDIA_ADMIN_AREA_PLACES
    .filter(item => item.id.startsWith('india-admin-'))
    .every(item => !!item.sourceUrl && !!item.sourceCheckedAt && item.verificationStatus === 'UNVERIFIED'));
}
