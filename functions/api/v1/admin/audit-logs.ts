import { PagesContext, json, unavailable, boundedInt, onRequestOptions } from "../../../_lib/api";
import { readAdminSession } from "../../../_lib/adminAuth";

export { onRequestOptions };

export async function onRequestGet({ request, env }: PagesContext): Promise<Response> {
  if (!env.DB) return unavailable();
  const admin = await readAdminSession(request, env, env.DB);
  if (!admin) return json({ success: false, error: "Administrator authorization required." }, 401);
  const limit = boundedInt(new URL(request.url).searchParams.get("limit"), 100, 1, 250);
  try {
    const rows = await env.DB.prepare(
      "SELECT id,action,entity_type,entity_id,actor_id,created_at,payload_json FROM audit_logs ORDER BY created_at DESC LIMIT ?"
    ).bind(limit).all<any>();
    const data = (rows.results || []).map(row => {
      let payload: any = {};
      try { payload = JSON.parse(row.payload_json); } catch { payload = {}; }
      return {
        ...payload,
        id: row.id,
        action: payload.action || row.action,
        entityType: payload.entityType || row.entity_type,
        entityId: payload.entityId || row.entity_id,
        performedBy: payload.performedBy || row.actor_id || "Super Admin",
        timestamp: payload.timestamp || row.created_at,
        reason: payload.reason || "Owner action recorded",
        isRollbackable: false
      };
    });
    return json({ success: true, data });
  } catch {
    return json({ success: false, error: "Audit log is temporarily unavailable." }, 503);
  }
}
