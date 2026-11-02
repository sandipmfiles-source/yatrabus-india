# YatraBus India — Open Data Catalogue

This folder contains the India administrative reference index, source-aware ingestion tools, and pilot transit place data.

## Included in Phase 3

- All **28 States and 8 Union Territories** are represented in the shared administrative catalogue.
- Capital/administrative-seat references, aliases, region tags, official government reference URLs, and review dates are retained.
- The West Bengal pilot index contains searchable town references for Jhargram, Kharagpur, Midnapore, Salboni, Debra, Panskura, Kolaghat, Uluberia, Howrah, Kolkata, Santragachi, Lodhasuli, Gopiballavpur and Belpahari.
- 15 bus terminal references are taken from the West Bengal Transport Department's 3 March 2017 terminal directory and remain UNVERIFIED until current locations are rechecked.
- One SBSTC 2019 special-event service notice is retained as historical-only evidence; it is never used as a current timetable.
- Government transport undertakings are maintained separately as directory candidates; an entry does not mean that an operator has claimed or authenticated its profile.
- Timetable and place provenance are explicit. Records without source-backed verification remain UNVERIFIED / UNAVAILABLE.

## Bundled LGD baseline (14,207 records)

The repository includes a reproducible **11 March 2022** LGD snapshot:
- 36 States/UTs
- 763 districts
- 6,921 sub-districts
- 1,673 blocks
- 4,814 urban local bodies (municipal corporations, municipalities and town bodies)

The original CSV inputs are in `data/lgd-source-snapshot-2022/`; the compact passenger-search indexes are in `data/lgd-index/`. This is a historical baseline, not a claim that the counts or boundaries are current in 2026. Newly created districts and changed local bodies must be synchronized from a newer official LGD export. All imported records remain UNVERIFIED.

To rebuild the bundled index from the included source snapshot:

```bash
node --loader ts-node/esm data/import-scripts/importLgdDirectory.ts data/lgd-source-snapshot-2022 data/india-lgd-directory.json.gz 2022-03-11
```

The runtime currently loads the split JSON files in `data/lgd-index/`; the gzip output is supported for compact future snapshots.

## LGD administrative and urban-local-body directory

The Ministry of Panchayati Raj's Local Government Directory (LGD) is the source of record for administrative entities and unique LGD codes:
- Official portal: https://lgdirectory.gov.in/
- Ministry of Panchayati Raj overview: https://panchayat.gov.in/en/lgd/
- Open Government Data catalogue: https://data.gov.in/catalog/local-government-directory-lgd
- Monthly refreshed LGD archive mirror referenced by the dataset maintainer: https://ramseraph.github.io/opendata/lgd/ (verify any downloaded snapshot against the official LGD portal before publishing)

The full all-India LGD download is large and changes over time. Do not put the 676k+ village roster into passenger autocomplete. Instead, download the current official LGD CSV exports and place these files in `data/lgd-source/`:

- `states.csv`
- `districts.csv`
- `subdistricts.csv`
- `blocks.csv`
- `urban-local-bodies.csv` (municipal corporations, municipalities, town councils and other urban bodies)

Then build the compact, searchable administrative/town index:

```bash
node --loader ts-node/esm data/import-scripts/importLgdDirectory.ts data/lgd-source data/india-lgd-directory.json.gz 2026-11-03
```

The generated `data/india-lgd-directory.json.gz` is loaded by the backend place autocomplete. Keep the original source exports and retrieval date for audit/reproducibility; do not commit sensitive or restricted source files.

The importer:
- preserves LGD codes as `sourceRecordId`;
- records GODL-India attribution and the official LGD source URL;
- includes administrative units and the available urban-local-body/town layer by default; this is not a complete Census Town or village gazetteer;
- leaves every imported place UNVERIFIED until a verifier checks it;
- does not invent coordinates when the export has none.

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
