import { PagesContext, json, unavailable } from "../../../../_lib/api.js";
import { getJourneySession } from "../../../../_lib/tracking.js";
export { onRequestOptions } from "../../../../_lib/api.js";

export async function onRequestPost({request,env}:PagesContext):Promise<Response>{
  if(!env.DB) return unavailable();
  const body:any=await request.json().catch(()=>null);
  const sessionId=String(body?.sessionId||"").trim();
  const reason=String(body?.reason||"USER_STOPPED").toUpperCase();
  if(!sessionId) return json({success:false,error:"sessionId is required."},400);
  try{
    const session=await getJourneySession(env.DB,sessionId);
    if(!session) return json({success:true,stopped:false});
    const now=new Date().toISOString();
    const payload=JSON.parse(session.payload_json||"{}");
    payload.isActive=false; payload.stoppedAt=now; payload.stoppedReason=reason;
    await env.DB.prepare("UPDATE journey_sessions SET status='stopped',consent_given=0,stopped_at=?,stopped_reason=?,last_active_time=?,payload_json=? WHERE id=?")
      .bind(now,reason,now,JSON.stringify(payload),sessionId).run();
    await env.DB.prepare("INSERT INTO consent_records (id,session_id,scope,status,revoked_at,disclosures_accepted) VALUES(?,?,'JOURNEY_TRACKING','REVOKED',?,0)")
      .bind(crypto.randomUUID(),sessionId,now).run();
    return json({success:true,stopped:true,sessionId,reason});
  }catch{return json({success:false,error:"Could not stop tracking session; D1 writes may be temporarily blocked."},503);}
}
