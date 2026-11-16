-- YatraBus India: Cloudflare D1 initial schema
-- SQLite-compatible. Apply with: npx wrangler d1 migrations apply yatrabus-india-db
-- Domain payloads are retained as JSON text while frequently queried fields
-- are indexed relationally. This avoids lossy conversion from the existing
-- PostgreSQL/PostGIS model during the first migration.

CREATE TABLE IF NOT EXISTS places (
  id TEXT PRIMARY KEY,
  canonical_name TEXT NOT NULL,
  place_type TEXT NOT NULL,
  state TEXT NOT NULL,
  district TEXT NOT NULL,
  subdivision TEXT,
  latitude REAL,
  longitude REAL,
  source_dataset TEXT,
  verification_status TEXT NOT NULL DEFAULT 'pending',
  last_updated TEXT,
  aliases_json TEXT NOT NULL DEFAULT '[]',
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_places_name ON places(canonical_name);
CREATE INDEX IF NOT EXISTS idx_places_state_district ON places(state, district);
CREATE INDEX IF NOT EXISTS idx_places_type ON places(place_type);
CREATE INDEX IF NOT EXISTS idx_places_coordinates ON places(latitude, longitude);

CREATE TABLE IF NOT EXISTS operators (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS buses (
  id TEXT PRIMARY KEY,
  operator_id TEXT,
  registration_number TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (operator_id) REFERENCES operators(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_buses_operator ON buses(operator_id);
CREATE INDEX IF NOT EXISTS idx_buses_registration ON buses(registration_number);

CREATE TABLE IF NOT EXISTS routes (
  id TEXT PRIMARY KEY,
  name TEXT,
  origin_place_id TEXT,
  destination_place_id TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  stops_json TEXT NOT NULL DEFAULT '[]',
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (origin_place_id) REFERENCES places(id) ON DELETE SET NULL,
  FOREIGN KEY (destination_place_id) REFERENCES places(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_routes_origin_destination
  ON routes(origin_place_id, destination_place_id);

CREATE TABLE IF NOT EXISTS timetables (
  id TEXT PRIMARY KEY,
  route_id TEXT NOT NULL,
  departure_time TEXT,
  service_days_json TEXT NOT NULL DEFAULT '[]',
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (route_id) REFERENCES routes(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_timetables_route_time
  ON timetables(route_id, departure_time);

CREATE TABLE IF NOT EXISTS journey_sessions (
  id TEXT PRIMARY KEY,
  bus_id TEXT NOT NULL,
  route_id TEXT NOT NULL,
  consent_given INTEGER NOT NULL CHECK (consent_given IN (0, 1)),
  status TEXT NOT NULL DEFAULT 'active',
  started_at TEXT NOT NULL,
  stopped_at TEXT,
  payload_json TEXT NOT NULL,
  FOREIGN KEY (bus_id) REFERENCES buses(id) ON DELETE CASCADE,
  FOREIGN KEY (route_id) REFERENCES routes(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_journey_sessions_bus_status
  ON journey_sessions(bus_id, status);

CREATE TABLE IF NOT EXISTS location_observations (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  bus_id TEXT NOT NULL,
  route_id TEXT NOT NULL,
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  accuracy REAL,
  speed REAL,
  heading REAL,
  observed_at TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  FOREIGN KEY (session_id) REFERENCES journey_sessions(id) ON DELETE CASCADE,
  FOREIGN KEY (bus_id) REFERENCES buses(id) ON DELETE CASCADE,
  FOREIGN KEY (route_id) REFERENCES routes(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_location_bus_observed
  ON location_observations(bus_id, observed_at DESC);

CREATE TABLE IF NOT EXISTS community_submissions (
  id TEXT PRIMARY KEY,
  submission_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  submitted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reviewed_at TEXT,
  payload_json TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_submissions_status_date
  ON community_submissions(status, submitted_at DESC);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  actor_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  payload_json TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_entity_date
  ON audit_logs(entity_type, entity_id, created_at DESC);

CREATE TABLE IF NOT EXISTS automation_rules (
  id TEXT PRIMARY KEY,
  is_enabled INTEGER NOT NULL DEFAULT 0 CHECK (is_enabled IN (0, 1)),
  threshold_value REAL,
  payload_json TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS schema_migrations (
  version TEXT PRIMARY KEY,
  applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
