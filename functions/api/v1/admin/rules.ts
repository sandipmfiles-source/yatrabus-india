import { PagesContext, json, unavailable, onRequestOptions } from "../../../_lib/api";
import { readAdminSession } from "../../../_lib/adminAuth";

export { onRequestOptions };

const DEFAULT_RULES = [
  { id: "gps-freshness-live", name: "GPS Live Freshness", description: "Observations older than this are not presented as live.", category: "freshness", thresholdValue: 120, isEnabled: true },
  { id: "gps-freshness-stale", name: "GPS Stale Window", description: "Older observations are hidden as unavailable.", category: "freshness", thresholdValue: 600, isEnabled: true },
  { id: "journey-session-max-hours", name: "Journey Session Safety Ceiling", description: "Maximum lifetime of a consented passenger tracking session.", category: "tracking", thresholdValue: 12, isEnabled: true },
  { id: "manual-route-approval", name: "Manual Route Approval", description: "New community routes require explicit Super Admin review before publication.", category: "verification", thresholdValue: 1, isEnabled: true },
  { id: "community-submissions-hourly", name: "Community Submission Limit", description: "Maximum submissions per client IP per hour.", category: "moderation", thresholdValue: 20, isEnabled: true }
];

export async function onRequestGet({ request, env }: PagesContext): Promise<Response> {
  if (!env.DB) return unavailable();
  const admin = await readAdminSession(request, env, env.DB);
  if (!admin) return json({ success: false, error: "Administrator authorization required." }, 401);
  try {
    for (const rule of DEFAULT_RULES) {
      await env.DB.prepare(
        "INSERT OR IGNORE INTO automation_rules (id,is_enabled,threshold_value,payload_json) VALUES (?,?,?,?)"
      ).bind(rule.id, rule.isEnabled ? 1 : 0, rule.thresholdValue, JSON.stringify(rule)).run();
    }
    const rows = await env.DB.prepare("SELECT id,is_enabled,threshold_value,payload_json FROM automation_rules ORDER BY id").all<any>();
    const data = (rows.results || []).map(row => {
      let payload: any = {};
      try { payload = JSON.parse(row.payload_json); } catch { payload = {}; }
      return {
        ...payload,
        id: row.id,
        isEnabled: Number(row.is_enabled) === 1,
        thresholdValue: row.threshold_value ?? payload.thresholdValue ?? 0
      };
    });
    return json({ success: true, data });
  } catch {
    return json({ success: false, error: "Automation rules are temporarily unavailable." }, 503);
  }
}
