-- 004_admin_automation.sql
-- Administrator Accounts, Automation Rules, Audit Logs & System Health

CREATE TABLE IF NOT EXISTS admin_users (
    id VARCHAR(64) PRIMARY KEY,
    email VARCHAR(150) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(100) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'TRANSIT_VERIFIER',
    assigned_state VARCHAR(100),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS automation_rules (
    id VARCHAR(64) PRIMARY KEY,
    rule_code VARCHAR(100) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    parameters JSONB NOT NULL DEFAULT '{}'::jsonb,
    last_triggered_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id VARCHAR(64) PRIMARY KEY,
    entity_type VARCHAR(50) NOT NULL,
    entity_id VARCHAR(64) NOT NULL,
    action VARCHAR(50) NOT NULL,
    actor_id VARCHAR(64) NOT NULL,
    actor_role VARCHAR(50) NOT NULL,
    reason TEXT,
    previous_payload JSONB,
    new_payload JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs (created_at DESC);

-- Seed Initial Default Automation Rules
INSERT INTO automation_rules (id, rule_code, name, description, is_enabled, parameters)
VALUES
    ('rule-gps-freshness', 'GPS_FRESHNESS_MONITOR', 'GPS Observation Freshness Enforcer', 'Marks observations older than 120s as Last Known, and older than 600s as Unavailable', TRUE, '{"liveThresholdSeconds": 120, "staleThresholdSeconds": 600}'::jsonb),
    ('rule-auto-publish-minor', 'AUTO_PUBLISH_MINOR_TIMETABLE', 'Low-Risk Timetable Correction Review', 'Requires explicit administrator verification for schedule shifts exceeding 15 minutes', FALSE, '{"maxAllowedShiftMinutes": 15, "minCorroboratingSubmissions": 3}'::jsonb),
    ('rule-duplicate-scanner', 'DUPLICATE_STOP_SCANNER', 'Duplicate Transit Stops Candidate Generator', 'Flags stops within 150m with >65% token similarity', TRUE, '{"distanceMeters": 150, "similarityThreshold": 0.65}'::jsonb),
    ('rule-session-safety-expiry', 'SESSION_SAFETY_EXPIRY', '12-Hour Journey Session Enforcer', 'Terminates journey tracking sessions older than 12 hours automatically', TRUE, '{"maxSessionHours": 12}'::jsonb)
ON CONFLICT (rule_code) DO NOTHING;
