# YatriBus Implementation & Milestone Verification Report

## Verification Checklist

### Milestone 1 — Foundation & Core Architecture
- [x] **Repository Structure**: Clean monorepo with `apps/`, `backend/`, `packages/shared/`, `data/`, `docs/`, `android/`, `.github/`.
- [x] **UI Design System**: Warm off-white (`#FBFBF9`), deep green primary brand (`#0E4D34`), emerald live tracking accents, crisp typography.
- [x] **Custom SVG Bus Artwork**: Vector illustration component (`BusIllustration.tsx`) replacing missing photos with modern Indian EV/CNG transit bus artwork. No broken image icons.
- [x] **Database Schema & Migrations**: 4 sequential SQL migrations (`001_initial_schema.sql` through `004_admin_automation.sql`) for PostgreSQL & PostGIS.
- [x] **Health Checks**: `/health` and `/api/health` endpoints returning server status and ₹0 architecture metadata.

### Milestone 2 — Places & Bus Directory
- [x] **Indian Administrative Places Master Directory**: Country, State/UT, District, Tehsil/Taluka, City/Town/Village, Locality, Bus Stop/Terminal.
- [x] **Search Normalization & Transliterations**: Case, whitespace, Unicode NFKD, and Indian city transliterations (Dilli, Calcutta, Bangalore, Poona, Allahabad, etc.).
- [x] **Typo-Tolerant Search Engine**: Levenshtein distance, token Jaccard similarity, and administrative disambiguation by district and state.
- [x] **Verified Corridors Seeded**: Real routes, buses, stops, and schedules for Delhi NCR (DTC), Mumbai/Pune (BEST/MSRTC), Bengaluru (BMTC), Kolkata (WBTC).

### Milestone 3 — Community Contribution Without Accounts
- [x] **No Mandatory Passenger Accounts**: Public users search and contribute immediately without phone numbers, emails, or logins.
- [x] **Public Reference IDs**: Submissions generate human-readable tracking codes (`YB-SUB-2026-XXXX`) so contributors can check review status.
- [x] **Client & Server Duplicate Detection**: Flags duplicate candidate stops (<150m) and routes before submission.
- [x] **Audit History & Rollback**: Timetable revisions preserve prior snapshots and proposed schedules with administrative decision notes.

### Milestone 4 — Consent-Based Passenger-Assisted Tracking
- [x] **Explicit Consent**: Contextual permission modal explaining anonymous aggregation and safety limits without coercive urgency.
- [x] **Journey Confirmation Decision Engine**: Evaluates whether to ask *"Are you travelling on this bus?"* based on departure window (±20 mins), schedule active today, and dismissal limits.
- [x] **Multi-Signal GPS Confidence Engine**:
  - GPS horizontal accuracy penalty (>100m rejected)
  - Observation freshness (<120s Live, <600s Last Known, >600s Unavailable)
  - Cross-track route polyline matching (<150m)
  - Speed plausibility (0 - 110 km/h)
  - Independent corroboration (distinct sessions count)
  - Contradiction penalty
- [x] **Bus-Level Aggregation**: Personal movement traces are never stored or exposed; public map shows only bus-level state.
- [x] **Session Safety Limit**: Maximum 12-hour session timeout with prominent "Stop Sharing" control.

### Milestone 5 — Route Graph, ETAs & Service Statuses
- [x] **Route Graph Algorithm**: Discovers both direct bus routes and 1-transfer connections with interchange wait times.
- [x] **Stop-by-Stop ETAs**: Distinguishes live GPS estimates from timetable predictions.
- [x] **Service Statuses**: Operating as scheduled, Schedule unverified, Possible delay, Route changed, Disruption reported, Under review.

### Milestone 6 — Mobile App & Automated Android APK Build
- [x] **Capacitor Configuration**: `in.yatribus.app` with fine location plugin and Android scheme.
- [x] **Android Manifest**: Declares fine location, coarse location, foreground service, and notification permissions.
- [x] **GitHub Actions Workflow**: `.github/workflows/android-apk.yml` sets up Node 20, Java 17, Android SDK, runs tests, builds Vite web bundle, syncs Capacitor, runs Gradle assembleDebug, verifies APK output, and uploads the downloadable artifact.
- [x] **Installation Guide**: Complete step-by-step instructions in `docs/APK_INSTALLATION.md`.

### Milestone 7 — Production Readiness & ₹0 Strategy
- [x] **Security & Rate Limiting**: In-memory rate limiters protecting search (120/min) and contributions (20/hr).
- [x] **Admin Authentication**: Bearer token authorization and role-based access control.
- [x] **Automated Tests**: Unit suites covering normalizer, typo search, duplicate detector, route matcher, confidence engine, stale detector, route graph, ETAs, and journey confirmation.
