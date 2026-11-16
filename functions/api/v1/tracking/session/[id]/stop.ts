import { PagesContext, json, onRequestOptions, unavailable, parsePayload } from "../../../../../_lib/api";
import { enforcePublicRateLimit } from "../../../../../_lib/rateLimit";

export { onRequestOptions };

type SessionRow = { id: string; status: string; payload_json: string };

export async function onRequestPost({ request, env, params }: PagesContext): Promise<Response> {
  if (!env.DB) return unavailable();
  const limited = await enforcePublicRateLimit(request, env, "journey-session-stop", 30, 60_000);
  if (limited) return limited;
  const sessionId = params?.id || "";
  if (!sessionId || sessionId.length > 128) {
    return json({ success: false, error: "A valid journey session is required." }, 400);
  }

  try {
    const row = await env.DB.prepare(
      "SELECT id, status, payload_json FROM journey_sessions WHERE id = ? LIMIT 1"
    ).bind(sessionId).first<SessionRow>();
    if (!row) return json({ success: false, error: "Journey session was not found." }, 404);
    if (row.status !== "active") {
      return json({ success: true, data: { sessionId, stopped: true, alreadyStopped: true } });
    }

    const stoppedAt = new Date().toISOString();
    const payload = { ...(parsePayload(row) || {}), stoppedAt, stopReason: "user_requested" };
    await env.DB.prepare(
      "UPDATE journey_sessions SET status = 'stopped', stopped_at = ?, payload_json = ? WHERE id = ? AND status = 'active'"
    ).bind(stoppedAt, JSON.stringify(payload), sessionId).run();

    return json({ success: true, data: { sessionId, stopped: true, stoppedAt } });
  } catch {
    return json({ success: false, error: "Could not stop the location-sharing session." }, 503);
  }
}
