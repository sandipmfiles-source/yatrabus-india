import { PagesContext, json, onRequestOptions, unavailable, parsePayload } from "../../../_lib/api";
import { enforcePublicRateLimit } from "../../../_lib/rateLimit";

export { onRequestOptions };

type SessionRow = {
  id: string;
  bus_id: string;
  route_id: string;
  consent_given: number;
  status: string;
  payload_json: string;
};
type LastObservation = { observed_at: string };

export async function onRequestPost({ request, env }: PagesContext): Promise<Response> {
  if (!env.DB) return unavailable();
  const limited = await enforcePublicRateLimit(request, env, "journey-location-observation", 90, 60_000);
  if (limited) return limited;

  let body: Record<string, unknown>;
  try {
    body = await request.json() as Record<string, unknown>;
  } catch {
    return json({ success: false, error: "A valid JSON location observation is required." }, 400);
  }

  const sessionId = typeof body.sessionId === "string" ? body.sessionId.trim() : "";
  const busId = typeof body.busId === "string" ? body.busId.trim() : "";
  const routeId = typeof body.routeId === "string" ? body.routeId.trim() : "";
  const latitude = Number(body.latitude);
  const longitude = Number(body.longitude);
  const accuracyMeters = Number(body.accuracyMeters);
  const speedKmh = body.speedKmh === undefined || body.speedKmh === null ? null : Number(body.speedKmh);
  const heading = body.heading === undefined || body.heading === null ? null : Number(body.heading);

  if (!sessionId || !busId || !routeId || sessionId.length > 128 || busId.length > 128 || routeId.length > 128) {
    return json({ success: false, error: "A valid consented session, bus and route are required." }, 400);
  }
  if (!Number.isFinite(latitude) || latitude < 6 || latitude > 38 || !Number.isFinite(longitude) || longitude < 68 || longitude > 98) {
    return json({ success: false, error: "GPS coordinates must be within India." }, 422);
  }
  if (!Number.isFinite(accuracyMeters) || accuracyMeters < 0 || accuracyMeters > 500) {
    return json({ success: false, error: "GPS accuracy is too low to share safely. Please wait for a better signal." }, 422);
  }
  if (speedKmh !== null && (!Number.isFinite(speedKmh) || speedKmh < 0 || speedKmh > 180)) {
    return json({ success: false, error: "GPS speed value is outside the accepted range." }, 422);
  }
  if (heading !== null && (!Number.isFinite(heading) || heading < 0 || heading >= 360)) {
    return json({ success: false, error: "GPS heading must be between 0 and 359 degrees." }, 422);
  }

  try {
    const session = await env.DB.prepare(`
      SELECT id, bus_id, route_id, consent_given, status, payload_json
      FROM journey_sessions
      WHERE id = ?
      LIMIT 1
    `).bind(sessionId).first<SessionRow>();
    if (!session || session.bus_id !== busId || session.route_id !== routeId) {
      return json({ success: false, error: "The location session does not match this bus and route." }, 403);
    }
    if (Number(session.consent_given) !== 1) {
      return json({ success: false, error: "Location sharing consent is not recorded for this session." }, 403);
    }
    if (session.status !== "active") {
      return json({ success: false, error: "This location-sharing session is no longer active." }, 410);
    }

    const sessionPayload = parsePayload(session);
    const expiresAt = Date.parse(sessionPayload?.expiresAt || "");
    const now = new Date();
    const observedAt = now.toISOString();
    if (!Number.isFinite(expiresAt) || expiresAt <= now.getTime()) {
      const expiredPayload = { ...(sessionPayload || {}), expiredAt: observedAt, stopReason: "session_expired" };
      await env.DB.prepare(
        "UPDATE journey_sessions SET status = 'expired', stopped_at = ?, payload_json = ? WHERE id = ? AND status = 'active'"
      ).bind(observedAt, JSON.stringify(expiredPayload), sessionId).run();
      return json({ success: false, error: "This location-sharing session has expired. Please start sharing again." }, 410);
    }

    const last = await env.DB.prepare(
      "SELECT observed_at FROM location_observations WHERE session_id = ? ORDER BY observed_at DESC LIMIT 1"
    ).bind(sessionId).first<LastObservation>();
    if (last?.observed_at) {
      const elapsed = now.getTime() - Date.parse(last.observed_at);
      if (Number.isFinite(elapsed) && elapsed < 10_000) {
        return json({ success: false, error: "Location updates are limited to one every 10 seconds.", retryAfterSeconds: Math.max(1, Math.ceil((10_000 - elapsed) / 1000)) }, 429);
      }
    }

    // Keep only one rounded point per consented session; do not create a movement history.
    const storedLatitude = Math.round(latitude * 10000) / 10000;
    const storedLongitude = Math.round(longitude * 10000) / 10000;
    const payload = {
      sessionId,
      locationSource: "device_gps",
      coordinatePrecisionDecimals: 4,
      accuracyMeters,
      speedKmh,
      heading,
      foregroundOnly: true,
      receivedAt: observedAt
    };
    await env.DB.prepare(`
      INSERT INTO location_observations
        (id, session_id, bus_id, route_id, latitude, longitude, accuracy, speed, heading, observed_at, payload_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        latitude = excluded.latitude,
        longitude = excluded.longitude,
        accuracy = excluded.accuracy,
        speed = excluded.speed,
        heading = excluded.heading,
        observed_at = excluded.observed_at,
        payload_json = excluded.payload_json
    `).bind(
      sessionId, sessionId, busId, routeId, storedLatitude, storedLongitude,
      accuracyMeters, speedKmh, heading, observedAt, JSON.stringify(payload)
    ).run();

    return json({ success: true, data: { accepted: true, observedAt, nextUpdateAfterSeconds: 10, historyStored: false } }, 201);
  } catch {
    return json({ success: false, error: "Location observation could not be stored." }, 503);
  }
}
