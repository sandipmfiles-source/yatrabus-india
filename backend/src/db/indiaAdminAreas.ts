import type { Place } from '../../../packages/shared/src/types/places.js';
import { INDIA_ADMINISTRATIVE_UNITS } from '../../../packages/shared/src/data/indiaCatalogue.js';

const catalogueDate = '2026-11-03';

const administrativePlaces: Place[] = INDIA_ADMINISTRATIVE_UNITS.flatMap((unit, index) => {
  const statePlace: Place = {
    id: 'india-admin-' + unit.kind.toLowerCase() + '-' + index,
    canonicalName: unit.name,
    names: { en: unit.name },
    placeType: unit.kind === 'STATE' ? 'STATE' : 'STATE',
    state: unit.name,
    sourceDataset: 'INDIA_ADMINISTRATIVE_REFERENCE_CATALOGUE',
    sourceLicense: 'Government public administrative reference; source link retained per record',
    sourceUrl: unit.officialReference,
    sourceVerifiedAt: unit.lastReviewedAt,
    verificationStatus: 'UNVERIFIED',
    aliases: [],
    createdAt: catalogueDate + 'T00:00:00.000Z',
    updatedAt: catalogueDate + 'T00:00:00.000Z',
  };
  const capitalPlace: Place = {
    id: 'india-admin-capital-' + index,
    canonicalName: unit.capital,
    names: { en: unit.capital },
    placeType: 'CITY',
    state: unit.name,
    sourceDataset: 'INDIA_ADMINISTRATIVE_REFERENCE_CATALOGUE',
    sourceLicense: 'Government public administrative reference; source link retained per record',
    sourceUrl: unit.officialReference,
    sourceVerifiedAt: unit.lastReviewedAt,
    verificationStatus: 'UNVERIFIED',
    aliases: unit.aliases,
    createdAt: catalogueDate + 'T00:00:00.000Z',
    updatedAt: catalogueDate + 'T00:00:00.000Z',
  };
  return [statePlace, capitalPlace];
});

/**
 * Pilot town names are searchable but deliberately carry no fabricated coordinates,
 * bus-stop IDs or timetable claims. They are queued for LGD/municipal source reconciliation.
 */
const westBengalPilotTowns: Array<{ name: string; district: string; aliases?: string[] }> = [
  { name: 'Jhargram', district: 'Jhargram', aliases: ['ঝাড়গ্রাম', 'Jhargram Town'] },
  { name: 'Kharagpur', district: 'Paschim Medinipur', aliases: ['খড়গপুর', 'KGP'] },
  { name: 'Midnapore', district: 'Paschim Medinipur', aliases: ['Medinipur', 'মেদিনীপুর'] },
  { name: 'Salboni', district: 'Paschim Medinipur', aliases: ['শালবনি'] },
  { name: 'Debra', district: 'Paschim Medinipur', aliases: ['দেবরা'] },
  { name: 'Panskura', district: 'Purba Medinipur', aliases: ['পাঁশকুড়া'] },
  { name: 'Kolaghat', district: 'Purba Medinipur', aliases: ['কোলাঘাট'] },
  { name: 'Uluberia', district: 'Howrah', aliases: ['উলুবেড়িয়া'] },
  { name: 'Howrah', district: 'Howrah', aliases: ['হাওড়া'] },
  { name: 'Kolkata', district: 'Kolkata', aliases: ['Calcutta', 'কলকাতা'] },
  { name: 'Santragachi', district: 'Howrah', aliases: ['সাঁতরাগাছি'] },
  { name: 'Lodhasuli', district: 'Jhargram', aliases: ['লোধাশুলি'] },
  { name: 'Gopiballavpur', district: 'Jhargram', aliases: ['গোপীবল্লভপুর'] },
  { name: 'Belpahari', district: 'Jhargram', aliases: ['বেলপাহাড়ি'] },
];

const pilotTownPlaces: Place[] = westBengalPilotTowns.map((town, index) => ({
  id: 'wb-pilot-town-' + index,
  canonicalName: town.name,
  names: { en: town.name, bn: town.aliases?.find(alias => /[\u0980-\u09FF]/.test(alias)) },
  placeType: 'TOWN',
  district: town.district,
  state: 'West Bengal',
  sourceDataset: 'YATRIBUS_WEST_BENGAL_PILOT_TOWN_INDEX',
  sourceLicense: 'YatriBus community reference index; reconcile against official LGD before verification',
  verificationStatus: 'UNVERIFIED',
  aliases: town.aliases || [],
  createdAt: catalogueDate + 'T00:00:00.000Z',
  updatedAt: catalogueDate + 'T00:00:00.000Z',
}));

export const INDIA_ADMIN_AREA_PLACES: Place[] = [...administrativePlaces, ...pilotTownPlaces];
