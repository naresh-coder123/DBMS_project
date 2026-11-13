import { Pool } from 'pg';
import { env } from '../config/env';

export const pool = new Pool({ connectionString: env.databaseUrl, max: 10 });

pool.on('error', (err) => {
  console.error('Unexpected idle PostgreSQL client error', err);
});
