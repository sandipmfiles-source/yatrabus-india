import { Router } from 'express';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildPublicGtfsCatalogue } from '../engine/gtfsCatalogue.js';

export const timetableRouter = Router();

// GET /api/timetable/feeds — source/provenance catalogue for the published static GTFS snapshot.
timetableRouter.get('/feeds', (_req, res) => {
  try {
    const registryPath = resolve(process.cwd(), 'data/gtfs/sources.json');
    const registry = JSON.parse(readFileSync(registryPath, 'utf8'));
    const catalogue = buildPublicGtfsCatalogue(registry);
    res.setHeader('Cache-Control', 'public, max-age=300, stale-while-revalidate=1800');
    res.setHeader('X-Timetable-Data-Type', 'GTFS-STATIC');
    return res.json(catalogue);
  } catch {
    return res.status(503).json({
      error: 'The public timetable source catalogue is temporarily unavailable.',
      timetableStatus: 'UNAVAILABLE',
      liveVehiclePositionsAvailable: false,
    });
  }
});
