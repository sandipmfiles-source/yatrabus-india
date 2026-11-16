-- Index consented GPS observations by session and route for fast, privacy-filtered reads.
-- Raw GPS retention is enforced by the scheduled prune workflow; no existing rows are deleted here.

CREATE INDEX IF NOT EXISTS idx_location_session_observed
  ON location_observations(session_id, observed_at DESC);

CREATE INDEX IF NOT EXISTS idx_location_route_observed
  ON location_observations(route_id, observed_at DESC);

CREATE INDEX IF NOT EXISTS idx_journey_route_status
  ON journey_sessions(route_id, status);

CREATE INDEX IF NOT EXISTS idx_journey_status_started
  ON journey_sessions(status, started_at);
