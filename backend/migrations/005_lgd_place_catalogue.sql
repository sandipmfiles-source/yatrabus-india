-- 005_lgd_place_catalogue.sql
-- Import the official Local Government Directory hierarchy after downloading
-- the current all-India CSV to data/lgd_places.csv.
-- Expected columns:
-- state_code,state_name,district_code,district_name,sub-district_code,
-- sub-district_name,village_code,village_name
--
-- Run with psql from the repository root:
--   psql "$DATABASE_URL" -f backend/migrations/005_lgd_place_catalogue.sql
-- The source CSV is intentionally not committed: it is a large, periodically
-- changing government dataset and must be refreshed from the source portal.

BEGIN;

CREATE TEMP TABLE lgd_import_stage (
  state_code TEXT NOT NULL,
  state_name TEXT NOT NULL,
  district_code TEXT NOT NULL,
  district_name TEXT NOT NULL,
  subdistrict_code TEXT NOT NULL,
  subdistrict_name TEXT NOT NULL,
  village_code TEXT NOT NULL,
  village_name TEXT NOT NULL
) ON COMMIT DROP;

\copy lgd_import_stage (state_code,state_name,district_code,district_name,subdistrict_code,subdistrict_name,village_code,village_name) FROM 'data/lgd_places.csv' WITH (FORMAT csv, HEADER true, ENCODING 'UTF8');

-- States / Union Territories
INSERT INTO places (
  id, canonical_name, names_json, place_type, parent_id, state,
  source_dataset, source_record_id, source_license, verification_status, aliases
)
SELECT DISTINCT
  'lgd-state-' || state_code,
  state_name,
  jsonb_build_object('en', state_name),
  'STATE',
  NULL,
  state_name,
  'LOCAL_GOVERNMENT_DIRECTORY',
  state_code,
  'GODL-India',
  'UNVERIFIED',
  '{}'::text[]
FROM lgd_import_stage
WHERE state_code <> '' AND state_name <> ''
ON CONFLICT (id) DO UPDATE SET
  canonical_name = EXCLUDED.canonical_name,
  names_json = EXCLUDED.names_json,
  state = EXCLUDED.state,
  updated_at = NOW();

-- Districts
INSERT INTO places (
  id, canonical_name, names_json, place_type, parent_id, district, state,
  source_dataset, source_record_id, source_license, verification_status, aliases
)
SELECT DISTINCT
  'lgd-district-' || district_code,
  district_name,
  jsonb_build_object('en', district_name),
  'DISTRICT',
  'lgd-state-' || state_code,
  district_name,
  state_name,
  'LOCAL_GOVERNMENT_DIRECTORY',
  district_code,
  'GODL-India',
  'UNVERIFIED',
  '{}'::text[]
FROM lgd_import_stage
WHERE district_code <> '' AND district_name <> '' AND state_code <> ''
ON CONFLICT (id) DO UPDATE SET
  canonical_name = EXCLUDED.canonical_name,
  names_json = EXCLUDED.names_json,
  parent_id = EXCLUDED.parent_id,
  district = EXCLUDED.district,
  state = EXCLUDED.state,
  updated_at = NOW();

-- Sub-districts / tehsils / talukas
INSERT INTO places (
  id, canonical_name, names_json, place_type, parent_id, district, state,
  source_dataset, source_record_id, source_license, verification_status, aliases
)
SELECT DISTINCT
  'lgd-subdistrict-' || subdistrict_code,
  subdistrict_name,
  jsonb_build_object('en', subdistrict_name),
  'SUBDIVISION',
  'lgd-district-' || district_code,
  district_name,
  state_name,
  'LOCAL_GOVERNMENT_DIRECTORY',
  subdistrict_code,
  'GODL-India',
  'UNVERIFIED',
  '{}'::text[]
FROM lgd_import_stage
WHERE subdistrict_code <> '' AND subdistrict_name <> '' AND district_code <> ''
ON CONFLICT (id) DO UPDATE SET
  canonical_name = EXCLUDED.canonical_name,
  names_json = EXCLUDED.names_json,
  parent_id = EXCLUDED.parent_id,
  district = EXCLUDED.district,
  state = EXCLUDED.state,
  updated_at = NOW();

-- Revenue villages
INSERT INTO places (
  id, canonical_name, names_json, place_type, parent_id, district, state,
  source_dataset, source_record_id, source_license, verification_status, aliases
)
SELECT DISTINCT
  'lgd-village-' || village_code,
  village_name,
  jsonb_build_object('en', village_name),
  'VILLAGE',
  'lgd-subdistrict-' || subdistrict_code,
  district_name,
  state_name,
  'LOCAL_GOVERNMENT_DIRECTORY',
  village_code,
  'GODL-India',
  'UNVERIFIED',
  '{}'::text[]
FROM lgd_import_stage
WHERE village_code <> '' AND village_name <> '' AND subdistrict_code <> ''
ON CONFLICT (id) DO UPDATE SET
  canonical_name = EXCLUDED.canonical_name,
  names_json = EXCLUDED.names_json,
  parent_id = EXCLUDED.parent_id,
  district = EXCLUDED.district,
  state = EXCLUDED.state,
  updated_at = NOW();

CREATE INDEX IF NOT EXISTS idx_places_lgd_state ON places (state);
CREATE INDEX IF NOT EXISTS idx_places_lgd_district ON places (district);
CREATE INDEX IF NOT EXISTS idx_places_lgd_parent ON places (parent_id);

COMMIT;
