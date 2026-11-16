import { createHmac } from "node:crypto";
import { PagesEnv, json } from "./api";

export async function enforcePublicRateLimit(
  request: Request,
  env: PagesEnv,
  bucket: string,
  maxRequests: number,
  windowMs: number
): Promise<Response | null> {
  if (!env.DB) return json({ success: false, error: "Rate-limit storage is unavailable." }, 503);
  const ip = request.headers.get("CF-Connecting-IP") ||
    request.headers.get("X-Forwarded-For")?.split(",")[0]?.trim() ||
    "unknown-client";
  // Store a short-lived one-way identifier, never the raw client IP.
  const privacyKey = env.ADMIN_JWT_SECRET || env.RATE_LIMIT_SECRET || "yatrabus-public-rate-limit-v1";
  const ipHash = createHmac("sha256", privacyKey).update(ip).digest("hex");
  const now = Date.now();
  const nowIso = new Date(now).toISOString();
  const cutoff = new Date(now - windowMs).toISOString();
  try {
    const row = await env.DB.prepare(
      "INSERT INTO public_rate_limits (bucket_key,ip_hash,window_started_at,request_count) VALUES (?,?,?,1) " +
      "ON CONFLICT(bucket_key,ip_hash) DO UPDATE SET " +
      "request_count = CASE WHEN public_rate_limits.window_started_at <= ? THEN 1 ELSE public_rate_limits.request_count + 1 END, " +
      "window_started_at = CASE WHEN public_rate_limits.window_started_at <= ? THEN excluded.window_started_at ELSE public_rate_limits.window_started_at END " +
      "RETURNING request_count,window_started_at"
    ).bind(bucket, ipHash, nowIso, cutoff, cutoff).first<{request_count:number;window_started_at:string}>();
    if (!row) return json({ success: false, error: "Rate-limit check failed." }, 503);
    if (Number(row.request_count) > maxRequests) {
      const retryAfterSeconds = Math.max(1, Math.ceil((windowMs - (now - Date.parse(row.window_started_at))) / 1000));
      return json({ success: false, error: "Too many requests. Please try again later.", retryAfterSeconds }, 429);
    }
    if (Number(row.request_count) === 1) {
      await env.DB.prepare("DELETE FROM public_rate_limits WHERE window_started_at < ?")
        .bind(new Date(now - 48 * 60 * 60 * 1000).toISOString()).run();
    }
    return null;
  } catch {
    // Fail closed if persistent rate limiting is unavailable.
    return json({ success: false, error: "Rate-limit check is temporarily unavailable." }, 503);
  }
}
