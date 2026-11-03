import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const checks = [];
const blockers = [];
const warnings = [];
const read = (path) => {
  if (!existsSync(path)) throw new Error(`Required QA file missing: ${path}`);
  return readFileSync(path, 'utf8');
};
const check = (name, condition, detail = '') => {
  checks.push({ name, passed: Boolean(condition), detail });
  if (!condition) blockers.push(name);
};

const server = read('backend/src/server.ts');
const auth = read('backend/src/middleware/auth.ts');
const tracking = read('backend/src/routes/tracking.ts');
const admin = read('backend/src/routes/admin.ts');
const manifest = read('android/app/src/main/AndroidManifest.xml');
const repository = read('backend/src/db/repository.ts');
const persistence = read('backend/src/db/persistence.ts');
const migrations = [
  read('backend/migrations/001_initial_schema.sql'),
  read('backend/migrations/002_postgis_indexes.sql'),
  read('backend/migrations/003_community_and_tracking.sql'),
  read('backend/migrations/004_admin_automation.sql'),
].join('\n');

check('No wildcard CORS response', !/Access-Control-Allow-Origin['"]?\s*,\s*['"]\*['"]/.test(server) && !/setHeader\(['"]Access-Control-Allow-Origin['"]\s*,\s*['"]\*['"]/.test(server));
check('CORS allow-list is applied', /CORS_ALLOWED_ORIGINS/.test(server) && /allowedOrigins\.has\(origin\)/.test(server));
check('Production health gate checks owner authentication config', /productionConfigReady/.test(server) && /ADMIN_JWT_SECRET/.test(server));
check('Super Admin password uses constant-time comparison', /timingSafeEqual/.test(auth) && /scryptSync/.test(auth));
check('Admin token only permits SUPER_ADMIN role', /payload\.role !== ['"]SUPER_ADMIN['"]/.test(auth) && /admin\.role !== ['"]SUPER_ADMIN['"]/.test(auth));
check('Tracking observations require granted consent', /consent\.status !== ['"]GRANTED['"]/.test(tracking) && /disclosuresAccepted !== true/.test(tracking));
check('Stop QR issuance requires verified route and place', /route\.verificationStatus !== ['"]ADMIN_VERIFIED['"]/.test(admin) && /place\.verificationStatus !== ['"]ADMIN_VERIFIED['"]/.test(admin));
check('Android disallows cleartext traffic and backups', /android:usesCleartextTraffic="false"/.test(manifest) && /android:allowBackup="false"/.test(manifest));
check('Android declares runtime-sensitive permissions', /ACCESS_FINE_LOCATION/.test(manifest) && /POST_NOTIFICATIONS/.test(manifest) && /CAMERA/.test(manifest) && /RECORD_AUDIO/.test(manifest));
check('PostgreSQL migrations include PostGIS and spatial indexes', /CREATE EXTENSION IF NOT EXISTS postgis/i.test(migrations) && /USING GIST/i.test(migrations));
check('Core transit, consent, tracking and audit schema exists', ['places','operators','routes','route_stops','timetables','consent_records','journey_sessions','location_observations','bus_location_aggregates','audit_logs'].every(table => new RegExp('CREATE TABLE IF NOT EXISTS '+table+'\\b','i').test(migrations)));

// This is intentionally a hard gate. SQL migration files alone do not constitute
// a runtime PostgreSQL integration. Current API repository calls are synchronous Maps.
const pgRuntimeConnected = /databaseConnected:\s*true/.test(repository) &&
  !/storageMode:\s*['"]JSON_FILE['"]/.test(server) &&
  /pg\.(Pool|Client)|from ['"]pg['"]/.test(persistence);
check('PostgreSQL is the actual runtime repository (not JSON snapshot)', pgRuntimeConnected,
  'BLOCKER: runtime is still synchronous Map + JSON-file persistence; migrations are not wired to live reads/writes.');

const report = {
  name: 'YatraBus Phase 6 static production-readiness audit',
  checks: checks.length,
  passed: checks.filter(item => item.passed).length,
  failed: blockers.length,
  blockers,
  warnings,
  results: checks,
};
console.log(JSON.stringify(report, null, 2));
if (blockers.length) {
  console.error('PHASE 6 QA BLOCKED: resolve every failed check before production release.');
  process.exit(1);
}
console.log('PHASE 6 STATIC QA PASSED.');
