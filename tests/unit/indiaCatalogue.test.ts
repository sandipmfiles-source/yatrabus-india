import { readFileSync } from 'node:fs';
import { boundedInt } from '../../functions/_lib/api.js';
import { INDIA_ADMINISTRATIVE_UNITS, INDIA_STATE_COUNT, INDIA_UT_COUNT } from '../../packages/shared/src/data/indiaCatalogue.js';
import { INDIA_GOVERNMENT_OPERATORS } from '../../packages/shared/src/data/indiaGovernmentOperators.js';
import { INDIA_ADMIN_AREA_PLACES } from '../../backend/src/db/indiaAdminAreas.js';

export function runIndiaCatalogueTests(assert: (description: string, pass: boolean) => void) {
  const states = INDIA_ADMINISTRATIVE_UNITS.filter(item => item.kind === 'STATE');
  const uts = INDIA_ADMINISTRATIVE_UNITS.filter(item => item.kind === 'UNION_TERRITORY');
  assert('Administrative catalogue contains exactly 28 States', INDIA_STATE_COUNT === 28 && states.length === 28);
  assert('Administrative catalogue contains exactly 8 Union Territories', INDIA_UT_COUNT === 8 && uts.length === 8);
  assert('All 36 administrative unit names are unique', new Set(INDIA_ADMINISTRATIVE_UNITS.map(item => item.name)).size === 36);
  assert('Every administrative unit has a capital and HTTPS government reference', INDIA_ADMINISTRATIVE_UNITS.every(item => !!item.capital && /^https:\/\//.test(item.officialReference)));
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
  assert('West Bengal pilot includes 15 historical bus-terminal references', pilotTerminals.length === 15);
  assert('Historical terminals remain unverified and retain the 2017 source snapshot', pilotTerminals.every(item =>
    item.placeType === 'BUS_TERMINAL' && item.verificationStatus === 'UNVERIFIED' && item.sourceSnapshotDate === '2017-03-03' && item.latitude === undefined && item.longitude === undefined
  ));
  assert('Every administrative state/UT and capital has source provenance', INDIA_ADMIN_AREA_PLACES
    .filter(item => item.id.startsWith('india-admin-'))
    .every(item => !!item.sourceUrl && !!item.sourceSnapshotDate && item.verificationStatus === 'UNVERIFIED'));

  const osmSeed = JSON.parse(readFileSync('data/osm-west-bengal-bus-stops.json', 'utf8')) as {
    license: string;
    attribution: string;
    records: Array<{ id: string; sourceUrl: string; sourcePage: string; sourceLicense: string; placeType: string; busServiceVerified: boolean; operationalStatus: string }>;
  };
  const osmMigration = readFileSync('migrations/0007_osm_west_bengal_bus_stops.sql', 'utf8');
  const nearbyEndpoint = readFileSync('functions/api/v1/places/nearby.ts', 'utf8');
  assert('West Bengal OSM stop seed has stable records and ODbL attribution', osmSeed.records.length >= 9 &&
    osmSeed.license === 'ODbL-1.0' && osmSeed.attribution.includes('OpenStreetMap contributors'));
  assert('Every OSM seed record retains an OSM object URL and source page', osmSeed.records.every(item =>
    /^https:\/\/www\.openstreetmap\.org\/(node|way)\//.test(item.sourceUrl) &&
    /^https:\/\/mapcarta\.com\//.test(item.sourcePage) && item.sourceLicense === 'ODbL-1.0'
  ));
  assert('OSM mapped bus locations are not falsely marked as verified services', osmSeed.records.every(item =>
    item.busServiceVerified === false && item.operationalStatus === 'UNKNOWN'
  ));
  assert('Jhargram and Midnapore bus stands are included in the mapped West Bengal seed', ['osm-way-394768163', 'osm-way-216241119'].every(id =>
    osmSeed.records.some(item => item.id === id)
  ));
  assert('Every OSM source record is present in the idempotent D1 migration', osmSeed.records.every(item =>
    osmMigration.includes(item.id)
  ));
  assert('Nearby stop lookup matches imported place types case-insensitively', /LOWER\(place_type\) IN/.test(nearbyEndpoint));
  assert('Nearby stop endpoint never labels mapped directory records as timetable-verified', /timetableVerified:\s*false/.test(nearbyEndpoint));
  assert('Nearby endpoint skips slow Overpass requests when D1 already has mapped stops', /if \(directoryStops\.length === 0\)/.test(nearbyEndpoint) && /osmQueried/.test(nearbyEndpoint));
  const androidGradle = readFileSync('android/app/build.gradle', 'utf8');
  const androidVersionCode = Number(androidGradle.match(/versionCode\s+(\d+)/)?.[1] || 0);
  const androidVersionName = androidGradle.match(/versionName\s+"([^"]+)"/)?.[1] || '';
  assert('Android update increments versionCode and keeps a valid semantic versionName', androidVersionCode > 2 &&
    /^\d+\.\d+\.\d+$/.test(androidVersionName));
  const androidWorkflow = readFileSync('.github/workflows/android-apk.yml', 'utf8');
  assert('Android debug APK uses a generated cached stable signing keystore', /path:\\s*android\\/debug\\.keystore/.test(androidWorkflow) &&
    /keytool -genkeypair/.test(androidWorkflow) && /signingConfig signingConfigs\\.debugStable/.test(androidGradle) &&
    /debug\\.keystore/.test(readFileSync('android/.gitignore', 'utf8')));
  assert('Missing or blank API limit query parameters use the documented fallback', boundedInt(null, 10, 1, 50) === 10 &&
    boundedInt('', 10, 1, 50) === 10 && boundedInt('invalid', 10, 1, 50) === 10 &&
    boundedInt('3', 10, 1, 50) === 3 && boundedInt('0', 10, 1, 50) === 1 &&
    boundedInt('99', 10, 1, 50) === 50);
}
