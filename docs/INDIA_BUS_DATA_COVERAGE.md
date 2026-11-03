# India bus data coverage and quality register

Checked 3 November 2026. This register covers all 28 states and 8 union territories. It records discoverable, public bus datasets, not total bus-service coverage.

## Verified / candidate sources

| Area | Source | Current assessment | App import decision |
|---|---|---|---|
| Telangana | TGSRTC official GTFS | Explicit reuse permission with attribution; publisher does not guarantee updates | Enabled; service-calendar validation and daily refresh |
| Goa | Department of Transport GTFS | Official CC BY 4.0, but page says last updated 31 Jan 2025 | Hold until current calendar confirmed |
| Delhi | Open Transit Data / DTC | Static data last updated 20 Jun 2024; official docs say stop times are rough estimates; realtime requires authorised private key | Hold; no access-control bypass |
| Andhra Pradesh | APSRTC community GTFS | Catalogue showed service period ending 30 Sep 2026 and validation errors; APSRTC official portal separately offers timetable/live tracking | Hold; obtain official feed/API permission |
| Chennai | Community MTC/CMRL unified GTFS | 2 errors, 3 warnings; MTC data reportedly derived from official app; CUMTA/agency rights unclear | Hold pending rights and data-quality review |
| Pune | PMPML community GTFS | Service dates active in Sep 2026, but feed has 6 errors/warnings and community publisher | Hold pending licence and validation review |
| Mumbai region | KDMT + BEST community GTFS | Service dates active in Aug 2026, community publisher; operator boundaries/rights need review | Hold pending licence review |
| Ahmedabad | Janmarg / AMTS community GTFS | Catalogue lists active 2026–27 period, but one validation error and community publisher | Hold pending licence review |
| Rajkot | Rampath community GTFS | Catalogue candidate | Hold pending licence and current-date validation |
| Hubballi-Dharwad | HDBRTS community GTFS | Active 2026–27 service range, 2 warnings, no clear redistribution licence | Hold pending licence review |
| Bengaluru | BMTC community archive | Old archived feed / replacement URL noted in catalogue; licence file exists but current status needs confirmation | Hold pending fresh feed and licence review |
| Maharashtra statewide | MSRTC community GTFS | Only 2 routes; service ended 30 Jun 2025 | Exclude as stale/incomplete |
| Kerala | Kochi bus/ferry community GTFS | Service ended 25 Mar 2023 | Exclude as stale |
| Vapi | Vapi City Bus catalogue entry | Catalogue listing found; current producer URL and licence not verified | Discovery only |
| Private intercity | FlixBus India listing | India feed listing found; current India-only source and reuse terms not verified | Discovery only |

## All-state coverage matrix

See `data/gtfs/india-coverage.json` for machine-readable status across all states and UTs. “No public GTFS feed verified” means the research did not establish a currently reusable public feed; it does not mean the state has no bus services or no official timetable.

## Refresh and freshness rules

- Mobility Database says its catalogue checks producer URLs daily and stores changed versions. This does not guarantee that operators themselves update their source feeds daily.
- YatraBus scheduled refresh is a separate pipeline. It only imports feeds marked `enabled`, validates GTFS required tables, foreign keys and service-calendar dates, and publishes versioned CI artifacts.
- Expired, stale, access-gated, unlicensed or structurally invalid feeds must not become passenger-facing schedules.
- GTFS Static = scheduled routes/times; GTFS-Realtime = separate authorised vehicle positions, trip updates and service alerts. Do not infer live positions from timetable data.
- Operator website timetable pages are not automatically reusable datasets. Do not scrape authenticated or access-controlled endpoints.

## Passenger corrections

The backend already has an account-free community contribution path in `POST /api/contributions/submit`, public reference-status lookup, timetable correction voting, and a separate operator-submission queue. Contributions are stored as pending review; community votes do not directly overwrite official GTFS. The sole Super Admin retains publication authority.

Recommended passenger correction lifecycle:
1. Passenger selects operator, route, stop and date/service.
2. They submit a correction with evidence/source and optional note.
3. YatraBus creates a reference ID and checks duplicates.
4. Other passengers may corroborate a proposed value.
5. A verifier/Super Admin compares it with operator notice or source and approves/rejects it.
6. Approved community observations remain labelled as community-verified, separate from official operator GTFS until the operator confirms them.

## Remaining integration work

The current importer creates validated normalized artifacts. It does not yet map all GTFS feeds into the live application timetable API or PostgreSQL. This requires the separate runtime repository integration and production database work. The coverage matrix is not a substitute for official agency agreements or a national open-data mandate.
