import { PagesContext, json, unavailable } from "../../../_lib/api.js";
import { getJourneySession, sessionIsActiveAndConsented } from "../../../_lib/tracking.js";
export { onRequestOptions } from "../../../_lib/api.js";

async function sha256(value:string):Promise<string>{
  const bytes=new TextEncoder().encode(value);
  const digest=await crypto.subtle.digest("SHA-256",bytes);
  return [...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,"0")).join("");
}
export async function onRequestPost({request,env}:PagesContext):Promise<Response>{
  if(!env.DB) return unavailable();
  const body:any=await request.json().catch(()=>null);
  const sessionId=String(body?.sessionId||""),busId=String(body?.busId||""),routeId=String(body?.routeId||"");
  if(!sessionId||!busId||!routeId||!body?.isRegistered) return json({accepted:false,error:"A registered cell observation and active session are required."},400);
  try{
    const session=await getJourneySession(env.DB,sessionId);
    if(!sessionIsActiveAndConsented(session)||session!.bus_id!==busId||session!.route_id!==routeId)
      return json({accepted:false,error:"This journey is not active or consented."},403);
    const cellHash=await sha256(String(body.cellId||""));
    const now=new Date().toISOString();
    await env.DB.prepare(`INSERT INTO cell_observations
      (id,session_id,bus_id,route_id,radio_type,mcc,mnc,area_code,cell_id,signal_dbm,is_registered,observed_at,payload_json)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`
    ).bind(crypto.randomUUID(),sessionId,busId,routeId,String(body.radioType||"LTE"),String(body.mcc||""),String(body.mnc||""),Number(body.areaCode)||0,cellHash,Number(body.signalDbm)||-120,1,body.timestamp||now,JSON.stringify({cellIdHash:cellHash,radioType:body.radioType,signalDbm:body.signalDbm,observedAt:body.timestamp||now})).run();
    return json({accepted:true,mapped:false,displayState:"UNAVAILABLE",message:"Cell sample stored in hashed form. A configured cell-location provider is required before it can support an estimated location."});
  }catch{return json({accepted:false,error:"Cell observation could not be stored. D1 writes may be temporarily blocked."},503);}
}
