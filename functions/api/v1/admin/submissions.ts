import { PagesContext, json, unavailable, boundedInt, onRequestOptions } from "../../../_lib/api";
import { readAdminSession } from "../../../_lib/adminAuth";

export { onRequestOptions };

interface SubmissionRow {
  id: string;
  status: string;
  submitted_at: string;
  reviewed_at: string | null;
  payload_json: string;
}

export async function onRequestGet({ request, env }: PagesContext): Promise<Response> {
  if (!env.DB) return unavailable();
  const admin = await readAdminSession(request, env, env.DB);
  if (!admin) return json({ success: false, error: "Administrator authorization required." }, 401);
  const url = new URL(request.url);
  const status = url.searchParams.get("status");
  const allowed = new Set(["pending_review", "approved", "rejected", "merged"]);
  const limit = boundedInt(url.searchParams.get("limit"), 100, 1, 250);
  try {
    const rows = status && allowed.has(status)
      ? await env.DB.prepare("SELECT id,status,submitted_at,reviewed_at,payload_json FROM community_submissions WHERE status = ? ORDER BY submitted_at DESC LIMIT ?")
          .bind(status, limit).all<SubmissionRow>()
      : await env.DB.prepare("SELECT id,status,submitted_at,reviewed_at,payload_json FROM community_submissions ORDER BY submitted_at DESC LIMIT ?")
          .bind(limit).all<SubmissionRow>();
    const data = (rows.results || []).map(row => {
      let payload: any = {};
      try { payload = JSON.parse(row.payload_json); } catch { payload = {}; }
      return {
        ...payload,
        id: row.id,
        status: row.status,
        submittedAt: row.submitted_at || payload.submittedAt,
        reviewedAt: row.reviewed_at || payload.reviewedAt
      };
    });
    return json({ success: true, data, meta: { count: data.length } });
  } catch {
    return json({ success: false, error: "Submission queue is temporarily unavailable." }, 503);
  }
}
