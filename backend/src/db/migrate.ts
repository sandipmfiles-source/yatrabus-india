import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { initDatabase, getDatabasePool, isUsingPostgres } from './db';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function runMigrations(): Promise<void> {
  await initDatabase();

  if (!isUsingPostgres()) {
    console.log('ℹ️ Embedded DataStore active. Initial schema and seed data are already populated in-memory.');
    return;
  }

  const pool = getDatabasePool();
  if (!pool) return;

  const migrationsDir = path.resolve(__dirname, '../../migrations');
  if (!fs.existsSync(migrationsDir)) {
    console.warn(`Migrations directory not found at ${migrationsDir}`);
    return;
  }

  const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();
  console.log(`Found ${files.length} SQL migration files.`);

  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version VARCHAR(255) PRIMARY KEY,
        applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    for (const file of files) {
      const res = await client.query('SELECT version FROM schema_migrations WHERE version = $1', [file]);
      if (res.rows.length === 0) {
        console.log(`Applying migration: ${file}...`);
        const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (version) VALUES ($1)', [file]);
        await client.query('COMMIT');
        console.log(`✅ Applied migration: ${file}`);
      } else {
        console.log(`Migration already applied: ${file}`);
      }
    }
  } catch (err: any) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', err);
    throw err;
  } finally {
    client.release();
  }
}

// Allow standalone execution via `node backend/src/db/migrate.ts` or `tsx`
if (process.argv[1] && process.argv[1].endsWith('migrate.ts')) {
  runMigrations()
    .then(() => {
      console.log('Migration runner finished.');
      process.exit(0);
    })
    .catch(err => {
      console.error('Migration runner failed:', err);
      process.exit(1);
    });
}
