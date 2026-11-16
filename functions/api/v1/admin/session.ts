import { PagesContext, json, unavailable, onRequestOptions } from "../../../_lib/api";
import { readAdminSession } from "../../../_lib/adminAuth";

export { onRequestOptions };

export async function onRequestGet({ request, env }: PagesContext): Promise<Response> {
  if (!env.DB) return unavailable();
  const admin = await readAdminSession(request, env, env.DB);
  if (!admin) return json({ success: false, error: "Administrator session is invalid or expired." }, 401);
  return json({ success: true, data: { id: admin.sub, email: admin.email, role: admin.role, expiresAt: new Date(admin.exp * 1000).toISOString() } });
}
