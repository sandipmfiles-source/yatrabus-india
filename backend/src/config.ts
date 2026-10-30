export const CONFIG = {
  PORT: process.env.PORT ? parseInt(process.env.PORT, 10) : 5000,
  NODE_ENV: process.env.NODE_ENV || 'development',
  ADMIN_JWT_SECRET: process.env.ADMIN_JWT_SECRET || 'development-only-change-this-secret-before-deploying-123456',
  INITIAL_ADMIN_EMAIL: process.env.INITIAL_ADMIN_EMAIL || 'admin@yatribus.in',
  INITIAL_ADMIN_PASSWORD: process.env.INITIAL_ADMIN_PASSWORD || '',
  MAX_JOURNEY_SESSION_HOURS: 12,
  GPS_ACCURACY_THRESHOLD_METERS: 100,
  GPS_FRESHNESS_LIVE_SECONDS: 120,
  GPS_FRESHNESS_STALE_SECONDS: 600,
  MIN_SPEED_KMPH: 2,
  MAX_SPEED_KMPH: 110,
};

if (CONFIG.NODE_ENV === 'production' && (!process.env.ADMIN_JWT_SECRET || process.env.ADMIN_JWT_SECRET.length < 32)) {
  throw new Error('ADMIN_JWT_SECRET must be configured with at least 32 characters in production.');
}
