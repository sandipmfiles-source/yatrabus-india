# YatriBus REST API Reference

All endpoints accept and return `application/json`. Timestamps use ISO 8601 UTC format. Scheduled transit times use Indian Standard Time (IST) in `HH:MM` format.

## Public Transit APIs (No Account Required)

### 1. Autocomplete Places Search
- **Endpoint**: `GET /api/places/search?q={query}&limit={limit}`
- **Rate Limit**: 120 req / minute
- **Example Response**:
```json
{
  "query": "kashmere",
  "count": 1,
  "results": [
    {
      "place": {
        "id": "place-delhi-isbt-kg",
        "canonicalName": "ISBT Kashmere Gate",
        "placeType": "BUS_TERMINAL",
        "district": "North Delhi",
        "state": "Delhi"
      },
      "matchScore": 100,
      "matchType": "EXACT",
      "displayLabel": "ISBT Kashmere Gate",
      "subtitle": "North Delhi, Delhi"
    }
  ]
}
```

### 2. Nearby Transit Stops
- **Endpoint**: `GET /api/places/nearby?lat={lat}&lon={lon}&radius={meters}`
- **Query Params**: `lat`, `lon`, `radius` (default 3000m)

### 3. Route Search (Origin to Destination)
- **Endpoint**: `GET /api/routes/search?from={from}&to={to}`
- **Returns**: Direct bus routes and 1-transfer connections with interchange wait times.

### 4. Route Details & Stops Sequence
- **Endpoint**: `GET /api/routes/:id`

### 5. Bus Profile & Stop ETAs
- **Endpoint**: `GET /api/buses/:id`
- **Returns**: Bus details, operator, current location state (`LIVE`, `LAST_KNOWN`, `ESTIMATED`, `UNAVAILABLE`), and stop-by-stop ETAs clearly tagged as `OBSERVATION_BASED` or `SCHEDULE_BASED`.

## Passenger-Assisted Tracking & Consent APIs

### 6. Journey Prompt Evaluation
- **Endpoint**: `POST /api/tracking/evaluate-prompt`
- **Body**: `{ "routeId": "...", "isAlreadyTracking": false, "dismissedCount": 0 }`

### 7. Explicit Location Consent
- **Endpoint**: `POST /api/tracking/consent`
- **Body**: `{ "sessionId": "...", "status": "GRANTED", "disclosuresAccepted": true }`

### 8. Start Journey Session
- **Endpoint**: `POST /api/tracking/session/start`
- **Body**: `{ "busId": "...", "routeId": "..." }`

### 9. Stop Journey Session
- **Endpoint**: `POST /api/tracking/session/stop`
- **Body**: `{ "sessionId": "...", "reason": "USER_STOPPED" }`

### 10. Ingest GPS Observation (Multi-Signal Confidence Pipeline)
- **Endpoint**: `POST /api/tracking/observation`
- **Body**:
```json
{
  "sessionId": "sess-12345",
  "busId": "bus-dtc-534-01",
  "routeId": "route-dtc-534-up",
  "latitude": 28.6469,
  "longitude": 77.3160,
  "accuracyMeters": 15,
  "speedKmh": 25,
  "headingDegrees": 140,
  "timestamp": "2026-10-26T01:00:00Z"
}
```

## Community Contribution APIs (No Account Required)

### 11. Submit Missing Info or Timetable Fix
- **Endpoint**: `POST /api/contributions/submit`
- **Rate Limit**: 20 req / hour
- **Returns**: `{ "success": true, "referenceId": "YB-SUB-2026-9481" }`

### 12. Check Submission Status via Reference ID
- **Endpoint**: `GET /api/contributions/status/:referenceId`

## Administrator APIs (Protected by Bearer Token)
- `POST /api/admin/login`
- `GET /api/admin/overview`
- `GET /api/admin/submissions`
- `POST /api/admin/submissions/:id/review`
- `GET /api/admin/automation/rules`
- `PUT /api/admin/automation/rules/:id`
- `GET /api/admin/health`
