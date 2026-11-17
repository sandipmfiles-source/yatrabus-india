import { PagesContext, json, unavailable } from "../../../_lib/api.js";
import { getRoute, getJourneySession, sessionIsActiveAndConsented, evaluateGpsObservation } from "../../../_lib/tracking.js";
export { onRequestOptions } from "../../../_lib/api.js";

export async function onRequestPost({request,env}:PagesContext):Promise<Response>{
  if(!env.DB) return unavailable();
  const body:any=await request.json().catch(()=>null);
  const routeId=String(body?.routeId||"");
  const samples=Array.isArray(body?.samples)?body.samples:[];
  if(!routeId||samples.length<2||samples.length>6||body?.disclosuresAccepted!==true)
    return json({verified:false,error:"Two to six consented samples and accepted disclosures are required."},400);
  try{
    const route=await getRoute(env.DB,routeId);
    if(!route) return json({verified:false,error:"Route not found."},404);
    const scored:any[]=[];
    for(const sample of samples){
      const session=await getJourneySession(env.DB,String(sample.sessionId||""));
      if(!sessionIsActiveAndConsented(session)||session!.route_id!==routeId) continue;
      const evaluation=evaluateGpsObservation({latitude:Number(sample.latitude),longitude:Number(sample.longitude),accuracyMeters:Number(sample.accuracyMeters),timestamp:String(sample.timestamp||""),speedKmh:sample.speedKmh==null?undefined:Number(sample.speedKmh),headingDegrees:sample.headingDegrees==null?undefined:Number(sample.headingDegrees),sessionId:String(sample.sessionId)},route,new Date().toISOString(),1,false);
      scored.push({busId:session!.bus_id,sessionId:session!.id,score:evaluation.score,category:evaluation.category,isPublishableAsLive:evaluation.isPublishableAsLive,reason:evaluation.rejectionReason||evaluation.explanation});
    }
    const grouped=new Map<string,any[]>();
    for(const item of scored){const list=grouped.get(item.busId)||[];list.push(item);grouped.set(item.busId,list);}
    const candidates=[...grouped.entries()].map(([busId,items])=>({busId,routeId,score:Math.round(items.reduce((n,x)=>n+x.score,0)/items.length),samples:items.length,verified:items.length>=2&&items.every(x=>x.isPublishableAsLive),reasons:items.map(x=>x.reason)})).sort((a,b)=>b.score-a.score);
    return json({verified:candidates.some(x=>x.verified),candidates,acceptedSamples:scored.length,requiredSamples:2,privacy:{consentRequired:true,rawPhoneIdentityStored:false}});
  }catch{return json({verified:false,error:"Bus candidate verification is temporarily unavailable."},503);}
}
