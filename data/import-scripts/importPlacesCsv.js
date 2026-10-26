/**
 * Repeatable Places Ingestion Script for Indian Geographical & Census Data
 * Handles CSV/JSON parsing, Unicode normalization, coordinates validation, and deduplication.
 */

import fs from 'fs';
import path from 'path';

export function normalizePlaceName(name) {
  if (!name) return '';
  return name.normalize('NFC').replace(/\s+/g, ' ').trim();
}

export function validateCoordinates(lat, lng) {
  const latitude = parseFloat(lat);
  const longitude = parseFloat(lng);
  if (isNaN(latitude) || isNaN(longitude)) return false;
  // India geographical bounding envelope (approx 6°N - 38°N, 68°E - 98°E)
  return latitude >= 6.0 && latitude <= 38.0 && longitude >= 68.0 && longitude <= 98.0;
}

export function importPlacesFromData(records, existingPlaces = []) {
  const metrics = {
    totalRecords: records.length,
    accepted: 0,
    rejected: 0,
    duplicates: 0,
    errors: []
  };

  const imported = [];
  const existingNames = new Set(existingPlaces.map(p => p.canonicalName.toLowerCase()));

  for (let i = 0; i < records.length; i++) {
    const row = records[i];
    const canonicalName = normalizePlaceName(row.name || row.canonicalName);

    if (!canonicalName || canonicalName.length < 2) {
      metrics.rejected++;
      metrics.errors.push(`Row ${i + 1}: Missing or invalid place name`);
      continue;
    }

    if (!validateCoordinates(row.latitude, row.longitude)) {
      metrics.rejected++;
      metrics.errors.push(`Row ${i + 1} (${canonicalName}): Coordinates (${row.latitude}, ${row.longitude}) outside India bounding box`);
      continue;
    }

    // Deduplication check
    if (existingNames.has(canonicalName.toLowerCase())) {
      metrics.duplicates++;
      continue;
    }

    const place = {
      id: row.id || `plc-imp-${Date.now()}-${i}`,
      canonicalName,
      placeType: row.placeType || 'bus_stop',
      parentPlaceId: row.parentPlaceId || null,
      state: row.state || 'General',
      district: row.district || 'General',
      subdivision: row.subdivision || null,
      latitude: parseFloat(row.latitude),
      longitude: parseFloat(row.longitude),
      sourceDataset: row.sourceDataset || 'Open Census / OSM Extract',
      verificationStatus: 'published_unverified',
      aliases: row.aliases || [],
      lastUpdated: new Date().toISOString()
    };

    existingNames.add(canonicalName.toLowerCase());
    imported.push(place);
    metrics.accepted++;
  }

  return { metrics, imported };
}

// Standalone execution test
if (process.argv[1]?.endsWith('importPlacesCsv.js')) {
  console.log('Running test import of sample Indian place records...');
  const sample = [
    { name: 'Kashmiri Gate', latitude: 28.6675, longitude: 77.2285, state: 'Delhi', district: 'Central Delhi', placeType: 'bus_terminal' },
    { name: 'Invalid Coords Station', latitude: 55.0, longitude: 10.0, state: 'Unknown', district: 'Unknown' }, // Should reject
    { name: 'Dadar Asiad Stand', latitude: 19.0178, longitude: 72.8478, state: 'Maharashtra', district: 'Mumbai City', placeType: 'bus_terminal' }
  ];

  const result = importPlacesFromData(sample, []);
  console.log('Import Metrics:', result.metrics);
  console.log('Imported Records Count:', result.imported.length);
}
