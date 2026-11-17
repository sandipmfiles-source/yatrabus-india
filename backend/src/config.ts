export const CONFIG = {
  PORT: process.env.PORT ? parseInt(process.env.PORT, 10) : 5000,
  // Set only to the exact number of trusted reverse-proxy hops in production.
  // Defaults to 0 so arbitrary client-supplied X-Forwarded-For headers are ignored.
  TRUST_PROXY_HOPS: Number.isInteger(Number(process.env.TRUST_PROXY_HOPS)) && Number(process.env.TRUST_PROXY_HOPS) >= 0
    ? Number(process.env.TRUST_PROXY_HOPS)
    : 0,
  NODE_ENV: process.env.NODE_ENV || 'development',
  CORS_ALLOWED_ORIGINS: (process.env.CORS_ALLOWED_ORIGINS || (process.env.NODE_ENV === 'production' ? '' : 'http://localhost:3000,http://127.0.0.1:3000,http://localhost:5173,http://127.0.0.1:5173,https://localhost')).split(',').map(value => value.trim()).filter(Boolean),
  ADMIN_EMAIL: (process.env.ADMIN_EMAIL || '').trim().toLowerCase(),
  ADMIN_PASSWORD_HASH: process.env.ADMIN_PASSWORD_HASH || '',
  ADMIN_JWT_SECRET: process.env.ADMIN_JWT_SECRET || '',
  ADMIN_SESSION_TTL_SECONDS: 8 * 60 * 60,
  MAX_JOURNEY_SESSION_HOURS: 12,
  GPS_ACCURACY_THRESHOLD_METERS: 100,
  GPS_FRESHNESS_LIVE_SECONDS: 120,
  GPS_FRESHNESS_STALE_SECONDS: 600,
  MIN_SPEED_KMPH: 2,
  MAX_SPEED_KMPH: 110,
};
