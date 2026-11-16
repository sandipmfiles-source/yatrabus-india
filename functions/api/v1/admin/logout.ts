import { PagesContext, json, unavailable, onRequestOptions } from "../../../_lib/api";
import { readAdminSession, tokenHash } from "../../../_lib/adminAuth";

export { onRequestOptions };

export async function onRequestPost({ request, env }: PagesContext): Promise<Response> {
  if (!env.DB) return unavailable();
  const session = await readAdminSession(request, env, env.DB);
  if (!session) return json({ success: false, error: "Administrator session is invalid or expired." }, 401);
  const token = (request.headers.get("Authorization") || "").slice(7).trim();
  await env.DB.prepare("UPDATE admin_sessions SET revoked_at = ? WHERE token_hash = ? AND revoked_at IS NULL")
    .bind(new Date().toISOString(), tokenHash(token)).run();
  return json({ success: true, data: { loggedOut: true } });
}
