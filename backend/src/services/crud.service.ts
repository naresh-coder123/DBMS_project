import { QueryResultRow } from 'pg';
import { pool } from '../db/pool';
import { AppError } from '../utils/AppError';

export interface CrudConfig {
  table: string;
  idColumn: string;
  entityName: string;
  /** Columns usable as equality filters in list(). */
  filterable?: readonly string[];
  /** ORDER BY clause for list(); defaults to the id column ascending. */
  orderBy?: string;
}

export interface ListOptions {
  limit: number;
  offset: number;
  filters?: Record<string, unknown>;
}

export interface CrudService<T> {
  list(opts: ListOptions): Promise<T[]>;
  getById(id: number): Promise<T>;
}

/**
 * Builds plain-SQL reads for a single table.
 * Table/column names come only from the config whitelist; all values are bound
 * as $1, $2, ... parameters, so request data can never inject SQL.
 */
export function createCrudService<T extends QueryResultRow>(cfg: CrudConfig): CrudService<T> {
  const { table, idColumn, entityName } = cfg;

  return {
    async list({ limit, offset, filters = {} }) {
      const where: string[] = [];
      const params: unknown[] = [];

      for (const col of cfg.filterable ?? []) {
        if (filters[col] !== undefined) {
          params.push(filters[col]);
          where.push(`${col} = $${params.length}`);
        }
      }
      params.push(limit, offset);

      const sql = `
        SELECT * FROM ${table}
        ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
        ORDER BY ${cfg.orderBy ?? idColumn}
        LIMIT $${params.length - 1} OFFSET $${params.length}`;
      const { rows } = await pool.query<T>(sql, params);
      return rows;
    },

    async getById(id) {
      const { rows } = await pool.query<T>(`SELECT * FROM ${table} WHERE ${idColumn} = $1`, [id]);
      if (!rows[0]) throw AppError.notFound(entityName, id);
      return rows[0];
    },
  };
}
