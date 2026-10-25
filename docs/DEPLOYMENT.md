# YatriBus Production Deployment Guide (₹0 Cost Tier)

This deployment architecture is tailored for Indian municipal transit authorities, community cooperatives, and open-source deployments running on a ₹0 initial infrastructure budget.

---

## 1. ₹0 Cloud Infrastructure Stack

| Component | Recommended Free Tier Service | Limits / Free Quota |
|---|---|---|
| **Database** | Neon.tech or Supabase PostgreSQL + PostGIS | 500 MB storage, PostGIS extensions included |
| **Backend API** | Render / Railway / Fly.io | 750 free compute hours/month |
| **Frontend Web** | Vercel or Cloudflare Pages | Unlimited bandwidth & HTTPS |
| **Map Tiles** | OpenStreetMap Standard Tiles | Free open-source tier with proper attribution |
| **Android APK CI** | GitHub Actions | 2,000 free minutes/month for APK compilation |

---

## 2. Environment Variables Checklist

Set these environment variables in your deployment dashboard:

```env
NODE_ENV=production
PORT=5000
DATABASE_URL=postgresql://[user]:[password]@[host]:5432/[database]?sslmode=require
DATABASE_SSL=true
USE_EMBEDDED_SQLITE=false

ADMIN_JWT_SECRET=generate_a_random_secure_64_character_hex_key
ADMIN_SESSION_EXPIRY_HOURS=24
INITIAL_ADMIN_EMAIL=admin@yatribus.in
INITIAL_ADMIN_PASSWORD=strong_production_password_here

MAX_JOURNEY_SESSION_HOURS=12
GPS_ACCURACY_THRESHOLD_METERS=100
GPS_FRESHNESS_LIVE_SECONDS=120
GPS_FRESHNESS_STALE_SECONDS=600

RATE_LIMIT_PUBLIC_WINDOW_MS=900000
RATE_LIMIT_PUBLIC_MAX_REQUESTS=300
RATE_LIMIT_CONTRIBUTION_MAX_HOURLY=15
```

---

## 3. Database Migration Deployment

Once PostgreSQL with PostGIS is provisioned:
```bash
psql $DATABASE_URL -f backend/migrations/001_initial_schema.sql
psql $DATABASE_URL -f backend/migrations/002_postgis_indexes.sql
psql $DATABASE_URL -f backend/migrations/003_community_and_tracking.sql
psql $DATABASE_URL -f backend/migrations/004_admin_automation.sql
```

---

## 4. Backup & Disaster Recovery

Run automated daily logical backups using `pg_dump`:
```bash
pg_dump -Fc --no-acl --no-owner -h [host] -U [user] [database] > yatribus_backup_$(date +%F).dump
```

To restore from a backup archive:
```bash
pg_restore -d [database] -c yatribus_backup_YYYY-MM-DD.dump
```
