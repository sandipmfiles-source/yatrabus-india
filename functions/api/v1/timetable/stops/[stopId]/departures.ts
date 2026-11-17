import { PagesContext, json, unavailable, boundedInt, parsePayload } from "../../../../../_lib/api";
import { parseServiceDate, serviceDateParams, timetableServiceFilter } from "../../../../../_lib/serviceCalendar";

function parseClock(value: unknown): number {
  if (typeof value !== "string") return 0;
  const parts = value.split(":").map(Number);
  return Number.isFinite(parts[0]) && Number.isFinite(parts[1]) ? parts[0] * 60 + parts[1] : 0;
}
function formatOffset(minutes: number): string {
  const normalized = ((minutes % 1440) + 1440) % 1440;
  const dayOffset = Math.floor(minutes / 1440);
  return `${String(Math.floor(normalized / 60)).padStart(2,"0")}:${String(normalized % 60).padStart(2,"0")}${dayOffset ? ` (+${dayOffset}d)` : ""}`;
}

export async function onRequestGet({ request, env, params }: PagesContext): Promise<Response> {
  if (!env.DB) return unavailable();
  const stopId = String(params?.stopId || "");
  const url = new URL(request.url);
  const date = parseServiceDate(url.searchParams.get("date"));
  const limit = boundedInt(url.searchParams.get("limit"), 20, 1, 50);
  if (!stopId || !date) return json({ error: "Required: stopId and a valid date (YYYY-MM-DD).", timetableStatus: "UNAVAILABLE", departures: [] }, 400);
  try {
    const rows = await env.DB.prepare(`
      SELECT r.payload_json AS route_json, rs.stop_name, rs.stop_sequence,
             rs.arrival_offset_minutes, rs.departure_offset_minutes,
             t.payload_json AS timetable_json
      FROM route_stops AS rs
      JOIN routes AS r ON r.id = rs.route_id AND r.status = 'active'
      JOIN timetables AS t ON t.route_id = rs.route_id
      WHERE rs.stop_id = ? AND ${timetableServiceFilter("t")}
      ORDER BY t.departure_time LIMIT ?
    `).bind(stopId, ...serviceDateParams(date), limit).all<{
      route_json:string;stop_name:string;stop_sequence:number;
      arrival_offset_minutes:number;departure_offset_minutes:number;timetable_json:string
    }>();
    const departures = (rows.results || []).map(row => {
      const route = parsePayload({payload_json:row.route_json}) as any;
      const trip = parsePayload({payload_json:row.timetable_json}) as any;
      if (!route || !trip) return null;
      const base = parseClock(trip.departureTime || route.firstDepartureTime);
      return {
        routeId: route.id,
        routeName: route.name || route.routeNumber || route.id,
        routeNumber: route.routeNumber || null,
        tripId: trip.tripCode || trip.id,
        headsign: trip.headsign || route.destinationName || null,
        stopId,
        stopName: row.stop_name,
        stopSequence: Number(row.stop_sequence),
        departureTime: formatOffset(base + Number(row.departure_offset_minutes || 0)),
        arrivalTime: formatOffset(base + Number(row.arrival_offset_minutes || 0)),
        serviceDate: date.date,
        verificationStatus: trip.verificationStatus || "published_unverified",
        sourceDataset: trip.sourceDataset || route.sourceDataset || null
      };
    }).filter(Boolean);
    return json({
      timetableStatus: departures.length ? "SCHEDULED_UNVERIFIED" : "NO_SERVICE_FOUND",
      dataType: "GTFS_STATIC",
      serviceDate: date.date,
      resultCount: departures.length,
      departures,
      liveVehiclePositionsAvailable: false
    });
  } catch {
    return json({ error: "Stop departures are temporarily unavailable.", timetableStatus: "UNAVAILABLE", departures: [] }, 503);
  }
}
