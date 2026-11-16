import { PagesContext, json, unavailable, onRequestOptions } from "../../../_lib/api";
import { enforcePublicRateLimit } from "../../../_lib/rateLimit";

export { onRequestOptions };

export async function onRequestPost({ request, env }: PagesContext): Promise<Response> {
  if (!env.DB) return unavailable();
  const rateLimited = await enforcePublicRateLimit(request, env, "operator-claim", 5, 24 * 60 * 60 * 1000);
  if (rateLimited) return rateLimited;
  let body: any;
  try {
    const raw = await request.text();
    if (raw.length > 8192) return json({ success: false, error: "Claim request is too large." }, 413);
    body = JSON.parse(raw || "{}");
  } catch {
    return json({ success: false, error: "A valid JSON body is required." }, 400);
  }
  const operatorId = typeof body?.operatorId === "string" ? body.operatorId.trim() : "";
  const claimantName = typeof body?.claimantName === "string" ? body.claimantName.trim() : "";
  const claimantDesignation = typeof body?.claimantDesignation === "string" ? body.claimantDesignation.trim() : "";
  const officialPhone = typeof body?.officialPhone === "string" ? body.officialPhone.replace(/[^\d+]/g, "") : "";
  const officialEmail = typeof body?.officialEmail === "string" ? body.officialEmail.trim().toLowerCase() : "";
  const notes = typeof body?.notes === "string" ? body.notes.trim().slice(0, 2000) : "";
  if (!operatorId || !claimantName || !claimantDesignation || !officialPhone || !officialEmail) {
    return json({ success: false, error: "All official claimant details are required." }, 400);
  }
  if (claimantName.length > 120 || claimantDesignation.length > 120 ||
      officialPhone.length < 8 || officialPhone.length > 20 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(officialEmail) || officialEmail.length > 254) {
    return json({ success: false, error: "Please check the claimant name, designation, phone and official email." }, 400);
  }
  try {
    const operator = await env.DB.prepare("SELECT id,name FROM operators WHERE id = ? LIMIT 1")
      .bind(operatorId).first<{id:string;name:string}>();
    if (!operator) return json({ success: false, error: "Operator not found in the YatraBus directory." }, 404);
    const id = "CLM-" + crypto.randomUUID().slice(0, 12).toUpperCase();
    const submittedAt = new Date().toISOString();
    const payload = {
      id, operatorId, operatorName: operator.name, claimantName, claimantDesignation,
      officialPhone, officialEmail, supportingDocumentsNote: notes, submittedAt,
      status: "pending_review"
    };
    await env.DB.prepare(
      "INSERT INTO operator_claims (id,operator_id,status,submitted_at,payload_json) VALUES (?,?,?,?,?)"
    ).bind(id, operatorId, "pending_review", submittedAt, JSON.stringify(payload)).run();
    return json({ success: true, data: { id, status: "pending_review" } }, 201);
  } catch {
    return json({ success: false, error: "Operator claim could not be submitted." }, 503);
  }
}
