import { PagesContext, json, unavailable, parsePayload } from "../../../../_lib/api";
export async function onRequestGet({ env, params }: PagesContext): Promise<Response> {
  if (!env.DB) return unavailable();
  try {
    const rows = await env.DB.prepare("SELECT payload_json FROM timetables WHERE route_id = ? ORDER BY departure_time")
      .bind(params?.id || "").all<{payload_json:string}>();
    const data = (rows.results || []).map(parsePayload).filter(Boolean);
    return json({ success: true, data, meta: { count: data.length } });
  } catch { return json({ success: false, error: "Timetable lookup is temporarily unavailable." }, 503); }
}
