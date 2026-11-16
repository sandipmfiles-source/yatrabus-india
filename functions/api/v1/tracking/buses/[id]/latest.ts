import { PagesContext, json, unavailable, onRequestOptions } from "../../../../../../_lib/api";
import { getLatestConsentedBusLocation } from "../../../../../../_lib/tracking";
export { onRequestOptions };

export async function onRequestGet({ env, params }: PagesContext): Promise<Response> {
  if (!env.DB) return unavailable();
  const busId=params?.id||"";
  if(!busId) return json({success:false,error:"Bus ID is required."},400);
  try {
    const bus=await env.DB.prepare("SELECT id FROM buses WHERE id=? AND status='active' LIMIT 1").bind(busId).first<{id:string}>();
    if(!bus) return json({success:false,error:"Bus not found or not active."},404);
    const location=await getLatestConsentedBusLocation(env.DB,busId);
    return json({success:true,data:location});
  } catch {
    return json({success:false,error:"Latest bus location is temporarily unavailable."},503);
  }
}
