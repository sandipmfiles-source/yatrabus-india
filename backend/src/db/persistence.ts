import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { repository } from './repository.js';
import { SEED_PLACES, SEED_OPERATORS, SEED_ROUTES, SEED_BUSES } from './seedData.js';
import { INDIA_ADMIN_AREA_PLACES } from './indiaAdminAreas.js';

const dataPath = resolve(process.env.YATRIBUS_DATA_FILE || './data/yatribus-state.json');
let persistenceReady = false;
let writing = false;
let installed = false;

function persistSnapshot(): void {
  if (writing) return;
  writing = true;
  try {
    mkdirSync(dirname(dataPath), { recursive: true });
    const temporaryPath = `${dataPath}.tmp`;
    writeFileSync(temporaryPath, JSON.stringify(repository.exportState()), { encoding: 'utf8', mode: 0o600 });
    renameSync(temporaryPath, dataPath);
    persistenceReady = true;
  } catch (error) {
    persistenceReady = false;
    console.error('YatraBus durable file persistence failed:', error);
  } finally {
    writing = false;
  }
}

export function installRepositoryPersistence(): void {
  if (installed) return;
  installed = true;
  if (existsSync(dataPath)) {
    try {
      const snapshot = JSON.parse(readFileSync(dataPath, 'utf8')) as Record<string, unknown>;
      repository.importState(snapshot);
      persistenceReady = true;
    } catch (error) {
      console.error('YatraBus state file could not be restored; seed data will be used:', error);
    }
  }

  // Merge newly shipped catalogue records into older persistent snapshots without overwriting operator edits.
  for (const place of [...INDIA_ADMIN_AREA_PLACES, ...SEED_PLACES]) {
    if (!repository.getPlaceById(place.id)) repository.addPlace(place);
  }
  for (const operator of SEED_OPERATORS) {
    if (!repository.getOperatorByName(operator.name)) repository.addOperator(operator);
  }
  for (const route of SEED_ROUTES) {
    if (!repository.getRouteById(route.id)) repository.addRoute(route);
  }
  for (const seedBus of SEED_BUSES) {
    const existing = repository.getBusById(seedBus.id);
    if (!existing) repository.addBus(seedBus);
    else if (!existing.routeId && seedBus.routeId) repository.addBus({ ...existing, routeId: seedBus.routeId });
    if (!repository.getBusLocation(seedBus.id)) {
      repository.updateBusLocation(seedBus.id, {
        busId: seedBus.id,
        routeId: seedBus.routeId || '',
        displayState: 'UNAVAILABLE',
        confidenceCategory: 'LOW',
        confidenceScore: 0,
        observationCount: 0,
        independentContributorsCount: 0,
        isLive: false,
        statusExplanation: 'No passenger GPS observation has been received. Use the published timetable for schedule estimates.',
        updatedAt: new Date().toISOString(),
      });
    }
  }

  const mutationMethods = [
    'addPlace', 'addOperator', 'addRoute', 'addTimetableDeparture', 'updateTimetableDeparture', 'addBus',
    'recordConsent', 'createJourneySession', 'stopJourneySession', 'ingestObservation',
    'updateBusLocation', 'createSubmission', 'recordSubmissionVote', 'updateSubmissionReview', 'createOperatorClaim',
    'addDuplicateCandidate', 'resolveDuplicateCandidate', 'updateAutomationRule', 'createAuditLog',
    'ensureSuperAdmin',
  ] as const;

  for (const method of mutationMethods) {
    const target = repository as any;
    const original = target[method].bind(repository);
    target[method] = (...args: unknown[]) => {
      const result = original(...args);
      persistSnapshot();
      return result;
    };
  }

  // Write an initial snapshot so seed records survive the first restart too.
  persistSnapshot();
}

export function isRepositoryPersistenceReady(): boolean {
  return persistenceReady;
}
