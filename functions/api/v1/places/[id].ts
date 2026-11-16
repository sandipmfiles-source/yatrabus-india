import { PagesContext, json, unavailable, parsePayload } from "../../../_lib/api";
export async function onRequestGet({ env, params }: PagesContext): Promise<Response> {
  if (!env.DB) return unavailable();
  const id = params?.id || "";
  try {
    const row = await env.DB.prepare("SELECT payload_json FROM places WHERE id = ? LIMIT 1").bind(id).first<{payload_json:string}>();
    const place = parsePayload(row);
    return place ? json({ success: true, data: place }) : json({ success: false, error: "Place not found" }, 404);
  } catch { return json({ success: false, error: "Place lookup is temporarily unavailable." }, 503); }
}
