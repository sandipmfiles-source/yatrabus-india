import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { D1Database, PagesEnv } from "./api";

export interface AdminSessionPayload {
  sub: string;
  email: string;
  role: "SUPER_ADMIN";
  iat: number;
  exp: number;
  jti: string;
}

export function adminIsConfigured(env: PagesEnv): boolean {
  const hash = env.ADMIN_PASSWORD_HASH || "";
  return Boolean(
    env.ADMIN_EMAIL?.trim() &&
    hash.startsWith("hmac-sha256:") &&
    /^[a-f0-9]{64}$/i.test(hash.slice("hmac-sha256:".length)) &&
    (env.ADMIN_JWT_SECRET || "").length >= 32
  );
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");
  if (left.length !== right.length) {
    timingSafeEqual(left, left);
    return false;
  }
  return timingSafeEqual(left, right);
}

export function verifyAdminPassword(password: string, encodedHash: string, secret: string): boolean {
  const prefix = "hmac-sha256:";
  if (!encodedHash.startsWith(prefix)) return false;
  const expectedHex = encodedHash.slice(prefix.length);
  if (!/^[a-f0-9]{64}$/i.test(expectedHex) || secret.length < 32) return false;
  try {
    const actual = createHmac("sha256", secret).update(password, "utf8").digest();
    const expected = Buffer.from(expectedHex, "hex");
    return expected.length === actual.length && timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

export function createAdminToken(email: string, secret: string): { token: string; payload: AdminSessionPayload } {
  const now = Math.floor(Date.now() / 1000);
  const payload: AdminSessionPayload = {
    sub: email,
    email,
    role: "SUPER_ADMIN",
    iat: now,
    exp: now + 8 * 60 * 60,
    jti: randomUUID()
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", secret).update(encoded).digest("base64url");
  return { token: encoded + "." + signature, payload };
}

export function tokenHash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function clientIpHash(request: Request, secret: string): string {
  const ip = request.headers.get("CF-Connecting-IP") ||
    request.headers.get("X-Forwarded-For")?.split(",")[0]?.trim() ||
    "unknown-client";
  return createHmac("sha256", secret).update(ip).digest("hex");
}

export async function readAdminSession(
  request: Request,
  env: PagesEnv,
  db: D1Database
): Promise<AdminSessionPayload | null> {
  const secret = env.ADMIN_JWT_SECRET || "";
  const configuredEmail = (env.ADMIN_EMAIL || "").trim().toLowerCase();
  if (secret.length < 32 || !configuredEmail) return null;
  const auth = request.headers.get("Authorization") || "";
  if (!auth.startsWith("Bearer ")) return null;
  const token = auth.slice(7).trim();
  const parts = token.split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  try {
    const expected = createHmac("sha256", secret).update(parts[0]).digest();
    const supplied = Buffer.from(parts[1], "base64url");
    if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) return null;
    const payload = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8")) as AdminSessionPayload;
    const now = Math.floor(Date.now() / 1000);
    if (
      payload.role !== "SUPER_ADMIN" ||
      payload.sub !== configuredEmail ||
      payload.email !== configuredEmail ||
      !payload.jti ||
      !Number.isFinite(payload.exp) ||
      payload.exp <= now ||
      !Number.isFinite(payload.iat) ||
      payload.iat > now + 60
    ) return null;
    const session = await db.prepare(
      "SELECT token_hash FROM admin_sessions WHERE token_hash = ? AND owner_email = ? AND revoked_at IS NULL AND expires_at > ? LIMIT 1"
    ).bind(tokenHash(token), configuredEmail, new Date().toISOString()).first<{ token_hash: string }>();
    return session ? payload : null;
  } catch {
    return null;
  }
}

export function constantTimeEmailMatch(email: string, configuredEmail: string): boolean {
  return safeEqual(email.trim().toLowerCase(), configuredEmail.trim().toLowerCase());
}
