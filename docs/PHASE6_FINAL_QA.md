# Phase 6 — Final QA and release acceptance

Phase 6 is a release gate, not a claim that an untested app is production-ready. The automated audit is intentionally separate from ordinary unit tests because it includes checks that require provisioned infrastructure and owner-controlled devices.

## Run the QA checks

```bash
npm ci
npm run build
npm test
npm run qa:phase6
```

- `npm run build`: TypeScript and production web bundle.
- `npm test`: route, ETA, GPS confidence, consent, GTFS, timetable, QR and India catalogue suites.
- `npm run qa:phase6`: source-level production checks for CORS, Super Admin authorization, consent-gated tracking, QR issuance, Android security flags, and PostgreSQL/PostGIS runtime wiring.

The Phase 6 audit exits non-zero if a required release condition is not satisfied. In the current codebase the expected blocker is PostgreSQL runtime integration: SQL migration files exist, but the live API still calls synchronous Map-backed repository methods and persists snapshots to a JSON file. Do not mark this audit green until all live reads and writes use the production database adapter.

## Data correctness acceptance

- Every public timetable must carry a traceable official source, effective period and verification timestamp.
- Sample/demo route schedules remain visibly unverified and must never be described as official departures.
- Place records must preserve source dataset, source license, verification state and coordinate provenance.
- Stop coordinates must be validated and within the supported geographic range before official QR issuance.
- A release review must sample records across all 28 states and 8 union territories; the presence of an administrative directory is not evidence of complete bus service or timetable coverage.
- Reconcile operator names and official URLs against the current official transport authority directory before marking an operator verified.
- Check route stop ordering, duplicate IDs, missing place references, invalid coordinates, impossible departure/arrival times and duplicate departure records.

## Security and privacy acceptance

- Only the configured owner email can authenticate as the single SUPER_ADMIN.
- Password hashes use scrypt and token signatures use HMAC with constant-time signature comparison.
- No wildcard CORS origin is allowed in production. List exact browser origins.
- The reverse-proxy hop count must match the actual trusted ingress topology.
- Admin routes require SUPER_ADMIN authorization; public endpoints must be rate-limited where abuse could expose or overload services.
- Location observations require an active session and explicit, unrevoked consent. Public endpoints must not return individual passenger traces or device/cell identifiers.
- Journey stop/expiry/revocation must stop subsequent observation ingestion.
- Production health must remain degraded until durable storage and owner authentication are configured.
- Scan repository, build logs, release assets and generated APK for secrets before publication. Never commit keystores or plaintext owner credentials.
- Review dependency audit output and pin/upgrade any high or critical transitive dependency before stable release.

## Database acceptance — mandatory

1. Implement a real asynchronous PostgreSQL repository and refactor route/service handlers to await repository reads and writes. Do not create a best-effort asynchronous snapshot mirror and call it a database integration.
2. Apply migrations through a tracked migration runner in a transaction where supported; record migration version and checksum.
3. Use PostGIS geography/geometry columns and GiST indexes for nearby-stop and route spatial operations.
4. Preserve transactional consistency for multi-entity admin approval, timetable revision, journey consent/revocation, QR audit and submissions.
5. Enforce unique IDs, foreign keys, check constraints, safe query parameterization and bounded connection pools.
6. Import existing JSON state in a one-time, idempotent migration. Validate row counts and critical entity checksums before cutover; retain a tested rollback snapshot.
7. Run integration tests against a real PostgreSQL/PostGIS service container: migration from empty DB, repeat migration, import, CRUD, concurrent writes, rollback, restart persistence, spatial queries, and retention cleanup.
8. Health endpoint must report the real database connection and migration readiness; never hard-code `databaseConnected: true`.

## Hosting acceptance

- Provision a real HTTPS domain and host with persistent storage, environment secrets, health checks, structured logs, alerting and a documented rollback.
- Use a managed PostgreSQL/PostGIS instance with private networking, automated encrypted backups and tested restore.
- Run one instance until the database-backed implementation and shared rate limiting/session behaviour are verified. Do not scale a JSON-backed process across replicas.
- Configure exact `CORS_ALLOWED_ORIGINS`, `TRUST_PROXY_HOPS`, owner email/hash/JWT secret, database URL and API URL using the host secret manager.
- Confirm TLS, DNS, certificate renewal, API health, frontend deep links, upload limits, log redaction and disk/connection-pool alerts.

## Signed Android acceptance

- Create the release keystore locally on a trusted machine and keep encrypted offline backups.
- Configure GitHub Actions secrets `ANDROID_KEYSTORE_BASE64`, `KEYSTORE_PASSWORD`, `KEY_ALIAS`, `KEY_PASSWORD` and HTTPS variables `VITE_API_BASE_URL`, `VITE_PUBLIC_APP_URL`.
- Run **Build Signed Android Release**. Verify APK with `apksigner`, AAB with `jarsigner`, package ID, version code/name, SHA-256 and certificate fingerprint.
- Confirm the APK calls the deployed HTTPS API and no debug endpoint or cleartext traffic is enabled.
- Publish a pre-release candidate only; promote to stable after the physical device acceptance below.

## Two-device physical acceptance record

This cannot be simulated by GitHub Actions or source-code inspection. Complete the table on two physical Android phones and attach the test evidence to the release record.

| Test | Device A | Device B |
|---|---|---|
| Fresh install, update install and app restart | Pending | Pending |
| Android version, package ID and signed certificate | Pending | Pending |
| Offline launch, slow network and API outage | Pending | Pending |
| Camera permission grant/deny and signed QR scan | Pending | Pending |
| Microphone permission grant/deny and Hindi/Bengali/English voice search | Pending | Pending |
| Notification permission, schedule/cancel and reboot behaviour | Pending | Pending |
| Foreground GPS journey, ongoing notification and explicit stop | Pending | Pending |
| Background, screen-off, battery saver, GPS off and permission revocation | Pending | Pending |
| Consent revoke/expiry prevents further observation upload | Pending | Pending |
| QR altered, expired, malformed and unverified-stop rejection | Pending | Pending |
| Large text, contrast, reduced motion and screen reader | Pending | Pending |
| No passenger trace or cell identifier exposed in public API | Pending | Pending |

Record model, Android version, APK SHA-256, test date, tester, steps, expected/actual result and relevant logcat evidence. A test is not passed until it has been performed on the device.

## Current known release blockers

- PostgreSQL/PostGIS is not yet the live runtime database.
- A real hosting account, domain, persistent volume and managed database have not been provisioned by this repository workflow.
- The owner-controlled signing key and GitHub Actions secrets have not been supplied/configured.
- Two physical Android devices have not been tested in this session.
- Nationwide official operator and timetable coverage has not been independently verified.
- Google OAuth remains deferred by owner decision.

**Release decision:** do not publish a stable public production release until the database, hosting, signed release, data correctness and both physical-device acceptance records are complete. Keep the default `main` branch untouched until the owner approves the final integration.
