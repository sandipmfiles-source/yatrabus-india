# Phase 12 — GTFS runtime and passenger timetable integration

## Objective

Turn the validated static GTFS snapshots published by Phase 11 into usable, date-correct passenger timetable results without presenting static schedules as live vehicle tracking or treating community feeds as operator-certified.

This phase is intentionally separate from the release-publication workflow. The existing JSON/Map repository is not a PostgreSQL adapter, and a catalogue endpoint is not a timetable search implementation.

## Verified starting constraints

- Phase 11 publishes `yatribus-gtfs-snapshot.tar.gz` at the stable `gtfs-latest` release URL and retains a 30-day Actions artifact.
- `GET /api/timetable/feeds` currently exposes feed provenance only; it does not search trips or departures.
- The API server currently calls `installRepositoryPersistence()` and reports `storageMode: JSON_FILE`.
- The existing `TransitRepository` is an in-process Map repository with JSON snapshot persistence. Existing SQL migrations do not make PostgreSQL the runtime database.
- Static GTFS is not GTFS-Realtime and must never be displayed as live bus GPS.
- Google OAuth remains deferred. Keep the single Super Admin authorization model.

## Work packages

### 12.1 Snapshot ingestion and validation

- Fetch only the stable Phase 11 release asset over HTTPS, with strict connect/read timeouts and a configurable maximum compressed and expanded size.
- Verify archive structure, reject path traversal, symlinks, unexpected files and decompression bombs.
- Validate schema version, feed IDs, source checksums, import report, provenance, licence and attribution metadata.
- Import into a staging dataset; publish a new active snapshot atomically only after every enabled feed passes validation.
- Preserve the last-known-good snapshot if download, validation or activation fails.
- Record imported-at time, source-generated time, source checksum, feed status and importer version.
- Do not require a GitHub token for a public release download.

### 12.2 GTFS date-aware query engine

- Parse agency, routes, stops, trips, stop_times, calendar, calendar_dates, frequencies and transfers.
- Evaluate service dates using calendar rules and exceptions; never return trips outside their active service dates.
- Convert GTFS times greater than 24:00:00 correctly, retaining the service-day relationship.
- Support stop/route lookup, origin-to-destination trip search, departure boards, intermediate stop times, reverse direction and transfers.
- Bound query results and add pagination/limits; index stop, route, trip and departure lookup paths.
- Keep timezone handling explicit per agency/feed and avoid interpreting feed-local times as server-local times.
- Deduplicate only by stable source/feed identifiers; do not merge distinct trips merely because their times look similar.

### 12.3 Passenger API contract

Implement versioned, bounded endpoints with validation and predictable response semantics:

- `GET /api/timetable/feeds` — retain and extend provenance/status.
- `GET /api/timetable/search?from=&to=&date=` — date-correct direct and transfer options.
- `GET /api/timetable/stops/:stopId/departures?date=` — departure board.
- `GET /api/timetable/routes/:routeId` — route details and ordered stop times.

Every response must identify feed/source, generated/imported timestamps, service date, official/community provenance, verification status and static-data limitations. Return explicit `UNAVAILABLE` or `STALE` states rather than inventing a departure.

### 12.4 Backend persistence and deployment

- Before multi-instance production, implement a real PostgreSQL/PostGIS runtime adapter with migrations, transactions, connection pooling and integration tests. Do not describe the existing Map/JSON store as PostgreSQL.
- Decide and document whether GTFS snapshots are stored in PostgreSQL tables or a durable object/file store with indexed database metadata; do not load multi-million-row stop_times into process memory on every request.
- Add health checks for active snapshot age, last successful import, database readiness and query-index readiness.
- Keep the previous active snapshot available for rollback.

### 12.5 App integration

- Connect the passenger timetable screens to the API, not to a bundled demo timetable.
- Display departures, intermediate stop arrival/departure times, service-day validity, source and last-updated time.
- Clearly label community-derived schedules as unverified; do not imply operator approval.
- Clearly separate scheduled timetable estimates from consent-based live GPS observations.
- Provide empty, offline, stale-feed and API-unavailable states without fabricating bus services.
- Preserve Bengali, Hindi and English UI support and existing route-search behaviour.

## Acceptance tests

1. A failed or malformed snapshot never replaces the active snapshot.
2. Archive traversal, oversized archives, missing required files and checksum mismatch are rejected.
3. Calendar and calendar_dates inclusion/exclusion are tested at boundary dates.
4. GTFS times after midnight (for example 25:10:00) are handled correctly.
5. Stops, trips and stop_times preserve referential integrity and source identity.
6. Search results are deterministic, bounded and date-correct.
7. Community feeds remain explicitly unverified; static GTFS never sets live GPS fields.
8. API tests cover malformed dates, unknown stops/routes, empty results, stale feeds, pagination and rate limits.
9. PostgreSQL integration tests exercise actual runtime reads/writes and transaction rollback; a migration-only check is insufficient.
10. Android CI builds the app and tests passenger timetable screens against mocked API states.
11. The existing sole Super Admin authorization and consent-gated tracking tests remain passing.

## Release gates and exclusions

- Keep this PR draft and keep `main` untouched until implementation, CI and review are complete.
- Do not merge this plan as if it were a completed runtime integration.
- Do not claim nationwide operator coverage: only enabled, licence-reviewed feeds are imported; coverage gaps remain visible.
- Do not scrape gated services, bypass access controls, invent schedules, or imply community data is operator-certified.
- No production APK claim until hosted HTTPS API, durable database/storage, release signing and physical-device QA are complete.
- Google OAuth configuration remains deferred as previously requested.
