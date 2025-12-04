import { Pool } from 'pg';
import { config } from '../config/env';

const isTest = process.env.NODE_ENV === 'test' || process.env.VITEST_WORKER_ID !== undefined;

type QueryResult<T> = { rows: T[] };

class InMemoryPool {
  async query<T>(_text: string, _params?: Array<string | number | null>): Promise<QueryResult<T>> {
    // Return empty result by default; specific services may mock at higher level
    return { rows: [] } as QueryResult<T>;
  }
  async connect() {
    return {
      release() {}
    } as any;
  }
}

export const pool: Pool | InMemoryPool = isTest
  ? new InMemoryPool()
  : new Pool({
      connectionString: config.databaseUrl,
      max: 50, // Increased from 20 for better concurrency
      min: 10, // Keep minimum connections alive
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000, // Fail fast if no connection available
      allowExitOnIdle: false, // Keep pool alive
      statement_timeout: 30_000, // 30s query timeout
    });

export async function query<T = unknown>(text: string, params?: Array<string | number | null>): Promise<T[]> {
  const result = (await (pool as any).query(text, params)) as QueryResult<T>;
  return result.rows;
}

export async function getClient() {
  return (pool as any).connect();
}
