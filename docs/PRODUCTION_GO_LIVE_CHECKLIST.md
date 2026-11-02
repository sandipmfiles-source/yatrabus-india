# YatraBus India — Production Go-Live Checklist

This is the required release gate before accepting real passenger data. A successful Android APK build is not proof that the hosted service is configured or that real buses/timetables are verified.

## A. What is in the repository today

- React + Vite passenger web app and Capacitor Android wrapper.
- Express API for place search, routes, buses, tracking, contributions and Super Admin moderation.
- Bundled Local Government Directory (LGD) administrative-place catalogue wired into the primary place autocomplete.
- Seed/sample transit records. These are examples and must not be represented as a verified nationwide bus timetable.
- Consent-based GPS/network observations and optional cell-tower observations. GPS, network estimates, tower-derived estimates and timetable predictions must remain separately labelled.
- Timetable-based bus position fallback when a bus-specific schedule and route data are available.
- One-time bus candidate scoring endpoint. One GPS point is only a candidate, never proof of bus identity.
- Single configured Super Admin authentication. There is no public admin registration.
- Dockerfile and Compose file for a single-container Express deployment.
- JSON-file persistence with a persistent mounted volume. PostgreSQL migration SQL exists, but the runtime is not yet connected to PostgreSQL.

## B. Required before public launch

- [ ] Deploy the Express backend on a Node.js-compatible host with HTTPS.
- [ ] Attach a persistent disk/volume at the path used by `YATRIBUS_DATA_FILE`. Do not use ephemeral filesystem storage.
- [ ] Keep the initial launch to one backend instance. The in-memory rate limiter and in-process repository are not shared across multiple replicas.
- [ ] Set `NODE_ENV=production`, `PORT`, `YATRIBUS_DATA_FILE`, `ADMIN_EMAIL`, `ADMIN_PASSWORD_HASH`, and a random `ADMIN_JWT_SECRET` of at least 32 characters in the host's private secret manager.
- [ ] Generate the password hash using the same scrypt format expected by the server:
  ```bash
  export ADMIN_PASSWORD='use-a-long-unique-password'
  node -e "const c=require('node:crypto');const p=process.env.ADMIN_PASSWORD;if(!p)throw Error('Set ADMIN_PASSWORD');const s=c.randomBytes(16).toString('hex');console.log(s+':'+c.scryptSync(p,s,64).toString('hex'))"
  unset ADMIN_PASSWORD
  ```
- [ ] Generate the JWT secret with `openssl rand -base64 48`. Never commit the generated values or put them in the Android app.
- [ ] Set `VITE_API_BASE_URL` to the public HTTPS API base URL when frontend and API are hosted separately. Rebuild the web app and APK after changing this build-time variable. If frontend and API share the same origin, keep the relative `/api` default.
- [ ] Test `GET /health` after deployment. It must report `status: UP` and `storageReady: true`.
- [ ] Test Super Admin login, expired/invalid token rejection, submission moderation, and audit logs.
- [ ] Submit a test correction, restart the backend, and verify the submission is still present. Restore from a backup in a test environment.
- [ ] Configure scheduled backups for the persistent JSON state file and test restoration. The Compose volume is persistence, not a backup.
- [ ] Confirm the hosting platform terminates HTTPS and forwards requests correctly.
- [ ] If the host is behind a reverse proxy, configure Express proxy trust deliberately at the hosting layer before relying on client-IP rate limiting. Do not blindly trust arbitrary forwarded headers.
- [ ] Review host request/body limits, logs, uptime monitoring, disk capacity and backup retention.

## C. Transit data readiness

- [ ] Import real operator, bus, route, ordered stop, coordinates, timetable and operating-day data.
- [ ] Verify every route and timetable against an official operator/state transport source or documented field verification.
- [ ] Enter bus-specific departure identifiers where more than one bus uses the same route. Generic route schedules cannot uniquely identify one vehicle.
- [ ] Check midnight-crossing services, cancelled trips, holiday schedules and seasonal timetable revisions.
- [ ] Do a field test on at least one real corridor (for example Jhargram–Kharagpur–Kolkata) with a known departure, intermediate stops and observed arrival times.
- [ ] Keep unverified community submissions pending until the Super Admin approves them. Do not publish estimates as official timetable facts.
- [ ] LGD administrative records improve place search but do not imply that every hamlet, informal stop or bus service has been independently verified.

