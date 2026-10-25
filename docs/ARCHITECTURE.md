# YatriBus System Architecture

## 1. High-Level Architecture Overview

YatriBus is an India-wide community-powered smart bus directory and live tracking platform designed from the ground up to operate on a ₹0 initial budget using open-source technologies, public transit datasets, and passenger-assisted GPS corroboration.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        PASSENGER CLIENTS                               │
│                                                                        │
│   Web Application (React 18 + Vite)    Android App (Capacitor Native)  │
│   • No mandatory login / account      • Fine Location Permission       │
│   • Multilingual UI (EN, HI, BN)      • Foreground Service Integration  │
│   • Custom Bus SVG Artwork            • Local Storage for History      │
└─────────────────────────────────┬──────────────────────────────────────┘
                                  │ HTTPS / REST API
┌─────────────────────────────────▼──────────────────────────────────────┐
│                    NODE.JS / EXPRESS BACKEND LAYER                     │
│                                                                        │
│   ┌─────────────────────┐  ┌─────────────────────┐  ┌────────────────┐ │
│   │ Search Normalizer   │  │ Transit Route Graph │  │ Rate Limiter   │ │
│   │ & Typo-Tolerant Eng │  │ (Direct + Transfers)│  │ & Anti-Abuse   │ │
│   └─────────────────────┘  └─────────────────────┘  └────────────────┘ │
│   ┌──────────────────────────────────────────────────────────────────┐ │
│   │        Deterministic Multi-Signal GPS Confidence Engine          │ │
│   │  • GPS Accuracy Threshold (<100m)                                │ │
│   │  • Timestamp Freshness (<120s Live, <600s Last Known)           │ │
│   │  • Cross-Track Polyline Route Match (<150m)                      │ │
│   │  • Speed Plausibility (0 - 110 km/h)                             │ │
│   │  • Independent Passenger Session Corroboration                   │ │
│   │  • Contradiction Detection & Penalty                             │ │
│   └──────────────────────────────────────────────────────────────────┘ │
│   ┌──────────────────────────────────────────────────────────────────┐ │
│   │ Admin Automation Engine & Verifier Review Moderation Queue       │ │
│   └──────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────┬──────────────────────────────────────┘
                                  │
┌─────────────────────────────────▼──────────────────────────────────────┐
│                      PERSISTENCE & SPATIAL DATA                        │
│                                                                        │
│   • PostgreSQL with PostGIS Extension (Production)                    │
│   • Spatial GIST Indexes & Trigram GIN Text Indexes                    │
│   • Embedded Spatial Repository with Zero-Dependency Dev Mode         │
│   • Separate Bus-Level Aggregates (Personal Traces Never Exposed)      │
└────────────────────────────────────────────────────────────────────────┘
```

## 2. Core Subsystems

### A. Place Master Database & Intelligent Search
- Supports Indian administrative hierarchy (Country, State/UT, District, Tehsil/Taluka, City/Town/Village, Locality, Bus Station/Terminal/Stop).
- Multilingual translation and Unicode NFKD normalization.
- Transliteration mapping for Indian cities (Dilli -> Delhi, Calcutta -> Kolkata, Bangalore -> Bengaluru, Poona -> Pune, Allahabad -> Prayagraj, etc.).
- Levenshtein distance and token similarity ranking for typo tolerance without paid AI APIs.

### B. Consent-Based Passenger-Assisted GPS Pipeline
1. **Contextual In-App Journey Confirmation**: Passengers viewing or searching a bus near its departure window are prompted: *"Are you travelling on this bus?"*
2. **Explicit Consent**: Consent is requested separately from search. Ordinary searches require no location permissions.
3. **Session Safety Expiry**: Active journey sessions terminate immediately on passenger request or automatically after max 12 hours.
4. **Privacy Shielding**: Raw passenger observations are evaluated server-side and transformed into a bus-level location aggregate. No individual trip history is ever published or retained.

### C. Route Graph & Journey Planner
- Models bus stops as network vertices and route legs as directed edges.
- Evaluates both direct bus routes and 1-transfer connections with realistic interchange wait times and terminus verification.
