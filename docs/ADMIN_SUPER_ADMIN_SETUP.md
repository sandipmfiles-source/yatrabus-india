# YatraBus India — single-owner Super Admin

The production admin API is disabled unless all three owner settings exist in the Cloudflare Pages **Production** environment:

- `ADMIN_EMAIL` — the one owner's email address (plain environment variable is sufficient).
- `ADMIN_PASSWORD_HASH` — scrypt hash in `salt:hex_digest` format (store as a secret).
- `ADMIN_JWT_SECRET` — a random signing secret of at least 32 characters (store as a secret).

There is no public registration, default account, demo password, second admin, or owner recovery bypass. Login fails closed with HTTP 503 if configuration is missing.

## Generate a password hash

Run this locally on a trusted computer with Node.js. Use a unique password of at least 14 characters. Do not paste the password or hash into chat and do not commit it to Git.

```bash
node --input-type=module -e "import {scryptSync,randomBytes} from 'node:crypto'; import {createInterface} from 'node:readline/promises'; const rl=createInterface({input:process.stdin,output:process.stdout}); const p=await rl.question('New strong admin password: '); rl.close(); if(p.length<14) throw new Error('Use at least 14 characters'); const salt=randomBytes(16).toString('hex'); console.log(salt+':'+scryptSync(p,salt,64).toString('hex'));"
```

Copy the printed `salt:hex_digest` into the Cloudflare Pages Production secret named `ADMIN_PASSWORD_HASH`.

Generate a separate signing secret:

```bash
node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"
```

Save the output as the Cloudflare Pages Production secret `ADMIN_JWT_SECRET`. Do not reuse the password.

## Security behaviour

- Only the configured `ADMIN_EMAIL` can authenticate.
- Password verification uses scrypt and constant-time hash comparison.
- Session tokens are HMAC-SHA256 signed, expire after 8 hours, and are stored in D1 only as SHA-256 token hashes.
- Logout revokes the D1 session.
- Five failed attempts from one client IP trigger a 15-minute lockout. Only an HMAC of the IP is stored.
- Public community submissions are limited to 20 per IP per hour; operator claims are limited to five per IP per day. Rate-limit storage keeps a short-lived one-way IP hash, not the raw address.
- Operator ownership claims can only reference an operator already in the directory.
- Admin endpoints require a valid bearer token and fail closed.
- Owner actions are written to the D1 audit log.
- No secret values belong in the repository, APK, or frontend bundle.

## D1 migration

The additive `migrations/0002_admin_security.sql` creates the session, login-throttling, operator-claim and service-alert tables. The GitHub Actions migration workflow applies this additive migration automatically when it reaches `main`. The existing initial schema migration is not removed.

## Current admin capabilities

The Super Admin dashboard reads real D1 counts, community submissions, operator claims, audit history and automation rules. Approving a timetable correction or disruption report publishes the reviewed record; an added location is labelled as an unverified community location, not automatically as a bus stop. A community bus remains unavailable to passengers until it is assigned to a route. Unsupported submission types cannot be published.

The login interface is in the YatraBus India app header. No separate paid hosting or custom domain is required.
