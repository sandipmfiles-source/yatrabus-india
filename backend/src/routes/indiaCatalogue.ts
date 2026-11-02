import { Router } from 'express';
import { INDIA_ADMINISTRATIVE_UNITS, INDIA_STATE_COUNT, INDIA_UT_COUNT } from '../../../packages/shared/src/data/indiaCatalogue.js';
import { INDIA_GOVERNMENT_OPERATORS } from '../../../packages/shared/src/data/indiaGovernmentOperators.js';
import { INDIA_ADMIN_AREA_PLACES } from '../db/indiaAdminAreas.js';

export const indiaCatalogueRouter = Router();

indiaCatalogueRouter.get('/', (_req, res) => {
  const states = INDIA_ADMINISTRATIVE_UNITS.filter(unit => unit.kind === 'STATE');
  const unionTerritories = INDIA_ADMINISTRATIVE_UNITS.filter(unit => unit.kind === 'UNION_TERRITORY');
  const pilotTowns = INDIA_ADMIN_AREA_PLACES.filter(place => place.id.startsWith('wb-pilot-town-'));

  res.setHeader('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400');
  return res.json({
    catalogueVersion: '2026-11-03',
    summary: {
      states: INDIA_STATE_COUNT,
      unionTerritories: INDIA_UT_COUNT,
      administrativeUnits: INDIA_ADMINISTRATIVE_UNITS.length,
      governmentOperatorDirectoryEntries: INDIA_GOVERNMENT_OPERATORS.length,
      pilotTownIndexEntries: pilotTowns.length,
    },
    states,
    unionTerritories,
    operators: INDIA_GOVERNMENT_OPERATORS.map(operator => ({
      id: operator.id,
      name: operator.name,
      shortCode: operator.shortCode,
      serviceArea: operator.serviceArea,
      operatorType: operator.operatorType,
      officialWebsite: operator.contactWebsite,
      sourceUrl: operator.sourceUrl,
      sourceDataset: operator.sourceDataset,
      sourceVerifiedAt: operator.sourceVerifiedAt,
      directoryStatus: operator.verificationStatus,
      isClaimed: operator.isClaimed,
    })),
    pilotCorridor: {
      name: 'Jhargram – Kharagpur – Kolkata',
      state: 'West Bengal',
      towns: pilotTowns.map(place => ({
        id: place.id, name: place.canonicalName, district: place.district,
        sourceDataset: place.sourceDataset, verificationStatus: place.verificationStatus,
      })),
      timetableStatus: 'UNAVAILABLE',
      liveGpsStatus: 'UNAVAILABLE',
      officialOperatorReferences: [
        { name: 'West Bengal Transport Corporation', url: 'https://transport.wb.gov.in/' },
        { name: 'South Bengal State Transport Corporation', url: 'https://sbstc.co.in/' },
        { name: 'North Bengal State Transport Corporation', url: 'https://nbstc.in/' },
      ],
      note: 'The corridor is a data-collection pilot, not a verified scheduled bus service. No departure times or live vehicle positions are published until official source records or consented GPS observations are available.',
    },
    statusDefinitions: [
      { code: 'LIVE_GPS', label: 'Live GPS', description: 'Fresh consented location observations within the live freshness window.' },
      { code: 'ESTIMATED', label: 'Estimated', description: 'A modelled ETA or location estimate; not a direct GPS fix.' },
      { code: 'SCHEDULED', label: 'Scheduled', description: 'A published timetable with source and verification metadata.' },
      { code: 'UNAVAILABLE', label: 'Unavailable', description: 'No reliable schedule or location evidence is currently available.' },
    ],
    dataQualityPolicy: [
      'An operator directory entry does not mean the operator has claimed or verified its YatriBus profile.',
      'Administrative units and pilot towns are searchable reference records, not proof of bus service.',
      'Timetable departures require a named source, source URL where available, and verification date.',
      'No guessed frequency, bus number, fare, stop coordinate, or live GPS state is promoted to verified data.',
    ],
  });
});
