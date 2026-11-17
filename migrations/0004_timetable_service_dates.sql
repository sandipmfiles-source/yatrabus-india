-- Store the exact GTFS calendar validity and exceptions for date-accurate passenger search.
-- Existing timetable rows are enriched by the checksum-pinned feed importer after this migration.

ALTER TABLE timetables ADD COLUMN service_start_date TEXT;
ALTER TABLE timetables ADD COLUMN service_end_date TEXT;
ALTER TABLE timetables ADD COLUMN service_exceptions_json TEXT NOT NULL DEFAULT '[]';

CREATE INDEX IF NOT EXISTS idx_timetables_route_service_dates
  ON timetables(route_id, service_start_date, service_end_date, departure_time);
