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

- Connect remaining passenger route-detail, offline and transfer views to the API; the search results page now queries the public GTFS timetable endpoint for a selected travel date.
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

## Implementation status — 3 Nov 2026

Implemented on this branch:
- Date-aware static GTFS query engine over normalized snapshot JSON.
- Service-day evaluation using `calendar.txt` and `calendar_dates.txt`, including exception precedence.
- Correct service-day offsets for times after 24:00.
- Direct origin/destination search, stop departure board and route/trip/stop-time detail endpoints.
- Explicit feed provenance, timezone, imported timestamp, UNVERIFIED status and static-vs-live separation.
- Bounded result limits (1–50), required service date validation and no-data 503 responses.
- Unit tests for service calendars, exceptions, after-midnight trips, source provenance and departure boards.
- CI updated to Node 22 and configured to run on this branch and PRs targeting Phase 11.

Runtime API endpoints:
- `GET /api/timetable/feeds`
- `GET /api/timetable/search?from=Kharagpur&to=Jhargram&date=2026-11-02&limit=20`
- `GET /api/timetable/stops/{stopId}/departures?date=2026-11-02&limit=20`
- `GET /api/timetable/routes/{routeId}`

Deployment requirement:
- The backend reads normalized feed JSON from `GTFS_DATA_DIR`; default: `artifacts/gtfs`.
- The Phase 11 release workflow creates the archive, but it does not automatically install that archive on a separately hosted backend. Deployment must download/extract the validated release asset into the configured directory before these APIs can return schedules.
- If no normalized snapshot is installed, timetable search deliberately returns `503 UNAVAILABLE`; it does not fall back to demo data.

Still NOT implemented / not production-ready:
- PostgreSQL/PostGIS runtime adapter, schema migrations and transactional snapshot activation.
- Automated production download/install of the release archive and atomic last-known-good snapshot swap.
- Multi-transfer journey planning across GTFS feeds, frequencies expansion into board-ready departures, transfer rules and timezone-aware display conversion.
- Passenger UI integration beyond the new date-specific search panel (route detail, offline caching and transfer itinerary presentation).
- API integration/load tests and Android end-to-end tests.
- Hosted API deployment, signing and physical-device QA.

Do not describe Phase 12 as complete until the remaining items pass CI and deployment validation.

### Install the published snapshot on the API host

After a successful Phase 11 **Refresh public GTFS data** release, run on the backend host:

```bash
export GTFS_DATA_DIR=/srv/yatribus/data/gtfs
node scripts/install-public-gtfs-snapshot.mjs
```

The installer downloads only the public stable release URL, caps compressed and expanded size, rejects unsafe archive paths and link entries, validates the import report and normalized feed schema, then replaces the snapshot directory on the same filesystem. It retains the previous directory if activation fails. Restart/reload the backend after installation if the deployment caches loaded feed data (the current endpoints load the directory per request).

For local development, omit `GTFS_DATA_DIR`; the default directory is `artifacts/gtfs`.
