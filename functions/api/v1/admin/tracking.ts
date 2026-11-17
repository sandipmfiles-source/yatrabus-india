import { PagesContext, json, unavailable } from "../../../_lib/api.js";
import { readAdminSession } from "../../../_lib/adminAuth.js";
export { onRequestOptions } from "../../../_lib/api.js";

export async function onRequestGet({request,env}:PagesContext):Promise<Response>{
  if(!env.DB) return unavailable();
  const admin=await readAdminSession(request,env,env.DB);
  if(!admin) return json({success:false,error:"A valid Super Admin session is required."},401);
  try{
    const [sessions,locations,observations]=await Promise.all([
      env.DB.prepare("SELECT id,bus_id,route_id,started_at,last_active_time,max_expiry_time,observations_contributed_count FROM journey_sessions WHERE status='active' AND consent_given=1 ORDER BY last_active_time DESC LIMIT 100").all<any>(),
      env.DB.prepare("SELECT bus_id,route_id,display_state,location_source,accuracy_meters,confidence_category,confidence_score,observation_count,independent_contributors_count,last_observed_at,is_live,status_explanation FROM bus_location_aggregates ORDER BY updated_at DESC LIMIT 100").all<any>(),
      env.DB.prepare("SELECT COUNT(*) AS total, SUM(CASE WHEN processing_status='ACCEPTED' THEN 1 ELSE 0 END) AS accepted, SUM(CASE WHEN processing_status='HELD_FOR_REVIEW' THEN 1 ELSE 0 END) AS held FROM location_observations WHERE observed_at >= ?").bind(new Date(Date.now()-24*60*60*1000).toISOString()).first<any>()
    ]);
    return json({success:true,data:{activeSessions:sessions.results||[],busLocations:locations.results||[],last24Hours:{total:Number(observations?.total||0),accepted:Number(observations?.accepted||0),heldForReview:Number(observations?.held||0)},privacyNote:"Admin view exposes aggregate bus-location quality and active-session metadata only; it does not expose passenger phone numbers or raw cell identifiers."}});
  }catch{return json({success:false,error:"Tracking overview is temporarily unavailable."},503);}
}
