import { PagesContext, json, unavailable, boundedInt, parsePayload } from "../../../_lib/api";
import { parseServiceDate, serviceDateParams, timetableServiceFilter } from "../../../_lib/serviceCalendar";
import { onRequestGet as searchRoutes } from "../routes/search";

export async function onRequestGet(context: PagesContext): Promise<Response> {
  const { request, env } = context;
  if (!env.DB) return unavailable();
  const url = new URL(request.url);
  const from = (url.searchParams.get("from") || url.searchParams.get("origin") || "").trim();
  const to = (url.searchParams.get("to") || url.searchParams.get("destination") || "").trim();
  const date = parseServiceDate(url.searchParams.get("date"));
  const limit = boundedInt(url.searchParams.get("limit"), 20, 1, 50);
  if (!from || !to || !date) return json({ error: "Required: from, to and a valid YYYY-MM-DD date.", timetableStatus: "UNAVAILABLE", results: [] }, 400);

  const searchUrl = new URL(request.url);
  searchUrl.pathname = "/api/v1/routes/search";
  searchUrl.searchParams.set("origin", from);
  searchUrl.searchParams.set("destination", to);
  searchUrl.searchParams.set("date", date.date);
  const routeResponse = await searchRoutes({ ...context, request: new Request(searchUrl, { method: "GET", headers: request.headers }) });
  const routePayload: any = await routeResponse.json();
  if (!routeResponse.ok || routePayload.success === false) {
    return json({ error: routePayload.error || "Route search is temporarily unavailable.", timetableStatus: "UNAVAILABLE", results: [] }, routeResponse.status);
  }
  const direct = routePayload.data?.directRoutes || routePayload.directRoutes || [];
  const results: Array<Record<string, unknown>> = [];
  try {
    for (const item of direct.slice(0, 20)) {
      const route = item.route || item;
      if (!route?.id) continue;
      const rows = await env.DB.prepare(`
        SELECT payload_json FROM timetables AS t
        WHERE t.route_id = ? AND ${timetableServiceFilter("t")}
        ORDER BY t.departure_time LIMIT ?
      `).bind(route.id, ...serviceDateParams(date), limit).all<{payload_json:string}>();
      for (const row of rows.results || []) {
        const trip = parsePayload(row) as any;
        if (!trip) continue;
        results.push({
          feedId: trip.sourceDataset || route.sourceDataset || "YATRIBUS_D1",
          routeId: route.id,
          tripId: trip.tripCode || trip.id,
          routeName: route.name || route.routeNumber || route.id,
          routeShortName: route.routeNumber || null,
          headsign: trip.headsign || route.destinationName || null,
          departureTime: trip.departureTime || route.firstDepartureTime || null,
          arrivalTime: trip.arrivalTime || null,
          estimatedMinutes: item.estimatedMinutes || route.durationMinutes || null,
          stops: route.stops || [],
          operatingDays: trip.operatingDays || [],
          serviceDate: date.date,
          verificationStatus: trip.verificationStatus || route.verificationStatus || "published_unverified",
          sourceDataset: trip.sourceDataset || route.sourceDataset || null,
          sourceUrl: trip.sourceUrl || route.sourceUrl || null,
          sourceAttribution: trip.sourceAttribution || route.sourceAttribution || null,
          dataType: "GTFS_STATIC"
        });
        if (results.length >= limit) break;
      }
      if (results.length >= limit) break;
    }
    return json({
      timetableStatus: results.length ? "SCHEDULED_UNVERIFIED" : "NO_SERVICE_FOUND",
      dataType: "GTFS_STATIC",
      serviceDate: date.date,
      resultCount: results.length,
      results,
      directRoutes: direct,
      transferRoutes: routePayload.data?.transferRoutes || routePayload.transferRoutes || [],
      liveVehiclePositionsAvailable: false
    });
  } catch {
    return json({ error: "Timetable search is temporarily unavailable.", timetableStatus: "UNAVAILABLE", results: [] }, 503);
  }
}
