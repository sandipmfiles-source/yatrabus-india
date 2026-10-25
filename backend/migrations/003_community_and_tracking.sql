-- 003_community_and_tracking.sql
-- Community Contribution, Consent-Based Journey Tracking & Privacy-Preserving Aggregates

CREATE TABLE IF NOT EXISTS community_submissions (
    id VARCHAR(64) PRIMARY KEY,
    reference_id VARCHAR(50) NOT NULL UNIQUE,
    submission_type VARCHAR(50) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    target_entity_id VARCHAR(64),
    contributor_note TEXT,
    proposed_data JSONB NOT NULL,
    existing_snapshot JSONB,
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING_REVIEW',
    admin_decision_reason TEXT,
    corroboration_count INT NOT NULL DEFAULT 1,
    duplicate_candidate_ids TEXT[] DEFAULT '{}',
    reviewed_by VARCHAR(64),
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_submissions_ref_id ON community_submissions (reference_id);
CREATE INDEX IF NOT EXISTS idx_submissions_status ON community_submissions (status);
CREATE INDEX IF NOT EXISTS idx_submissions_entity ON community_submissions (entity_type, target_entity_id);

CREATE TABLE IF NOT EXISTS consent_records (
    id VARCHAR(64) PRIMARY KEY,
    session_id VARCHAR(64) NOT NULL,
    scope VARCHAR(50) NOT NULL DEFAULT 'JOURNEY_TRACKING',
    status VARCHAR(50) NOT NULL,
    granted_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    ip_hash VARCHAR(64),
    user_agent_snippet VARCHAR(255),
    disclosures_accepted BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_consent_session ON consent_records (session_id);

CREATE TABLE IF NOT EXISTS journey_sessions (
    id VARCHAR(64) PRIMARY KEY,
    bus_id VARCHAR(64) NOT NULL REFERENCES buses(id) ON DELETE CASCADE,
    route_id VARCHAR(64) NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
    origin_stop_id VARCHAR(64),
    destination_stop_id VARCHAR(64),
    start_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_active_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    max_expiry_time TIMESTAMPTZ NOT NULL, -- Safety limit: Max 12 hours
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    is_confirmed_passenger BOOLEAN NOT NULL DEFAULT TRUE,
    observations_contributed_count INT NOT NULL DEFAULT 0,
    stopped_reason VARCHAR(50)
);

CREATE INDEX IF NOT EXISTS idx_journey_sessions_bus ON journey_sessions (bus_id, is_active);

-- Raw observations stored with strict retention limit (purged automatically)
CREATE TABLE IF NOT EXISTS location_observations (
    id VARCHAR(64) PRIMARY KEY,
    session_id VARCHAR(64) NOT NULL REFERENCES journey_sessions(id) ON DELETE CASCADE,
    bus_id VARCHAR(64) NOT NULL REFERENCES buses(id) ON DELETE CASCADE,
    route_id VARCHAR(64) NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    accuracy_meters NUMERIC(6,2) NOT NULL,
    speed_kmh NUMERIC(6,2),
    heading_degrees NUMERIC(6,2),
    distance_from_route_meters NUMERIC(8,2) NOT NULL,
    is_route_matched BOOLEAN NOT NULL DEFAULT TRUE,
    is_direction_consistent BOOLEAN NOT NULL DEFAULT TRUE,
    is_speed_realistic BOOLEAN NOT NULL DEFAULT TRUE,
    confidence_score INT NOT NULL DEFAULT 50,
    confidence_category VARCHAR(20) NOT NULL DEFAULT 'MODERATE',
    processing_status VARCHAR(50) NOT NULL DEFAULT 'ACCEPTED',
    rejection_reason TEXT,
    observed_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_obs_bus_time ON location_observations (bus_id, observed_at DESC);

-- Bus-level aggregated location table (PUBLIC FACING - Never exposes individual traces)
CREATE TABLE IF NOT EXISTS bus_location_aggregates (
    bus_id VARCHAR(64) PRIMARY KEY REFERENCES buses(id) ON DELETE CASCADE,
    route_id VARCHAR(64) NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
    display_state VARCHAR(50) NOT NULL DEFAULT 'UNAVAILABLE',
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    accuracy_meters NUMERIC(6,2),
    bearing NUMERIC(6,2),
    speed_kmh NUMERIC(6,2),
    confidence_category VARCHAR(20) NOT NULL DEFAULT 'LOW',
    confidence_score INT NOT NULL DEFAULT 0,
    observation_count INT NOT NULL DEFAULT 0,
    independent_contributors_count INT NOT NULL DEFAULT 0,
    last_observed_at TIMESTAMPTZ,
    estimated_next_stop_name VARCHAR(255),
    estimated_arrival_minutes INT,
    status_explanation TEXT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS duplicate_candidates (
    id VARCHAR(64) PRIMARY KEY,
    entity_type VARCHAR(50) NOT NULL,
    primary_entity_id VARCHAR(64) NOT NULL,
    secondary_entity_id VARCHAR(64) NOT NULL,
    similarity_score INT NOT NULL,
    matching_factors TEXT[] NOT NULL DEFAULT '{}',
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    resolved_by VARCHAR(64),
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS operator_claims (
    id VARCHAR(64) PRIMARY KEY,
    operator_id VARCHAR(64) NOT NULL REFERENCES operators(id) ON DELETE CASCADE,
    claimant_name VARCHAR(100) NOT NULL,
    claimant_role VARCHAR(100) NOT NULL,
    official_email VARCHAR(150),
    contact_number VARCHAR(50) NOT NULL,
    proof_document_note TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    admin_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
