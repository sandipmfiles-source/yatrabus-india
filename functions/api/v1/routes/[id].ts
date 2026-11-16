import { PagesContext, json, unavailable, parsePayload } from "../../../_lib/api";
export async function onRequestGet({ env, params }: PagesContext): Promise<Response> {
  if (!env.DB) return unavailable();
  try {
    const row = await env.DB.prepare("SELECT payload_json FROM routes WHERE id = ? LIMIT 1").bind(params?.id || "").first<{payload_json:string}>();
    const route = parsePayload(row);
    return route ? json({ success: true, data: route }) : json({ success: false, error: "Route not found" }, 404);
  } catch { return json({ success: false, error: "Route lookup is temporarily unavailable." }, 503); }
}
