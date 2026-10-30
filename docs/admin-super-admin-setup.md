# YatraBus Super Admin Setup

The admin API is intentionally disabled until the deployment owner configures credentials. There is no public admin registration and no default password.

## Required backend environment variables

Configure these as encrypted environment variables/secrets in the backend hosting platform:

- `ADMIN_EMAIL`: the single owner's email address. There is no default email.
- `ADMIN_PASSWORD_HASH`: scrypt password hash in the format `salt:hex_digest`.
- `ADMIN_JWT_SECRET`: a random secret of at least 32 characters. Keep it private.

## Generate a password hash

Run this locally on a trusted computer with Node.js. Use a long, unique password and do not paste it into chat or commit it to GitHub.

```bash
node --input-type=module -e "import {scryptSync,randomBytes} from 'node:crypto'; import {createInterface} from 'node:readline/promises'; const rl=createInterface({input:process.stdin,output:process.stdout}); const p=await rl.question('New strong admin password: '); rl.close(); if(p.length<14) throw new Error('Use at least 14 characters'); const salt=randomBytes(16).toString('hex'); console.log(salt+':'+scryptSync(p,salt,64).toString('hex'));"
```

Set the printed value as `ADMIN_PASSWORD_HASH`. The password itself is not stored in the repository.

Generate a separate signing secret locally:

```bash
node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"
```

Set that output as `ADMIN_JWT_SECRET`. Never reuse the password or commit the secret.

## Admin URLs

- Login: `/admin`
- Dashboard: `/admin/dashboard`
- Pending bus and route contributions: `/admin/submissions`

Admin sessions are signed and expire after 8 hours. Login is rate-limited to five attempts per client IP in a 15-minute window. The API accepts only the configured owner email and an active Super Admin record. If the environment variables are missing, login returns HTTP 503 by design.

## Persistent storage and deployment limitation

The backend saves repository snapshots to `YATRIBUS_DATA_FILE`. Configure this path on a persistent disk on the backend host; otherwise data may be lost when the host restarts or replaces its instance. The file-based store is for one backend instance only and is not safe for multi-instance deployments. For production scale, backups, and concurrent writes, migrate to managed PostgreSQL.

Before public launch, deploy the backend, configure the private environment variables and persistent disk, set the GitHub Actions repository variable `VITE_API_BASE_URL` to the HTTPS API URL ending in `/api`, and verify that the installed APK can reach it. For Owner Google sign-in, also configure `GOOGLE_OAUTH_CLIENT_ID` and `OWNER_JWT_SECRET` on the backend and the matching `VITE_GOOGLE_CLIENT_ID` build variable. Without the API and required credentials, owner login, community submissions, and shared live tracking will not work from the installed APK.