## D. Tracking safety and reliability

- [ ] Test foreground permission denial, consent rejection, consent revocation, app force-stop, phone restart, battery saver and network loss.
- [ ] Confirm tracking only runs during an explicitly consented active journey and automatically ends on stop, destination arrival or session expiry.
- [ ] Confirm public maps expose only bus-level aggregates, not individual passenger traces or cell identifiers.
- [ ] Verify fresh GPS, Android provider/network estimates, cell-tower estimates and timetable fallback have different source labels and confidence.
- [ ] Configure `OPENCELLID_API_KEY` only if tower lookup is intentionally enabled. Without it, tower IDs cannot be translated into a useful coordinate estimate. A tower location is approximate and must never be shown as exact bus GPS.
- [ ] Do not infer a bus identity from a single passenger GPS point, a shared cell tower, or co-moving devices alone. Require a registered trip/vehicle binding or multiple independent, consented and time-separated observations plus route/time consistency.
- [ ] Test spoofed GPS, impossible speed, route deviation, duplicate samples and multiple buses sharing a corridor. Ambiguous results must remain ambiguous.
- [ ] Do not collect IMEI, IMSI, phone number, SIM serial, contacts or SMS for tracking.

## E. Current known limitations — do not overlook

1. **Database:** the current runtime uses an in-process repository persisted to one JSON file. SQL migrations are supplied but PostgreSQL/PostGIS is not connected to the runtime. This is acceptable only for a controlled, single-instance pilot with persistent storage and backups, not a high-availability public launch.
2. **Crowd identity:** the candidate matcher currently ranks a one-time location against route geometry and timetable. It does not yet implement a durable multi-sample trajectory-clustering or multi-passenger identity-verification engine.
3. **Cell towers:** cell observation mapping requires an OpenCelliD key and remains coarse. It is not carrier-grade triangulation.
4. **Data coverage:** bundled LGD place search is not a verified national bus timetable database. Bus/operator/route coverage must be collected and verified separately.
5. **Authentication:** Google OAuth remains intentionally deferred. Public passenger and operator contribution flows do not imply verified operator identity; claims require manual Super Admin review.
6. **Android release:** CI currently builds a debug APK. Before Play Store/public production distribution, configure a protected Android signing key, signed release workflow, versioning and key backup.
7. **Admin automation:** rule definitions and on/off values are stored and displayed, but not every rule parameter is consumed by runtime services yet. Treat the automation page as a read-only registry until each rule has a tested runtime integration.
8. **Duplicate resolution:** the current admin action changes a candidate's review status and records an audit event; it does not physically merge or rewrite route/stop/bus records. Perform any actual data merge as a separate reviewed operation.

## F. Recommended launch sequence

1. Complete the single-instance persistent-volume pilot and validate health/admin/data survival.
2. Load and verify one complete bus corridor; test timetable-only fallback and real GPS observations in the field.
3. Fix any issues found by the field test; only then expand route coverage.
4. Before multi-instance scale or accepting large volumes of public data, connect PostgreSQL/PostGIS to the repository, add database migrations/backup/restore automation, and move rate limiting to shared storage.
5. Implement and test time-separated multi-sample trajectory corroboration before enabling any automatic crowd-based bus identity assignment.
6. Configure production Android signing only when the app is ready for external release.

## G. Free/open-source boundaries

OpenStreetMap, the LGD dataset, Docker and GitHub Actions can reduce initial cost, but free services have fair-use limits and may change. Public OSM tiles, Nominatim and OSRM are not unlimited production APIs. Use attribution, respect their usage policies, cache responsibly and arrange a suitable provider or self-hosted service before scale.
