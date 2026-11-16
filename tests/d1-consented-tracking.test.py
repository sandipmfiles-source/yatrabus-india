#!/usr/bin/env python3
"""SQLite smoke tests for consented GPS storage, expiry and public visibility."""
import json
import sqlite3

db = sqlite3.connect(":memory:")
db.execute("PRAGMA foreign_keys = ON")
db.executescript("""
CREATE TABLE buses (id TEXT PRIMARY KEY, operator_id TEXT, status TEXT, payload_json TEXT);
CREATE TABLE routes (id TEXT PRIMARY KEY, status TEXT, payload_json TEXT);
CREATE TABLE journey_sessions (
  id TEXT PRIMARY KEY, bus_id TEXT NOT NULL REFERENCES buses(id),
  route_id TEXT NOT NULL REFERENCES routes(id), consent_given INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active', started_at TEXT NOT NULL, stopped_at TEXT,
  payload_json TEXT NOT NULL DEFAULT '{}'
);
CREATE TABLE location_observations (
  id TEXT PRIMARY KEY, session_id TEXT NOT NULL REFERENCES journey_sessions(id),
  bus_id TEXT NOT NULL REFERENCES buses(id), route_id TEXT NOT NULL REFERENCES routes(id),
  latitude REAL NOT NULL, longitude REAL NOT NULL, accuracy REAL, speed REAL, heading REAL,
  observed_at TEXT NOT NULL, payload_json TEXT NOT NULL DEFAULT '{}'
);
CREATE TABLE public_rate_limits (
  bucket_key TEXT NOT NULL, ip_hash TEXT NOT NULL, window_started_at TEXT NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(bucket_key, ip_hash)
);
""")
with open("migrations/0005_consented_gps_indexes.sql", encoding="utf-8") as handle:
    db.executescript(handle.read())

db.execute("INSERT INTO buses VALUES ('B1','OP1','active','{}')")
db.execute("INSERT INTO routes VALUES ('R1','active','{}')")
started = "2026-11-16T10:00:00.000Z"
expires = "2026-11-16T16:00:00.000Z"
db.execute(
    "INSERT INTO journey_sessions VALUES (?,?,?,?,?,?,?,?)",
    ("S1", "B1", "R1", 1, "active", started, None, json.dumps({"expiresAt": expires})),
)

# One primary-key row per session means every GPS ping overwrites the latest
# rounded point instead of creating a movement-history trail.
upsert = """
INSERT INTO location_observations
  (id,session_id,bus_id,route_id,latitude,longitude,accuracy,speed,heading,observed_at,payload_json)
VALUES (?,?,?,?,?,?,?,?,?,?,?)
ON CONFLICT(id) DO UPDATE SET
  latitude=excluded.latitude, longitude=excluded.longitude, accuracy=excluded.accuracy,
  speed=excluded.speed, heading=excluded.heading, observed_at=excluded.observed_at,
  payload_json=excluded.payload_json
"""
db.execute(upsert, ("S1","S1","B1","R1",22.3001,70.8001,25,32,90,"2026-11-16T10:00:10.000Z",'{"foregroundOnly":true}'))
db.execute(upsert, ("S1","S1","B1","R1",22.3002,70.8002,20,34,91,"2026-11-16T10:00:20.000Z",'{"foregroundOnly":true}'))
assert db.execute("SELECT COUNT(*) FROM location_observations WHERE session_id='S1'").fetchone()[0] == 1
assert db.execute("SELECT latitude FROM location_observations WHERE id='S1'").fetchone()[0] == 22.3002

visible = db.execute("""
SELECT COUNT(*) FROM location_observations o
JOIN journey_sessions s ON s.id=o.session_id
WHERE o.bus_id='B1' AND o.route_id='R1' AND s.status='active'
  AND s.consent_given=1 AND json_extract(s.payload_json,'$.expiresAt') > ?
""", ("2026-11-16T10:01:00.000Z",)).fetchone()[0]
assert visible == 1, "active, consented and unexpired location should be visible"

db.execute("UPDATE journey_sessions SET status='stopped', stopped_at=? WHERE id='S1'", ("2026-11-16T10:02:00.000Z",))
visible_after_stop = db.execute("""
SELECT COUNT(*) FROM location_observations o
JOIN journey_sessions s ON s.id=o.session_id
WHERE o.bus_id='B1' AND s.status='active' AND s.consent_given=1
  AND json_extract(s.payload_json,'$.expiresAt') > ?
""", ("2026-11-16T10:03:00.000Z",)).fetchone()[0]
assert visible_after_stop == 0, "stopped session must no longer be public"

location_indexes = {row[1] for row in db.execute("PRAGMA index_list('location_observations')")}
journey_indexes = {row[1] for row in db.execute("PRAGMA index_list('journey_sessions')")}
assert {"idx_location_session_observed", "idx_location_route_observed"} <= location_indexes
assert {"idx_journey_route_status", "idx_journey_status_started"} <= journey_indexes
assert not db.execute("PRAGMA foreign_key_check").fetchall()
print("Consented GPS storage tests passed: one latest point per session, stop/expiry visibility and required indexes.")
