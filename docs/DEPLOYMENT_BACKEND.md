# YatriBus single-service deployment

This repository can run the built web app and the Express API from one Node service. The API persists routes, buses, submissions, moderation decisions, consent records, journey sessions and bus-level location aggregates in a JSON file. Raw passenger GPS observations are not written to disk.

## Before deployment

1. Choose a host that supports Docker and a persistent volume.
2. Point a domain or HTTPS URL at the service.
3. Copy `.env.example` to `.env` and set:
   - `PUBLIC_API_BASE_URL`: the public HTTPS origin, with no trailing slash and no `/api` suffix
   - `ADMIN_JWT_SECRET`: a random secret of at least 32 characters
   - `INITIAL_ADMIN_EMAIL`: the owner login email
   - `INITIAL_ADMIN_PASSWORD`: a strong, unique owner password
4. Keep the persistent volume mounted at `/data`. If that volume is removed, the JSON store is lost.
5. Run `docker compose up --build -d`.

## Jhargram and Kharagpur starter places

Jhargram New Bus Stand and KGP Bus Stand are included as searchable, **unverified** community map places using OpenStreetMap-derived coordinates. These are stop locators only, not bus-service or timetable records. No Jhargram–Kharagpur departure times are seeded because a verified public timetable for that exact route was not found. Add the real route, intermediate stops, exact departures and operator evidence through the contribution form, then approve it in Admin.

## Android APK

The APK build must use the same public API origin. Set the GitHub repository Actions variable `VITE_API_BASE_URL` to the same HTTPS origin before producing the production APK. The value is compiled into the app; changing it requires a new APK build.

## Community route verification

- Submissions stay in `PENDING_REVIEW`.
- The owner signs in to the Admin portal with the configured email and password.
- Bus submissions can be published after review.
- A route is published only when the origin, destination, first/last times and GPS coordinates are present. Every intermediate stop must be submitted as `Name|latitude|longitude|HH:MM`, separated by semicolons.
- A published route appears in public route search. Unverified or incomplete information is not promoted to an admin-verified route.

## GPS privacy and operation

Passenger sharing starts only after the passenger explicitly confirms the trip. On Android, a foreground location service displays a persistent notification and can be stopped from the app. Uploading observations requires internet and a reachable HTTPS API; GPS permission and satellite location fixes themselves do not require mobile data.

The file-backed store is intended for a single service instance with a persistent disk. For multiple replicas or high-volume production, migrate the repository to PostgreSQL/PostGIS before scaling horizontally.
