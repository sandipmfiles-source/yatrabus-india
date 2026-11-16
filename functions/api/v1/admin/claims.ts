import { PagesContext, json, unavailable, boundedInt, onRequestOptions } from "../../../_lib/api";
import { readAdminSession } from "../../../_lib/adminAuth";

export { onRequestOptions };

export async function onRequestGet({ request, env }: PagesContext): Promise<Response> {
  if (!env.DB) return unavailable();
  const admin = await readAdminSession(request, env, env.DB);
  if (!admin) return json({ success: false, error: "Administrator authorization required." }, 401);
  const status = new URL(request.url).searchParams.get("status");
  const limit = boundedInt(new URL(request.url).searchParams.get("limit"), 100, 1, 250);
  try {
    const rows = status
      ? await env.DB.prepare("SELECT id,operator_id,status,submitted_at,reviewed_at,payload_json FROM operator_claims WHERE status = ? ORDER BY submitted_at DESC LIMIT ?").bind(status, limit).all<any>()
      : await env.DB.prepare("SELECT id,operator_id,status,submitted_at,reviewed_at,payload_json FROM operator_claims ORDER BY submitted_at DESC LIMIT ?").bind(limit).all<any>();
    const data = (rows.results || []).map(row => {
      let payload: any = {};
      try { payload = JSON.parse(row.payload_json); } catch { payload = {}; }
      return { ...payload, id: row.id, operatorId: row.operator_id, status: row.status, submittedAt: row.submitted_at, reviewedAt: row.reviewed_at };
    });
    return json({ success: true, data });
  } catch {
    return json({ success: false, error: "Operator claims are temporarily unavailable." }, 503);
  }
}
