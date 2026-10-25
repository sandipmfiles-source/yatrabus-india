# YatriBus Database & PostGIS Architecture

## Schema Overview

The database uses PostgreSQL with the PostGIS and `pg_trgm` extensions to support fast geographic radius queries, route polyline spatial matching, and typo-tolerant trigram autocomplete.

### Key Entities

1. `places`: Geographical entities across Indian administrative tiers with Point geometry `geom geometry(Point, 4326)`.
2. `operators`: Public and private transit agencies (e.g. DTC, BEST, BMTC, WBTC, MSRTC).
3. `buses`: Fleet entities referencing operators with custom SVG fallback indicators.
4. `routes`: Transit corridors with ordered stop sequences and optional polyline geometry.
5. `route_stops`: Ordered stops along a route with distance from start (km) and scheduled arrival/departure times.
6. `timetables`: Operational schedules with revision history (`timetable_revisions`) supporting non-destructive audits and rollbacks.
7. `consent_records`: Traceable explicit passenger consent records with scope and granted/revoked timestamps.
8. `journey_sessions`: Anonymous tracking sessions with 12-hour max safety limit.
9. `location_observations`: Raw GPS points with distance-from-route and confidence scores (purged after retention window).
10. `bus_location_aggregates`: Public-facing bus-level location table with display state (`LIVE`, `LAST_KNOWN`, `ESTIMATED`, `UNAVAILABLE`).
11. `community_submissions`: Account-free suggestions with public reference IDs (e.g. `YB-SUB-2026-XXXX`).
12. `duplicate_candidates`: Spatial and name similarity candidates for verifier resolution.
13. `automation_rules`: Configurable rules engine for GPS freshness, auto-publish policies, and session timeouts.

## Running Migrations

Execute migration scripts in sequential order:
```bash
psql $DATABASE_URL -f backend/migrations/001_initial_schema.sql
psql $DATABASE_URL -f backend/migrations/002_postgis_indexes.sql
psql $DATABASE_URL -f backend/migrations/003_community_and_tracking.sql
psql $DATABASE_URL -f backend/migrations/004_admin_automation.sql
```
