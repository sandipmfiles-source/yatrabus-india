# YatraBus India: Deployment Guide (₹0 Budget Strategy)

This guide documents how to deploy **YatraBus India** on free-tier hosting platforms without recurring expenses.

---

## 1. Zero-Cost Hosting Architecture Options

| Component | Recommended Free Provider | Quota / Free Tier Specs |
| :--- | :--- | :--- |
| **Frontend Web App** | Vercel / Cloudflare Pages / Netlify | Unlimited free bandwidth, custom domain, automatic HTTPS |
| **Backend REST API** | Render / Railway / Fly.io | 512 MB RAM, free web service tier |
| **Database** | Neon.tech / Supabase / Embedded Store | 0.5 GB Postgres with PostGIS extension (Free forever) |
| **Map Tiles** | OpenStreetMap / Carto Free | Free public attribution policy |
| **Android APK Build** | GitHub Actions | 2,000 free build minutes/month for public repositories |

---

## 2. Deploying the Frontend (Vercel / Cloudflare)
1. Fork or push this repository to GitHub.
2. Sign in to [Vercel](https://vercel.com/) and click **Add New Project**.
3. Select your repository.
4. Set Build Settings:
   - Framework Preset: **Vite**
   - Build Command: `npm run build`
   - Output Directory: `dist`
5. Click **Deploy**. Your progressive web app will be live on an HTTPS domain within 60 seconds.

---

## 3. Deploying the Backend API (Render)
1. In [Render](https://render.com/), create a new **Web Service**.
2. Connect your GitHub repository.
3. Set:
   - Runtime: **Node**
   - Build Command: `npm run build`
   - Start Command: `node backend/src/server.ts`
4. Set Environment Variables:
   - `PORT`: `3000`
   - `NODE_ENV`: `production`
   - `ADMIN_SECRET_KEY`: `<set-a-strong-random-key>`

---

## 4. Connecting PostgreSQL + PostGIS (Optional Production Database)
If you wish to use managed PostgreSQL instead of the embedded zero-cost local repository:
1. Create a free PostgreSQL instance on [Neon](https://neon.tech/) or [Supabase](https://supabase.com/).
2. Run the migration script:
   ```bash
   psql -U postgres -d indiabus_db -f backend/migrations/001_initial_schema.sql
   ```
3. Set the `DATABASE_URL` environment variable in your backend settings:
   ```
   DATABASE_URL=postgresql://user:pass@host:5432/indiabus_db
   ```
