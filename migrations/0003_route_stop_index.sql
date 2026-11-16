-- YatraBus India: indexed stop-to-route lookup for scalable journey search.
-- Existing route payloads are backfilled without replacing any source records.

CREATE TABLE IF NOT EXISTS route_stops (
  route_id TEXT NOT NULL,
  stop_id TEXT NOT NULL,
  stop_sequence INTEGER NOT NULL,
  stop_name TEXT NOT NULL,
  arrival_offset_minutes INTEGER NOT NULL DEFAULT 0,
  departure_offset_minutes INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (route_id, stop_sequence),
  FOREIGN KEY (route_id) REFERENCES routes(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_route_stops_stop_route_sequence
  ON route_stops(stop_id, route_id, stop_sequence);

CREATE INDEX IF NOT EXISTS idx_route_stops_route_sequence
  ON route_stops(route_id, stop_sequence);

INSERT OR IGNORE INTO route_stops (
  route_id, stop_id, stop_sequence, stop_name,
  arrival_offset_minutes, departure_offset_minutes
)
SELECT
  r.id,
  json_extract(s.value, '$.stopId'),
  COALESCE(CAST(json_extract(s.value, '$.stopSequence') AS INTEGER), CAST(s.key AS INTEGER) + 1),
  COALESCE(json_extract(s.value, '$.stopName'), ''),
  COALESCE(CAST(json_extract(s.value, '$.arrivalOffsetMinutes') AS INTEGER), 0),
  COALESCE(CAST(json_extract(s.value, '$.departureOffsetMinutes') AS INTEGER), 0)
FROM routes AS r,
     json_each(CASE WHEN json_valid(COALESCE(NULLIF(r.stops_json, '[]'), json_extract(r.payload_json, '$.stops')))
                    THEN COALESCE(NULLIF(r.stops_json, '[]'), json_extract(r.payload_json, '$.stops'))
                    ELSE '[]' END) AS s
WHERE json_extract(s.value, '$.stopId') IS NOT NULL
  AND COALESCE(CAST(json_extract(s.value, '$.stopSequence') AS INTEGER), CAST(s.key AS INTEGER) + 1) > 0;
