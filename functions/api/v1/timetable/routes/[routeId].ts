import { PagesContext, json, unavailable, parsePayload } from "../../../../_lib/api";
import { parseServiceDate, serviceDateParams, timetableServiceFilter } from "../../../../_lib/serviceCalendar";

function parseClock(value: unknown): number {
  if (typeof value !== "string") return 0;
  const parts = value.split(":").map(Number);
  return Number.isFinite(parts[0]) && Number.isFinite(parts[1]) ? parts[0] * 60 + parts[1] : 0;
}
function formatOffset(minutes: number): { time: string; dayOffset: number } {
  const dayOffset = Math.floor(minutes / 1440);
  const normalized = ((minutes % 1440) + 1440) % 1440;
  return { time: `${String(Math.floor(normalized / 60)).padStart(2,"0")}:${String(normalized % 60).padStart(2,"0")}`, dayOffset };
}

export async function onRequestGet({ request, env, params }: PagesContext): Promise<Response> {
  if (!env.DB) return unavailable();
  const routeId = String(params?.routeId || "");
  const url = new URL(request.url);
  const dateValue = url.searchParams.get("date");
  const serviceDate = dateValue ? parseServiceDate(dateValue) : null;
  if (dateValue && !serviceDate) return json({ error: "date must be a real calendar date in YYYY-MM-DD format." }, 400);
  try {
    const routeRow = await env.DB.prepare("SELECT payload_json FROM routes WHERE id = ? LIMIT 1").bind(routeId).first<{payload_json:string}>();
    const route = parsePayload(routeRow) as any;
    if (!route) return json({ error: "Route not found." }, 404);
    const dateFilter = serviceDate ? `AND ${timetableServiceFilter("t")}` : "";
    const rows = await env.DB.prepare(`
      SELECT t.payload_json FROM timetables AS t
      WHERE t.route_id = ? ${dateFilter}
      ORDER BY t.departure_time LIMIT 100
    `).bind(routeId, ...(serviceDate ? serviceDateParams(serviceDate) : [])).all<{payload_json:string}>();
    const trips = (rows.results || []).map(row => {
      const trip = parsePayload(row) as any;
      if (!trip) return null;
      const base = parseClock(trip.departureTime || route.firstDepartureTime);
      const stopTimes = (route.stops || []).map((stop:any,index:number) => {
        const arrival = formatOffset(base + Number(stop.arrivalOffsetMinutes || 0));
        const departure = formatOffset(base + Number(stop.departureOffsetMinutes ?? stop.arrivalOffsetMinutes ?? 0));
        return {
          stopId: stop.stopId || stop.id,
          stopName: stop.stopName || stop.name || stop.stopId || stop.id,
          stopSequence: Number(stop.stopSequence || index + 1),
          arrivalTime: arrival.time,
          arrivalDayOffset: arrival.dayOffset,
          departureTime: departure.time,
          departureDayOffset: departure.dayOffset
        };
      });
      return {
        tripId: trip.tripCode || trip.id,
        serviceId: trip.serviceId || null,
        headsign: trip.headsign || route.destinationName || null,
        departureTime: trip.departureTime || null,
        arrivalTime: trip.arrivalTime || null,
        stopTimes,
        verificationStatus: trip.verificationStatus || "published_unverified",
        sourceDataset: trip.sourceDataset || route.sourceDataset || null
      };
    }).filter(Boolean);
    return json({
      route: { ...route, id: route.id, shortName: route.routeNumber || route.shortName || null, longName: route.name || route.longName || null },
      feed: { id: route.sourceDataset || "YATRIBUS_D1", name: route.sourceAttribution || route.sourceDataset || "Published timetable data", official: false, verificationStatus: "UNVERIFIED", importedAt: route.sourceSnapshotDate || null, attribution: route.sourceAttribution || null },
      agencyTimezone: "Asia/Kolkata",
      ...(serviceDate ? { serviceDate: serviceDate.date, timetableStatus: trips.length ? "SCHEDULED_UNVERIFIED" : "NO_SERVICE_FOUND" } : {}),
      trips,
      dataType: "GTFS_STATIC",
      liveVehiclePositionsAvailable: false
    });
  } catch {
    return json({ error: "Timetable route details are temporarily unavailable." }, 503);
  }
}
