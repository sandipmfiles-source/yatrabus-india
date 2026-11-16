#!/usr/bin/env python3
"""Validate the Cloudflare D1 migration using SQLite's engine."""
from pathlib import Path
import sqlite3

migration = Path("migrations/0001_initial.sql").read_text(encoding="utf-8")
db = sqlite3.connect(":memory:")
db.executescript(migration)
required = {
    "places", "operators", "buses", "routes", "timetables",
    "journey_sessions", "location_observations", "community_submissions",
    "audit_logs", "automation_rules", "schema_migrations",
}
actual = {
    row[0] for row in db.execute(
        "SELECT name FROM sqlite_master WHERE type='table'"
    )
}
missing = required - actual
if missing:
    raise SystemExit(f"Missing D1 tables: {', '.join(sorted(missing))}")

# Exercise the exact query shape used by the Pages place-search function.
db.execute(
    "INSERT INTO places (id, canonical_name, place_type, state, district, payload_json) "
    "VALUES (?, ?, ?, ?, ?, ?)",
    ("test-place", "Kolkata Esplanade Bus Stand", "bus_terminal", "West Bengal", "Kolkata", "{}"),
)
matches = db.execute(
    "SELECT id FROM places WHERE canonical_name LIKE ? ESCAPE '\\' COLLATE NOCASE",
    ("%Kolkata%",),
).fetchall()
if not matches:
    raise SystemExit("Place search smoke test returned no matching row")

print(f"D1 migration OK: {len(required)} required tables; place-search SQL OK.")
