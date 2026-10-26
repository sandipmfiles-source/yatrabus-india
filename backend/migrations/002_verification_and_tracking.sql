-- ====================================================================
-- INDIA-WIDE SMART BUS PLATFORM: DATABASE MIGRATION 002
-- Operator Claims, GTFS Provenance, and Retention Policies
-- ====================================================================

-- 1. OPERATOR CLAIMS & VERIFICATION TABLE
CREATE TABLE IF NOT EXISTS operator_claims (
    id VARCHAR(64) PRIMARY KEY,
    operator_id VARCHAR(64) NOT NULL REFERENCES operators(id) ON DELETE CASCADE,
    claimant_name VARCHAR(255) NOT NULL,
    claimant_designation VARCHAR(100) NOT NULL,
    official_phone VARCHAR(50) NOT NULL,
    official_email VARCHAR(100) NOT NULL,
    supporting_documents_note TEXT,
    status VARCHAR(32) DEFAULT 'pending_review', -- 'pending_review', 'verified', 'rejected'
    submitted_at TIMESTAMPTZ DEFAULT NOW(),
    reviewed_at TIMESTAMPTZ,
    reviewed_by VARCHAR(64),
    admin_remarks TEXT
);

CREATE INDEX IF NOT EXISTS idx_operator_claims_status ON operator_claims(status);

-- 2. GTFS & OPEN DATA PROVENANCE REGISTRY
CREATE TABLE IF NOT EXISTS data_provenance (
    id VARCHAR(64) PRIMARY KEY,
    dataset_name VARCHAR(255) NOT NULL,
    source_agency VARCHAR(255) NOT NULL,
    license_type VARCHAR(100) NOT NULL, -- 'ODbL', 'GODL', 'Open Data'
    source_url TEXT,
    imported_at TIMESTAMPTZ DEFAULT NOW(),
    records_processed INTEGER DEFAULT 0,
    records_accepted INTEGER DEFAULT 0,
    records_rejected INTEGER DEFAULT 0,
    duplicates_detected INTEGER DEFAULT 0
);

-- 3. DATA MINIMIZATION & RETENTION CLEANUP PROCEDURE
-- Deletes raw GPS observation records older than 30 days to protect privacy
CREATE OR REPLACE PROCEDURE purge_expired_observations(days_to_keep INTEGER DEFAULT 30)
LANGUAGE plpgsql
AS $$
BEGIN
    DELETE FROM location_observations
    WHERE timestamp < NOW() - (days_to_keep || ' days')::INTERVAL;
    
    DELETE FROM journey_sessions
    WHERE expires_at < NOW() - INTERVAL '7 days';
END;
$$;
