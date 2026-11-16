import { PagesContext, json, unavailable, onRequestOptions } from "../../../../_lib/api";
import { readAdminSession } from "../../../../_lib/adminAuth";

export { onRequestOptions };

export async function onRequestPost({ request, env, params }: PagesContext): Promise<Response> {
  if (!env.DB) return unavailable();
  const admin = await readAdminSession(request, env, env.DB);
  if (!admin) return json({ success: false, error: "Administrator authorization required." }, 401);
  const id = params?.id || "";
  let body: any;
  try {
    const raw = await request.text();
    if (raw.length > 4096) return json({ success: false, error: "Request is too large." }, 413);
    body = JSON.parse(raw || "{}");
  } catch {
    return json({ success: false, error: "A valid JSON body is required." }, 400);
  }
  if (typeof body?.isEnabled !== "boolean") {
    return json({ success: false, error: "A boolean isEnabled value is required." }, 400);
  }
  const threshold = Number(body.thresholdValue);
  if (!Number.isFinite(threshold) || threshold < 0 || threshold > 1000000) {
    return json({ success: false, error: "A valid non-negative thresholdValue is required." }, 400);
  }
  try {
    const row = await env.DB.prepare("SELECT payload_json FROM automation_rules WHERE id = ? LIMIT 1").bind(id).first<{payload_json:string}>();
    if (!row) return json({ success: false, error: "Automation rule not found." }, 404);
    let payload: any = {};
    try { payload = JSON.parse(row.payload_json); } catch { payload = {}; }
    payload = { ...payload, isEnabled: body.isEnabled, thresholdValue: threshold, updatedAt: new Date().toISOString() };
    const updatedAt = new Date().toISOString();
    await env.DB.prepare("UPDATE automation_rules SET is_enabled = ?, threshold_value = ?, payload_json = ?, updated_at = ? WHERE id = ?")
      .bind(body.isEnabled ? 1 : 0, threshold, JSON.stringify(payload), updatedAt, id).run();
    const auditId = "audit-" + crypto.randomUUID();
    const audit = { id: auditId, action: "update", entityType: "automation_rule", entityId: id, performedBy: admin.email, reason: "Super Admin changed automation rule", timestamp: updatedAt, isRollbackable: false };
    await env.DB.prepare("INSERT INTO audit_logs (id,action,entity_type,entity_id,actor_id,created_at,payload_json) VALUES (?,?,?,?,?,?,?)")
      .bind(auditId, "update", "automation_rule", id, admin.email, updatedAt, JSON.stringify(audit)).run();
    return json({ success: true, data: payload });
  } catch {
    return json({ success: false, error: "Automation rule could not be updated." }, 503);
  }
}
