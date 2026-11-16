# YatraBus India transit-data coverage

This document separates administrative location data from real public-transport data. An administrative directory entry is not evidence that a bus stop, bus route or timetable exists.

## Administrative locations

- Cloudflare D1 contains 20,294 records imported from the pinned India Local Government Directory snapshot.
- These are administrative reference locations (state/UT, district, sub-district, block and town/urban-local-body levels).
- They do not include the full village roster and are not automatically bus stops.
- The API reports the exact loaded count by source and place type.

## Public transit feeds

### Rajkot Rampath Limited (RRL), Gujarat

- Source repository: https://github.com/croyla/rrl-gtfs
- Feed archive: `gtfs_compat.zip`, pinned to commit `3937952038f7fa052a019418d064991cfa14a2fe`.
- License stated by the repository: MIT-0.
- Attribution: "GTFS feed for Rajkot Rampath Limited services; repository by croylA (MIT-0)".
- Snapshot date: 2026-11-16.
- The import workflow validates the archive checksum, GTFS files, Indian stop coordinates, current service calendars and complete trip stop sequences before import.
- CI dry-run of this pinned snapshot found 760 stops, 267 route patterns and 3,140 current scheduled trips, with zero trips skipped. These are source-archive counts, not production D1 counts until the post-import verification completes.
- Imported routes and timetables are labelled `published_unverified`: they are from a community-published feed and have not been independently confirmed by YatraBus India or the operator.
- The importer does not invent fares, individual buses or live GPS positions. Fare and vehicle data remain unavailable unless a trusted source supplies them.
- D1 import is append-only and verifies stop, route and trip counts after import.

The CI workflow prints the actual counts from the pinned archive. Production D1 counts are reported only after the import workflow completes successfully.

### Telangana TGSRTC

A TGSRTC GTFS archive was identified, but the publisher download currently denies automated access (HTTP 403) and its MobilityData mirror returns 404. No TGSRTC schedules have been imported. The WIP importer remains unmerged until a checksum-verified archive is accessible.

## India-wide coverage status

YatraBus India is not yet a nationwide timetable database. Coverage is added feed-by-feed only when a source can be downloaded, licensed, validated and attributed. The app must show "No published timetable" rather than inventing a schedule for areas without data.

## Data-quality rules

1. GTFS stop coordinates outside India are rejected.
2. Trips with missing stops or invalid times are skipped, never silently truncated.
3. Only current or near-future service calendars are imported.
4. A published feed is not automatically called government-verified.
5. Static timetable data is never presented as live GPS.
6. No fare or individual vehicle is inferred from route geometry or schedule rows.
