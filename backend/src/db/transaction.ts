import { PoolClient } from 'pg';
import { pool } from './pool';

/** One line of a recorded transaction, in the order PostgreSQL saw it. */
export interface TxStep {
  kind: 'tx' | 'sql' | 'trigger' | 'error';
  text: string;
}

export interface TxRecord {
  id: number;
  name: string;
  orderIds: number[];
  startedAt: string;
  ms: number;
  outcome: 'COMMIT' | 'ROLLBACK';
  steps: TxStep[];
}

// Recent order transactions, kept in memory so the order page can show them.
const recent: TxRecord[] = [];
let nextId = 1;

export function transactionsForOrder(orderId: number): TxRecord[] {
  return recent.filter((tx) => tx.orderIds.includes(orderId));
}

const shortValue = (value: unknown) => {
  const text = String(value);
  return text.length > 40 ? `${text.slice(0, 37)}...` : text;
};

function describeError(err: unknown): string {
  const e = err as { message?: string; code?: string; where?: string };
  if (e.code === 'P0001') {
    const fn = /function (\w+)\(/.exec(e.where ?? '')?.[1] ?? 'trigger';
    return `Trigger ${fn} raised: ${e.message}`;
  }
  return `Error: ${e.message ?? String(err)}`;
}

/**
 * Runs `work` inside one database transaction, written by hand:
 *   BEGIN -> work(client) -> COMMIT   (or ROLLBACK if anything throws)
 *
 * All queries in `work` must use the given `client`: a transaction belongs to
 * a single connection, so using `pool.query` inside would run outside it.
 *
 * Every statement, every trigger NOTICE and the final COMMIT/ROLLBACK are
 * recorded under `name` for the orders in `orderIds` (a list, or a function
 * of the result for orders that only get an id inside the transaction).
 */
export async function withTransaction<T>(
  work: (client: PoolClient) => Promise<T>,
  name = 'transaction',
  orderIds: number[] | ((result: T) => number[]) = [],
): Promise<T> {
  const client = await pool.connect();
  const steps: TxStep[] = [];
  const startedAt = new Date();
  let outcome: TxRecord['outcome'] = 'ROLLBACK';
  let result: T | undefined;

  // Record each statement sent on this connection, and each trigger notice it gets back.
  const query = client.query;
  const send = query as (this: PoolClient, text: string, values?: unknown[]) => Promise<unknown>;
  client.query = ((text: string, values?: unknown[]) => {
    const kind = /^(BEGIN|COMMIT|ROLLBACK)$/.test(text) ? 'tx' : 'sql';
    const params = values?.length ? `  [${values.map(shortValue).join(', ')}]` : '';
    steps.push({ kind, text: text.replace(/\s+/g, ' ').trim() + params });
    return send.call(client, text, values);
  }) as typeof client.query;
  const onNotice = (notice: { message?: string }) => steps.push({ kind: 'trigger', text: notice.message ?? '' });
  client.on('notice', onNotice);

  try {
    await client.query('BEGIN');
    result = await work(client);
    await client.query('COMMIT');
    outcome = 'COMMIT';
    return result;
  } catch (err) {
    steps.push({ kind: 'error', text: describeError(err) });
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.off('notice', onNotice);
    client.query = query;
    client.release();

    const ids = typeof orderIds === 'function' ? (outcome === 'COMMIT' ? orderIds(result as T) : []) : orderIds;
    if (ids.length) {
      recent.push({
        id: nextId++,
        name,
        orderIds: ids,
        startedAt: startedAt.toISOString(),
        ms: Date.now() - startedAt.getTime(),
        outcome,
        steps,
      });
      if (recent.length > 300) recent.shift();
    }
  }
}
