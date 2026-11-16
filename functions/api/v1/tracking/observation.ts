import { PagesContext, json, unavailable, onRequestOptions } from "../../../../_lib/api";
import { enforcePublicRateLimit } from "../../../../_lib/rateLimit";
export { onRequestOptions };

function distanceKm(lat1:number,lon1:number,lat2:number,lon2:number):number {
  const r=6371.0088, rad=Math.PI/180;
  const dLat=(lat2-lat1)*rad, dLon=(lon2-lon1)*rad;
  const a=Math.sin(dLat/2)**2+Math.cos(lat1*rad)*Math.cos(lat2*rad)*Math.sin(dLon/2)**2;
  return 2*r*Math.asin(Math.min(1,Math.sqrt(a)));
}

export async function onRequestPost({ request, env }: PagesContext): Promise<Response> {
  if (!env.DB) return unavailable();
  const limited = await enforcePublicRateLimit(request, env, "tracking-observation", 360, 60 * 60 * 1000);
  if (limited) return limited;

  let body:any;
  try {
    const raw=await request.text();
    if(raw.length>4096) return json({success:false,error:"Location update is too large."},413);
    body=JSON.parse(raw||"{}");
  } catch { return json({success:false,error:"A valid JSON body is required."},400); }

  const sessionId=typeof body?.sessionId==="string"?body.sessionId.trim():"";
  const busId=typeof body?.busId==="string"?body.busId.trim():"";
  const routeId=typeof body?.routeId==="string"?body.routeId.trim():"";
  const latitude=Number(body?.latitude), longitude=Number(body?.longitude), accuracy=Number(body?.accuracyMeters);
  const speed=body?.speedKmh==null?null:Number(body.speedKmh);
  const heading=body?.heading==null?null:Number(body.heading);
  if(!sessionId||!busId||!routeId||!Number.isFinite(latitude)||!Number.isFinite(longitude)||
     latitude<6||latitude>38||longitude<68||longitude>98||
     !Number.isFinite(accuracy)||accuracy<0||accuracy>100||
     (speed!==null&&(!Number.isFinite(speed)||speed<0||speed>120))||
     (heading!==null&&(!Number.isFinite(heading)||heading<0||heading>360))) {
    return json({success:false,error:"Location coordinates or accuracy are outside accepted limits."},400);
  }

  try {
    const session=await env.DB.prepare(
      "SELECT bus_id,route_id,consent_given,status,started_at,payload_json FROM journey_sessions WHERE id=? LIMIT 1"
    ).bind(sessionId).first<any>();
    if(!session) return json({success:false,error:"Tracking session not found."},404);
    if(session.status!=="active"||Number(session.consent_given)!==1||session.bus_id!==busId||session.route_id!==routeId) {
      return json({success:false,error:"This tracking session is not active or consent does not match."},403);
    }
    let sessionPayload:any={}; try{sessionPayload=JSON.parse(session.payload_json||"{}");}catch{sessionPayload={};}
    const expiresAt=sessionPayload.expiresAt?Date.parse(sessionPayload.expiresAt):Date.parse(session.started_at)+12*60*60*1000;
    const now=Date.now(), nowIso=new Date(now).toISOString();
    if(!Number.isFinite(expiresAt)||expiresAt<=now) {
      await env.DB.prepare("UPDATE journey_sessions SET status='expired',stopped_at=? WHERE id=? AND status='active'")
        .bind(nowIso,sessionId).run();
      return json({success:false,error:"Tracking session has expired. Start a new consented session."},410);
    }

    const assignment=await env.DB.prepare(
      "SELECT 1 AS ok FROM bus_route_assignments a JOIN buses b ON b.id=a.bus_id JOIN routes r ON r.id=a.route_id " +
      "WHERE a.bus_id=? AND a.route_id=? AND a.status='active' AND b.status='active' AND r.status='active' LIMIT 1"
    ).bind(busId,routeId).first<{ok:number}>();
    if(!assignment) return json({success:false,error:"Bus-route assignment is no longer active."},403);

    const previous=await env.DB.prepare(
      "SELECT latitude,longitude,observed_at FROM location_observations WHERE session_id=? ORDER BY observed_at DESC LIMIT 1"
    ).bind(sessionId).first<{latitude:number;longitude:number;observed_at:string}>();
    if(previous) {
      const previousAt=Date.parse(previous.observed_at);
      const elapsed=(now-previousAt)/1000;
      if(!Number.isFinite(previousAt)||elapsed<5) return json({success:false,error:"Location updates must be at least five seconds apart."},429);
      if(elapsed>0) {
        const moved=distanceKm(Number(previous.latitude),Number(previous.longitude),latitude,longitude);
        if((moved/elapsed)*3600>140) return json({success:false,error:"Location jump is inconsistent with normal bus travel."},422);
      }
    }

    const id="obs-"+crypto.randomUUID();
    const confidence=accuracy<=25?"high":accuracy<=60?"medium":"low";
    const payload={
      id,sessionId,busId,routeId,latitude,longitude,accuracyMeters:accuracy,
      speedKmh:speed,heading,observedAt:nowIso,source:"consented_community_device",
      confidence,consentGiven:true
    };
    await env.DB.prepare(
      "INSERT INTO location_observations (id,session_id,bus_id,route_id,latitude,longitude,accuracy,speed,heading,observed_at,payload_json) VALUES (?,?,?,?,?,?,?,?,?,?,?)"
    ).bind(id,sessionId,busId,routeId,latitude,longitude,accuracy,speed,heading,nowIso,JSON.stringify(payload)).run();
    sessionPayload={...sessionPayload,lastObservationAt:nowIso};
    await env.DB.prepare("UPDATE journey_sessions SET payload_json=? WHERE id=? AND status='active'")
      .bind(JSON.stringify(sessionPayload),sessionId).run();
    return json({success:true,data:{id,observedAt:nowIso,confidence,accepted:true}});
  } catch {
    return json({success:false,error:"Location update could not be saved."},503);
  }
}
