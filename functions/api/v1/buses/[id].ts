import { PagesContext, json, unavailable, parsePayload } from "../../../_lib/api";
import { aggregateBusLocation, RawLocationObservation } from "../../../_lib/locationAggregation";

type BusRow = { id: string; operator_id: string | null; status: string; payload_json: string };
type RouteRow = { id: string; status: string; payload_json: string };
type ObservationRow = RawLocationObservation;

export async function onRequestGet({ request, env, params }: PagesContext): Promise<Response> {
  if (!env.DB) return unavailable();
  const busId = params?.id || "";
  if (!busId) return json({ success: false, error: "Bus ID is required." }, 400);
  const url = new URL(request.url);

  try {
    const row = await env.DB.prepare(
      "SELECT id, operator_id, status, payload_json FROM buses WHERE id = ? LIMIT 1"
    ).bind(busId).first<BusRow>();
    const bus = parsePayload(row);
    if (!row || !bus) return json({ success: false, error: "Bus not found." }, 404);

    const nowIso = new Date().toISOString();
    await env.DB.prepare(`
      UPDATE journey_sessions
      SET status = 'expired',
          stopped_at = COALESCE(stopped_at, ?),
          payload_json = json_set(payload_json, '$.expiredAt', ?)
      WHERE bus_id = ?
        AND status = 'active'
        AND julianday(json_extract(payload_json, '$.expiresAt')) <= julianday(?)
    `).bind(nowIso, nowIso, busId, nowIso).run();

    let routeId = (url.searchParams.get("routeId") || "").trim();
    if (!routeId) {
      const activeSession = await env.DB.prepare(
        "SELECT route_id FROM journey_sessions WHERE bus_id = ? AND status = 'active' ORDER BY started_at DESC LIMIT 1"
      ).bind(busId).first<{ route_id: string }>();
      routeId = activeSession?.route_id || "";
    }

    let currentLocation = null;
    if (routeId) {
      const routeRow = await env.DB.prepare(
        "SELECT id, status, payload_json FROM routes WHERE id = ? LIMIT 1"
      ).bind(routeId).first<RouteRow>();
      const route = parsePayload(routeRow);
      const busOperatorId = row.operator_id || bus.operatorId;
      if (routeRow && routeRow.status === "active" && route && busOperatorId && route.operatorId === busOperatorId) {
        const now = new Date();
        const nowIso = now.toISOString();
        const cutoff = new Date(now.getTime() - 120_000).toISOString();
        const observations = await env.DB.prepare(`
          SELECT
            o.id, o.session_id, o.bus_id, o.route_id,
            o.latitude, o.longitude, o.accuracy, o.speed, o.heading, o.observed_at
          FROM location_observations AS o
          JOIN journey_sessions AS s ON s.id = o.session_id
          WHERE o.bus_id = ?
            AND o.route_id = ?
            AND s.status = 'active'
            AND s.consent_given = 1
            AND o.observed_at >= ?
            AND json_extract(s.payload_json, '$.expiresAt') > ?
          ORDER BY o.observed_at DESC
          LIMIT 100
        `).bind(busId, routeId, cutoff, nowIso).all<ObservationRow>();
        currentLocation = aggregateBusLocation(
          observations.results || [],
          busId,
          routeId,
          Array.isArray(route.polyline) ? route.polyline : [],
          now.getTime()
        );
      }
    }

    return json({ success: true, data: { ...bus, currentLocation } });
  } catch {
    return json({ success: false, error: "Bus lookup is temporarily unavailable." }, 503);
  }
}
