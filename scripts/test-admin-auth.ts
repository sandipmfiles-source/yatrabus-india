import assert from "node:assert/strict";
import { createHmac, randomBytes } from "node:crypto";
import {
  adminIsConfigured, constantTimeEmailMatch, createAdminToken,
  readAdminSession, tokenHash, verifyAdminPassword
} from "../functions/_lib/adminAuth";

// Test-only fixture; never reused for a production administrator account.
const password = randomBytes(32).toString("base64url");
const secret = randomBytes(48).toString("base64url");
const encodedHash = "hmac-sha256:" + createHmac("sha256", secret).update(password).digest("hex");
const env = { ADMIN_EMAIL: "owner@example.com", ADMIN_PASSWORD_HASH: encodedHash, ADMIN_JWT_SECRET: secret };

assert.equal(adminIsConfigured(env), true);
assert.equal(adminIsConfigured({ ADMIN_EMAIL: "owner@example.com" }), false);
assert.equal(verifyAdminPassword(password, encodedHash, secret), true);
assert.equal(verifyAdminPassword("wrong-password", encodedHash, secret), false);
assert.equal(constantTimeEmailMatch("OWNER@example.com", "owner@example.com"), true);
assert.equal(constantTimeEmailMatch("other@example.com", "owner@example.com"), false);

const { token, payload } = createAdminToken("owner@example.com", secret);
const storedHash = tokenHash(token);
const db = {
  prepare: (_sql: string) => ({
    bind: (..._values: unknown[]) => ({
      first: async () => ({ token_hash: storedHash })
    })
  })
};
const request = new Request("https://example.test/api/v1/admin/session", {
  headers: { Authorization: "Bearer " + token }
});
const session = await readAdminSession(request, env, db as any);
assert.equal(session?.role, "SUPER_ADMIN");
assert.equal(session?.email, "owner@example.com");
assert.equal(session?.jti, payload.jti);

const invalid = await readAdminSession(new Request("https://example.test", {
  headers: { Authorization: "Bearer invalid.token" }
}), env, db as any);
assert.equal(invalid, null);

console.log("Super Admin auth tests passed.");
