# Phase 2 — Cloudflare Pages Functions + D1

## What this change provides

- A Pages Function at `/api/v1/health`.
- A SQLite-compatible initial D1 schema in `migrations/0001_initial.sql`.
- An explicit health response when D1 is missing, unreachable, or not migrated.
- No production secrets, database IDs, or credentials are committed.

The existing Node.js/PostgreSQL backend is preserved. This change does **not**
claim that all existing API routes have been ported to Workers or that the
frontend is connected to D1 yet.

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

Wrangler uses the repository's `migrations/` directory by default. If prompted
for a migrations directory, use `migrations`.

## Verify

Open:

`https://yatrabus-india.pages.dev/api/v1/health`

Expected outcomes:

- HTTP 503 with `database: not_configured`: the Pages Function is deployed,
  but the DB binding is not configured.
- HTTP 503 with `database: connected` is not emitted; if the DB is reachable
  but migrations are missing, the response reports `database: d1` and
  `schemaReady: false`.
- HTTP 200 with `database: d1`, `persistentStorage: true`, and
  `schemaReady: true`: D1 is bound and the initial schema is present.

## Important limitations

This is the safe foundation only. The existing API uses Node.js modules,
PostgreSQL queries/PostGIS behavior, and in-memory services. Those routes must
be ported to Workers-compatible D1 repositories in follow-up changes before
bus search, submissions, admin workflows, or GPS tracking can be called
production-ready on Cloudflare.
