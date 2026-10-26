import { dataStore, DataStore } from './dataStore';

/**
 * Universal Database Connection Layer
 * Supports Production PostgreSQL / PostGIS with zero-config in-memory fallback
 * Ensures ₹0 local development and reliable unit testing without requiring live Postgres.
 */

let pgPool: any = null;
let isPostgresConnected = false;

export async function initDatabase(): Promise<{ type: 'postgres' | 'embedded'; connected: boolean }> {
  const dbUrl = process.env.DATABASE_URL;

  if (dbUrl && dbUrl !== 'embedded' && !dbUrl.includes('placeholder')) {
    try {
      const { Pool } = await import('pg');
      pgPool = new Pool({
        connectionString: dbUrl,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
        connectionTimeoutMillis: 5000
      });

      const client = await pgPool.connect();
      await client.query('SELECT 1');
      client.release();

      isPostgresConnected = true;
      console.log('✅ PostgreSQL / PostGIS database connected successfully.');
      return { type: 'postgres', connected: true };
    } catch (err: any) {
      console.warn(`⚠️ PostgreSQL connection failed (${err.message}). Falling back to high-performance embedded DataStore.`);
      isPostgresConnected = false;
    }
  } else {
    console.log('ℹ️ Running on embedded zero-cost DataStore engine (DATABASE_URL not configured).');
  }

  return { type: 'embedded', connected: true };
}

export function getDatabasePool(): any {
  return pgPool;
}

export function isUsingPostgres(): boolean {
  return isPostgresConnected;
}

export function getDataStore(): DataStore {
  return dataStore;
}
