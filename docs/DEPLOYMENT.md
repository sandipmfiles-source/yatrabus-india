# YatraBus India — free-first deployment plan

This plan keeps the initial build at ₹0 by using open-source data and free tiers. Free tiers have quotas and can change; this is a prototype / low-traffic launch plan, not a promise of unlimited production hosting.

Before launch, complete every item in [PRODUCTION_GO_LIVE_CHECKLIST.md](PRODUCTION_GO_LIVE_CHECKLIST.md). This includes persistent storage, owner credentials, HTTPS, field verification and the known limitations of the current JSON-backed pilot.

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

- A successful APK build does not deploy the backend. Every Android APK must be rebuilt with `VITE_API_BASE_URL=https://YOUR-BACKEND-HOST.example/api`; the app runs from Capacitor's local WebView origin, so a relative `/api` URL will not reach your hosted server. Native Android builds reject non-HTTPS API URLs and fail closed when this value is missing. For a browser web build served from the same origin as the API, relative `/api` can be used.
- The Android wrapper enables Capacitor's native HTTP bridge for API fetch/XHR calls, blocks cleartext and mixed-content traffic, and disables WebView debugging in its shared app configuration. Validate this on physical Android devices before release.
- The current Express backend writes JSON state to its local filesystem. A host with ephemeral storage can lose data on restart. Do not launch community submissions on an ephemeral instance as if it were durable.
- PostgreSQL migrations are present, but a database adapter and production migration runner still need to be connected before Neon/Supabase is a real production database.
- Cloudflare Pages can host the static frontend, but the existing Express server cannot simply be uploaded as a Pages static site. Cloudflare Workers requires an API-runtime migration.
- OSRM road distance and duration are not a public-bus timetable. They do not prove that a bus operates on a road. Admin verification is mandatory.
- OSM tile policy requires visible attribution, normal interactive viewing only, and respecting caching headers. Do not bulk-download tiles or add offline map prefetch.
- Public OSRM/Nominatim endpoints are community resources with usage limits, not guaranteed free production infrastructure.

## 5. India LGD place-index files

The backend place-search route loads the split LGD index from the repository's root `data/lgd-index/` directory. Keep this directory in the production deployment alongside the backend source/build; deploying only the `backend/` folder will omit the index. The server resolves the path from source mode, compiled `dist/` mode and the process working directory.

The bundled index is a historical 11 March 2022 baseline. Keep its four JSON files and source metadata together. A refreshed index must be generated from a newer official LGD export, reviewed for source date/licence, and deployed atomically. The 4,814 urban-local-body layer is not a complete Census Town or village directory.

## 6. Backend environment variables

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

Only Super Admin credentials belong in the backend host's private environment. Never put passwords, JWT secrets, or database passwords in GitHub source files or the APK.

## 7. Persistent database activation (future step)

Before public launch, connect the runtime repository to PostgreSQL and then run:

    psql "$DATABASE_URL" -f backend/migrations/001_initial_schema.sql
    psql "$DATABASE_URL" -f backend/migrations/002_postgis_indexes.sql
    psql "$DATABASE_URL" -f backend/migrations/003_community_and_tracking.sql
    psql "$DATABASE_URL" -f backend/migrations/004_admin_automation.sql

The migration files alone do not activate PostgreSQL. Verify reads, writes, restart recovery and backups before accepting real community data.

## 8. Backup

For a persistent PostgreSQL deployment, schedule regular pg_dump backups and test restoration. For the current JSON-file backend, keep the data directory on a persistent disk and back up yatribus-state.json; a container's temporary filesystem is not a backup.
