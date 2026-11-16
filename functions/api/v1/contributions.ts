import { PagesContext, json, unavailable, onRequestOptions } from "../../_lib/api";
import { enforcePublicRateLimit } from "../../_lib/rateLimit";
export { onRequestOptions };
const allowedTypes = new Set(["add_bus","add_stop","suggest_route","correct_timetable","report_disruption","report_discontinued","claim_operator"]);
async function hashReference(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map(x => x.toString(16).padStart(2,"0")).join("");
}
export async function onRequestPost({ request, env }: PagesContext): Promise<Response> {
  if (!env.DB) return unavailable();
  const rateLimited = await enforcePublicRateLimit(request, env, "community-contribution", 20, 60 * 60 * 1000);
  if (rateLimited) return rateLimited;
  let payload:any;
  try {
    const raw = await request.text();
    if (raw.length > 32_000) return json({ success:false, error:"Submission is too large." },413);
    payload = JSON.parse(raw || "{}");
  } catch { return json({ success:false, error:"A valid JSON body is required." },400); }
  if (!allowedTypes.has(payload?.submissionType) || !payload?.proposedData || typeof payload.proposedData !== "object" || Array.isArray(payload.proposedData))
    return json({ success:false, error:"A supported submission type and proposed data are required." },400);
  const id = `SUB-${new Date().getUTCFullYear()}-${crypto.randomUUID().replace(/-/g,"").slice(0,12).toUpperCase()}`;
  const submittedAt = new Date().toISOString();
  const contributorRefHash = typeof payload.contributorRef === "string" && payload.contributorRef.length
    ? await hashReference(payload.contributorRef.slice(0,256))
    : "anonymous";
  const submission = {
    id, submissionType:payload.submissionType, proposedData:payload.proposedData,
    contributorNotes:typeof payload.contributorNotes === "string" ? payload.contributorNotes.slice(0,2000) : undefined,
    duplicateCandidateIds:[], status:"pending_review", submittedAt, contributorRefHash
  };
  try {
    await env.DB.prepare("INSERT INTO community_submissions (id, submission_type, status, submitted_at, payload_json) VALUES (?, ?, 'pending_review', ?, ?)")
      .bind(id, payload.submissionType, submittedAt, JSON.stringify(submission)).run();
    return json({ success:true, data:submission, meta:{ duplicateCandidates:[], hasDuplicates:false, trackingReferenceId:id } },201);
  } catch { return json({ success:false, error:"Submission could not be saved. Please try again later." },503); }
}
