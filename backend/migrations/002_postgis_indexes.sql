-- 002_postgis_indexes.sql
-- Geographic and Trigram Indexing for Fast Spatial & Typo-Tolerant Search

-- Enable PostGIS & Trigram extensions if running on PostgreSQL
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Spatial Point columns on places and route_stops
ALTER TABLE places ADD COLUMN IF NOT EXISTS geom geometry(Point, 4326);
UPDATE places SET geom = ST_SetSRID(ST_MakePoint(longitude, latitude), 4326) WHERE longitude IS NOT NULL AND latitude IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_places_geom ON places USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_places_state_district ON places (state, district);
CREATE INDEX IF NOT EXISTS idx_places_type ON places (place_type);
CREATE INDEX IF NOT EXISTS idx_places_name_trgm ON places USING GIN (canonical_name gin_trgm_ops);

-- Route Stops Indexes
ALTER TABLE route_stops ADD COLUMN IF NOT EXISTS geom geometry(Point, 4326);
UPDATE route_stops SET geom = ST_SetSRID(ST_MakePoint(longitude, latitude), 4326);

CREATE INDEX IF NOT EXISTS idx_route_stops_geom ON route_stops USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_route_stops_route_id ON route_stops (route_id);
CREATE INDEX IF NOT EXISTS idx_route_stops_stop_id ON route_stops (stop_id);

-- Routes Indexes
CREATE INDEX IF NOT EXISTS idx_routes_operator_id ON routes (operator_id);
CREATE INDEX IF NOT EXISTS idx_routes_number ON routes (route_number);
CREATE INDEX IF NOT EXISTS idx_routes_terminals ON routes (origin_stop_id, destination_stop_id);

-- Buses Indexes
CREATE INDEX IF NOT EXISTS idx_buses_operator_id ON buses (operator_id);
CREATE INDEX IF NOT EXISTS idx_buses_identifier ON buses (public_identifier);
