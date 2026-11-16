import { PagesContext, json, unavailable, parsePayload } from "../../../../../../_lib/api";
import { parseServiceDate, serviceDateParams, todayInIndia, timetableServiceFilter } from "../../../../../../_lib/serviceCalendar";

type RouteStop = {
  stopId: string;
  stopName: string;
  stopSequence?: number;
  arrivalOffsetMinutes?: number;
  departureOffsetMinutes?: number;
};

type TimetableRow = { payload_json: string; departure_time: string };

function departureMinutes(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const match = /^(\d{1,3}):([0-5]\d)(?::[0-5]\d)?$/.exec(value.trim());
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

function formatIndiaTime(utcMillis: number): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(new Date(utcMillis));
}

export async function onRequestGet({ request, env, params }: PagesContext): Promise<Response> {
  if (!env.DB) return unavailable();
  const routeId = params?.id || "";
  const stopId = params?.stopId || "";
  const url = new URL(request.url);
  const dateValue = url.searchParams.get("date") || todayInIndia();
  const serviceDate = parseServiceDate(dateValue);
  if (!routeId || !stopId || !serviceDate) {
    return json({ success: false, error: "A valid route, stop and YYYY-MM-DD service date are required." }, 400);
  }

  try {
    const routeRow = await env.DB.prepare(
      "SELECT payload_json FROM routes WHERE id = ? AND status = 'active' LIMIT 1"
    ).bind(routeId).first<{ payload_json: string }>();
    if (!routeRow) return json({ success: false, error: "Route not found." }, 404);
    const route = parsePayload(routeRow) as { stops?: RouteStop[] } | null;
    const stop = route?.stops?.find(item => item.stopId === stopId);
    if (!stop) return json({ success: false, error: "Stop is not part of this route." }, 404);

    const rows = await env.DB.prepare(`
      SELECT t.payload_json, t.departure_time
      FROM timetables AS t
      WHERE t.route_id = ?
        AND ${timetableServiceFilter("t")}
      ORDER BY t.departure_time
    `).bind(routeId, ...serviceDateParams(serviceDate)).all<TimetableRow>();

    const now = Date.now();
    const today = todayInIndia();
    const [year, month, day] = serviceDate.date.split("-").map(Number);
    const localMidnightUtc = Date.UTC(year, month - 1, day) - 330 * 60 * 1000;
    const offsetMinutes = Math.max(0, Number(stop.arrivalOffsetMinutes || 0));
    const arrivals = (rows.results || []).map(row => {
      const timetable = parsePayload(row) as { departureTime?: string; tripCode?: string; sourceDataset?: string } | null;
      const minutes = departureMinutes(timetable?.departureTime || row.departure_time);
      if (minutes === null) return null;
      const arrivalUtc = localMidnightUtc + (minutes + offsetMinutes) * 60 * 1000;
      if (serviceDate.date === today && arrivalUtc < now) return null;
      return {
        arrivalUtc,
        arrivalTime: formatIndiaTime(arrivalUtc),
        tripCode: timetable?.tripCode || null,
        sourceDataset: timetable?.sourceDataset || null
      };
    }).filter((item): item is NonNullable<typeof item> => item !== null)
      .sort((a, b) => a.arrivalUtc - b.arrivalUtc);

    const next = arrivals[0];
    if (!next) {
      return json({
        success: true,
        data: null,
        meta: { routeId, stopId, serviceDate: serviceDate.date, basis: "published_timetable", message: "No published departure is scheduled for this stop on the selected date." }
      });
    }

    return json({
      success: true,
      data: {
        routeId,
        stopId,
        stopName: stop.stopName,
        scheduledArrival: next.arrivalTime,
        predictedArrival: next.arrivalTime,
        isEstimated: false,
        delayMinutes: 0,
        confidence: "low",
        trackingStatus: "unavailable",
        lastUpdated: new Date(now).toISOString(),
        basis: "timetable_projection",
        serviceDate: serviceDate.date,
        tripCode: next.tripCode,
        sourceDataset: next.sourceDataset
      }
    });
  } catch {
    return json({ success: false, error: "ETA lookup is temporarily unavailable." }, 503);
  }
}
