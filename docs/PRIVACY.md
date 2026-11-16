# YatraBus India: Privacy & Data Protection Policy

## 1. Zero-account passenger access
Passengers do not need to create an account, verify an email address, or provide a phone number to search routes, check timetables or view stops. Recent searches and language preferences are stored locally in the app/browser.

## 2. Explicit, foreground-only GPS sharing
- Location permission is requested only after the passenger accepts the in-app consent notice and confirms the selected bus and route.
- GPS updates are sent only while the app is open. The Android app does not request background-location permission and does not register a location foreground service.
- A visible **Stop Sharing** control remains available while a session is active.
- Every session expires automatically after 6 hours. Stopped or expired sessions are excluded from public bus-location responses.
- If OS location permission is denied, no server tracking session is started.

## 3. Location minimization and public display
- The server stores only one latest location point per session. Each new update replaces the previous point; no continuous movement trail is collected.
- Coordinates are rounded to four decimal places before storage. A single report is shown publicly as a coarser yellow estimate.
- A green live marker is shown only when at least two independent, consented sessions report positions within 300 metres of one another, with recent updates and acceptable GPS accuracy.
- Public responses never expose session IDs, device identifiers or exact unrounded device coordinates.
- A stopped or expired session is not used to calculate a public bus position.

## 4. Network abuse prevention
- Raw IP addresses are not stored in the GPS session or observation records.
- Public API rate limiting uses a keyed hash of the connecting IP address; this is a security control and is not a passenger account identity.

## 5. Data retention status
- One latest rounded position is stored per session rather than a movement history.
- Session and latest-point records are retained in the D1 database after they stop being publicly visible. Automatic deletion of inactive session records is a separate retention control that must be approved and enabled before broad public launch.
- No fare, vehicle identity, bus registration number or live vehicle feed is inferred from passenger GPS.

## 6. Hardware independence
YatraBus does not require proprietary GPS hardware inside buses. Passenger-assisted location is optional, consent-based and unavailable unless an approved bus and route record exist.
