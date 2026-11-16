import { D1Database } from "./api";

export async function getLatestConsentedBusLocation(db: D1Database, busId: string): Promise<any | null> {
  const row = await db.prepare(
    "SELECT lo.latitude,lo.longitude,lo.accuracy,lo.speed,lo.heading,lo.observed_at,lo.route_id,js.id AS session_id,js.started_at,js.payload_json AS session_payload " +
    "FROM location_observations lo JOIN journey_sessions js ON js.id = lo.session_id " +
    "WHERE lo.bus_id = ? AND js.status = 'active' AND js.consent_given = 1 " +
    "ORDER BY lo.observed_at DESC LIMIT 1"
  ).bind(busId).first<any>();
  if (!row) return null;

  let sessionPayload: any = {};
  try { sessionPayload = JSON.parse(row.session_payload || "{}"); } catch { sessionPayload = {}; }
  const startedAt = Date.parse(row.started_at);
  const expiresAt = sessionPayload.expiresAt
    ? Date.parse(sessionPayload.expiresAt)
    : (Number.isFinite(startedAt) ? startedAt + 12 * 60 * 60 * 1000 : 0);
  const now = Date.now();
  if (!expiresAt || expiresAt <= now) {
    await db.prepare("UPDATE journey_sessions SET status = 'expired', stopped_at = COALESCE(stopped_at, ?) WHERE id = ? AND status = 'active'")
      .bind(new Date(now).toISOString(), row.session_id).run();
    return null;
  }

  const observedAt = Date.parse(row.observed_at);
  if (!Number.isFinite(observedAt) || observedAt > now + 60_000) return null;
  const ageSeconds = Math.max(0, Math.floor((now - observedAt) / 1000));
  if (ageSeconds > 600) return null;

  let observationPayload: any = {};
  const confidence = Number(row.accuracy) <= 25 ? "high" : "medium";
  return {
    routeId: row.route_id,
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    accuracyMeters: row.accuracy == null ? null : Number(row.accuracy),
    speedKmh: row.speed == null ? null : Number(row.speed),
    heading: row.heading == null ? null : Number(row.heading),
    observedAt: row.observed_at,
    ageSeconds,
    isLive: ageSeconds <= 120,
    status: ageSeconds <= 120 ? "live" : "last_known",
    confidence,
    source: "consented_community_device"
  };
}
