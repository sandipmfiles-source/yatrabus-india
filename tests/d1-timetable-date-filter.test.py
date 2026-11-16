#!/usr/bin/env python3
"""SQLite integration tests for date-aware GTFS service calendars."""
import json
import sqlite3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MIGRATION = ROOT / "migrations" / "0004_timetable_service_dates.sql"

def scheduled_on(db, timetable_id, date, day):
    return db.execute("""
        SELECT COUNT(*) FROM timetables AS t
        WHERE t.id = ?
          AND (
            EXISTS (SELECT 1 FROM json_each(t.service_days_json) AS d WHERE d.value = ?)
            OR EXISTS (
              SELECT 1 FROM json_each(t.service_exceptions_json) AS added
              WHERE json_extract(added.value, '$.date') = ?
                AND CAST(json_extract(added.value, '$.exceptionType') AS INTEGER) = 1
            )
          )
          AND (t.service_start_date IS NULL OR t.service_start_date <= ?)
          AND (t.service_end_date IS NULL OR t.service_end_date >= ?)
          AND NOT EXISTS (
            SELECT 1 FROM json_each(t.service_exceptions_json) AS removed
            WHERE json_extract(removed.value, '$.date') = ?
              AND CAST(json_extract(removed.value, '$.exceptionType') AS INTEGER) = 2
          )
    """, (timetable_id, day, date, date, date, date)).fetchone()[0] == 1

def route_scheduled_on(db, route_id, date, day):
    return db.execute("""
        SELECT COUNT(*) FROM routes AS r
        WHERE r.id = ? AND r.status = 'active'
          AND EXISTS (
            SELECT 1 FROM timetables AS service_tt
            WHERE service_tt.route_id = r.id
              AND (
                EXISTS (SELECT 1 FROM json_each(service_tt.service_days_json) AS weekly WHERE weekly.value = ?)
                OR EXISTS (
                  SELECT 1 FROM json_each(service_tt.service_exceptions_json) AS added
                  WHERE json_extract(added.value, '$.date') = ?
                    AND CAST(json_extract(added.value, '$.exceptionType') AS INTEGER) = 1
                )
              )
              AND (service_tt.service_start_date IS NULL OR service_tt.service_start_date <= ?)
              AND (service_tt.service_end_date IS NULL OR service_tt.service_end_date >= ?)
              AND NOT EXISTS (
                SELECT 1 FROM json_each(service_tt.service_exceptions_json) AS removed
                WHERE json_extract(removed.value, '$.date') = ?
                  AND CAST(json_extract(removed.value, '$.exceptionType') AS INTEGER) = 2
              )
          )
    """, (route_id, day, date, date, date, date)).fetchone()[0] == 1

def main():
    db = sqlite3.connect(":memory:")
    db.execute("CREATE TABLE routes (id TEXT PRIMARY KEY, status TEXT NOT NULL)")
    db.execute("""CREATE TABLE timetables (
        id TEXT PRIMARY KEY, route_id TEXT NOT NULL, departure_time TEXT NOT NULL,
        service_days_json TEXT NOT NULL DEFAULT '[]', payload_json TEXT NOT NULL
    )""")
    db.executescript(MIGRATION.read_text(encoding="utf-8"))
    db.execute("INSERT INTO routes(id,status) VALUES('R1','active')")
    exceptions = [
        {"date": "2026-11-17", "exceptionType": 2},
        {"date": "2026-11-22", "exceptionType": 1},
    ]
    db.execute("""
        INSERT INTO timetables (
          id,route_id,departure_time,service_days_json,service_start_date,
          service_end_date,service_exceptions_json,payload_json
        ) VALUES (?,?,?,?,?,?,?,?)
    """, ("tt1","R1","06:00",json.dumps(["Mon","Tue","Wed","Thu","Fri"]),
          "2026-01-01","2030-12-31",json.dumps(exceptions),json.dumps({"tripCode":"T1"})))

    assert scheduled_on(db,"tt1","2026-11-16","Mon"), "regular weekday service should run"
    assert not scheduled_on(db,"tt1","2026-11-17","Tue"), "removed exception must suppress weekly service"
    assert scheduled_on(db,"tt1","2026-11-22","Sun"), "added exception must create service on a non-operating weekday"
    assert not scheduled_on(db,"tt1","2031-01-01","Wed"), "service outside calendar end date must not run"
    assert not scheduled_on(db,"tt1","2025-12-31","Wed"), "service before calendar start date must not run"
    assert route_scheduled_on(db,"R1","2026-11-16","Mon"), "route search should include an active weekday service"
    assert not route_scheduled_on(db,"R1","2026-11-17","Tue"), "route search should exclude a removed service date"
    assert route_scheduled_on(db,"R1","2026-11-22","Sun"), "route search should include an added service date"

    # Legacy rows with no range metadata remain weekday-filterable until enriched.
    db.execute("INSERT INTO timetables(id,route_id,departure_time,service_days_json,payload_json) VALUES(?,?,?,?,?)",
               ("legacy","R1","07:00",json.dumps(["Mon"]),json.dumps({"tripCode":"OLD"})))
    assert scheduled_on(db,"legacy","2026-11-16","Mon")

    print("GTFS date-calendar tests passed: weekday, added/removed exceptions, date range, legacy fallback.")

if __name__ == "__main__":
    main()
