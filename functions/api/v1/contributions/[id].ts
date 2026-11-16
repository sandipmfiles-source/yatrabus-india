import { PagesContext, json, unavailable, parsePayload } from "../../../_lib/api";
export async function onRequestGet({ env, params }: PagesContext): Promise<Response> {
  if (!env.DB) return unavailable();
  try {
    const row = await env.DB.prepare("SELECT payload_json FROM community_submissions WHERE id = ? LIMIT 1").bind(params?.id || "").first<{payload_json:string}>();
    const submission = parsePayload(row);
    if (!submission) return json({ success:false, error:"Submission reference ID not found" },404);
    return json({ success:true, data:{
      id:submission.id, type:submission.submissionType, status:submission.status,
      submittedAt:submission.submittedAt, reviewedAt:submission.reviewedAt,
      reviewRemarks:submission.reviewRemarks
    }});
  } catch { return json({ success:false, error:"Submission status is temporarily unavailable." },503); }
}
