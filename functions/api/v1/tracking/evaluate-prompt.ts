import { PagesContext, json, unavailable } from "../../../_lib/api.js";
import { getRoute } from "../../../_lib/tracking.js";
import { evaluateJourneyPrompt } from "../../../../packages/shared/src/engine/journeyConfirmationEngine.js";
export { onRequestOptions } from "../../../_lib/api.js";

export async function onRequestPost({request,env}:PagesContext):Promise<Response>{
  if(!env.DB) return unavailable();
  const body:any=await request.json().catch(()=>null);
  const routeId=String(body?.routeId||"");
  if(!routeId) return json({shouldPrompt:false,reason:"Route is required."},400);
  try{
    const route=await getRoute(env.DB,routeId);
    if(!route) return json({shouldPrompt:false,reason:"Route not found."},404);
    const result=evaluateJourneyPrompt(route,{
      isAlreadyTrackingThisBus:body?.isAlreadyTracking===true,
      dismissedCountForRoute:Math.max(0,Number(body?.dismissedCount)||0),
      hasExplicitlyDeclined:body?.hasExplicitlyDeclined===true
    },new Date().toISOString());
    return json(result);
  }catch{return json({shouldPrompt:false,reason:"Journey prompt evaluation is unavailable."},503);}
}
