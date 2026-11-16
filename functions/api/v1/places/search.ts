import { PagesContext, json, unavailable, boundedInt, parsePayload } from "../../../_lib/api";
export async function onRequestGet({ request, env }: PagesContext): Promise<Response> {
  if (!env.DB) return unavailable();
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") || "").trim().slice(0, 100);
  const limit = boundedInt(url.searchParams.get("limit"), 8, 1, 20);
  try {
    const pattern = `%${q.replace(/[\\%_]/g, "\\$&")}%`;
    const result = q
      ? await env.DB.prepare(`SELECT payload_json, canonical_name FROM places
          WHERE canonical_name LIKE ? ESCAPE '\\' COLLATE NOCASE
             OR state LIKE ? ESCAPE '\\' COLLATE NOCASE
             OR district LIKE ? ESCAPE '\\' COLLATE NOCASE
             OR aliases_json LIKE ? ESCAPE '\\' COLLATE NOCASE
          ORDER BY CASE WHEN canonical_name LIKE ? ESCAPE '\\' COLLATE NOCASE THEN 0 ELSE 1 END,
                   canonical_name LIMIT ?`)
          .bind(pattern, pattern, pattern, pattern, `${q.replace(/[\\%_]/g, "\\$&")}%`, limit).all<{payload_json:string;canonical_name:string}>()
      : await env.DB.prepare("SELECT payload_json, canonical_name FROM places ORDER BY canonical_name LIMIT ?")
          .bind(limit).all<{payload_json:string;canonical_name:string}>();
    const data = (result.results || []).map(row => parsePayload(row)).filter(Boolean);
    return json({ success: true, data, meta: { totalResults: data.length, query: q } });
  } catch {
    return json({ success: false, error: "Place search is temporarily unavailable." }, 503);
  }
}
