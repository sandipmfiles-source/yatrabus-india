# Public GTFS data pipeline

## Refresh and publication

- The refresh workflow downloads only feeds whose registry status is `enabled`.
- It validates required GTFS tables, service-calendar freshness, unique core identifiers and referential integrity before creating normalized JSON.
- Each successful run retains a 30-day Actions artifact for debugging and publishes a compressed snapshot to the stable GitHub Release tag `gtfs-latest`.
- The release asset is named `yatribus-gtfs-snapshot.tar.gz`; it contains one normalized JSON file per enabled feed and `import-report.json`.
- The stable public download URL is:
  `https://github.com/sandipmfiles-source/yatrabus-india/releases/download/gtfs-latest/yatribus-gtfs-snapshot.tar.gz`
- Publishing uses the repository's built-in `GITHUB_TOKEN`; no personal access token or user secret is embedded in the workflow. Repository Actions settings must permit the workflow token to create releases (contents: write).

## Source quality and attribution

The source registry at `data/gtfs/sources.json` is authoritative for enabled feeds, licence review and attribution. Current enabled feeds include TGSRTC Hyderabad and several community-derived regional datasets. Community-derived feeds are not operator-certified. A catalogue listing or downloadable URL alone does not grant redistribution rights; only registry entries with recorded review and attribution are eligible.

The importer fails the run if an enabled feed cannot be downloaded or fails validation. A failed run does not replace the previously published `gtfs-latest` release asset.

## Data semantics and limitations

- GTFS Static is schedule data, not live vehicle tracking or live GPS.
- Service calendars determine the dates on which a trip operates; consumers must apply calendar exceptions and service-date rules.
- Source timestamps, source links, licence metadata, attribution, and SHA-256 hashes are preserved in normalized feed data and the import report.
- The backend exposes enabled feed provenance and the stable snapshot link at `GET /api/timetable/feeds`.
- This endpoint is a source catalogue only; it does not yet perform passenger route/departure searches or load the archive into Android timetable screens.
- Backend runtime still requires a deliberate data adapter, bounded query/pagination, service-date evaluation, and provenance display before passengers can use these feeds.
- Do not label community-derived schedules as official or guaranteed.

## Run manually

GitHub → Actions → **Refresh public GTFS data** → Run workflow. After a successful run, check the run's Artifacts section and the repository's **Releases** page for the updated `gtfs-latest` asset.
