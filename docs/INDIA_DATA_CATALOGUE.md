# India Data Catalogue — Phase 3

## Scope and current coverage

YatraBus now ships a structured administrative reference catalogue for all 28 States and 8 Union Territories, plus a searchable starter index for the Jhargram–Kharagpur–Kolkata pilot corridor.

The catalogue stores administrative type, capital/administrative seat, aliases, region, official government reference URL and review date. Seasonal and shared capital distinctions are noted instead of flattening them into a misleading single-capital claim.

**Important:** State and UT records are reference entries, not bus service records. The town starter index is UNVERIFIED and does not create fake bus stops, coordinates or routes. Fifteen terminal candidates from a 3 March 2017 public directory snapshot are also included as historical, UNVERIFIED references; current operation and service coverage are not asserted.

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

The backend now refreshes from the latest dated LGD export available in the upstream mirror. Every downloaded archive is SHA-256 checked before import. The 3 November 2026 snapshot contains 20,294 administrative, block and urban-local-body/town records: 35 current LGD state/UT rows, 787 districts, 7,095 sub-districts, 7,327 blocks and 5,050 urban-local-body/town records. The compact catalogue is bundled as `backend/data/india-lgd-directory.json.gz`.

The complete village roster is stored separately under `backend/data/lgd-villages/` as first-Unicode-character gzip shards. The backend loads only the shard matching the first character of the passenger's query and keeps a small bounded cache; it does not expand or scan the full village roster on each keystroke. Both English and local-language village names are indexed when present. The manifest records the source snapshot date, unique village count and shard counts. The 3 November 2026 source export did not expose a local-language village-name column, so this snapshot's village records are currently searchable by their English names; Hindi/Bengali coverage is retained only where aliases already exist in other catalogue records. A future export with local-language fields will be indexed automatically.

All LGD-derived entries remain UNVERIFIED until a verifier checks them. LGD administrative names are not proof of a bus stop, active route or timetable. Coordinates are not invented when the source export has none.

## What is not claimed as complete

- The backend index includes 677,664 LGD village records in lazy shards; they are not copied into the APK binary itself and require the deployed backend to be reachable.
- Every small-town bus stop has not been surveyed or verified.
- Nationwide operator route/timetable coverage is not complete.
- No official Jhargram–Kharagpur–Kolkata bus timetable has been asserted.
- Live bus tracking is unavailable where no fresh consented GPS observations exist.
