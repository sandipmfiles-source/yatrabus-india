import { PagesContext, json, unavailable, parsePayload } from "../../../../_lib/api.js";
import { getRoute } from "../../../../_lib/tracking.js";
export { onRequestOptions } from "../../../../_lib/api.js";

export async function onRequestPost({request,env}:PagesContext):Promise<Response>{
  if(!env.DB) return unavailable();
  const body:any=await request.json().catch(()=>null);
  const busId=String(body?.busId||"").trim(), routeId=String(body?.routeId||"").trim();
  if(!busId||!routeId) return json({success:false,error:"busId and routeId are required."},400);
  try{
    const [busRow,routeRow]=await Promise.all([
      env.DB.prepare("SELECT status,payload_json FROM buses WHERE id=? LIMIT 1").bind(busId).first<{status:string;payload_json:string}>(),
      env.DB.prepare("SELECT status,payload_json FROM routes WHERE id=? LIMIT 1").bind(routeId).first<{status:string;payload_json:string}>()
    ]);
    const bus=parsePayload(busRow),route=parsePayload(routeRow);
    if(!busRow||!bus) return json({success:false,error:"Bus record was not found."},404);
    if(!routeRow||!route) return json({success:false,error:"Route record was not found."},404);
    if(!["active","published","verified"].includes(String(busRow.status||"").toLowerCase()) ||
       !["active","published","verified"].includes(String(routeRow.status||"").toLowerCase()))
      return json({success:false,error:"Only active published buses and routes can start passenger tracking."},409);
    if(bus.routeId && String(bus.routeId)!==routeId)
      return json({success:false,error:"This bus is not assigned to the selected route."},409);
    const destinationStopId=body?.destinationStopId?String(body.destinationStopId):null;
    if(destinationStopId && !(route.stops||[]).some((stop:any)=>String(stop.stopId||stop.id)===destinationStopId))
      return json({success:false,error:"The selected destination is not on this route."},422);
    const now=new Date(),nowIso=now.toISOString(),expiry=new Date(now.getTime()+12*60*60*1000).toISOString();
    const sessionId=crypto.randomUUID();
    const payload={sessionId,busId,routeId,originStopId:null,destinationStopId,startTime:nowIso,lastActiveTime:nowIso,maxExpiryTime:expiry,isActive:true,isConfirmedPassenger:true,observationsContributedCount:0,consentStatus:"NOT_ASKED"};
    await env.DB.prepare(`INSERT INTO journey_sessions
      (id,bus_id,route_id,consent_given,status,started_at,stopped_at,payload_json,origin_stop_id,destination_stop_id,last_active_time,max_expiry_time,observations_contributed_count,stopped_reason)
      VALUES(?,?,?,0,'active',?,NULL,?,?,?,?,?,0,NULL)`
    ).bind(sessionId,busId,routeId,nowIso,JSON.stringify(payload),null,destinationStopId,nowIso,expiry).run();
    return json({success:true,session:payload});
  }catch{
    return json({success:false,error:"Could not create a tracking session. D1 may be read-only or temporarily unavailable."},503);
  }
}
