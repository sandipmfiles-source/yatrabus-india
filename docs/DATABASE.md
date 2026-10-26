# YatraBus India: Database Schema & Data Dictionary

## 1. Database Overview
The YatraBus database is designed for PostgreSQL with the **PostGIS** extension, providing spatial indexing (`GIST`) and geographic computations. For local testing and zero-cost development, an embedded in-memory repository implements identical semantics.

---

## 2. Entity Relational Models

### `places` (Master Geographical Directory)
| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | VARCHAR(64) PK | Stable unique identifier (`plc-del-01`) |
| `canonical_name` | VARCHAR(255) | Official canonical name in English / Primary script |
| `place_type` | VARCHAR(32) | `state`, `district`, `city`, `town`, `village`, `bus_terminal`, `bus_stop` |
| `parent_place_id` | VARCHAR(64) FK | References parent administrative unit |
| `state` | VARCHAR(100) | State or Union Territory |
| `district` | VARCHAR(100) | District name |
| `latitude` | NUMERIC(9,6) | WGS84 Latitude |
| `longitude` | NUMERIC(9,6) | WGS84 Longitude |
| `geom` | GEOMETRY(Point, 4326) | PostGIS spatial point for indexing |
| `verification_status`| VARCHAR(32) | `admin_verified`, `community_corroborated` |

### `place_aliases` (Multilingual Names & Transliterations)
| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | BIGSERIAL PK | Auto-incrementing identifier |
| `place_id` | VARCHAR(64) FK | References `places(id)` |
| `language_code` | VARCHAR(10) | `en`, `hi`, `bn`, `ta`, etc. |
| `alias_name` | VARCHAR(255) | Translated name or phonetic variant |
| `is_transliteration`| BOOLEAN | True if transliterated |

### `operators` (State Transport Corporations & Private Fleets)
| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | VARCHAR(64) PK | e.g. `op-dtc`, `op-best`, `op-wbtc`, `op-bmtc` |
| `name` | VARCHAR(255) | Full public name |
| `short_code` | VARCHAR(32) UNIQUE | e.g. `DTC`, `BEST`, `WBTC`, `BMTC` |
| `is_government` | BOOLEAN | Distinguishes public transit from private operators |

### `buses` (Fleet Vehicles)
| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | VARCHAR(64) PK | Stable identifier |
| `name` | VARCHAR(255) | Public fleet identifier |
| `operator_id` | VARCHAR(64) FK | References `operators(id)` |
| `vehicle_type` | VARCHAR(32) | `ordinary`, `express`, `semideluxe`, `ac_volvo`, `electric` |
| `photo_url` | TEXT | Optional photo. If null, custom SVG artwork is rendered |
| `status` | VARCHAR(32) | `active`, `inactive`, `disputed` |

### `routes` (Bus Routes & Stop Sequence Network)
| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | VARCHAR(64) PK | e.g. `rt-del-502` |
| `route_number` | VARCHAR(64) | e.g. `502`, `203`, `C-8`, `500-D` |
| `name` | VARCHAR(255) | Descriptive title (`Mehrauli to Old Delhi Station`) |
| `origin_place_id` | VARCHAR(64) FK | References `places(id)` |
| `destination_place_id`| VARCHAR(64) FK | References `places(id)` |
| `duration_minutes` | INTEGER | Expected typical journey duration |
| `distance_km` | NUMERIC(6,2) | Route distance in kilometers |
| `route_geometry` | GEOMETRY(LineString, 4326) | Polyline path coordinates |

### `route_stops` (Sequenced Stops on Route)
| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | BIGSERIAL PK | Auto-incrementing identifier |
| `route_id` | VARCHAR(64) FK | References `routes(id)` |
| `stop_id` | VARCHAR(64) FK | References `places(id)` |
| `stop_sequence` | INTEGER | 1-indexed order along route |
| `arrival_offset_minutes`| INTEGER | Expected arrival delay from route origin |
| `distance_from_origin_km`| NUMERIC(6,2) | Cumulative distance from route start |

### `timetables` (Trip Timetables & Version History)
| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | VARCHAR(64) PK | Timetable identifier |
| `route_id` | VARCHAR(64) FK | References `routes(id)` |
| `departure_time` | TIME | Scheduled departure in Indian Standard Time (IST) |
| `arrival_time` | TIME | Scheduled destination arrival in IST |
| `version_number` | INTEGER | Incremented on every revision; old versions preserved |

### `community_submissions` (Account-Free Contributions)
| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | VARCHAR(32) PK | Reference tracking ID (`SUB-2026-9812`) |
| `submission_type` | VARCHAR(32) | `add_bus`, `add_stop`, `correct_timetable`, `report_disruption` |
| `proposed_data` | JSONB | Submitted JSON payload |
| `status` | VARCHAR(32) | `pending_review`, `approved`, `rejected`, `merged` |
| `contributor_ref_hash`| VARCHAR(64) | Anonymized token for non-account lookup |
