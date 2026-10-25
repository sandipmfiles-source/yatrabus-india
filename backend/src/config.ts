export const CONFIG = {
  PORT: process.env.PORT ? parseInt(process.env.PORT, 10) : 5000,
  NODE_ENV: process.env.NODE_ENV || 'development',
  ADMIN_JWT_SECRET: process.env.ADMIN_JWT_SECRET || 'yatribus_super_secret_dev_key_12345',
  MAX_JOURNEY_SESSION_HOURS: 12,
  GPS_ACCURACY_THRESHOLD_METERS: 100,
  GPS_FRESHNESS_LIVE_SECONDS: 120,
  GPS_FRESHNESS_STALE_SECONDS: 600,
  MIN_SPEED_KMPH: 2,
  MAX_SPEED_KMPH: 110,
};
