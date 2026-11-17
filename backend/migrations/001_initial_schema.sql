-- 001_initial_schema.sql
-- YatriBus Core Places, Bus Operators, Routes and Timetables Schema

CREATE TABLE IF NOT EXISTS places (
    id VARCHAR(64) PRIMARY KEY,
    canonical_name VARCHAR(255) NOT NULL,
    names_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    place_type VARCHAR(50) NOT NULL,
    parent_id VARCHAR(64) REFERENCES places(id) ON DELETE SET NULL,
    district VARCHAR(100),
    state VARCHAR(100) NOT NULL,
    pincode VARCHAR(10),
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    source_dataset VARCHAR(100) NOT NULL,
    source_record_id VARCHAR(100),
    source_license VARCHAR(100) NOT NULL,
    verification_status VARCHAR(50) NOT NULL DEFAULT 'UNVERIFIED',
    aliases TEXT[] NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS operators (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    short_code VARCHAR(50),
    operator_type VARCHAR(50) NOT NULL DEFAULT 'GOVERNMENT_STATE',
    service_area VARCHAR(100) NOT NULL,
    contact_phone VARCHAR(50),
    contact_website VARCHAR(255),
    verification_status VARCHAR(50) NOT NULL DEFAULT 'COMMUNITY_LISTED',
    is_claimed BOOLEAN NOT NULL DEFAULT FALSE,
    claimed_by VARCHAR(64),
    source_dataset VARCHAR(100) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS buses (
    id VARCHAR(64) PRIMARY KEY,
    public_identifier VARCHAR(100) NOT NULL,
    operator_id VARCHAR(64) NOT NULL REFERENCES operators(id) ON DELETE CASCADE,
    fleet_registration_number VARCHAR(100),
    vehicle_type VARCHAR(50) NOT NULL DEFAULT 'ORDINARY',
    photo_url TEXT,
    has_custom_svg_illustration BOOLEAN NOT NULL DEFAULT TRUE,
    service_status VARCHAR(50) NOT NULL DEFAULT 'OPERATING_SCHEDULED',
    status_reason TEXT,
    verification_status VARCHAR(50) NOT NULL DEFAULT 'UNVERIFIED',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS routes (
    id VARCHAR(64) PRIMARY KEY,
    route_number VARCHAR(50) NOT NULL,
    route_name VARCHAR(255) NOT NULL,
    origin_stop_id VARCHAR(64) NOT NULL,
    origin_stop_name VARCHAR(255) NOT NULL,
    destination_stop_id VARCHAR(64) NOT NULL,
    destination_stop_name VARCHAR(255) NOT NULL,
    operator_id VARCHAR(64) NOT NULL REFERENCES operators(id) ON DELETE CASCADE,
    direction VARCHAR(20) NOT NULL DEFAULT 'UP',
    distance_km NUMERIC(8,2) NOT NULL DEFAULT 0.00,
    typical_duration_minutes INT NOT NULL DEFAULT 60,
    operating_days TEXT[] NOT NULL DEFAULT '{"MON","TUE","WED","THU","FRI","SAT","SUN"}',
    first_departure_time VARCHAR(10) NOT NULL DEFAULT '06:00',
    last_departure_time VARCHAR(10) NOT NULL DEFAULT '22:00',
    frequency_minutes INT,
    geometry_json JSONB,
    verification_status VARCHAR(50) NOT NULL DEFAULT 'UNVERIFIED',
    service_status VARCHAR(50) NOT NULL DEFAULT 'OPERATING_SCHEDULED',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS route_stops (
    id VARCHAR(64) PRIMARY KEY,
    route_id VARCHAR(64) NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
    stop_id VARCHAR(64) NOT NULL REFERENCES places(id) ON DELETE CASCADE,
    stop_name VARCHAR(255) NOT NULL,
    stop_sequence INT NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    distance_from_start_km NUMERIC(8,2) NOT NULL DEFAULT 0.00,
    scheduled_arrival_time VARCHAR(10),
    scheduled_departure_time VARCHAR(10),
    platform_or_bay VARCHAR(50),
    notes TEXT,
    CONSTRAINT uq_route_stop_seq UNIQUE (route_id, stop_sequence)
);

CREATE TABLE IF NOT EXISTS timetables (
    id VARCHAR(64) PRIMARY KEY,
    route_id VARCHAR(64) NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
    season_name VARCHAR(100) NOT NULL DEFAULT 'STANDARD',
    effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
    effective_until DATE,
    version_number INT NOT NULL DEFAULT 1,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS timetable_departures (
    id VARCHAR(64) PRIMARY KEY,
    timetable_id VARCHAR(64) NOT NULL REFERENCES timetables(id) ON DELETE CASCADE,
    departure_time VARCHAR(10) NOT NULL,
    arrival_time VARCHAR(10) NOT NULL,
    bus_identifier VARCHAR(100),
    operating_days TEXT[] NOT NULL DEFAULT '{"MON","TUE","WED","THU","FRI","SAT","SUN"}',
    confidence_score INT NOT NULL DEFAULT 80,
    is_cancelled BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS timetable_revisions (
    id VARCHAR(64) PRIMARY KEY,
    route_id VARCHAR(64) NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
    revision_number INT NOT NULL,
    change_summary TEXT NOT NULL,
    previous_schedule JSONB NOT NULL,
    proposed_schedule JSONB NOT NULL,
    submitted_by VARCHAR(100),
    submission_ref_id VARCHAR(100),
    approved_by VARCHAR(64),
    effective_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
