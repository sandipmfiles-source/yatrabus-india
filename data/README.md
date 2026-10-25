# YatriBus Open Data Ingestion Framework

This directory contains repeatable data ingestion scripts, format converters, and metadata registers for public datasets across Indian states and union territories.

## Legal and License Compliance
All imported datasets must respect:
1. **Source Licensing**: Only ODbL, GODL-India, or compatible open public domain data may be imported.
2. **Attribution**: Every record in the database maintains `source_dataset` and `source_license` columns.
3. **Data Freshness**: Original record identifiers (`source_record_id`) are preserved so updates can be synchronised cleanly without creating orphan records.

## Repeatable Ingestion Commands
- Ingest places from CSV/JSON:
  ```bash
  node --loader ts-node/esm data/import-scripts/importPlaces.ts
  ```
- Parse GTFS static feed:
  ```bash
  node --loader ts-node/esm data/import-scripts/importGTFS.ts
  ```
