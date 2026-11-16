import { PagesContext, json, unavailable, onRequestOptions } from "../../../../_lib/api";
import { enforcePublicRateLimit } from "../../../../_lib/rateLimit";
export { onRequestOptions };

export async function onRequestPost({ request, env }: PagesContext): Promise<Response> {
  if (!env.DB) return unavailable();
  const limited = await enforcePublicRateLimit(request, env, "tracking-session-start", 5, 60 * 60 * 1000);
  if (limited) return limited;

  let body: any;
  try {
    const raw = await request.text();
    if (raw.length > 4096) return json({ success:false,error:"Tracking request is too large." },413);
    body = JSON.parse(raw || "{}");
  } catch { return json({ success:false,error:"A valid JSON body is required." },400); }

  const busId = typeof body?.busId === "string" ? body.busId.trim() : "";
  const routeId = typeof body?.routeId === "string" ? body.routeId.trim() : "";
  if (!busId || !routeId || body?.consent !== true) {
    return json({ success:false,error:"Bus, route and explicit location-sharing consent are required." },400);
  }

  try {
    const assignment = await env.DB.prepare(
      "SELECT b.id,b.payload_json FROM buses b " +
      "JOIN bus_route_assignments a ON a.bus_id = b.id AND a.status = 'active' " +
      "JOIN routes r ON r.id = a.route_id AND r.status = 'active' " +
      "WHERE b.id = ? AND a.route_id = ? AND b.status = 'active' LIMIT 1"
    ).bind(busId,routeId).first<{id:string;payload_json:string}>();
    if (!assignment) return json({success:false,error:"This bus is not approved and assigned to the selected route."},422);

    const now = new Date();
    const startedAt = now.toISOString();
    const expiresAt = new Date(now.getTime()+12*60*60*1000).toISOString();
    const sessionId = "session-" + crypto.randomUUID();
    const payload = {
      id:sessionId,busId,routeId,consentGiven:true,consentVersion:"1",
      source:"consented_community_device",startedAt,expiresAt,
      privacyNotice:"The device location is shared with YatraBus passengers for this bus and route until sharing is stopped or the 12-hour session expires."
    };
    await env.DB.prepare(
      "INSERT INTO journey_sessions (id,bus_id,route_id,consent_given,status,started_at,stopped_at,payload_json) VALUES (?,?,?,?,?,?,NULL,?)"
    ).bind(sessionId,busId,routeId,1,"active",startedAt,JSON.stringify(payload)).run();

    return json({success:true,data:{sessionId,busId,routeId,startedAt,expiresAt,consentGiven:true}});
  } catch {
    return json({success:false,error:"A consented tracking session could not be started."},503);
  }
}
