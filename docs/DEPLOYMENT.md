# YatraBus India — free-first deployment plan

This plan keeps the initial build at ₹0 by using open-source data and free tiers. Free tiers have quotas and can change; this is a prototype / low-traffic launch plan, not a promise of unlimited production hosting.

## 1. Free-first services

| Layer | Service | What is free | Important limit / status |
|---|---|---|---|
| Source code | GitHub public repository | Public source, issues and pull requests | Keep secrets out of commits |
| Android build | GitHub Actions standard hosted runners | Free for public repositories | Actions artifact is retained for 90 days; after merge to mx-local-preserve, the workflow also publishes a downloadable GitHub pre-release |
| Web frontend | Cloudflare Pages Free | Static frontend hosting, HTTPS, free subdomain | 500 builds/month; 20,000 files/site; 25 MiB per file |
| API runtime (future migration) | Cloudflare Workers Free | 100,000 requests/day | Current API is Express + Node filesystem; it is NOT deployed to Workers yet and needs a compatibility rewrite before using this option |
| PostgreSQL (future durable DB) | Neon Free | 1 GB storage/project, 100 CU-hours/project/month, 5 GB public transfer/project/month | Current repository uses an in-process repository + JSON file persistence; Neon migrations exist but are NOT wired into runtime yet |
| Map data | OpenStreetMap | Open map data under ODbL | Tile servers are donation-funded, not unlimited; follow tile policy and show attribution |
| Road routing | OSRM public demo using OSM road data | No API key for low-volume route checks | Best-effort demo only, no SLA; rate-limit/cache; switchable endpoint needed before scale |

## 2. Self-hosted single-container option

A Dockerfile and `docker-compose.yml` are now included. They build the passenger web app and Express API into one container, serve both from the same host, and persist the JSON repository on a named Docker volume. Follow `docs/DOCKER_DEPLOYMENT.md`. This provides a deployable package; it does not mean a hosting account or public HTTPS endpoint has already been configured.

## 3. What works without paid keys

- Android APK compilation through the public GitHub Actions workflow.
- Local seeded place search and route/timetable data.
- Public contribution and correction flows in the codebase.
- OpenStreetMap-based map display with attribution.
- Road-route preview using OSRM when every point has coordinates. Use Name | latitude | longitude for a point that is not in the local YatraBus catalogue.
- Hindi, Bengali and English UI resources already included in the app source.

Bus owners and passengers can submit information without Google sign-in or an account. Owner submissions are routed to a separate Super Admin review queue and require contact details for manual verification. Google Maps / Places is not required for the free OpenStreetMap / OSRM route-preview path.

## 4. Important service boundaries

- A successful APK build does not deploy the backend. The app must be configured with a reachable VITE_API_BASE_URL for shared submissions, admin review and live GPS to work across devices.
- The current Express backend writes JSON state to its local filesystem. A host with ephemeral storage can lose data on restart. Do not launch community submissions on an ephemeral instance as if it were durable.
- PostgreSQL migrations are present, but a database adapter and production migration runner still need to be connected before Neon/Supabase is a real production database.
- Cloudflare Pages can host the static frontend, but the existing Express server cannot simply be uploaded as a Pages static site. Cloudflare Workers requires an API-runtime migration.
- OSRM road distance and duration are not a public-bus timetable. They do not prove that a bus operates on a road. Admin verification is mandatory.
- OSM tile policy requires visible attribution, normal interactive viewing only, and respecting caching headers. Do not bulk-download tiles or add offline map prefetch.
- Public OSRM/Nominatim endpoints are community resources with usage limits, not guaranteed free production infrastructure.

## 5. Backend environment variables

Configure only on the backend host, never in the APK:

    NODE_ENV=production
    PORT=5000
    YATRIBUS_DATA_FILE=./data/yatribus-state.json
    ADMIN_EMAIL=
    ADMIN_PASSWORD_HASH=
    ADMIN_JWT_SECRET=
    MAX_JOURNEY_SESSION_HOURS=12
    GPS_ACCURACY_THRESHOLD_METERS=100
    GPS_FRESHNESS_LIVE_SECONDS=120
    GPS_FRESHNESS_STALE_SECONDS=600
    RATE_LIMIT_PUBLIC_WINDOW_MS=900000
    RATE_LIMIT_PUBLIC_MAX_REQUESTS=300
    RATE_LIMIT_CONTRIBUTION_MAX_HOURLY=15

Set `GOOGLE_OAUTH_CLIENT_ID` and `OWNER_JWT_SECRET` only on the backend host; set the matching public `VITE_GOOGLE_CLIENT_ID` as a GitHub Actions repository variable before building the APK. Never put passwords, JWT secrets, OAuth client secrets, or database passwords in GitHub source files.

## 6. Persistent database activation (future step)

Before public launch, connect the runtime repository to PostgreSQL and then run:

    psql "$DATABASE_URL" -f backend/migrations/001_initial_schema.sql
    psql "$DATABASE_URL" -f backend/migrations/002_postgis_indexes.sql
    psql "$DATABASE_URL" -f backend/migrations/003_community_and_tracking.sql
    psql "$DATABASE_URL" -f backend/migrations/004_admin_automation.sql

The migration files alone do not activate PostgreSQL. Verify reads, writes, restart recovery and backups before accepting real community data.

## 7. Backup

For a persistent PostgreSQL deployment, schedule regular pg_dump backups and test restoration. For the current JSON-file backend, keep the data directory on a persistent disk and back up yatribus-state.json; a container's temporary filesystem is not a backup.
