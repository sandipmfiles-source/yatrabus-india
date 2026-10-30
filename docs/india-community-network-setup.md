# India-wide bus-owner and community timetable network

## What this feature adds

- Local search now includes all 28 States and 8 Union Territories plus their capital-city entries.
- Search suggestions use YatraBus local records first. If the local list cannot fill the requested suggestions, the backend may ask Google Places Autocomplete for India-scoped results.
- Route search can resolve local place aliases and matches boarding/alighting stops anywhere along the ordered route.
- Individually approved bus departures are returned as separate search options; intermediate stop times are estimated from route distance and duration when a bus-specific stop time is not present.
- Passenger stop-name and arrival-time corrections are account-free. The route detail page provides pencil actions and a one-device anonymous vote. A suggestion with at least two votes is displayed as a community majority; Super Admin approval is still required before the canonical timetable is changed.
- Bus owners and drivers have a separate Google sign-in portal. Owner submissions, timetable edits and removal requests are kept in a separate moderation category and are not published before Super Admin approval.
- The Super Admin can search active buses and edit bus records and complete route JSON (including ordered stops, stop times and departures).

## Required production configuration

The application code is prepared for these settings, but they must be configured in the backend host and GitHub repository before owner login and Google suggestions work.

### GitHub repository Variables

In **Settings → Secrets and variables → Actions → Variables**, add:

- `VITE_API_BASE_URL`: the deployed backend API URL ending in `/api`.
- `VITE_GOOGLE_CLIENT_ID`: the Google OAuth Web Client ID (public client ID only).

### Backend host environment / secrets

Set:

- `GOOGLE_OAUTH_CLIENT_ID`: the same Google OAuth Web Client ID.
- `OWNER_JWT_SECRET`: a randomly generated secret of at least 32 characters.
- `GOOGLE_MAPS_API_KEY`: a server-side Google Maps Platform key with Places API (New) enabled and suitable quota/billing restrictions.
- `ADMIN_EMAIL`, `ADMIN_PASSWORD_HASH`, `ADMIN_JWT_SECRET`: the existing single-Super-Admin configuration.
- `YATRIBUS_DATA_FILE`: a file path on a persistent mounted disk, for example `/var/data/yatribus-state.json`.

Never place Google Maps API keys, owner signing secrets, admin secrets, OAuth client secrets or passwords in the APK, source code, or chat. The owner sign-in flow verifies Google's ID token server-side; it uses the OAuth Client ID and does not need a client secret in the APK.

## Storage and deployment notes

The current repository persistence adapter stores records in a JSON snapshot on the backend filesystem. The hosting plan must provide a persistent disk and run one backend instance. Ephemeral filesystems lose submissions on restart/deploy; multiple backend replicas can race on a shared JSON file. For a multi-instance nationwide production service, migrate this repository adapter to PostgreSQL before scaling.

Cloudflare Workers do not provide the Node filesystem persistence this current adapter uses. Cloudflare D1/R2 or another database can be used only after a database adapter is implemented; do not point `YATRIBUS_DATA_FILE` at a temporary path and assume it is durable.

## India place coverage

The local catalogue includes all State/UT names and capital cities, and the pre-existing seed stops/terminals. It is not yet an exhaustive offline gazetteer of every Indian town, village, bus stand and roadside stop. Google Places Autocomplete fills gaps when the backend key is configured and the device is online. Offline suggestions are limited to records bundled in the app/backend seed data. A complete offline India gazetteer requires a licensed, maintained dataset import.

## Privacy behaviour

- Passenger search and public corrections do not require an account.
- Google sign-in is required only for the owner dashboard.
- Owner email/name are stored with the owner's submissions so that the owner can see and manage their own requests.
- The public app does not need a passenger profile or a copy of personal activity in the backend.
- Browser/app local storage is only a convenience cache. Uninstalling an app can erase that cache; important bus submissions and approved timetables must live on the persistent backend.
- Anonymous voting uses a random installation/browser identifier and rate limiting, not a real-world identity. It is useful for lightweight corroboration but is not fraud-proof; admin approval remains the publishing control.

## Approval workflow

1. Passenger submissions enter the Passenger queue.
2. Google-authenticated bus owner/driver submissions enter the Bus Owner / Driver queue.
3. Only the configured Super Admin can approve, reject, edit the bus catalogue or change published route/timetable data.
4. Approved bus timetable entries become searchable. Removal requests deactivate a bus only after approval.
