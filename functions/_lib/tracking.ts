import { D1Database, parsePayload } from "./api.js";
import { evaluateLocationConfidence, DEFAULT_CONFIDENCE_CONFIG } from "../../packages/shared/src/engine/confidenceEngine.js";
import { matchPointToRoute } from "../../packages/shared/src/engine/routeMatcher.js";

export interface JourneySessionRow {
  id:string; bus_id:string; route_id:string; consent_given:number; status:string;
  started_at:string; stopped_at:string|null; origin_stop_id?:string|null;
  destination_stop_id?:string|null; last_active_time?:string|null; max_expiry_time?:string|null;
  observations_contributed_count?:number; stopped_reason?:string|null; payload_json:string;
}
export async function getJourneySession(db:D1Database,id:string) {
  return db.prepare("SELECT * FROM journey_sessions WHERE id = ? LIMIT 1").bind(id).first<JourneySessionRow>();
}
export async function getRoute(db:D1Database,id:string):Promise<any|null> {
  const row=await db.prepare("SELECT payload_json FROM routes WHERE id = ? LIMIT 1").bind(id).first<{payload_json:string}>();
  return parsePayload(row);
}
export function sessionIsActiveAndConsented(session:JourneySessionRow|null,nowIso=new Date().toISOString()):boolean {
  if(!session || String(session.status).toLowerCase()!=="active" || Number(session.consent_given)!==1) return false;
  if(session.stopped_at) return false;
  if(session.max_expiry_time && session.max_expiry_time<=nowIso) return false;
  return true;
}
export function routeDistance(latitude:number,longitude:number,route:any):number {
  try { return matchPointToRoute(latitude,longitude,route,DEFAULT_CONFIDENCE_CONFIG.maxRouteDistanceMeters).distanceMeters; }
  catch { return Number.POSITIVE_INFINITY; }
}
export function evaluateGpsObservation(obs:any,route:any,nowIso:string,independentSessionsCount=1,hasContradictions=false) {
  return evaluateLocationConfidence(obs,route,nowIso,independentSessionsCount,hasContradictions,DEFAULT_CONFIDENCE_CONFIG);
}
export function parseClockMinutes(value:any):number {
  if(typeof value!=="string") return 0;
  const [h,m]=value.split(":").map(Number);
  return Number.isFinite(h)&&Number.isFinite(m)?h*60+m:0;
}
export function distanceMeters(lat1:number,lon1:number,lat2:number,lon2:number):number {
  const rad=(v:number)=>v*Math.PI/180;
  const dLat=rad(lat2-lat1),dLon=rad(lon2-lon1);
  const a=Math.sin(dLat/2)**2+Math.cos(rad(lat1))*Math.cos(rad(lat2))*Math.sin(dLon/2)**2;
  return 6371000*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
}
