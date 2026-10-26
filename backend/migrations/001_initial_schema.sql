-- ====================================================================
-- INDIA-WIDE SMART BUS PLATFORM: DATABASE INITIAL SCHEMA MIGRATION 001
-- PostgreSQL + PostGIS (Portable, Free, Production-Ready)
-- ====================================================================

-- Enable PostGIS for spatial queries, route matching, and radius searches
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. PLACES MASTER DIRECTORY
CREATE TABLE IF NOT EXISTS places (
    id VARCHAR(64) PRIMARY KEY,
    canonical_name VARCHAR(255) NOT NULL,
    place_type VARCHAR(32) NOT NULL,
    parent_place_id VARCHAR(64) REFERENCES places(id) ON DELETE SET NULL,
    state VARCHAR(100) NOT NULL,
    district VARCHAR(100) NOT NULL,
    subdivision VARCHAR(100),
    latitude NUMERIC(9, 6) NOT NULL,
    longitude NUMERIC(9, 6) NOT NULL,
    geom GEOMETRY(Point, 4326),
    source_dataset VARCHAR(100) DEFAULT 'India Census / Open Transport Data',
    source_record_id VARCHAR(100),
    source_license VARCHAR(100) DEFAULT 'ODbL / Government Open Data',
    verification_status VARCHAR(32) DEFAULT 'published_unverified',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_places_state_district ON places(state, district);
CREATE INDEX IF NOT EXISTS idx_places_type ON places(place_type);
CREATE INDEX IF NOT EXISTS idx_places_name ON places(canonical_name);
CREATE INDEX IF NOT EXISTS idx_places_geom ON places USING GIST(geom);

-- 2. PLACE ALIASES & MULTILINGUAL NAMES (Hindi, Bengali, Transliterations)
CREATE TABLE IF NOT EXISTS place_aliases (
    id BIGSERIAL PRIMARY KEY,
    place_id VARCHAR(64) NOT NULL REFERENCES places(id) ON DELETE CASCADE,
    language_code VARCHAR(10) NOT NULL, -- 'en', 'hi', 'bn', 'ta', etc.
    alias_name VARCHAR(255) NOT NULL,
    is_transliteration BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_place_aliases_lookup ON place_aliases(language_code, alias_name);
CREATE INDEX IF NOT EXISTS idx_place_aliases_place_id ON place_aliases(place_id);

-- 3. BUS OPERATORS (DTC, BEST, WBTC, BMTC, KSRTC, MTC, UPSRTC, Private)
CREATE TABLE IF NOT EXISTS operators (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    short_code VARCHAR(32) NOT NULL UNIQUE,
    state VARCHAR(100) NOT NULL,
    service_area TEXT,
    contact_phone VARCHAR(50),
    contact_email VARCHAR(100),
    is_government BOOLEAN DEFAULT TRUE,
    verification_status VARCHAR(32) DEFAULT 'published_unverified',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. BUSES (Separate entity from Routes)
CREATE TABLE IF NOT EXISTS buses (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    operator_id VARCHAR(64) REFERENCES operators(id) ON DELETE SET NULL,
    registration_number VARCHAR(64),
    vehicle_type VARCHAR(32) NOT NULL DEFAULT 'express', -- 'ordinary', 'express', 'ac_volvo', 'electric', etc.
    photo_url TEXT, -- NULL displays custom SVG bus illustration
    status VARCHAR(32) DEFAULT 'active', -- 'active', 'inactive', 'disputed'
    verification_status VARCHAR(32) DEFAULT 'published_unverified',
    features JSONB DEFAULT '[]', -- ['ac', 'low_floor', 'ladies_seat']
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_buses_operator ON buses(operator_id);
CREATE INDEX IF NOT EXISTS idx_buses_status ON buses(status);

-- 5. ROUTES
CREATE TABLE IF NOT EXISTS routes (
    id VARCHAR(64) PRIMARY KEY,
    route_number VARCHAR(64) NOT NULL,
    name VARCHAR(255) NOT NULL,
    operator_id VARCHAR(64) REFERENCES operators(id) ON DELETE SET NULL,
    origin_place_id VARCHAR(64) NOT NULL REFERENCES places(id),
    destination_place_id VARCHAR(64) NOT NULL REFERENCES places(id),
    direction VARCHAR(16) DEFAULT 'up', -- 'up', 'down', 'circular'
    duration_minutes INTEGER NOT NULL,
    distance_km NUMERIC(6, 2) NOT NULL,
    operating_days JSONB DEFAULT '["Mon","Tue","Wed","Thu","Fri","Sat","Sun"]',
    status VARCHAR(32) DEFAULT 'active',
    verification_status VARCHAR(32) DEFAULT 'published_unverified',
    route_geometry GEOMETRY(LineString, 4326),
    first_departure_time TIME NOT NULL DEFAULT '05:30:00',
    last_departure_time TIME NOT NULL DEFAULT '22:30:00',
    frequency_minutes INTEGER DEFAULT 15,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_routes_operator ON routes(operator_id);
CREATE INDEX IF NOT EXISTS idx_routes_origin ON routes(origin_place_id);
CREATE INDEX IF NOT EXISTS idx_routes_destination ON routes(destination_place_id);
CREATE INDEX IF NOT EXISTS idx_routes_geom ON routes USING GIST(route_geometry);

-- 6. ROUTE STOPS (Ordered sequence with intermediate timing & distance)
CREATE TABLE IF NOT EXISTS route_stops (
    id BIGSERIAL PRIMARY KEY,
    route_id VARCHAR(64) NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
    stop_id VARCHAR(64) NOT NULL REFERENCES places(id) ON DELETE CASCADE,
    stop_sequence INTEGER NOT NULL,
    arrival_offset_minutes INTEGER NOT NULL,
    departure_offset_minutes INTEGER NOT NULL,
    distance_from_origin_km NUMERIC(6, 2) NOT NULL,
    stop_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(route_id, stop_sequence)
);

CREATE INDEX IF NOT EXISTS idx_route_stops_route_seq ON route_stops(route_id, stop_sequence);
CREATE INDEX IF NOT EXISTS idx_route_stops_stop_id ON route_stops(stop_id);

-- 7. TIMETABLE SCHEDULES & VERSIONS (Never overwritten on correction)
CREATE TABLE IF NOT EXISTS timetables (
    id VARCHAR(64) PRIMARY KEY,
    route_id VARCHAR(64) NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
    bus_id VARCHAR(64) REFERENCES buses(id) ON DELETE SET NULL,
    trip_code VARCHAR(64) NOT NULL,
    departure_time TIME NOT NULL, -- IST scheduled departure
    arrival_time TIME NOT NULL,   -- IST scheduled arrival
    operating_days JSONB DEFAULT '["Mon","Tue","Wed","Thu","Fri","Sat","Sun"]',
    vehicle_type VARCHAR(32) DEFAULT 'express',
    fare_in_rupees NUMERIC(6, 2),
    is_confirmed BOOLEAN DEFAULT TRUE,
    version_number INTEGER NOT NULL DEFAULT 1,
    verification_status VARCHAR(32) DEFAULT 'published_unverified',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_timetables_route_time ON timetables(route_id, departure_time);

-- 8. COMMUNITY CONTRIBUTIONS (Account-free, submission tracking reference)
CREATE TABLE IF NOT EXISTS community_submissions (
    id VARCHAR(32) PRIMARY KEY, -- e.g. SUB-2026-XXXX
    submission_type VARCHAR(32) NOT NULL, -- 'add_bus', 'correct_timetable', etc.
    entity_id VARCHAR(64),
    proposed_data JSONB NOT NULL,
    current_data JSONB,
    contributor_notes TEXT,
    duplicate_candidate_ids JSONB DEFAULT '[]',
    status VARCHAR(32) DEFAULT 'pending_review', -- 'pending_review', 'approved', 'rejected', 'merged'
    contributor_ref_hash VARCHAR(64) NOT NULL,
    submitted_at TIMESTAMPTZ DEFAULT NOW(),
    reviewed_at TIMESTAMPTZ,
    reviewed_by VARCHAR(64),
    review_remarks TEXT
);

CREATE INDEX IF NOT EXISTS idx_submissions_status ON community_submissions(status);
CREATE INDEX IF NOT EXISTS idx_submissions_type ON community_submissions(submission_type);

-- 9. CONSENT-BASED JOURNEY SHARING SESSIONS (Anonymous, revocable)
CREATE TABLE IF NOT EXISTS journey_sessions (
    session_id VARCHAR(64) PRIMARY KEY,
    bus_id VARCHAR(64) NOT NULL REFERENCES buses(id),
    route_id VARCHAR(64) NOT NULL REFERENCES routes(id),
    started_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL, -- Initial 12-hour maximum hard limit
    is_active BOOLEAN DEFAULT TRUE,
    has_consented BOOLEAN DEFAULT FALSE,
    total_observations_count INTEGER DEFAULT 0,
    last_ping_time TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sessions_active ON journey_sessions(is_active, expires_at);

-- 10. PRIVACY-PROTECTED BUS LOCATION OBSERVATIONS
CREATE TABLE IF NOT EXISTS location_observations (
    id VARCHAR(64) PRIMARY KEY,
    session_id VARCHAR(64) NOT NULL REFERENCES journey_sessions(session_id) ON DELETE CASCADE,
    bus_id VARCHAR(64) NOT NULL REFERENCES buses(id),
    route_id VARCHAR(64) NOT NULL REFERENCES routes(id),
    latitude NUMERIC(9, 6) NOT NULL,
    longitude NUMERIC(9, 6) NOT NULL,
    geom GEOMETRY(Point, 4326),
    accuracy_meters NUMERIC(6, 2) NOT NULL,
    speed_kmh NUMERIC(5, 2),
    heading NUMERIC(5, 2),
    timestamp TIMESTAMPTZ NOT NULL,
    confidence VARCHAR(16) NOT NULL, -- 'high', 'moderate', 'low'
    tracking_status VARCHAR(32) NOT NULL, -- 'live_gps', 'estimated', 'last_known', 'unavailable'
    distance_from_route_meters NUMERIC(8, 2) NOT NULL,
    matched_stop_id VARCHAR(64) REFERENCES places(id),
    matching_remarks TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_observations_bus_time ON location_observations(bus_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_observations_geom ON location_observations USING GIST(geom);

-- 11. AUDIT LOGS & ROLLBACK HISTORY
CREATE TABLE IF NOT EXISTS audit_logs (
    id BIGSERIAL PRIMARY KEY,
    action VARCHAR(32) NOT NULL,
    entity_type VARCHAR(32) NOT NULL,
    entity_id VARCHAR(64) NOT NULL,
    previous_value JSONB,
    new_value JSONB NOT NULL,
    performed_by VARCHAR(64) NOT NULL,
    reason TEXT NOT NULL,
    is_rollbackable BOOLEAN DEFAULT TRUE,
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(entity_type, entity_id);

-- 12. ADMIN AUTOMATION RULES
CREATE TABLE IF NOT EXISTS automation_rules (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(32) NOT NULL,
    threshold_value JSONB NOT NULL,
    is_enabled BOOLEAN DEFAULT TRUE,
    last_triggered TIMESTAMPTZ,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 13. ADMIN ACCOUNTS (Secure, separate from public passengers)
CREATE TABLE IF NOT EXISTS admin_users (
    id VARCHAR(64) PRIMARY KEY,
    username VARCHAR(64) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    role VARCHAR(32) NOT NULL DEFAULT 'moderator', -- 'superadmin', 'admin', 'moderator'
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_login_at TIMESTAMPTZ
);
