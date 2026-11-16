-- YatraBus India: explicit bus-to-route assignments.
-- Additive migration; existing bus and route records are not modified.

CREATE TABLE IF NOT EXISTS bus_route_assignments (
  id TEXT PRIMARY KEY,
  bus_id TEXT NOT NULL,
  route_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  assigned_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  payload_json TEXT NOT NULL,
  FOREIGN KEY (bus_id) REFERENCES buses(id) ON DELETE CASCADE,
  FOREIGN KEY (route_id) REFERENCES routes(id) ON DELETE CASCADE,
  UNIQUE (bus_id, route_id)
);

CREATE INDEX IF NOT EXISTS idx_bus_route_assignments_route_status
  ON bus_route_assignments(route_id, status);

CREATE INDEX IF NOT EXISTS idx_bus_route_assignments_bus_status
  ON bus_route_assignments(bus_id, status);

CREATE INDEX IF NOT EXISTS idx_location_session_observed
  ON location_observations(session_id, observed_at DESC);
