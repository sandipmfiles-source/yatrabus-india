import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { repository } from './repository.js';

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

  const mutationMethods = [
    'addPlace', 'addOperator', 'addRoute', 'addTimetableDeparture', 'addBus',
    'recordConsent', 'createJourneySession', 'stopJourneySession', 'ingestObservation',
    'updateBusLocation', 'createSubmission', 'updateSubmissionReview', 'createOperatorClaim',
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
