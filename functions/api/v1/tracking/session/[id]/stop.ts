import { PagesContext, json, unavailable, onRequestOptions } from "../../../../../_lib/api";
import { enforcePublicRateLimit } from "../../../../../_lib/rateLimit";
export { onRequestOptions };

export async function onRequestPost({ request, env, params }: PagesContext): Promise<Response> {
  if (!env.DB) return unavailable();
  const limited = await enforcePublicRateLimit(request, env, "tracking-session-stop", 20, 60 * 60 * 1000);
  if (limited) return limited;
  const sessionId = params?.id || "";
  if (!sessionId || sessionId.length > 100) return json({success:false,error:"Invalid tracking session."},400);
  try {
    const row = await env.DB.prepare("SELECT status,payload_json FROM journey_sessions WHERE id = ? LIMIT 1")
      .bind(sessionId).first<{status:string;payload_json:string}>();
    if (!row) return json({success:false,error:"Tracking session not found."},404);
    if (row.status !== "active") return json({success:true,data:{sessionId,status:row.status,alreadyStopped:true}});
    const stoppedAt = new Date().toISOString();
    let payload:any={}; try{payload=JSON.parse(row.payload_json||"{}");}catch{payload={};}
    payload={...payload,status:"stopped",stoppedAt};
    await env.DB.prepare("UPDATE journey_sessions SET status='stopped',stopped_at=?,payload_json=? WHERE id=? AND status='active'")
      .bind(stoppedAt,JSON.stringify(payload),sessionId).run();
    return json({success:true,data:{sessionId,status:"stopped",stoppedAt}});
  } catch {
    return json({success:false,error:"Tracking session could not be stopped."},503);
  }
}
