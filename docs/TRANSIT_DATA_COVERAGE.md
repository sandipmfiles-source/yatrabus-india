# India transit data coverage and source policy

## TGSRTC static bus schedules (Telangana)

YatraBus can import the TGSRTC GTFS static schedule snapshot dated **8 February 2026**. The snapshot is pinned by SHA-1 in the GitHub Actions workflow so a changed file cannot silently enter production.

- Source authority: Telangana State Road Transport Corporation (TGSRTC), [official open-data terms](https://www.tgsrtc.telangana.gov.in/open-data)
- Producer download URL: [OpenCity GTFS ZIP](https://data.opencity.in/dataset/88e2d145-7ec6-4666-88dd-6cf18b18312e/resource/1b0d18bb-b2fb-4a79-8ed0-1e071da5790c/download/telangana_opendata_gtfs_tgsrtc_08_february_2026.zip) (currently returns HTTP 403 to automated CI).
- CI download mirror: [Mobility Database latest archive](https://storage.googleapis.com/mdb-latest/in-hyderabad-bus-gtfs-3361.zip). The exact file is SHA-1 pinned in the workflow; a changed archive fails validation until deliberately reviewed and re-pinned.
- Attribution required by the provider: **“Contains data provided by TGSRTC”**
- The app must not suggest that TGSRTC endorses YatraBus.
- The source terms permit free, non-exclusive use, adaptation, storage, display and redistribution, subject to attribution and the other terms on the official page.

The importer creates stop, route-pattern and scheduled-trip records from GTFS. It does not create individual vehicle records, live GPS observations, fares, vehicle classes or real-time arrival promises. Unknown fields remain unknown. Route and timetable records are labelled as published source data, not independently verified by YatraBus.

The current feed is a dated static snapshot. It must not be described as live or guaranteed current. Riders should check service changes with the operator. A later refresh must use a new pinned feed version and a deliberate version-replacement process; the current importer is append-only and will not overwrite old rows.

## GTFS interpretation

GTFS Schedule describes static stops, routes, trips, stop times and service calendars. GTFS Realtime is a separate feed for trip updates, service alerts and vehicle positions. YatraBus will only show live GPS when an actual consented GPS source is available; static GTFS data is never a live location.

## India-wide coverage

TGSRTC is one regional starting point, not nationwide coverage. Additional state transport corporations, city bus agencies and intercity operators must be added as separate, source-attributed feeds after their licensing, freshness and quality are checked. A location directory entry alone does not prove bus service exists there.
