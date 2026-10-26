# YatraBus India (यात्रा बस इंडिया / যাত্রাবাস ইন্ডিয়া)
### India-Wide Smart Bus Directory, Community-Powered Live Tracking & Android App

[![Build Android APK](https://github.com/example/indiabus/actions/workflows/android-apk.yml/badge.svg)](https://github.com/example/indiabus/actions/workflows/android-apk.yml)
[![Tests](https://github.com/example/indiabus/actions/workflows/tests.yml/badge.svg)](https://github.com/example/indiabus/actions/workflows/tests.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)
[![Initial Budget](https://img.shields.io/badge/Budget-%E2%82%B90-brightgreen.svg)]()

**YatraBus India** is a modern, community-powered public transport information directory, live tracking engine, and installable Android application designed specifically for the Indian transit network.

---

## 🌟 Key Features

1. **Account-Free Passenger Experience**:
   - Zero mandatory registration, phone numbers, or passwords.
   - Passengers open the application and immediately search bus routes.
2. **India-Wide Places Master Directory**:
   - Covers Indian administrative hierarchy: Country ➔ State/UT ➔ District ➔ Subdivision/Tehsil ➔ City/Town/Village ➔ Bus Terminal / Bus Stop.
   - Full multilingual alias matching in **English**, **Hindi (हिन्दी)**, and **Bengali (বাংলা)**.
3. **Intelligent Typo-Tolerant Search**:
   - Case and Unicode NFC normalization, Levenshtein distance, Jaro-Winkler string similarity, and district/state disambiguation.
   - Zero paid AI API dependency.
4. **Custom SVG Bus Artwork**:
   - When no verified photograph exists, the app renders an original, custom-designed SVG bus illustration with route destination boards and operator theme colors (never a broken icon or emoji).
5. **Consent-Based Passenger GPS Tracking**:
   - No dedicated bus hardware required.
   - Contextual permission flow: Prompts passengers travelling on a bus to optionally share anonymous updates.
   - Configurable **12-hour safety ceiling** and persistent *"Stop Sharing"* controls.
6. **Multi-Signal Location Confidence Engine**:
   - Distinguishes **Live GPS** (`high`/`moderate` confidence) from **Estimated Positions** and **Last Known Locations**.
   - Filters out inaccurate GPS (>50m error) and stale pings (>5 minutes).
7. **Dynamic ETA & Service Status**:
   - Real-time arrival predictions based on route distance, sequenced stops, and live passenger observations.
8. **Community Contribution System**:
   - Add missing buses, stops, or suggest timetable corrections without logging in.
   - Built-in duplicate detection (>80% similarity warnings).
   - Generates non-identifiable reference IDs (`SUB-2026-XXXX`) for status lookup.
9. **Administrator Control Suite**:
   - Protected admin dashboard with system health metrics, review queue with diff viewer, configurable automation rules, and audit logs with rollback capability.
10. **Installable Android APK via GitHub Actions**:
    - Ready-to-use Capacitor integration and GitHub Actions cloud build workflow producing a downloadable Android debug APK.

---

## 🏗️ Repository Architecture

```
/
├── apps/
│   └── mobile/                # Android Capacitor configuration & native manifests
├── android/                   # Generated Capacitor Android native project
│   ├── app/src/main/
│   │   ├── AndroidManifest.xml   # Location & Foreground service declarations
│   │   └── java/in/yatrabus/app/ # BusTrackingForegroundService.java & MainActivity
│   └── build.gradle
├── backend/
│   ├── migrations/            # PostgreSQL + PostGIS DDL migrations (001_initial_schema.sql)
│   └── src/
│       ├── db/                # In-memory persistent DataStore & Indian seed datasets
│       ├── routes/            # REST API router & controller handlers
│       ├── utils/             # Geospatial calculations (Haversine) & search algorithms
│       └── server.ts          # Standalone Node HTTP server
├── src/
│   ├── assets/                # Bus vector logo & responsive artwork
│   ├── components/
│   │   ├── admin/             # Control suite & automation rules
│   │   ├── common/            # CustomBusIllustration.tsx
│   │   ├── contribution/      # Account-free submission modal with duplicate checks
│   │   ├── home/              # Autocomplete From/To search, recent searches
│   │   ├── map/               # Leaflet + OpenStreetMap interactive bus route map
│   │   ├── routes/            # Stop sequence, timetable versioning & ETA modal
│   │   └── tracking/          # Contextual journey consent & location sharing modal
│   ├── i18n/                  # Localization dictionary (English, Hindi, Bengali)
│   ├── services/              # Unified API client
│   ├── types/                 # TypeScript interfaces
│   ├── App.tsx                # Main application shell & navigation
│   └── main.tsx               # Client entrypoint
├── docs/                      # ARCHITECTURE, DATABASE, API, PRIVACY, DEPLOYMENT, APK
├── tests/                     # Automated unit and integration test runner
├── .github/workflows/         # android-apk.yml (automated APK) & tests.yml
├── capacitor.config.ts        # Capacitor mobile configuration
└── package.json               # Dependencies and build scripts
```

---

## 🚀 Quick Start Guide

### 1. Prerequisites
- **Node.js**: v18.x or v20.x
- **Git**

### 2. Local Setup
```bash
# Clone the repository
git clone https://github.com/<your-username>/indiabus.git
cd Bus

# Install dependencies
npm install

# Run the automated test suite
npm test:unit

# Start the local development server
npm run dev
```
Open your browser at `http://localhost:5173` to experience the platform.

### 3. Running the Backend API Server
```bash
npm run dev -- --host
# Or run standalone API server:
npx tsx backend/src/server.ts
```

---

## 📱 Building the Android APK (Cloud Automated)

You do **not** need Android Studio installed on your computer.

1. Push this project to your GitHub repository.
2. Go to the **Actions** tab on GitHub.
3. Select **Build Android APK** and click **Run workflow**.
4. Once completed (~3 minutes), download the **`yatrabus-india-debug-apk`** artifact.
5. Transfer the `.apk` file to your Android phone and install it!

Detailed instructions are available in [docs/APK_INSTALLATION.md](file:///c:/Users/Jahoba%20Haat/Desktop/Bus/docs/APK_INSTALLATION.md).

---

## 🧪 Automated Testing

Run the built-in test suite:
```bash
node tests/run-all-tests.js
```
The test suite validates:
- Geospatial distance formulas (Haversine & route cross-track error)
- Devanagari Hindi and Bengali Unicode normalization
- Typo-tolerant Levenshtein string matching
- Duplicate bus and route submission detection
- Consent lifecycle and 12-hour maximum session ceiling
- GPS horizontal accuracy thresholding (>50m rejection)
- Observation freshness window (<300 seconds)
- Timetable version history preservation (non-destructive revisions)

---

## 📄 License
This project is open-source under the [MIT License](LICENSE).
Map data is © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors.
