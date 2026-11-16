-- YatraBus India: persistent single-owner Super Admin security state.
-- Tokens are stored only as SHA-256 hashes; raw bearer tokens are never persisted.

CREATE TABLE IF NOT EXISTS admin_sessions (
  token_hash TEXT PRIMARY KEY,
  owner_email TEXT NOT NULL,
  session_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  revoked_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_admin_sessions_owner_expiry
  ON admin_sessions(owner_email, expires_at);

CREATE TABLE IF NOT EXISTS admin_login_attempts (
  ip_hash TEXT PRIMARY KEY,
  window_started_at TEXT NOT NULL,
  failed_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until TEXT
);

CREATE INDEX IF NOT EXISTS idx_admin_login_lock
  ON admin_login_attempts(locked_until);

CREATE TABLE IF NOT EXISTS operator_claims (
  id TEXT PRIMARY KEY,
  operator_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending_review',
  submitted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reviewed_at TEXT,
  payload_json TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_operator_claims_status_date
  ON operator_claims(status, submitted_at DESC);

CREATE TABLE IF NOT EXISTS service_alerts (
  id TEXT PRIMARY KEY,
  route_id TEXT NOT NULL,
  alert_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  valid_until TEXT,
  payload_json TEXT NOT NULL,
  FOREIGN KEY (route_id) REFERENCES routes(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_service_alerts_route_status
  ON service_alerts(route_id, status, valid_until);

CREATE TABLE IF NOT EXISTS public_rate_limits (
  bucket_key TEXT NOT NULL,
  ip_hash TEXT NOT NULL,
  window_started_at TEXT NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (bucket_key, ip_hash)
);

CREATE INDEX IF NOT EXISTS idx_public_rate_limits_window
  ON public_rate_limits(window_started_at);
