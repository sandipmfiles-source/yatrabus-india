# Phase 5 — Production readiness implementation and release gates

This phase hardens the existing single-instance pilot, adds repeatable state backup/restore, and provides a protected signed Android release pipeline. It does not claim that a hosting account, PostgreSQL runtime, Android signing key, or physical test devices have been configured.

## Implemented in this branch

- **JSON state backup:** `scripts/backup-state.sh` validates the state JSON, writes a private gzip snapshot, and records a SHA-256 checksum.
- **Safe restore:** `scripts/restore-state.sh` verifies the checksum, gzip integrity and JSON structure; it refuses to overwrite the live state unless `YATRIBUS_CONFIRM_STOPPED=YES` is explicitly supplied.
- **CORS allow-list:** browser origins are no longer accepted through `Access-Control-Allow-Origin: *`. Configure exact deployed origins using `CORS_ALLOWED_ORIGINS`. Development defaults are limited to local Vite origins and the Capacitor HTTPS origin.
- **Trusted proxy control:** `TRUST_PROXY_HOPS` remains explicit and defaults to zero. Set it only to the exact number of trusted reverse-proxy hops.
- **Signed Android release pipeline:** `.github/workflows/android-release.yml` requires HTTPS `VITE_API_BASE_URL` and `VITE_PUBLIC_APP_URL` plus protected keystore secrets, injects both URLs into the web build, builds APK and AAB, verifies their signatures, publishes checksums and uploads a GitHub pre-release candidate.
- **Reproducible release tags:** APK release tags now point to the exact workflow commit (`github.sha`) rather than defaulting to the repository's default branch.
- **Gradle signing config:** release signing values are read only from process environment variables; no keystore or password is stored in Git.
- **Production health gate:** `/health` reports `DEGRADED` (HTTP 503) in production unless persistent JSON storage is writable and the sole Super Admin email, valid scrypt hash and 32+ character JWT secret are configured.
- **Docker deployment:** Compose passes the CORS allow-list and trusted-proxy setting into the backend container.

## Required GitHub Actions configuration for a signed release

In repository Settings → Secrets and variables → Actions, configure:

| Name | Type | Value |
|---|---|---|
| `ANDROID_KEYSTORE_BASE64` | Secret | Base64-encoded private release keystore |
| `KEYSTORE_PASSWORD` | Secret | Keystore password |
| `KEY_ALIAS` | Secret | Exact key alias |
| `KEY_PASSWORD` | Secret | Private key password |
| `VITE_API_BASE_URL` | Variable | Deployed HTTPS API URL ending in `/api` |
| `VITE_PUBLIC_APP_URL` | Variable | Public HTTPS frontend URL used in signed QR links |

Create the keystore on a trusted machine and keep at least two secure offline backups. Never upload the raw keystore to the repository, issue tracker, chat, or APK. If a signing key is lost, future updates cannot be signed with the same identity.

To create the Base64 value locally:

```bash
base64 -w 0 yatribus-release.jks > yatribus-release.jks.base64
```

Copy the contents of the generated text file directly into the GitHub secret, then securely delete the temporary Base64 text file. Keep the original keystore in encrypted offline backups.

After all five settings are present, open Actions → **Build Signed Android Release** → Run workflow. The workflow deliberately publishes a **pre-release candidate**, not a public production release, until real-device verification is complete.

## Single-instance backend deployment

The current supported backend package is a Node.js Express container using a named persistent Docker volume. Deploy it on a Node.js/Docker-compatible host that provides:

- HTTPS termination and a stable public hostname
- Persistent volume storage
- A single running backend instance
- Private environment variables/secrets
- Health checks, logs, disk monitoring and backup retention

Set `ADMIN_EMAIL`, `ADMIN_PASSWORD_HASH`, `ADMIN_JWT_SECRET`, `YATRIBUS_DATA_FILE`, `CORS_ALLOWED_ORIGINS`, and the exact `TRUST_PROXY_HOPS` on the host. Set the web frontend's `VITE_API_BASE_URL` build variable to the public HTTPS API URL and rebuild the Android APK after changing it.

