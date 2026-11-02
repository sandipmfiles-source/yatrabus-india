# YatraBus Cell-Assisted Tracking

## What this feature does

- Reads the registered mobile radio cell from Android only while a passenger has an active, explicitly consented YatraBus journey.
- Sends the radio type, MCC/MNC, area/TAC/LAC, cell ID, signal level and capture time to the YatraBus backend.
- Resolves tower coordinates on the server through OpenCelliD when `OPENCELLID_API_KEY` is configured.
- Rejects tower coordinates outside the published route corridor.
- Labels a cell-derived point as `ESTIMATED` / `CELL_TOWER`; it is never marked as a GPS live fix.
- Does not read phone numbers, IMEI, IMSI, SIM serials, contacts or SMS.

## Backend configuration

Create an OpenCelliD account and obtain an API key. Add it as a secret/environment variable on the **backend hosting service**:

```text
OPENCELLID_API_KEY=your_private_key
```

Do not put this key in the Android app, Vite variables, source files, or a public GitHub commit. Restart/redeploy the backend after adding it.

Without this key, the backend accepts and temporarily stores the sample but cannot turn the cell ID into a map coordinate.

## Important operating limits

- Android controls access to cell information. Some phones/carriers return no cell data, cached data, or only partial identifiers.
- Android rate-limits/caches cell information updates. YatraBus reads up to 12 available serving and neighboring cell records at a modest interval and cannot force the modem to refresh.
- Neighboring cells are retained as radio-context evidence, but are never plotted as the bus location. Only the registered/serving cell can provide a coarse tower-database fallback. This avoids treating every nearby tower as a bus coordinate.
- This is not true RF triangulation. Reliable multilateration would require carrier-grade timing/angle/measurement data (for example synchronized timing advance/RTT and antenna-sector information), which ordinary Android apps do not consistently expose. Multiple tower coordinates alone do not reveal the handset position.
- The current web-layer sampler runs while the consented journey screen/app process is active. It is not a guaranteed background cell collector; Android may suspend WebView timers.
- A tower's registered location is an approximate coverage-area reference, not the passenger's or bus's exact position. A cell can cover several kilometres and may serve multiple roads.
- A cell observation is useful only when the passenger has explicitly confirmed the correct bus and route. Never treat one cell sample as proof of bus identity.
- The current backend repository is in-memory. Cell observations and the derived estimate are lost on backend restart and are not suitable for multi-instance production hosting until persistent storage is added.
- Use fresh GPS observations as the preferred source. Cell-derived locations remain estimates and must never replace a fresh GPS fix.

## Validation checklist

1. Add the API key to backend environment variables and redeploy.
2. Install the APK on at least two Android phones using different carriers.
3. Start a journey and explicitly grant tracking consent on both phones while on the same bus.
4. Confirm the backend receives cell samples and that OpenCelliD maps the serving cells.
5. Compare the returned tower range and map position against the actual route.
6. Test with location disabled, no SIM, airplane mode, denied permission, stale cell cache, and a cell outside the route corridor.
7. Verify that stopping/revoking consent stops further samples.
8. Do not advertise the feature as reliable live tracking until field tests demonstrate acceptable accuracy across routes and carriers.


## Android network/fused location fallback

- The app also requests Android balanced-power location with Capacitor Geolocation (`enableHighAccuracy: false`) while a consented journey is active. Android may derive this from Wi-Fi, cellular networks, GNSS, or a fused provider; the OS chooses the available provider and may return no fix.
- These observations are explicitly tagged `NETWORK`, validated against the selected route corridor, and always published as `ESTIMATED` with a capped confidence score. They can never become green LIVE GPS and cannot replace a fresh GPS fix.
- Background GPS remains the preferred source. The network fallback is a best-effort periodic request while the app process is running; it is not a guarantee of background updates.
- Cell tower records are supporting radio context. Only a mapped serving cell may provide a coarse tower-area estimate; neighboring cells are not triangulated into a false point. Without a tower database API key, cell records are collected but cannot be geocoded.
- Accuracy order is GPS fix (when valid and route-matched), Android network/fused estimate, serving-cell area estimate, then timetable estimate. Each non-GPS source is visibly labelled approximate.
