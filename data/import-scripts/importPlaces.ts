/**
 * YatriBus Place Dataset Ingestion Script
 * Ingests Census, OSM, or State Transport place extracts into the database.
 * Normalizes names, deduplicates, and preserves source licensing and attribution.
 */

import { Place, IndianState, PlaceType } from '../../packages/shared/src/types/places.js';
import { normalizePlaceName } from '../../packages/shared/src/search/normalizer.js';
import { checkDuplicateStop } from '../../packages/shared/src/engine/duplicateDetector.js';

export interface RawPlaceImportRecord {
  name: string;
  hindiName?: string;
  bengaliName?: string;
  type: string;
  district?: string;
  state: string;
  lat?: number;
  lon?: number;
  aliases?: string[];
  sourceRecordId?: string;
}

export interface ImportOptions {
  sourceDataset: string;
  sourceLicense: string;
  sourceUrl?: string;
}

export function parseAndIngestPlaces(
  records: RawPlaceImportRecord[],
  options: ImportOptions,
  existingPlaces: Place[] = []
): {
  accepted: Place[];
  duplicatesDetected: number;
  skipped: number;
} {
  const accepted: Place[] = [];
  let duplicatesDetected = 0;
  let skipped = 0;

  for (const raw of records) {
    if (!raw.name || !raw.state) {
      skipped++;
      continue;
    }

    const normName = normalizePlaceName(raw.name);
    const lat = raw.lat;
    const lon = raw.lon;

    // Check duplicate against existing places if lat/lon available
    let isDup = false;
    if (lat !== undefined && lon !== undefined) {
      for (const ex of existingPlaces) {
        if (ex.latitude !== undefined && ex.longitude !== undefined) {
          const dupRes = checkDuplicateStop(
            { name: raw.name, latitude: lat, longitude: lon },
            { name: ex.canonicalName, latitude: ex.latitude, longitude: ex.longitude }
          );
          if (dupRes.isLikelyDuplicate) {
            duplicatesDetected++;
            isDup = true;
            break;
          }
        }
      }
    }

    if (isDup) {
      continue;
    }

    const id = `place-${options.sourceDataset.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    const place: Place = {
      id,
      canonicalName: raw.name.trim(),
      names: {
        en: raw.name.trim(),
        hi: raw.hindiName?.trim(),
        bn: raw.bengaliName?.trim(),
      },
      placeType: (raw.type?.toUpperCase() as PlaceType) || 'BUS_STOP',
      district: raw.district?.trim(),
      state: raw.state as IndianState,
      latitude: lat,
      longitude: lon,
      sourceDataset: options.sourceDataset,
      sourceRecordId: raw.sourceRecordId,
      sourceLicense: options.sourceLicense,
      verificationStatus: 'UNVERIFIED',
      aliases: raw.aliases || [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    accepted.push(place);
    existingPlaces.push(place);
  }

  return { accepted, duplicatesDetected, skipped };
}
