# India Transit Data Ingestion & Provenance

## 1. Overview
This directory contains schemas, ingest scripts, and sample datasets for the India-Wide Smart Bus Platform.

To maintain an initial **₹0 budget**, all core geographical and timetable records are ingested from legitimate, legally reusable open datasets rather than querying paid third-party APIs.

---

## 2. Supported Ingestion Formats

1. **Census & Administrative CSVs**:
   - Primary administrative boundaries: States, Districts, Subdivisions, Tehsils, Talukas, and Cities.
   - Script: `data/import-scripts/importPlacesCsv.js`

2. **GTFS Static Feeds (General Transit Feed Specification)**:
   - Industry standard for public transport agencies.
   - Supports: `agency.txt`, `routes.txt`, `trips.txt`, `stops.txt`, `stop_times.txt`.
   - Script: `data/import-scripts/importGtfs.js`

3. **Community Crowdsourced Contributions**:
   - Ingested via the account-free web submission queue after duplicate checks.

---

## 3. Data Licensing & Provenance Table

| Dataset | Source Authority | License | Coverage / Notes |
| :--- | :--- | :--- | :--- |
| **OpenStreetMap Extract** | OpenStreetMap Contributors | Open Database License (ODbL) | Transport nodes, bus terminals, route road geometry |
| **Delhi Transport Data** | Delhi Open Transport Data Portal | Government Open Data License (GODL) | DTC routes, stop coordinates, scheduled frequency |
| **BEST Transit Data** | BEST Undertaking Open Data | Public Transit Open Data | Mumbai bus routes, terminals, stop sequences |
| **WBTC Kolkata Data** | Transport Dept, Govt of West Bengal | Public Transit Open Data | Kolkata city and intercity express schedules |
| **BMTC Bengaluru Data** | BMTC Open Data Portal | Open Data License | Kempegowda Majestic & Electronic City corridors |

---

## 4. Normalization & Deduplication Rules
- All place and stop names undergo Unicode NFC normalization, trimming, and casing standardisation.
- Duplicate detection matches incoming records against existing canonical records using Jaro-Winkler string similarity with an 80% threshold.
- Regional variations in administrative terminology (e.g., *Tehsil* in North India vs *Taluka* in Maharashtra vs *Mandal* in Andhra/Telangana) are normalized into the hierarchical `PlaceType` structure.
