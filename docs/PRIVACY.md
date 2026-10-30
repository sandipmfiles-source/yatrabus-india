# YatriBus Privacy Architecture & Data Minimization

## Core Privacy Principles

1. **No Passenger Account Required**: Passengers can search routes, look up timetables and submit public corrections without providing a phone number, email address or social account.
2. **No Covert Location Collection**: The Android app requires foreground location permission before the passenger can continue into the app. Granting Android permission does not start GPS sharing. GPS observations are sent only after a passenger separately confirms a journey and accepts the tracking disclosures; the API rejects observations without recorded consent.
3. **Session-Bound GPS**: Every observation must match an active journey session's bus and route. Invalid coordinates and expired sessions are rejected.
4. **Temporary Coordinate Retention**: Raw per-session GPS observations are held only while the journey session is active, and are deleted when the user stops sharing or the session expires. Observations older than 12 hours are pruned. The latest bus-level aggregate can remain visible with its freshness state; an individual passenger path is not published.
5. **Safety Expiry Limit**: Journey sessions automatically expire after a maximum of 12 hours. Passengers can stop sharing at any time using the Stop Sharing control.
6. **Anti-Abuse Protections**: Contribution and search routes use rate limiting. Anonymous correction votes use a one-way hash of the browser/app visitor token to prevent repeat votes; it is not a passenger identity.
7. **Deployment Caveat**: These controls are implemented in the repository's backend code. They protect real traffic only after the backend is deployed and the APK is configured to use that backend. The current backend persistence is a local JSON file and requires a persistent disk until a production database adapter is connected.