A running container is not a deployed service. A GitHub Actions APK build does not create a hosting account, domain, TLS certificate, or persistent disk.

## Backup and restore operations

Run a backup on the backend host:

```bash
YATRIBUS_DATA_FILE=/var/lib/yatribus/yatribus-state.json \
YATRIBUS_BACKUP_DIR=/var/backups/yatribus \
  bash scripts/backup-state.sh
```

Copy both the `.json.gz` file and its matching `.sha256` file to a separate protected backup location. A Docker named volume alone is not a backup.

To restore, stop the backend first and use:

```bash
YATRIBUS_DATA_FILE=/var/lib/yatribus/yatribus-state.json \
YATRIBUS_CONFIRM_STOPPED=YES \
  bash scripts/restore-state.sh /var/backups/yatribus/yatribus-state-YYYYMMDDTHHMMSSZ.json.gz
```

Start the service and verify `GET /health`, the Super Admin login, recent submissions and audit history. Perform a restore drill in a staging environment before relying on backups.

## PostgreSQL/PostGIS — explicit remaining integration gate

The repository currently includes SQL migrations for PostgreSQL/PostGIS, but the live `TransitRepository` is still an in-memory Map-based repository with JSON-file snapshot persistence. The SQL files are **not** a connected database adapter, and running them alone does not move live application reads/writes into PostgreSQL.

Do not point a production service at a PostgreSQL URL and assume data is being stored there. A real integration requires a repository interface and an asynchronous PostgreSQL implementation for every entity, transaction boundaries for related updates, migration tracking, seed/import strategy, and tests proving restart recovery and concurrency. The existing route and tracking services currently expect synchronous repository reads, so this requires a deliberate service-layer refactor rather than a superficial connection check.

Until that work is complete:
- Use only a controlled single-instance pilot with persistent disk and verified backups.
- Do not run multiple backend replicas.
- Do not accept high-volume or safety-critical community data as if it were backed by PostgreSQL HA.
- Do not claim PostGIS spatial indexes are active in the running API.

## Physical Android verification — required before public production release

A cloud build cannot verify real device behaviour. Test at least two physical Android devices, preferably Android 13+ and a current Android version:

1. Install the same signed candidate on both devices; verify package identity and update installation.
2. Test fresh install, app restart, offline launch, slow network and API unreachable state.
3. Deny and later grant camera, microphone, notifications, foreground location and background location separately.
4. Start a journey only after explicit consent; verify ongoing notification, location freshness labels, stop-sharing action, expiry and app force-stop behaviour.
5. Test battery saver, screen off, network handover, GPS disabled and permission revocation.
6. Verify local journey reminder scheduling/cancellation and notification delivery after reboot where Android permits.
7. Scan a signed stop QR and test malformed, expired, altered and unverified-stop QR cases.
8. Verify Hindi, Bengali and English search, text fallback, accessibility size/contrast and reduced motion.
9. Confirm no individual passenger trace or cell identifier appears in public APIs.
10. Record device model, Android version, test build SHA, steps, expected result, actual result and screenshots/logcat for every failure.

Do not promote the pre-release candidate to a stable production release until the field-test record is reviewed and all critical failures are resolved.

## Final launch blockers

- [ ] Select and configure a real HTTPS backend host, domain and persistent disk.
- [ ] Configure owner-only Super Admin credentials in the host secret manager.
- [ ] Configure exact CORS origins and trusted proxy hop count.
- [ ] Complete end-to-end backup and restore drill.
- [ ] Refactor and test the repository to use PostgreSQL/PostGIS as the actual runtime data store before multi-instance/public scale.
- [ ] Configure the private Android signing key and GitHub Actions secrets.
- [ ] Build and verify a signed APK/AAB with the real HTTPS API URL.
- [ ] Complete physical two-device GPS, notifications, QR, offline and permission testing.
- [ ] Verify one real bus corridor and official timetable data; sample seed routes are not nationwide verified service data.
- [ ] Complete security, privacy, uptime, logging and incident-response review.

Google OAuth remains intentionally deferred as previously requested; passenger browsing and community contributions do not require Google sign-in. Owner identity claims must remain manually reviewed by the sole Super Admin until a later verified identity flow is configured.
