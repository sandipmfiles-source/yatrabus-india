import type { Place } from '../types/places.js';
import directory from '../../../../data/west-bengal-bus-directory.json';

/**
 * Searchable West Bengal terminal candidates from the public 2017 directory.
 * This is a location index only: no current service, timetable or coordinates
 * are implied. Proposed-only records are deliberately excluded.
 */
export const WEST_BENGAL_DIRECTORY_PLACES: Place[] = directory.terminals
  .filter(terminal => terminal.listingStatus !== 'PROPOSED_IN_SOURCE')
  .map(terminal => ({
    id: 'wb-directory-terminal-' + terminal.id.toLowerCase(),
    canonicalName: terminal.name,
    names: { en: terminal.name, bn: terminal.nameLocal || undefined },
    placeType: 'BUS_TERMINAL',
    district: terminal.district,
    state: 'West Bengal',
    sourceDataset: 'WEST_BENGAL_TRANSPORT_DEPARTMENT_BUS_TERMINALS',
    sourceRecordId: terminal.id,
    sourceLicense: 'Public government directory reference; source reuse terms require review',
    sourceUrl: 'https://transport.wb.gov.in/infrastructure/bus-depots-terminals/',
    sourceSnapshotDate: '2017-03-03',
    verificationStatus: 'UNVERIFIED',
    aliases: terminal.aliases || [],
    createdAt: '2026-11-16T00:00:00.000Z',
    updatedAt: '2026-11-16T00:00:00.000Z',
  }));
