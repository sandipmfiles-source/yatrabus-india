# Phase 2 — Transport Engine

This document describes the Phase 2 transport-engine implementation. It does not certify the completeness or accuracy of any operator's timetable data.

## GTFS Static import

The Super Admin page is available at `/admin/gtfs`.

1. Select a GTFS static ZIP archive (maximum 10 MB).
2. Run **Validate GTFS Feed**. This is read-only.
3. Review all validation errors, warnings and route/operator conflicts.
4. Only after review, explicitly confirm **Import as Unverified Records**.

Protected backend endpoints:

- `POST /api/admin/gtfs/preview` — parses and validates without writing.
- `POST /api/admin/gtfs/import` — requires Super Admin authorization and `confirmImport: true`; conflicts block the entire import.

Required GTFS files: `agency.txt`, `routes.txt`, `stops.txt`, `trips.txt`, and `stop_times.txt`.

Optional files currently consumed: `calendar.txt`, `calendar_dates.txt`, `frequencies.txt`, and `shapes.txt`.

Archive protections: 10 MB compressed upload limit, 30 MB total expanded content limit, at most 250 ZIP entries, stored/deflate compression only, no encrypted archives, no path traversal, and per-entry decompression capped to its declared size. CSV parsing supports quoted commas, escaped quotes and embedded newlines.

### GTFS interpretation and safety

- GTFS service calendars and date additions/removals are retained and checked against the requested Indian service date.
- GTFS times such as 24:40 are retained as 00:40 with a next-service-day offset.
- `frequencies.txt` creates headway departures. They are marked approximate unless `exact_times=1`; approximate trips receive lower confidence and are visibly marked as approximate.
- `trip_id` remains a trip identifier. It is never displayed or treated as a vehicle registration or physical bus identity.
- Imported agencies are community-listed. Routes and timetables remain `UNVERIFIED` / `SCHEDULE_UNVERIFIED`. The importer does not create buses, mark services live, or auto-publish a timetable.
- Different stop patterns on one GTFS route are warned about; each trip retains its own stop_times, while the route's displayed stop sequence uses the first selected pattern.
- GTFS-RT, fare rules, pathways, translations and `transfers.txt` are not yet ingested. Transfer planning therefore uses the platform's configurable conservative transfer buffers.

## Timetable engine and journey planning

- All schedule-date and clock calculations use Asia/Kolkata (IST).
- Exact trips, frequency-based departures, calendar exceptions and 24:xx overnight times are considered.
- Route search considers direct trips and up to two transfers (three legs).
- Default interchange minimum is 8 minutes; the maximum accepted wait is 90 minutes. Connections outside that window are rejected rather than advertised as feasible.
- Results include ordered legs, route/stop/time details, transfer waits and an explicit next-day flag.
- Results are timetable estimates. They are not claims that a bus is currently physically available or live-tracked.

## GPS trajectory corroboration

`POST /api/tracking/verify-bus-candidate-series` accepts 2–6 time-separated samples. Every sample must reference an active journey session with unrevoked, explicit journey-tracking consent for the selected route.

The matcher rejects stale/future fixes, invalid India coordinates, poor accuracy, samples spaced less than 20 seconds or more than 10 minutes apart, implausible speed above 120 km/h, off-route movement and sequences with less than 100 metres of movement.

Samples are evaluated in memory by this endpoint and are not persisted by it. A result is only a **corroborated candidate**, never proof of physical bus identity. Independent fleet/operator verification remains necessary.

## ETA confidence

ETA calculation now uses IST, route progress derived from route-matched GPS (not a hard-coded progress value), observation age and accuracy. A GPS fix older than 120 seconds is not used for a live ETA; the passenger receives a timetable fallback with a lower confidence score and explanation.

## Validation and rollout gates

The Phase 2 PR CI must pass TypeScript/Vite build, all unit suites, dependency audit and Android Debug APK build. GTFS data must be previewed and checked against official operator sources before any timetable is admin-verified. Field validation of route patterns, actual service dates, GPS tracking and transfer feasibility remains mandatory.

The backend still uses its existing JSON-file, single-instance persistence model. Phase 2 does not turn that storage into PostgreSQL/PostGIS or make it horizontally scalable.
