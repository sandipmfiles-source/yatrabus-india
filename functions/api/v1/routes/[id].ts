import { PagesContext, json, unavailable, parsePayload } from "../../../_lib/api";
export async function onRequestGet({ env, params }: PagesContext): Promise<Response> {
  if (!env.DB) return unavailable();
  try {
    const row = await env.DB.prepare("SELECT payload_json FROM routes WHERE id = ? LIMIT 1").bind(params?.id || "").first<{payload_json:string}>();
    const route = parsePayload(row);
    if (!route) return json({ success: false, error: "Route not found" }, 404);
    let serviceAlerts: any[] = [];
    try {
      const alerts = await env.DB.prepare("SELECT payload_json FROM service_alerts WHERE route_id = ? AND status = 'active' AND (valid_until IS NULL OR valid_until > ?) ORDER BY created_at DESC LIMIT 10")
        .bind(params?.id || "", new Date().toISOString()).all<{payload_json:string}>();
      serviceAlerts = (alerts.results || []).map(item => parsePayload(item)).filter(Boolean);
    } catch { /* Route reads remain available until the admin migration is applied. */ }
    return json({ success: true, data: { ...route, serviceAlerts } });
  } catch { return json({ success: false, error: "Route lookup is temporarily unavailable." }, 503); }
}
