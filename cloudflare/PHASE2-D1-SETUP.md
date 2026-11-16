# Phase 2 — Cloudflare Pages Functions + D1

## What this change provides

- A Pages Function at `/api/v1/health`.
- D1-backed public read APIs for places, nearby places, routes, route search, timetables, buses and operators.
- D1-backed public contribution submission and status lookup APIs.
- Shared API CORS preflight handling for GET and POST requests.
- Versioned, SQLite-compatible D1 schema migrations in `migrations/` (initial, owner security, and indexed route-stop lookup).
- An explicit health response when D1 is missing, unreachable, or not migrated.
- No production secrets, database IDs, or credentials are committed.

The existing Node.js/PostgreSQL backend is preserved. The deployed Pages frontend uses the Pages API for the routes implemented under `functions/api`; this does **not** mean every legacy Node/PostgreSQL route has been ported. GPS ingestion and several legacy write flows remain outside this D1 API.

## Cloudflare dashboard setup

1. In Cloudflare, open **Storage & databases → D1 SQL Database**.
2. Create a database named `yatrabus-india-db`.
3. Open **Workers & Pages → yatrabus-india → Settings → Functions → D1 database bindings**.
4. Add a binding with variable name `DB` and select `yatrabus-india-db`.
5. Save and redeploy the latest Production deployment.

## Apply the migration

From the repository root, after installing Wrangler and authenticating:

```sh
npx wrangler login
npx wrangler d1 migrations apply yatrabus-india-db --remote
```

Wrangler uses the repository's configured `migrations/` directory and records applied versions in its D1 migration history. The GitHub Actions workflow applies only pending migrations and captures Cloudflare's automatic pre-migration backup.

## Verify

Open:

`https://yatrabus-india.pages.dev/api/v1/health`

Expected outcomes:

- HTTP 503 with `database: not_configured`: the Pages Function is deployed,
  but the DB binding is not configured.
- HTTP 503 with `database: d1` and `schemaReady: false`: one or more of the 12 required core tables are missing.
- HTTP 503 with `database: d1`, `schemaReady: true`, and `adminSecurityReady: false`: the core schema exists, but the additive owner-security migration `0002_admin_security.sql` is missing.
- HTTP 200 with `database: d1`, `persistentStorage: true`, `schemaReady: true`, and `adminSecurityReady: true`: all 17 required core and owner-security tables are present, including the indexed `route_stops` table.

## Important limitations

This is the Cloudflare Pages/D1 API foundation, not a claim that every legacy backend route is ported. The owner-only Super Admin API and public submission rate limits are implemented by the additive security migration and Functions. The Node/PostgreSQL runtime, GPS ingestion and live journey writes remain separate integration work. D1 currently contains an administrative place directory; this does not prove bus service availability. Public timetable coverage remains limited to feeds with current, licence-reviewed snapshots, and community-derived feeds must remain labelled unverified.
