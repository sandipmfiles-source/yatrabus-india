# YatriBus India — implementation status (30 October 2026)

This report separates code implemented in the repository from services that are actually deployed. A checked box means the code or workflow exists; it does not mean a production backend or nationwide timetable feed is live.

## Implemented in the repository

### 1. App foundation and interface
- [x] React + TypeScript + Vite frontend, Capacitor Android wrapper, Express API source and shared TypeScript packages.
- [x] Custom SVG bus artwork and responsive app shell.
- [x] Premium charcoal / signal-yellow YatriBus header, white YatriBus wordmark, animated bus and reduced-motion-aware effects.
- [x] English, Hindi and Bengali language dictionaries with matching keys. Public search, bus detail, contribution, operator verification and privacy pages use translations. Some owner/admin console labels remain English-only.

### 2. Places, search and route data
- [x] India-focused administrative place hierarchy and typo-tolerant search (normalization, transliteration and disambiguation).
- [x] Route graph for direct and one-transfer journeys, timetable-based ETAs and service-state labels.
- [x] Timetable, stop sequence and bus data structures, plus admin review and versioning code.
- [x] Route submissions can identify outbound (UP) and return (DOWN) directions; Super Admin approval preserves the selected direction.
- [x] Bus records are linked to their route so tracking sessions and route details use the correct bus/route pair.
- [ ] Nationwide verified schedules are NOT complete. The current seed dataset contains four sample route records and four sample buses (Delhi, Mumbai and Kolkata examples). These seed routes/buses are marked UNVERIFIED / SCHEDULE_UNVERIFIED until a Super Admin checks current operator data. This is not a complete India-wide bus timetable.

### 3. Public contributions and moderation
- [x] Account-free passenger submissions and public reference IDs.
- [x] Account-free bus-owner submissions with contact verification details and a separate Super Admin owner-review queue; no Google sign-in or passenger account is offered.
- [x] Correction suggestions, community corroboration/voting, duplicate candidates and submission status lookup.
- [x] Super Admin review endpoints and dashboard source. Admin access is owner-controlled; there is no public admin registration.
- [ ] Public submissions and moderation are not live across devices until the backend is deployed and the APK is configured with its API URL.

### 4. Passenger-assisted GPS tracking
- [x] Explicit consent prompt, journey session, GPS confidence checks, route matching, freshness checks and bus-level public location state.
- [x] Android startup foreground-location permission gate is mounted; background-location permission is declared for use during an explicitly consented journey. Granting device permission does not itself start GPS sharing.
- [x] Bus detail refreshes the selected bus location and stop ETAs every 15 seconds while the page is open.
- [x] Seed buses no longer display fabricated coordinates; without a passenger GPS observation, location is shown as unavailable.
- [x] Server rejects observations without recorded consent, mismatched bus/route IDs, invalid coordinates or expired sessions.
- [x] Session ends on Stop Sharing or at the 12-hour limit. Per-session coordinate observations are deleted when the session ends/expires; only the latest bus-level location aggregate remains available.
- [ ] No physical Android device test has been performed in this workflow. Real cross-device live tracking requires the deployed backend and API URL.

### 5. Free route preview
- [x] Owner and public route builders include origin, destination, route number/name, UP/DOWN direction, intermediate stops and a vertical ordered-stop preview.
- [x] Owner and passenger submissions are free to use across all 28 States and 8 Union Territories; no subscription or payment gateway is included.
- [x] Stops can be moved up/down without changing the fixed origin/destination endpoints; adding an intermediate stop inserts it before the destination.
- [x] Both owner and public route submissions require a successful OpenStreetMap / OSRM road-path check in the exact submitted stop order before submission; the owner preview displays road geometry, distance and estimated duration.
- [x] The public route form supports all 28 Indian states and 8 union territories.
- [ ] Route preview needs coordinates for each point (saved local place coordinates or Name | latitude | longitude). The public OSRM demo is best-effort and has no production SLA.
- [ ] Road routing checks a drivable path, not whether a public bus actually operates there; admin verification is required.

### 6. Android build and downloads
- [x] GitHub Actions builds the web bundle, runs tests, syncs Capacitor and assembles the Android debug APK.
- [x] APK artifact retention set to 90 days.
- [x] Workflow is configured to publish a GitHub pre-release APK when a successful build is triggered by a push to mx-local-preserve after merge.
- [ ] A stable release-signed APK is not configured. The current output is a debug APK; stable in-place updates require a persistent private signing key.

## Not yet deployed / deferred

- [x] Google sign-in has been removed for passengers and bus owners for the launch period. Owner submissions use a no-account form and a separate review queue; only the Super Admin uses protected sign-in.
- [ ] Express backend hosting — not deployed.
- [ ] Durable production database — runtime currently uses JSON-file persistence. SQL migrations exist, but a PostgreSQL adapter is not yet wired into repository reads/writes.
- [ ] Cloudflare Pages / Workers and Neon are documented as free-tier targets, but no provider account has been connected and the existing Express API needs adaptation plus durable storage before production launch.
- [ ] GitHub repository variable VITE_API_BASE_URL must point to the deployed HTTPS API ending in /api before shared submissions, admin review and live GPS can work from the installed APK.
- [ ] Nationwide timetable data collection and operator verification remain ongoing work; no mass outreach to all Indian bus operators has been performed.
- [ ] Admin and owner consoles still need full Hindi/Bengali localization.

## Validation boundary

CI success proves that the repository's automated tests and Android debug APK build passed for that commit. It does not prove a physical device install, a live backend deployment, Google OAuth, nationwide timetable completeness or real-world bus GPS coverage.
