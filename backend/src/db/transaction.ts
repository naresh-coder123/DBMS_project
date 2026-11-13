import { PoolClient } from 'pg';
import { pool } from './pool';

/**
 * Runs `work` inside one database transaction, written by hand:
 *   BEGIN -> work(client) -> COMMIT   (or ROLLBACK if anything throws)
 *
 * All queries in `work` must use the given `client`: a transaction belongs to
 * a single connection, so using `pool.query` inside would run outside it.
 */
export async function withTransaction<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
