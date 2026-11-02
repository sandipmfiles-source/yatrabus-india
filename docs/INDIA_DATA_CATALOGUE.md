# India Data Catalogue — Phase 3

## Scope and current coverage

YatraBus now ships a structured administrative reference catalogue for all 28 States and 8 Union Territories, plus a searchable starter index for the Jhargram–Kharagpur–Kolkata pilot corridor.

The catalogue stores administrative type, capital/administrative seat, aliases, region, official government reference URL and review date. Seasonal and shared capital distinctions are noted instead of flattening them into a misleading single-capital claim.

**Important:** State and UT records are reference entries, not bus service records. The town starter index is UNVERIFIED and does not create fake bus stops, coordinates or routes.

## Government bus operators

The operator directory includes state transport corporations, government transport departments and municipal undertakings identified from Association of State Road Transport Undertakings (ASRTU) and government transport references. Each listing:
- is `COMMUNITY_LISTED`, not an authenticated operator profile;
- is not automatically claimed by an operator account;
- retains the source dataset and official website where identified;
- has no invented contact phone number;
- must be independently verified before being promoted.

The directory is a national starting index, not a guarantee that every state has a separately constituted corporation. Some states/UTs operate through departments, shared undertakings or contracted city services.

## West Bengal pilot corridor

Pilot towns currently indexed:
- Jhargram and nearby Jhargram district towns: Lodhasuli, Gopiballavpur, Belpahari
- Paschim Medinipur: Kharagpur, Midnapore, Salboni, Debra
- Purba Medinipur: Panskura, Kolaghat
- Howrah district: Uluberia, Howrah, Santragachi
- Kolkata: Kolkata

The West Bengal Transport Department identifies WBTC as serving Kolkata/suburban areas, SBSTC for southern and south-western districts, and NBSTC for North Bengal. These references help direct data collection, but do not prove that a particular operator runs a specific Jhargram–Kharagpur–Kolkata departure.

**Pilot timetable state: UNAVAILABLE.** No official current departure timetable was supplied in the repository. Third-party schedule snippets are not used to invent or verify times. The pilot will move to SCHEDULED only after an official operator publication is reviewed and the Super Admin records the source, URL, reason and timestamp.

## Timetable provenance model

Routes and individual departures can retain:
- source name;
- HTTPS source URL;
- verification timestamp;
- status: LIVE_GPS, ESTIMATED, SCHEDULED or UNAVAILABLE.

The backend defaults legacy/demo and imported-but-unverified schedules to UNAVAILABLE. The passenger UI hides their sample departure times. A Super Admin must explicitly verify a timetable with a named source, HTTPS source URL and review reason. That operation creates an audit log entry and a backend-generated timestamp.

LIVE_GPS is not a timetable status: it is a separate, freshness-bound state derived from explicit passenger consent and actual GPS observations. An ETA estimate remains ESTIMATED and is never labelled LIVE.

## Data sources

- Ministry of Panchayati Raj — Local Government Directory: https://lgdirectory.gov.in/
- Ministry of Panchayati Raj LGD overview: https://panchayat.gov.in/en/lgd/
- Open Government Data Platform — LGD catalogue: https://data.gov.in/catalog/local-government-directory-lgd
- Ministry of Home Affairs — Union Territories division: https://www.mha.gov.in/union-territories-divisions
- West Bengal Transport Department: https://transport.wb.gov.in/
- ASRTU STUs Profile and Performance 2019–20: https://asrtu.org/resource/front/uploads/STUs%20Profile%20and%20Performance%202019-20.pdf

## Full LGD town import

Follow [data/README.md](../data/README.md) to download current LGD CSV exports and create the compact gzip index used by backend autocomplete. The huge village roster is excluded from the normal passenger autocomplete index; the town and administrative layers are indexed instead. Every imported item remains UNVERIFIED until checked.

## What is not claimed as complete

- All 676k+ villages are not bundled in the APK.
- Every small-town bus stop has not been surveyed or verified.
- Nationwide operator route/timetable coverage is not complete.
- No official Jhargram–Kharagpur–Kolkata bus timetable has been asserted.
- Live bus tracking is unavailable where no fresh consented GPS observations exist.
