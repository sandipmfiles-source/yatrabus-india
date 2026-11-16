#!/usr/bin/env python3
"""Validate every Cloudflare D1 migration using SQLite's engine."""
from pathlib import Path
import sqlite3

db = sqlite3.connect(":memory:")
migration_files = sorted(Path("migrations").glob("*.sql"))
if not migration_files:
    raise SystemExit("No D1 migration files found.")
for migration_file in migration_files:
    db.executescript(migration_file.read_text(encoding="utf-8"))

required = {
    "places", "operators", "buses", "routes", "route_stops", "timetables",
    "journey_sessions", "location_observations", "community_submissions",
    "audit_logs", "automation_rules", "schema_migrations",
    "admin_sessions", "admin_login_attempts", "operator_claims", "service_alerts", "public_rate_limits",
}
actual = {row[0] for row in db.execute("SELECT name FROM sqlite_master WHERE type='table'")}
missing = required - actual
if missing:
    raise SystemExit(f"Missing D1 tables: {', '.join(sorted(missing))}")
timetable_columns = {row[1] for row in db.execute("PRAGMA table_info(timetables)")}
required_timetable_columns = {"service_start_date", "service_end_date", "service_exceptions_json"}
missing_calendar_columns = required_timetable_columns - timetable_columns
if missing_calendar_columns:
    raise SystemExit(f"Missing timetable calendar columns: {', '.join(sorted(missing_calendar_columns))}")

db.execute(
    "INSERT INTO places (id, canonical_name, place_type, state, district, payload_json) "
    "VALUES (?, ?, ?, ?, ?, ?)",
    ("test-place", "Kolkata Esplanade Bus Stand", "bus_terminal", "West Bengal", "Kolkata", "{}"),
)
matches = db.execute(
    "SELECT id FROM places WHERE canonical_name LIKE ? COLLATE NOCASE",
    ("%Kolkata%",),
).fetchall()
if not matches:
    raise SystemExit("Place search smoke test returned no matching row")

db.execute(
    "INSERT INTO admin_sessions (token_hash, owner_email, session_id, created_at, expires_at) VALUES (?,?,?,?,?)",
    ("a" * 64, "owner@example.com", "test-session", "2026-01-01T00:00:00Z", "2026-01-01T08:00:00Z"),
)
db.execute(
    "INSERT INTO operator_claims (id, operator_id, payload_json) VALUES (?,?,?)",
    ("claim-test", "operator-test", "{}"),
)
if db.execute("PRAGMA foreign_key_check").fetchall():
    raise SystemExit("D1 migration has foreign-key violations")

print(f"D1 migrations OK: {len(migration_files)} files, {len(required)} required tables and {len(required_timetable_columns)} timetable calendar columns; place search and security table smoke tests passed.")
