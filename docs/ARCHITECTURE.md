# YatraBus India: Architecture & System Design

## 1. Overview & Vision
**YatraBus India** is an open-source, community-powered public transport information directory and live bus tracking platform designed specifically for the diverse, high-volume Indian transit ecosystem.

The platform solves core transport discoverability challenges across Tier-1 metros, Tier-2/3 cities, and regional transit corridors without imposing barriers:
- **₹0 Cost Target**: Built strictly on free tiers, open-source software, and open datasets (OpenStreetMap, census, GTFS extracts). No mandatory paid AI APIs or expensive fleet hardware.
- **Account-Free Passenger Experience**: Passengers never need to create an account, enter a mobile number, or sign in to search buses, view timetables, or submit corrections.
- **Consent-Based Passenger GPS**: Live bus tracking operates via passenger-assisted crowdsourcing. Ordinary search works 100% without location permission.

---

## 2. High-Level Architecture Diagram

```
+-------------------------------------------------------------------------+
|                              CLIENT APPS                                |
|  +----------------------------------+  +-----------------------------+  |
|  |     Mobile PWA / Web Browser     |  |   Android APK (Capacitor)   |  |
|  |  (React, TypeScript, Tailwind)   |  | (Foreground Location Svc)   |  |
|  +----------------------------------+  +-----------------------------+  |
+-------------------------------------------------------------------------+
                                    |
                            REST API / HTTPS
                                    v
+-------------------------------------------------------------------------+
|                           BACKEND & API LAYER                           |
|  - Intelligent Search Engine (Unicode NFC, Levenshtein, Jaro-Winkler)    |
|  - Multi-Signal Location Matching & Confidence Classifier               |
|  - Dynamic ETA Calculator (Schedule + Live Observation)                 |
|  - Community Moderation & Duplicate Detection Engine                    |
|  - Admin Automation Rules Engine & Audit Logging                        |
+-------------------------------------------------------------------------+
                                    |
                                    v
+-------------------------------------------------------------------------+
|                              DATA TIER                                  |
|  - PostgreSQL + PostGIS (Production Spatial Engine)                     |
|  - Embedded In-Memory & File Store Fallback (Zero-Cost Local Dev)       |
|  - India-Wide Places Directory (Hierarchy, Aliases: EN, HI, BN)         |
|  - Buses, Operators, Sequenced Route Stops & Timetable Revisions        |
+-------------------------------------------------------------------------+
```

---

## 3. Core Engine Components

### 3.1 Intelligent Search & Place Normalization
- Normalizes all queries to Unicode NFC, stripping noisy punctuation and case-folding.
- Supports multi-script Indian languages (Devanagari Hindi, Bengali, Latin English, and phonetic transliterations).
- Implements Jaro-Winkler similarity (0-100 score) and Levenshtein distance for typo-tolerant matching.
- Disambiguates duplicate place names by appending District and State context.

### 3.2 Consent-Based Tracking & Session Lifecycle
- Never prompts for GPS upon first launch.
- When a user views an active route near its scheduled departure, the system asks: *"Are you travelling on this bus?"*
- Explicit consent grants permission for an anonymous, revocable session (`sess-XXXX-XXXX`).
- Sessions are capped by a strict **12-hour safety ceiling** and automatically expire.
- A persistent control (*"Stop Sharing Location"*) is visible at all times.

### 3.3 Multi-Signal Location Confidence Engine
Input observations pass through deterministic validation:
1. **Horizontal Accuracy Check**: Rejects readings exceeding 50 meters horizontal error.
2. **Freshness Filter**: Observations older than 300 seconds (5 minutes) are marked as `last_known`.
3. **Route Proximity Corridor**: Calculates perpendicular distance to the route's polyline using Haversine cross-track projection.
4. **Classification**:
   - `high`: Accuracy <= 25m, Route distance <= 100m, Age <= 120s.
   - `moderate`: Accuracy <= 50m, Route distance <= 350m, Age <= 300s.
   - `low` / `estimated`: Fallback or timetable-projected position.

### 3.4 Community Verification & Duplicate Prevention
- Contributions generate a transparent reference ID (`SUB-2026-XXXX`) allowing contributors to check status without accounts.
- Automated duplicate detection compares proposed names against existing records. If similarity exceeds 80%, existing candidates are displayed.
- Timetable updates increment revision numbers and store historical copies in `audit_logs` with rollback capability.
