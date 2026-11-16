# YatraBus India — single-owner Super Admin

The production admin API is disabled unless all three owner settings exist in the Cloudflare Pages **Production** environment:

- `ADMIN_EMAIL` — the one owner's email address (plain environment variable is sufficient).
- `ADMIN_PASSWORD_HASH` — scrypt hash in `salt:hex_digest` format (store as a secret).
- `ADMIN_JWT_SECRET` — a random signing secret of at least 32 characters (store as a secret).

There is no public registration, default account, demo password, second admin, or owner recovery bypass. Login fails closed with HTTP 503 if configuration is missing.

## Generate a high-entropy owner password and matching verifier

The Cloudflare Free plan has a 10 ms CPU budget per Worker request. To keep login reliable on the free plan, this implementation uses a fast keyed HMAC-SHA256 verifier rather than an expensive password KDF. Generate a random password (not a human-chosen phrase) and a separate signing secret together on a trusted computer. Save the password in a password manager; do not paste it into chat or commit it.

```bash
node --input-type=module -e "import {randomBytes,createHmac} from 'node:crypto'; const password=randomBytes(32).toString('base64url'); const secret=randomBytes(48).toString('base64url'); const hash='hmac-sha256:'+createHmac('sha256',secret).update(password).digest('hex'); console.log('ADMIN_PASSWORD='+password); console.log('ADMIN_PASSWORD_HASH='+hash); console.log('ADMIN_JWT_SECRET='+secret);"
```

Copy the generated password into a password manager. Set `ADMIN_PASSWORD_HASH` and `ADMIN_JWT_SECRET` as separate Cloudflare Pages Production secrets. The hash is keyed by the signing secret, so neither value alone is sufficient to test password guesses offline. Use a new pair if either value is exposed.

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
