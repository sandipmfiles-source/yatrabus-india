import { PagesContext, json, unavailable, parsePayload } from "../../../_lib/api";
export async function onRequestGet({ env, params }: PagesContext): Promise<Response> {
  if (!env.DB) return unavailable();
  try {
    const row = await env.DB.prepare("SELECT payload_json FROM buses WHERE id = ? LIMIT 1").bind(params?.id || "").first<{payload_json:string}>();
    const bus = parsePayload(row);
    if (!bus) return json({ success:false, error:"Bus not found" },404);
    const locationRow = await env.DB.prepare("SELECT payload_json FROM location_observations WHERE bus_id = ? ORDER BY observed_at DESC LIMIT 1").bind(params?.id || "").first<{payload_json:string}>();
    return json({ success:true, data:{ ...bus, currentLocation:parsePayload(locationRow) } });
  } catch { return json({ success:false, error:"Bus lookup is temporarily unavailable." },503); }
}
