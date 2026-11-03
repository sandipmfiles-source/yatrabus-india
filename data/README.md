# YatraBus India — Open Data Catalogue

This folder contains the India administrative reference index, source-aware ingestion tools, and pilot transit place data.

## Included in Phase 3

- All **28 States and 8 Union Territories** are represented in the shared administrative catalogue.
- Capital/administrative-seat references, aliases, region tags, official government reference URLs, and review dates are retained.
- The West Bengal pilot index contains searchable town references for Jhargram, Kharagpur, Midnapore, Salboni, Debra, Panskura, Kolaghat, Uluberia, Howrah, Kolkata, Santragachi, Lodhasuli, Gopiballavpur and Belpahari.
- Fifteen historical West Bengal bus-terminal candidates are included from a 3 March 2017 public directory snapshot. They remain UNVERIFIED, carry no coordinates, and are not claims of current operation.
- Government transport undertakings are maintained separately as directory candidates; an entry does not mean that an operator has claimed or authenticated its profile.
- Timetable and place provenance are explicit. Records without source-backed verification remain UNVERIFIED / UNAVAILABLE.

## Full town and administrative directory from LGD

The Ministry of Panchayati Raj's Local Government Directory (LGD) is the source of record for administrative entities and unique LGD codes:
- Official portal: https://lgdirectory.gov.in/
- Ministry of Panchayati Raj overview: https://panchayat.gov.in/en/lgd/
- Open Government Data catalogue: https://data.gov.in/catalog/local-government-directory-lgd

The all-India LGD export includes administrative entities, urban local bodies and the large village roster. The backend stores the searchable administrative/town catalogue in `backend/data/india-lgd-directory.json.gz` and the complete village roster separately in `backend/data/lgd-villages/`.

The village index is split into gzip shards by the first Unicode character of the English and local-language names. Passenger search loads only the matching shard and keeps a bounded cache; it does not load or scan all 676k+ villages on every keystroke. This makes the full village directory searchable without holding the entire dataset in backend memory.

The automated GitHub Actions refresh resolves the latest dated LGD export available in the upstream mirror's `lgd-latest` release and verifies each archive against its SHA-256 digest. It derives state/district/subdistrict hierarchy from the village export, imports blocks and urban local bodies, creates village shards, validates record counts and snapshot consistency, and commits the refreshed backend datasets.

The importer:
- preserves LGD codes as source record IDs;
- records GODL-India attribution, official LGD source URL and snapshot date;
- indexes state, district, sub-district, block, urban-local-body/town and village names;
- indexes local-language village names when present;
- leaves every imported place UNVERIFIED until a verifier checks it;
- does not invent coordinates, bus stops, routes or timetables when the source has none.

## GTFS static feed import

GTFS ZIP files can be previewed and imported by the Super Admin from **Admin → GTFS Import**. Imported records remain UNVERIFIED and timetable data remains UNAVAILABLE until a human checks the operator's current publication and records the source and verification date.

## Timetable data status rules

| Status | Meaning |
|---|---|
| LIVE_GPS | Fresh, consented GPS observation; never inferred from a timetable |
| ESTIMATED | Modelled ETA/location estimate; never described as live |
| SCHEDULED | Official timetable source has been reviewed and verification timestamp recorded |
| UNAVAILABLE | No reliable, source-verified timetable or location evidence |

A route with an old sample time, a third-party search snippet, or a GTFS import awaiting review is not SCHEDULED.

## Licensing and attribution

- LGD data: Government Open Data License — India (GODL-India).
- OpenStreetMap-derived places/geometry: Open Database License (ODbL), with attribution to © OpenStreetMap contributors.
- Operator directory: public transport undertaking references; each entry carries its source dataset and website where known.
- YatraBus-generated indexes are not a replacement for official government records.
