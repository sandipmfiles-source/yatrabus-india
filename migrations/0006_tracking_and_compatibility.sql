-- YatraBus D1: consented tracking, QR verification and admin review support.
-- This migration is additive. It does not modify or delete existing route/place/timetable data.

ALTER TABLE journey_sessions ADD COLUMN origin_stop_id TEXT;
ALTER TABLE journey_sessions ADD COLUMN destination_stop_id TEXT;
ALTER TABLE journey_sessions ADD COLUMN last_active_time TEXT;
ALTER TABLE journey_sessions ADD COLUMN max_expiry_time TEXT;
ALTER TABLE journey_sessions ADD COLUMN observations_contributed_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE journey_sessions ADD COLUMN stopped_reason TEXT;

ALTER TABLE location_observations ADD COLUMN location_source TEXT NOT NULL DEFAULT 'GPS';
ALTER TABLE location_observations ADD COLUMN distance_from_route_meters REAL;
ALTER TABLE location_observations ADD COLUMN is_route_matched INTEGER NOT NULL DEFAULT 0;
ALTER TABLE location_observations ADD COLUMN confidence_score INTEGER NOT NULL DEFAULT 0;
ALTER TABLE location_observations ADD COLUMN confidence_category TEXT NOT NULL DEFAULT 'LOW';
ALTER TABLE location_observations ADD COLUMN processing_status TEXT NOT NULL DEFAULT 'HELD_FOR_REVIEW';
ALTER TABLE location_observations ADD COLUMN rejection_reason TEXT;

CREATE TABLE IF NOT EXISTS consent_records (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  scope TEXT NOT NULL CHECK (scope = 'JOURNEY_TRACKING'),
  status TEXT NOT NULL CHECK (status IN ('GRANTED','DECLINED','REVOKED')),
  granted_at TEXT,
  revoked_at TEXT,
  disclosures_accepted INTEGER NOT NULL DEFAULT 0,
  user_agent_snippet TEXT,
  ip_hash TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_consent_records_session ON consent_records(session_id, created_at);

CREATE TABLE IF NOT EXISTS cell_observations (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  bus_id TEXT NOT NULL,
  route_id TEXT NOT NULL,
  radio_type TEXT NOT NULL,
  mcc TEXT NOT NULL,
  mnc TEXT NOT NULL,
  area_code INTEGER NOT NULL,
  cell_id TEXT NOT NULL,
  signal_dbm INTEGER NOT NULL,
  is_registered INTEGER NOT NULL DEFAULT 0,
  observed_at TEXT NOT NULL,
  payload_json TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_cell_observations_session_time ON cell_observations(session_id, observed_at);
CREATE INDEX IF NOT EXISTS idx_cell_observations_bus_time ON cell_observations(bus_id, observed_at);

CREATE TABLE IF NOT EXISTS bus_location_aggregates (
  bus_id TEXT PRIMARY KEY,
  route_id TEXT NOT NULL,
  display_state TEXT NOT NULL CHECK (display_state IN ('LIVE','LAST_KNOWN','ESTIMATED','UNAVAILABLE')),
  location_source TEXT NOT NULL,
  latitude REAL,
  longitude REAL,
  accuracy_meters REAL,
  bearing REAL,
  speed_kmh REAL,
  confidence_category TEXT NOT NULL DEFAULT 'LOW',
  confidence_score INTEGER NOT NULL DEFAULT 0,
  observation_count INTEGER NOT NULL DEFAULT 0,
  independent_contributors_count INTEGER NOT NULL DEFAULT 0,
  last_observed_at TEXT,
  estimated_next_stop_name TEXT,
  estimated_arrival_minutes INTEGER,
  is_live INTEGER NOT NULL DEFAULT 0,
  status_explanation TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  payload_json TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_bus_location_state_time ON bus_location_aggregates(display_state, last_observed_at);

CREATE TABLE IF NOT EXISTS stop_qr_tokens (
  id TEXT PRIMARY KEY,
  route_id TEXT NOT NULL,
  stop_id TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by TEXT NOT NULL,
  revoked_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_stop_qr_route_stop ON stop_qr_tokens(route_id, stop_id, expires_at);

CREATE TABLE IF NOT EXISTS contribution_votes (
  id TEXT PRIMARY KEY,
  reference_id TEXT NOT NULL,
  voter_hash TEXT NOT NULL,
  field_name TEXT NOT NULL,
  proposed_value TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(reference_id, voter_hash, field_name)
);
CREATE INDEX IF NOT EXISTS idx_contribution_votes_reference ON contribution_votes(reference_id, created_at);

CREATE TABLE IF NOT EXISTS duplicate_candidates (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('PLACE','BUS','ROUTE')),
  primary_entity_id TEXT NOT NULL,
  secondary_entity_id TEXT NOT NULL,
  similarity_score INTEGER NOT NULL,
  matching_factors_json TEXT NOT NULL DEFAULT '[]',
  recommendation TEXT NOT NULL DEFAULT 'REQUIRES_MANUAL_REVIEW',
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','MERGED','REJECTED_DIFFERENT')),
  resolved_by TEXT,
  resolved_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(entity_type, primary_entity_id, secondary_entity_id)
);
CREATE INDEX IF NOT EXISTS idx_duplicate_candidates_status ON duplicate_candidates(status, created_at);

CREATE TABLE IF NOT EXISTS gtfs_import_jobs (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL CHECK (status IN ('PREVIEWED','IMPORTED','REJECTED','FAILED')),
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TEXT,
  payload_json TEXT NOT NULL,
  result_json TEXT
);
CREATE INDEX IF NOT EXISTS idx_gtfs_import_jobs_status ON gtfs_import_jobs(status, created_at);
