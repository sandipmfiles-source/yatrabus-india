# YatraBus Super Admin Setup

The admin API is intentionally disabled until the deployment owner configures credentials. There is no public admin registration and no default password.

## Required backend environment variables

Configure these as encrypted environment variables/secrets in the backend hosting platform:

- `ADMIN_EMAIL`: the single owner's email address (defaults to `admin@yatribus.in`).
- `ADMIN_PASSWORD_HASH`: scrypt password hash in the format `salt:hex_digest`.
- `ADMIN_JWT_SECRET`: a random secret of at least 32 characters. Keep it private.

## Generate a password hash

Run this locally on a trusted computer with Node.js. It prompts for a password without echoing it and prints only the hash value:

```bash
node --input-type=module -e "import {scryptSync,randomBytes} from 'node:crypto'; import {createInterface} from 'node:readline/promises'; const rl=createInterface({input:process.stdin,output:process.stdout}); const p=await rl.question('New strong admin password: '); rl.close(); if(p.length<14) throw new Error('Use at least 14 characters'); const salt=randomBytes(16).toString('hex'); console.log(salt+':'+scryptSync(p,salt,64).toString('hex'));"
```

Set the printed value as `ADMIN_PASSWORD_HASH`. Do not commit it to GitHub and do not paste it into chat.

Generate a separate signing secret locally:

```bash
node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"
```

Set that output as `ADMIN_JWT_SECRET`. Never reuse the password or commit the secret.

## Admin URLs

- Login: `/admin`
- Dashboard: `/admin/dashboard`
- Pending bus and route contributions: `/admin/submissions`

Admin sessions are signed and expire after 8 hours. The API accepts only the configured owner email and an active Super Admin record. If the environment variables are missing, login returns HTTP 503 by design.

## Important deployment limitation

This repository's current repository implementation stores buses, submissions, and audit records in process memory. This means records are not durable across backend restarts and multiple server instances do not share state. Before accepting real public submissions or deploying the service for production, replace the in-memory repository with a persistent database and verify the public app's approved-only data filtering.
