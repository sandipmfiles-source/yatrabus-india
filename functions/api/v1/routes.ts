import { PagesContext, json, unavailable, parsePayload } from "../../_lib/api";
export async function onRequestGet({ env }: PagesContext): Promise<Response> {
  if (!env.DB) return unavailable();
  try {
    const rows = await env.DB.prepare("SELECT payload_json FROM routes WHERE status = 'active' ORDER BY name").all<{payload_json:string}>();
    return json({ success: true, data: (rows.results || []).map(parsePayload).filter(Boolean) });
  } catch { return json({ success: false, error: "Route directory is temporarily unavailable." }, 503); }
}
