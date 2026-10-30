# YatriBus (यात्रीबस / যাত্রীবাস)
### India-Wide Smart Bus Directory, Community-Powered Live Tracking & Android App

[![Build Android Debug APK](https://github.com/sandipmfiles-source/yatrabus-india/actions/workflows/android-apk.yml/badge.svg)](https://github.com/sandipmfiles-source/yatrabus-india/actions/workflows/android-apk.yml)
[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![Target Budget](https://img.shields.io/badge/Cost_Target-₹0_Initial_Budget-emerald.svg)](#)

---

## 🚌 Overview

**YatriBus** is a community-powered public transport information platform for Indian commuters. It combines an India-focused places directory, a timetable and route engine, typo-tolerant search, account-free community contributions, and a consent-based passenger-assisted GPS tracking module. Live shared features require a deployed backend; the included bus schedules are sample records, not a nationwide verified feed.

### Core Non-Negotiables Built In:
- **No Sign-in for Passengers or Bus Owners**: Search, view routes, and submit passenger corrections or bus-owner route/timetable details without Google, phone OTP, email login, or passwords. Owner submissions go to a separate Super Admin review queue.
- **Free Across India**: No subscription, listing fee, or payment gateway. The public app and contribution workflow are available across all 28 States and 8 Union Territories.
- **Explicit Location Consent**: The Android app requires foreground location permission before entry. Permission alone never shares GPS; journey tracking starts only after the passenger separately confirms a bus journey and consents.
- **Deterministic Multi-Signal GPS Engine**: Evaluates horizontal accuracy, timestamp freshness, route cross-track distance, and speed realism without requiring paid AI APIs.
- **Transparent Distinction**: Live GPS observations and schedule timetable predictions are clearly differentiated. Schedule estimates are **never** falsely labeled as "Live GPS".
- **Custom SVG Bus Artwork**: Missing bus photos display a custom vector SVG bus illustration, never a broken image icon.
- **₹0 Initial Cost Target**: Uses open-source code, OpenStreetMap data, a free-first deployment plan and automated GitHub Actions Android APK builds. Production PostgreSQL is planned but not yet connected to the backend runtime.

---

## 📱 Features

- **Origin to Destination Search**: Fast direct bus routes and 1-transfer connections with realistic interchange wait times.
- **Typo-Tolerant Place Autocomplete**: Levenshtein distance, token similarity, and Indian administrative disambiguation (e.g., distinguishing Kashmere Gate from Kashmiri Gate, or Rampur HP from Rampur UP).
- **Multilingual Support**: First-class support for English, Hindi (हिन्दी), and Bengali (বাংলা).
- **Interactive Route Maps**: Route polylines, ordered stop markers, and real-time pulsing bus markers powered by Leaflet and OpenStreetMap.
- **Account-Free Contribution Portal**: Submit missing buses, stops, routes, or schedule corrections and receive a public Reference ID. Contributors receive a public Reference ID (e.g., `YB-SUB-2026-9481`) to check review progress.
- **Administrator Moderation Dashboard**: Protected console for transit verifiers to review submissions, resolve duplicate candidates, configure automation rules, and monitor active tracking sessions.
- **Android Mobile App**: Packaged via Capacitor with native fine location and foreground service permissions.

---

## 🚀 Quick Start Guide

### Prerequisites
- Node.js 20 or newer
- npm 9 or newer

### 1. Clone & Install Dependencies
```bash
git clone https://github.com/sandipmfiles-source/yatrabus-india.git
cd yatribus-india
npm install
```

### 2. Configure Environment
Copy the example environment template:
```bash
cp .env.example .env
```
*(The default configuration runs out of the box with zero external dependencies using the embedded transit repository).*

### 3. Run Automated Tests
Execute the master automated test runner verifying normalizers, route matching, confidence engine, and ETA logic:
```bash
npm test
```

### 4. Start Development Servers
- **Frontend Web UI** (Vite + React + Tailwind):
  ```bash
  npm run dev
  ```
  Open `http://localhost:3000` in your web browser.

- **Backend Express REST API**:
  ```bash
  npm run server
  ```
  Listening on `http://localhost:5000`.

---

## 📦 Android APK Build via GitHub Actions

You do **not** need Android Studio installed locally. The repository includes an automated GitHub Actions workflow (`.github/workflows/android-apk.yml`) that builds an installable Android Debug APK in the cloud.

### How to Get Your APK:
1. Push this repository to GitHub.
2. Navigate to the **Actions** tab on your GitHub repository page.
3. After a successful merge to `mx-local-preserve`, open the repository **Releases** page and download the latest **app-debug.apk** asset.
4. If the release has not appeared yet, open **Actions** → **Build Android Debug APK** and download the `yatribus-debug-apk` artifact from the latest successful run.
5. Transfer `app-debug.apk` to your Android phone, enable *Install Unknown Apps* for your file manager, and tap **Install**.

*For complete details, see [docs/APK_INSTALLATION.md](docs/APK_INSTALLATION.md).*

---

## 📚 Documentation Directory

- **[System Architecture](docs/ARCHITECTURE.md)**: Deep dive into the client-server layers, route graph, and geospatial confidence pipeline.
- **[Database & PostGIS](docs/DATABASE.md)**: Schema definitions, spatial GIST indexes, and migration scripts.
- **[REST API Reference](docs/API.md)**: Endpoint documentation, query parameters, and JSON payloads.
- **[Privacy & Data Minimization](docs/PRIVACY.md)**: Consent lifecycle, 12-hour session limits, and bus-level anonymization.
- **[Production Deployment (₹0 Tier)](docs/DEPLOYMENT.md)**: Setup guide for Supabase/Neon PostgreSQL and hosting.
- **[Milestone Verification Report](docs/MILESTONE_REPORT.md)**: Audit checklist of completed requirements.

---

## 📜 License

Licensed under the [Apache License, Version 2.0](LICENSE). Transit schedule data and OpenStreetMap tiles remain subject to their respective ODbL and open government licenses.
