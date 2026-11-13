import fs from 'fs';
import path from 'path';
import { pool } from './pool';
import { withTransaction } from './transaction';

const MIGRATIONS_DIR = path.resolve(process.cwd(), 'db', 'migrations');

/** Drops everything in the public schema (used by `npm run db:reset`). */
async function reset(): Promise<void> {
  await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  console.log('Schema reset');
}

/** Applies every db/migrations/*.sql file not yet recorded in schema_migrations, in name order. */
export async function migrate(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name        TEXT PRIMARY KEY,
      applied_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    )`);

  const { rows } = await pool.query<{ name: string }>('SELECT name FROM schema_migrations');
  const applied = new Set(rows.map((r) => r.name));

  const files = fs.readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).sort();

  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');

    // Each migration is atomic: either the whole file applies or nothing does.
    await withTransaction(async (client) => {
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
    });
    console.log(`Applied migration ${file}`);
  }
  console.log('Migrations up to date');
}

if (require.main === module) {
  (async () => {
    if (process.argv.includes('--reset')) await reset();
    await migrate();
  })()
    .then(() => pool.end())
    .catch(async (err) => {
      console.error('Migration failed:', err);
      await pool.end();
      process.exit(1);
    });
}
