import { PagesContext, json, unavailable, parsePayload } from "../../../_lib/api.js";
import { getJourneySession, getRoute, sessionIsActiveAndConsented, routeDistance, evaluateGpsObservation, distanceMeters } from "../../../_lib/tracking.js";
export { onRequestOptions } from "../../../_lib/api.js";

export async function onRequestPost({request,env}:PagesContext):Promise<Response>{
  if(!env.DB) return unavailable();
  const body:any=await request.json().catch(()=>null);
  const sessionId=String(body?.sessionId||""),busId=String(body?.busId||""),routeId=String(body?.routeId||"");
  const latitude=Number(body?.latitude),longitude=Number(body?.longitude),accuracyMeters=Number(body?.accuracyMeters);
  const locationSource=String(body?.locationSource||"GPS").toUpperCase()==="NETWORK"?"NETWORK":"GPS";
  const timestamp=body?.timestamp?new Date(body.timestamp).toISOString():new Date().toISOString();
  const speedKmh=body?.speedKmh==null?undefined:Number(body.speedKmh);
  const headingDegrees=body?.headingDegrees==null?undefined:Number(body.headingDegrees);
  if(!sessionId||!busId||!routeId||!Number.isFinite(latitude)||!Number.isFinite(longitude)||Math.abs(latitude)>90||Math.abs(longitude)>180||!Number.isFinite(accuracyMeters)||accuracyMeters<=0)
    return json({accepted:false,error:"A valid session, bus, route and location fix are required."},400);
  try{
    const session=await getJourneySession(env.DB,sessionId);
    const now=new Date(),nowIso=now.toISOString();
    if(!sessionIsActiveAndConsented(session,nowIso)||session!.bus_id!==busId||session!.route_id!==routeId)
      return json({accepted:false,error:"This journey is not active or consented."},403);
    const ageSeconds=Math.max(0,(now.getTime()-new Date(timestamp).getTime())/1000);
    if(!Number.isFinite(ageSeconds)||ageSeconds>300||new Date(timestamp).getTime()>now.getTime()+60000)
      return json({accepted:false,error:"Location sample is stale or has an invalid timestamp."},422);
    if(locationSource==="GPS"&&accuracyMeters>500) return json({accepted:false,error:"GPS accuracy is too low to assess this observation."},422);
    if(locationSource==="NETWORK"&&accuracyMeters>10000) return json({accepted:false,error:"Network location accuracy is outside the safe range."},422);
    const route=await getRoute(env.DB,routeId);
    if(!route) return json({accepted:false,error:"Route record was not found."},404);
    const independent=await env.DB.prepare(`SELECT COUNT(DISTINCT session_id) AS n FROM location_observations
      WHERE bus_id=? AND observed_at>=? AND processing_status='ACCEPTED'`).bind(busId,new Date(now.getTime()-5*60*1000).toISOString()).first<{n:number}>();
    const independentSessions=Math.max(1,Number(independent?.n||1));
    let evaluation:any;
    let dist=routeDistance(latitude,longitude,route);
    let processingStatus="ACCEPTED";
    let displayState="ESTIMATED";
    let confidenceScore=30;
    let confidenceCategory="LOW";
    let rejectionReason:string|null=null;
    if(locationSource==="GPS"){
      evaluation=evaluateGpsObservation({latitude,longitude,accuracyMeters,timestamp,speedKmh,headingDegrees,sessionId},route,nowIso,independentSessions,false);
      confidenceScore=evaluation.score;
      confidenceCategory=evaluation.category;
      processingStatus=evaluation.isPublishableAsLive?"ACCEPTED":"HELD_FOR_REVIEW";
      rejectionReason=evaluation.rejectionReason||null;
      displayState=evaluation.isPublishableAsLive?"LIVE":(ageSeconds<=600&&dist<=500?"LAST_KNOWN":"UNAVAILABLE");
    }else{
      if(!Number.isFinite(dist)||dist>3000) return json({accepted:false,error:"Network fix is too far from the published route."},422);
      displayState="ESTIMATED";
      confidenceScore=Math.max(10,Math.min(45,Math.round(45-(accuracyMeters/10000)*35)));
      confidenceCategory="LOW";
      evaluation={score:confidenceScore,category:confidenceCategory,isPublishableAsLive:false,explanation:"Network location is shown only as an estimate and is never labelled Live GPS."};
    }
    const observationId=crypto.randomUUID();
    const payload={id:observationId,sessionId,busId,routeId,latitude,longitude,accuracyMeters,speedKmh,headingDegrees,locationSource,timestamp,distanceFromRouteMeters:Math.round(dist),isRouteMatched:dist<=150,confidenceScore,confidenceCategory,processingStatus,rejectionReason,createdAt:nowIso};
    await env.DB.prepare(`INSERT INTO location_observations
      (id,session_id,bus_id,route_id,latitude,longitude,accuracy,speed,heading,observed_at,payload_json,location_source,distance_from_route_meters,is_route_matched,confidence_score,confidence_category,processing_status,rejection_reason)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
    ).bind(observationId,sessionId,busId,routeId,latitude,longitude,accuracyMeters,speedKmh??null,headingDegrees??null,timestamp,JSON.stringify(payload),locationSource,Number.isFinite(dist)?dist:null,dist<=150?1:0,confidenceScore,confidenceCategory,processingStatus,rejectionReason).run();
    const sessionPayload=JSON.parse(session!.payload_json||"{}");
    sessionPayload.lastActiveTime=nowIso;
    sessionPayload.observationsContributedCount=Number(sessionPayload.observationsContributedCount||0)+1;
    await env.DB.prepare("UPDATE journey_sessions SET last_active_time=?,observations_contributed_count=observations_contributed_count+1,payload_json=? WHERE id=?")
      .bind(nowIso,JSON.stringify(sessionPayload),sessionId).run();
    if(processingStatus==="ACCEPTED"&&(displayState==="LIVE"||displayState==="ESTIMATED"||displayState==="LAST_KNOWN")){
      const aggregate={busId,routeId,displayState,locationSource,latitude,longitude,accuracyMeters,bearing:headingDegrees,speedKmh,confidenceCategory,confidenceScore,observationCount:1,independentContributorsCount:independentSessions,lastObservedAt:timestamp,isLive:displayState==="LIVE",statusExplanation:evaluation?.explanation||"Network-derived position; not Live GPS.",updatedAt:nowIso};
      await env.DB.prepare(`INSERT INTO bus_location_aggregates
        (bus_id,route_id,display_state,location_source,latitude,longitude,accuracy_meters,bearing,speed_kmh,confidence_category,confidence_score,observation_count,independent_contributors_count,last_observed_at,is_live,status_explanation,updated_at,payload_json)
        VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        ON CONFLICT(bus_id) DO UPDATE SET
          route_id=excluded.route_id,display_state=excluded.display_state,location_source=excluded.location_source,
          latitude=excluded.latitude,longitude=excluded.longitude,accuracy_meters=excluded.accuracy_meters,
          bearing=excluded.bearing,speed_kmh=excluded.speed_kmh,confidence_category=excluded.confidence_category,
          confidence_score=excluded.confidence_score,observation_count=bus_location_aggregates.observation_count+1,
          independent_contributors_count=excluded.independent_contributors_count,last_observed_at=excluded.last_observed_at,
          is_live=excluded.is_live,status_explanation=excluded.status_explanation,updated_at=excluded.updated_at,payload_json=excluded.payload_json
        WHERE bus_location_aggregates.last_observed_at IS NULL OR excluded.last_observed_at >= bus_location_aggregates.last_observed_at`
      ).bind(busId,routeId,displayState,locationSource,latitude,longitude,accuracyMeters,headingDegrees??null,speedKmh??null,confidenceCategory,confidenceScore,1,independentSessions,timestamp,displayState==="LIVE"?1:0,aggregate.statusExplanation,nowIso,JSON.stringify(aggregate)).run();
    }
    let journeyCompleted=false;
    const destinationStopId=session!.destination_stop_id;
    if(destinationStopId&&accuracyMeters<=100){
      const dest=await env.DB.prepare("SELECT latitude,longitude FROM places WHERE id=? LIMIT 1").bind(destinationStopId).first<{latitude:number;longitude:number}>();
      if(dest&&Number.isFinite(Number(dest.latitude))&&Number.isFinite(Number(dest.longitude))&&distanceMeters(latitude,longitude,Number(dest.latitude),Number(dest.longitude))<=100){
        const count=Number(sessionPayload.destinationArrivalCount||0)+1;
        sessionPayload.destinationArrivalCount=count;
        if(count>=2){
          journeyCompleted=true;sessionPayload.isActive=false;sessionPayload.stoppedReason="JOURNEY_COMPLETED";
          await env.DB.prepare("UPDATE journey_sessions SET status='completed',consent_given=0,stopped_at=?,stopped_reason='JOURNEY_COMPLETED',payload_json=? WHERE id=?").bind(nowIso,JSON.stringify(sessionPayload),sessionId).run();
        }else{
          await env.DB.prepare("UPDATE journey_sessions SET payload_json=? WHERE id=?").bind(JSON.stringify(sessionPayload),sessionId).run();
        }
      }else{sessionPayload.destinationArrivalCount=0;await env.DB.prepare("UPDATE journey_sessions SET payload_json=? WHERE id=?").bind(JSON.stringify(sessionPayload),sessionId).run();}
    }
    return json({accepted:processingStatus==="ACCEPTED",observationId,evaluation,displayState,journeyCompleted,sessionActive:!journeyCompleted,reason:rejectionReason});
  }catch{
    return json({accepted:false,error:"Location observation could not be stored. D1 writes may be temporarily blocked."},503);
  }
}
