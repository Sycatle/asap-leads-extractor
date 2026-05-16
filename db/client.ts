/**
 * Drizzle Postgres client - singleton partagé entre worker et web.
 *
 * Lit DATABASE_URL depuis l'environnement. Si non défini, fallback sur
 * la conf locale par défaut (postgresql://leads:leads@localhost:5432/leads).
 */

import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

const DATABASE_URL = process.env.DATABASE_URL ?? 'postgresql://leads:leads@localhost:5432/leads';

let pool: Pool | null = null;
let dbInstance: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: DATABASE_URL,
      max: Number(process.env.DATABASE_POOL_SIZE ?? 10),
      idleTimeoutMillis: 30_000,
    });
  }
  return pool;
}

export function getDb() {
  if (!dbInstance) {
    dbInstance = drizzle(getPool(), { schema });
  }
  return dbInstance;
}

export async function closeDb(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    dbInstance = null;
  }
}

export type DbClient = ReturnType<typeof getDb>;
export { schema };
