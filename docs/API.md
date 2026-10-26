# YatraBus India: REST API Documentation

All API endpoints are versioned under `/api/v1` and return standardized JSON responses.

### Base Response Structure
```json
{
  "success": true,
  "data": {},
  "error": null,
  "meta": {}
}
```

---

## 1. System Health
### `GET /api/v1/health`
Returns live platform health, database connectivity, and entity counts.
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "uptimeSeconds": 1420,
    "totalPlaces": 18,
    "totalBuses": 5,
    "totalRoutes": 4,
    "totalStops": 15,
    "activeLiveSessions": 1,
    "databaseStatus": "connected"
  }
}
```

---

## 2. Places & Search
### `GET /api/v1/places/search?q={query}&limit=8`
Performs typo-tolerant, multilingual fuzzy search across canonical names, districts, states, and aliases.
#### Sample Request
`GET /api/v1/places/search?q=kashmiri`
#### Sample Response
```json
{
  "success": true,
  "data": [
    {
      "id": "plc-del-01",
      "canonicalName": "Kashmiri Gate ISBT",
      "placeType": "bus_terminal",
      "state": "Delhi",
      "district": "Central Delhi",
      "latitude": 28.6675,
      "longitude": 77.2285,
      "matchScore": 100
    }
  ],
  "meta": { "totalResults": 1, "query": "kashmiri" }
}
```

### `GET /api/v1/places/nearby?lat={lat}&lng={lng}&radiusKm=5`
Returns bus stops and terminals located within the specified radius.

---

## 3. Routes & Timetables
### `GET /api/v1/routes/search?origin={originId}&destination={destinationId}`
Returns direct and transfer routes connecting the specified locations.
#### Sample Response
```json
{
  "success": true,
  "data": {
    "directRoutes": [
      {
        "route": {
          "id": "rt-del-502",
          "routeNumber": "502",
          "name": "Mehrauli Terminal to Old Delhi Railway Station",
          "frequencyMinutes": 15
        },
        "boardStopSequence": 1,
        "alightStopSequence": 5,
        "stopsCount": 5,
        "estimatedMinutes": 65
      }
    ],
    "transferRoutes": []
  }
}
```

### `GET /api/v1/routes/{id}/timetables`
Returns scheduled departures for the specified route.

### `GET /api/v1/routes/{id}/stops/{stopId}/eta`
Calculates dynamic ETA for a given stop.
```json
{
  "success": true,
  "data": {
    "routeId": "rt-del-502",
    "stopId": "plc-del-06",
    "stopName": "AIIMS Bus Stop",
    "scheduledArrival": "08:28",
    "predictedArrival": "08:31",
    "isEstimated": false,
    "delayMinutes": 3,
    "confidence": "high",
    "trackingStatus": "live_gps",
    "basis": "live_gps"
  }
}
```

---

## 4. Consent-Based Passenger Tracking
### `POST /api/v1/tracking/session/start`
Starts an anonymous tracking session. Explicit consent is mandatory.
#### Request Body
```json
{
  "busId": "bus-dtc-502-01",
  "routeId": "rt-del-502",
  "consent": true
}
```
#### Response
```json
{
  "success": true,
  "data": {
    "sessionId": "sess-1711370000-a9f82d",
    "expiresAt": "2026-03-26T04:00:00Z",
    "isActive": true
  }
}
```

### `POST /api/v1/tracking/session/{sessionId}/stop`
Immediately stops the tracking session.

### `POST /api/v1/tracking/observation`
Ingests an observation payload.
```json
{
  "sessionId": "sess-1711370000-a9f82d",
  "busId": "bus-dtc-502-01",
  "routeId": "rt-del-502",
  "latitude": 28.5672,
  "longitude": 77.2100,
  "accuracyMeters": 18,
  "speedKmh": 32,
  "heading": 15
}
```

---

## 5. Community Contributions
### `POST /api/v1/contributions`
Submits a missing bus, stop, or timetable correction. Returns duplicate candidate matches if found.
#### Request Body
```json
{
  "submissionType": "add_bus",
  "proposedData": {
    "name": "DTC 502 Electric",
    "operatorId": "op-dtc",
    "vehicleType": "electric"
  },
  "contributorNotes": "New low-floor AC electric bus introduced on this route"
}
```
#### Response
```json
{
  "success": true,
  "data": {
    "id": "SUB-2026-7741",
    "status": "pending_review",
    "submittedAt": "2026-03-25T14:30:00Z"
  },
  "meta": {
    "duplicateCandidates": [
      { "id": "bus-dtc-502-01", "name": "DTC Low Floor AC 502", "similarity": 84 }
    ],
    "hasDuplicates": true,
    "trackingReferenceId": "SUB-2026-7741"
  }
}
```
