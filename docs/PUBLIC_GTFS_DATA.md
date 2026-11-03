# Public GTFS data pipeline

## What this adds
- A source registry with provenance, publisher/catalog links, feed status and licence-review state.
- A daily GitHub Actions refresh (02:17 UTC) plus manual dispatch.
- A dependency-light GTFS ZIP importer that validates required tables and foreign-key references before writing normalized JSON snapshots.
- SHA-256 checksums and per-feed import reports.

## Enabled sources
Only feeds marked `enabled` are downloaded. The initial set is:
- TGSRTC Hyderabad — official open-data publisher; its page publishes GTFS and terms of use.
- Chennai unified transit — community-maintained feed listed by Mobility Database; use remains subject to the linked terms and must not be described as an official agency feed.

Other discovered feeds (PMPML, KDMT/BEST, APSRTC, Rajkot and Ahmedabad) are recorded but disabled until reuse terms, attribution and quality are reviewed. A catalogue listing or a downloadable URL does not automatically grant redistribution rights.

## Data semantics and safety
- GTFS Static is schedule data, not live vehicle tracking.
- No GTFS-Realtime endpoints are configured because a verified public, unauthenticated, reusable India bus realtime endpoint has not been established by this registry.
- Source snapshot timestamps and SHA-256 hashes are preserved.
- Invalid/incomplete feeds fail the job; no partially parsed feed is published as a successful artifact.
- Imported JSON is a CI artifact retained for 30 days, not a permanent database or an app runtime data source yet.
- This pipeline does not yet replace the app's JSON/Map repository. Runtime API integration requires the separate PostgreSQL/repository refactor and a deliberate mapping of GTFS entities into the app's data model.

## Run manually
GitHub → Actions → **Refresh public GTFS data** → Run workflow. The normalized snapshot and import report appear under the run's Artifacts section.
