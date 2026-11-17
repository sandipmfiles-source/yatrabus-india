import { PagesContext, json, unavailable } from "../../../_lib/api.js";
import { clientIpHash } from "../../../_lib/adminAuth.js";
import { getJourneySession, sessionIsActiveAndConsented } from "../../../_lib/tracking.js";
export { onRequestOptions } from "../../../_lib/api.js";

export async function onRequestPost({request,env}:PagesContext):Promise<Response>{
  if(!env.DB) return unavailable();
  const body:any=await request.json().catch(()=>null);
  const sessionId=String(body?.sessionId||"").trim();
  const status=String(body?.status||"").toUpperCase();
  const disclosuresAccepted=body?.disclosuresAccepted===true;
  if(!sessionId||!["GRANTED","DECLINED","REVOKED"].includes(status)) return json({success:false,error:"A sessionId and valid consent status are required."},400);
  if(status==="GRANTED"&&!disclosuresAccepted) return json({success:false,error:"Tracking disclosure must be accepted before location sharing."},400);
  try{
    const session=await getJourneySession(env.DB,sessionId);
    if(!session) return json({success:false,error:"Tracking session was not found."},404);
    const now=new Date().toISOString();
    if(status==="GRANTED"&&!sessionIsActiveAndConsented({...session,consent_given:0},now) && String(session.status).toLowerCase()!=="active")
      return json({success:false,error:"Tracking session is no longer active."},409);
    const granted=status==="GRANTED"?1:0;
    const payload=JSON.parse(session.payload_json||"{}");
    payload.consentStatus=status;
    payload.disclosuresAccepted=disclosuresAccepted;
    payload.consentRecordedAt=now;
    const stopped=status==="REVOKED"||status==="DECLINED";
    if(stopped){payload.isActive=false;payload.stoppedReason=status==="REVOKED"?"CONSENT_REVOKED":"USER_STOPPED";}
    await env.DB.prepare(`UPDATE journey_sessions SET consent_given=?,status=CASE WHEN ?=1 THEN status ELSE 'stopped' END,
      stopped_at=CASE WHEN ?=1 THEN stopped_at ELSE ? END,
      stopped_reason=CASE WHEN ?=1 THEN stopped_reason ELSE ? END,
      last_active_time=?,payload_json=? WHERE id=?`
    ).bind(granted,granted,granted,now,granted,payload.stoppedReason||status,now,JSON.stringify(payload),sessionId).run();
    const secret=env.RATE_LIMIT_SECRET||env.ADMIN_JWT_SECRET||"";
    const ipHash=secret.length>=16?clientIpHash(request,secret):null;
    await env.DB.prepare(`INSERT INTO consent_records
      (id,session_id,scope,status,granted_at,revoked_at,disclosures_accepted,user_agent_snippet,ip_hash)
      VALUES(?,?,'JOURNEY_TRACKING',?,?,?,?,?,?)`
    ).bind(crypto.randomUUID(),sessionId,status,status==="GRANTED"?now:null,stopped?now:null,disclosuresAccepted?1:0,(request.headers.get("User-Agent")||"").slice(0,160),ipHash).run();
    return json({success:true,sessionId,status,consentGiven:granted===1});
  }catch{
    return json({success:false,error:"Consent could not be saved. D1 writes may be temporarily blocked."},503);
  }
}
