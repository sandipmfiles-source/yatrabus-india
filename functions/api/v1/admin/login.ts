import { PagesContext, json, unavailable, onRequestOptions } from "../../../_lib/api";
import {
  adminIsConfigured, clientIpHash, constantTimeEmailMatch, createAdminToken,
  tokenHash, verifyAdminPassword
} from "../../../_lib/adminAuth";

export { onRequestOptions };

const LOCK_WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILED_ATTEMPTS = 5;

export async function onRequestPost({ request, env }: PagesContext): Promise<Response> {
  if (!env.DB) return unavailable();
  if (!adminIsConfigured(env)) {
    return json({
      success: false,
      error: "Super Admin login is not configured.",
      message: "Set ADMIN_EMAIL, ADMIN_PASSWORD_HASH and a 32+ character ADMIN_JWT_SECRET in Cloudflare Pages secrets."
    }, 503);
  }

  let body: any;
  try {
    const raw = await request.text();
    if (raw.length > 4096) return json({ success: false, error: "Login request is too large." }, 413);
    body = JSON.parse(raw || "{}");
  } catch {
    return json({ success: false, error: "A valid JSON body is required." }, 400);
  }

  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase()
    : (typeof body?.username === "string" ? body.username.trim().toLowerCase() : "");
  const password = typeof body?.password === "string" ? body.password : "";
  if (!email || !password || password.length > 1024) {
    return json({ success: false, error: "Owner email and password are required." }, 400);
  }

  const secret = env.ADMIN_JWT_SECRET || "";
  const ipHash = clientIpHash(request, secret);
  const now = Date.now();
  const nowIso = new Date(now).toISOString();
  const attempt = await env.DB.prepare(
    "SELECT failed_attempts, window_started_at, locked_until FROM admin_login_attempts WHERE ip_hash = ? LIMIT 1"
  ).bind(ipHash).first<{ failed_attempts: number; window_started_at: string; locked_until: string | null }>();

  if (attempt?.locked_until && Date.parse(attempt.locked_until) > now) {
    const retryAfterSeconds = Math.ceil((Date.parse(attempt.locked_until) - now) / 1000);
    return json({ success: false, error: "Too many failed login attempts. Try again later.", retryAfterSeconds }, 429);
  }

  let valid = false;
  try {
    valid = constantTimeEmailMatch(email, env.ADMIN_EMAIL || "") &&
      verifyAdminPassword(password, env.ADMIN_PASSWORD_HASH || "");
  } catch {
    return json({ success: false, error: "Administrator password verification is unavailable." }, 503);
  }

  if (!valid) {
    const windowExpired = !attempt || now - Date.parse(attempt.window_started_at) >= LOCK_WINDOW_MS;
    const failedAttempts = windowExpired ? 1 : Number(attempt?.failed_attempts || 0) + 1;
    const windowStartedAt = windowExpired ? nowIso : attempt!.window_started_at;
    const lockedUntil = failedAttempts >= MAX_FAILED_ATTEMPTS
      ? new Date(now + LOCK_WINDOW_MS).toISOString()
      : null;
    await env.DB.prepare(
      "INSERT INTO admin_login_attempts (ip_hash, window_started_at, failed_attempts, locked_until) VALUES (?, ?, ?, ?) ON CONFLICT(ip_hash) DO UPDATE SET window_started_at = excluded.window_started_at, failed_attempts = excluded.failed_attempts, locked_until = excluded.locked_until"
    ).bind(ipHash, windowStartedAt, failedAttempts, lockedUntil).run();
    return json({ success: false, error: "Invalid administrator credentials." }, 401);
  }

  await env.DB.prepare("DELETE FROM admin_login_attempts WHERE ip_hash = ?").bind(ipHash).run();
  const ownerEmail = (env.ADMIN_EMAIL || "").trim().toLowerCase();
  const { token, payload } = createAdminToken(ownerEmail, secret);
  const expiresAt = new Date(payload.exp * 1000).toISOString();
  await env.DB.prepare(
    "INSERT INTO admin_sessions (token_hash, owner_email, session_id, created_at, expires_at, revoked_at) VALUES (?, ?, ?, ?, ?, NULL)"
  ).bind(tokenHash(token), ownerEmail, payload.jti, nowIso, expiresAt).run();

  return json({
    success: true,
    data: {
      token,
      expiresIn: payload.exp - payload.iat,
      user: { id: payload.sub, email: payload.email, name: "Super Admin", role: payload.role }
    }
  });
}
