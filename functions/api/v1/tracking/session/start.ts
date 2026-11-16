import { PagesContext, json, onRequestOptions, unavailable, parsePayload } from "../../../../_lib/api";
import { enforcePublicRateLimit } from "../../../../_lib/rateLimit";

export { onRequestOptions };

type StartRow = {
  bus_id: string;
  bus_operator_id: string | null;
  bus_status: string;
  bus_payload: string;
  route_id: string;
  route_status: string;
  route_payload: string;
};

export async function onRequestPost({ request, env }: PagesContext): Promise<Response> {
  if (!env.DB) return unavailable();
  const limited = await enforcePublicRateLimit(request, env, "journey-session-start", 10, 60_000);
  if (limited) return limited;

  let body: Record<string, unknown>;
  try {
    body = await request.json() as Record<string, unknown>;
  } catch {
    return json({ success: false, error: "A valid JSON request is required." }, 400);
  }

  const busId = typeof body.busId === "string" ? body.busId.trim() : "";
  const routeId = typeof body.routeId === "string" ? body.routeId.trim() : "";
  if (!busId || !routeId || busId.length > 128 || routeId.length > 128) {
    return json({ success: false, error: "A valid bus and route are required." }, 400);
  }
  if (body.consent !== true) {
    return json({ success: false, error: "Explicit location-sharing consent is required." }, 403);
  }

  try {
    const row = await env.DB.prepare(`
      SELECT
        b.id AS bus_id,
        b.operator_id AS bus_operator_id,
        b.status AS bus_status,
        b.payload_json AS bus_payload,
        r.id AS route_id,
        r.status AS route_status,
        r.payload_json AS route_payload
      FROM buses AS b
      JOIN routes AS r ON r.id = ?
      WHERE b.id = ?
      LIMIT 1
    `).bind(routeId, busId).first<StartRow>();

    if (!row) return json({ success: false, error: "Bus or route was not found." }, 404);
    if (row.bus_status !== "active" || row.route_status !== "active") {
      return json({ success: false, error: "Only active, approved buses and routes can share location." }, 409);
    }

    const bus = parsePayload({ payload_json: row.bus_payload });
    const route = parsePayload({ payload_json: row.route_payload });
    const busOperatorId = row.bus_operator_id || bus?.operatorId;
    const routeOperatorId = route?.operatorId;
    if (!busOperatorId || !routeOperatorId || busOperatorId !== routeOperatorId) {
      return json({ success: false, error: "This bus is not verified as belonging to the selected route operator." }, 403);
    }

    const now = new Date();
    const startedAt = now.toISOString();
    const expiresAt = new Date(now.getTime() + 6 * 60 * 60 * 1000).toISOString();
    const sessionId = crypto.randomUUID();
    const payload = {
      sessionId,
      consentVersion: "yatrabus-gps-consent-2026-11-v1",
      consentedAt: startedAt,
      consentScope: "foreground-location-only",
      expiresAt,
      rawLocationRetentionHours: 24,
      identityStored: false
    };

    await env.DB.prepare(`
      INSERT INTO journey_sessions
        (id, bus_id, route_id, consent_given, status, started_at, stopped_at, payload_json)
      VALUES (?, ?, ?, 1, 'active', ?, NULL, ?)
    `).bind(sessionId, busId, routeId, startedAt, JSON.stringify(payload)).run();

    return json({
      success: true,
      data: { sessionId, busId, routeId, startedAt, expiresAt, consentRecorded: true, foregroundOnly: true }
    }, 201);
  } catch {
    return json({ success: false, error: "Could not start the consented location session." }, 503);
  }
}
