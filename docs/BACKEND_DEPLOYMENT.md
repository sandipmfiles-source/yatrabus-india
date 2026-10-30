# YatraBus backend and Android configuration

The Android APK is a client application. Live GPS uploads, community submissions, moderation, and owner login require a reachable backend API; they cannot be made multi-device or persistent by the APK alone.

## Backend environment

Configure these values in the backend host's private environment settings:

- `ADMIN_EMAIL`: the one owner's email address. Do not use a shared or public address.
- `ADMIN_PASSWORD_HASH`: scrypt hash in `salt:128-character-hex-hash` format.
- `ADMIN_JWT_SECRET`: at least 32 random characters.
- `YATRIBUS_DATA_FILE`: absolute path on a persistent disk, for example `/var/lib/yatribus/yatribus-state.json`.
- `PORT`: supplied by the hosting platform, if applicable.

Generate an owner password hash on a trusted computer:

```bash
node -e 'const {scryptSync,randomBytes}=require("node:crypto");const salt=randomBytes(16).toString("hex");const hash=scryptSync(process.argv[1],salt,64).toString("hex");console.log(salt+":"+hash)' 'PUT_A_LONG_UNIQUE_PASSWORD_HERE'
```

Generate the signing secret:

```bash
openssl rand -hex 32
```

Never commit real values to GitHub. The backend provisions exactly one Super Admin from `ADMIN_EMAIL`; when it is unset, admin access is disabled.

## Persistent storage

The backend writes its repository state to `YATRIBUS_DATA_FILE` and restores it at startup. Mount a persistent disk at the selected path. This file-based store is intended for a single backend instance; it is not a substitute for managed PostgreSQL when running multiple instances or requiring database-level concurrency and backups. Back up the state file regularly.

## Connect the APK to the backend

After deploying the backend, set a GitHub Actions repository variable named `VITE_API_BASE_URL` to the full API base URL, including `/api`, for example:

```text
https://YOUR-BACKEND-HOST.example/api
```

Do not include a trailing slash. The Android workflow injects this value into the web build. If it is unset, the app uses the local relative `/api` path; on an installed APK this will not reach a separately hosted backend, so submissions, owner login, and shared live tracking will not work until configured.

## Android tracking permissions

The app explains location use before requesting permission. A passenger must separately confirm a journey before GPS is shared. Android shows an ongoing tracking notification while the background location watcher is active. Users can stop sharing from the in-app tracking panel. Device power-saving settings and GPS/network availability can still affect delivery.
