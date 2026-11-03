# YatraBus India — Final Release Audit (2026-11-03)

## Scope and status

This audit is based on the repository branch `phase10-final-release-hardening` and the public GTFS sources reviewed on 2026-11-03. It is not a claim of production readiness. The Android build workflow is now configured to run on the Phase 8, 9 and 10 branches so these changes can be tested rather than silently bypassing Android CI.

## Public bus timetable sources

The current India GTFS catalogues are not exhaustive inventories of every bus operator. Mobility Database says it checks producer feed URLs daily, but that only detects changes at the supplied source URL; it does not guarantee that an operator publishes fresh or accurate data. A feed is enabled only after a reuse licence/permission and attribution are recorded.

Currently enabled sources in the registry:
- TGSRTC Hyderabad — official open-data terms permit reuse and redistribution with attribution and no implied endorsement; the publisher explicitly does not guarantee that every service change will be reflected.
- PMPML Pune — community-derived, dataset licence reviewed; not operator-certified.
- Mumbai-region BEST/KDMT/TMT — community-derived, dataset licence reviewed; not operator-certified.
- Hubballi-Dharwad BRTS — community-derived, dataset licence reviewed; not operator-certified.
- Rajkot Rampath — community-derived, dataset licence reviewed; not operator-certified.
- Karnataka KSRTC — community-generated from publicly accessible schedules, MIT-0 dataset licence; not operator-certified and requires current calendar validation.

Not enabled:
- Delhi DTC/DIMTS: available community archive has expired service dates; official OTD snapshot is dated 20 June 2024, warns stop-times are rough estimates, and real-time positions require an authorised key.
- Chennai MTC: community feed is based on app scraping; rights to redistribute underlying agency content are not sufficiently clear. Metro/rail entries must not be misrepresented as bus routes.
- BMTC: community source warns timetable accuracy is unreliable and only covers routes with live tracking in its source app; rights/freshness remain under review.
- Vapi City Bus: catalogue describes a corrected dataset and a request/quote delivery model, so it is not verified as a free reusable feed.
- FlixBus India: catalogue entry is not sufficient to establish an India-only, free-to-redistribute dataset; generic FlixBus feed coverage/rights need separate verification.
- APSRTC: community feed has validation errors and the currently listed service window is expired.
- Goa: official CC BY 4.0 source is stale (publisher page last updated 31 Jan 2025).
- MSRTC and Kochi bus feeds: published snapshots have expired service periods.

## Data pipeline

- Refresh workflow runs daily and on manual dispatch.
- Importer checks download size, ZIP extraction size, required GTFS tables, calendar presence, service expiry, and stop/trip/route referential integrity.
- This hardening adds registry duplicate-ID checks, HTTPS and licence/attribution metadata checks, and duplicate/missing identifiers in core GTFS tables.
- CI uploads normalized snapshots as GitHub Actions artifacts with a 30-day retention period.

Important: GitHub Actions artifacts are temporary build outputs. The current pipeline does **not** automatically publish the normalized snapshot to a permanent public data endpoint, production backend database, or the APK. Daily import success is not the same as in-app timetable availability.

## Confirmed product/release blockers

1. Backend persistence is still a synchronous in-process Map repository with JSON-file snapshots. PostgreSQL/PostGIS migrations exist, but a PostgreSQL runtime adapter is not connected. A container's local file is not sufficient durable multi-instance production storage.
2. GTFS normalized snapshots are not yet consumed by the live bus/route/timetable API or the Android timetable screens.
3. Android CI can build a debug APK, but a blank `VITE_API_BASE_URL` means native API calls fail closed. No hosted HTTPS backend/domain has been configured.
4. A production-signed APK/AAB requires the owner's private Android keystore and GitHub Actions secrets. Do not commit or share the keystore/passwords in chat.
5. Physical-device QA is still required for camera/QR, microphone/voice search, notifications, foreground/background location, battery saver, offline behaviour, accessibility and install/update.
6. Google OAuth remains intentionally deferred as requested.
7. Nationwide coverage is not complete: there is no verified free, current, redistributable timetable feed for every Indian state/operator. Never synthesize missing departure times or label static GTFS as live GPS.

## Release gate

Do not label a build as the final production APK until the backend persistence/runtime, permanent GTFS publication + API integration, HTTPS configuration, signed release secrets, automated test suite, Android build, and physical-device QA have passed. Until then, any downloadable APK must be labelled a debug/test build.
