#!/usr/bin/env python3
"""SQLite integration test for the D1 route-stop index migration."""
from pathlib import Path
import json
import sqlite3

ROOT = Path(__file__).resolve().parents[1]
MIGRATION = ROOT / "migrations" / "0003_route_stop_index.sql"

def main():
    db = sqlite3.connect(":memory:")
    db.execute("""CREATE TABLE routes (
        id TEXT PRIMARY KEY, status TEXT NOT NULL, stops_json TEXT NOT NULL,
        payload_json TEXT NOT NULL
    )""")
    db.execute("CREATE TABLE places (id TEXT PRIMARY KEY, payload_json TEXT NOT NULL)")
    route_a_stops = [
        {"stopId":"A","stopName":"Origin","stopSequence":1,"arrivalOffsetMinutes":0,"departureOffsetMinutes":0},
        {"stopId":"B","stopName":"Interchange","stopSequence":2,"arrivalOffsetMinutes":10,"departureOffsetMinutes":12},
        {"stopId":"C","stopName":"Destination","stopSequence":3,"arrivalOffsetMinutes":25,"departureOffsetMinutes":25},
    ]
    route_b_stops = [
        {"stopId":"B","stopName":"Interchange","stopSequence":1,"arrivalOffsetMinutes":0,"departureOffsetMinutes":0},
        {"stopId":"D","stopName":"Second Destination","stopSequence":2,"arrivalOffsetMinutes":30,"departureOffsetMinutes":30},
    ]
    for route_id, stops, indexed_json in [
        ("R1", route_a_stops, json.dumps(route_a_stops)),
        ("R2", route_b_stops, json.dumps(route_b_stops)),
        ("R3", [{"stopId":"E","stopName":"Legacy E","stopSequence":1},{"stopId":"F","stopName":"Legacy F","stopSequence":2}], "[]"),
    ]:
        payload = json.dumps({"id":route_id,"stops":stops})
        db.execute("INSERT INTO routes(id,status,stops_json,payload_json) VALUES(?,?,?,?)",
                   (route_id, "active", indexed_json, payload))
    db.execute("INSERT INTO places(id,payload_json) VALUES('B',?)",
               (json.dumps({"id":"B","canonicalName":"Interchange"}),))

    sql = MIGRATION.read_text(encoding="utf-8")
    db.executescript(sql)

    count = db.execute("SELECT COUNT(*) FROM route_stops").fetchone()[0]
    assert count == 7, f"expected 7 backfilled route stops including payload fallback, got {count}"

    direct = db.execute("""
        SELECT r.id, board.stop_sequence, alight.stop_sequence
        FROM route_stops AS board
        JOIN route_stops AS alight
          ON alight.route_id = board.route_id
         AND alight.stop_id = ?
         AND alight.stop_sequence > board.stop_sequence
        JOIN routes AS r ON r.id = board.route_id
        WHERE board.stop_id = ? AND r.status = 'active'
    """, ("C", "A")).fetchall()
    assert direct == [("R1", 1, 3)], f"direct journey lookup failed: {direct}"

    intermediate = db.execute("""
        SELECT r.id, board.stop_sequence, alight.stop_sequence
        FROM route_stops AS board
        JOIN route_stops AS alight
          ON alight.route_id = board.route_id
         AND alight.stop_id = ?
         AND alight.stop_sequence > board.stop_sequence
        JOIN routes AS r ON r.id = board.route_id
        WHERE board.stop_id = ? AND r.status = 'active'
    """, ("B", "A")).fetchall()
    assert intermediate == [("R1", 1, 2)], f"intermediate stop matching failed: {intermediate}"

    transfer = db.execute("""
        SELECT r.id, board.stop_id
        FROM route_stops AS board
        JOIN route_stops AS alight
          ON alight.route_id = board.route_id
         AND alight.stop_id = ?
         AND alight.stop_sequence > board.stop_sequence
        JOIN routes AS r ON r.id = board.route_id
        WHERE board.stop_id IN (?) AND r.status = 'active'
    """, ("D", "B")).fetchall()
    assert transfer == [("R2", "B")], f"transfer leg lookup failed: {transfer}"

    indexes = {row[1] for row in db.execute("PRAGMA index_list(route_stops)")}
    assert "idx_route_stops_stop_route_sequence" in indexes
    assert "idx_route_stops_route_sequence" in indexes

    # The migration must be safe to re-run: existing index rows are preserved.
    db.executescript(sql)
    count_after = db.execute("SELECT COUNT(*) FROM route_stops").fetchone()[0]
    assert count_after == count, f"migration re-run duplicated rows: {count_after}"
    legacy_count = db.execute("SELECT COUNT(*) FROM route_stops WHERE route_id = 'R3'").fetchone()[0]
    assert legacy_count == 2, f"legacy payload fallback failed: {legacy_count}"

    print("D1 route-stop index integration tests passed: backfill, direct, intermediate, transfer, indexes, idempotency.")

if __name__ == "__main__":
    main()
