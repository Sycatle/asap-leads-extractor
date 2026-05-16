import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import * as schema from '../schema';
import {
  addSuppression,
  bulkImport,
  filterSuppressed,
  isSuppressed,
  listSuppressions,
  removeSuppression,
} from './suppression';

const DATABASE_URL = process.env.DATABASE_URL ?? 'postgresql://leads:leads@localhost:5434/leads_test';

let pool: Pool;
let db: ReturnType<typeof drizzle<typeof schema>>;

beforeAll(async () => {
  pool = new Pool({ connectionString: DATABASE_URL });
  db = drizzle(pool, { schema });
  await migrate(db, { migrationsFolder: './db/migrations' });
}, 30_000);

afterAll(async () => {
  await pool?.end();
});

beforeEach(async () => {
  await pool.query('TRUNCATE TABLE suppression_list');
});

describe('isSuppressed', () => {
  it('returns false for unknown email', async () => {
    expect(await isSuppressed(db, 'unknown@x.com')).toBe(false);
  });

  it('returns true after addSuppression (case-insensitive)', async () => {
    await addSuppression(db, { email: 'Foo@Bar.com', reason: 'user_request' });
    expect(await isSuppressed(db, 'foo@bar.com')).toBe(true);
    expect(await isSuppressed(db, 'FOO@BAR.COM')).toBe(true);
  });
});

describe('addSuppression', () => {
  it('is idempotent on duplicate email', async () => {
    const a = await addSuppression(db, { email: 'd@x.com', reason: 'user_request' });
    const b = await addSuppression(db, { email: 'd@x.com', reason: 'manual' });
    expect(a?.email).toBe('d@x.com');
    expect(b).toBeNull(); // onConflictDoNothing
    expect((await listSuppressions(db))).toHaveLength(1);
  });
});

describe('bulkImport', () => {
  it('inserts only new emails', async () => {
    await addSuppression(db, { email: 'existing@x.com', reason: 'manual' });
    const inserted = await bulkImport(db, [
      { email: 'existing@x.com', reason: 'manual' },
      { email: 'new1@x.com', reason: 'manual' },
      { email: 'NEW2@x.com', reason: 'manual' },
    ]);
    expect(inserted).toBe(2);
    expect(await isSuppressed(db, 'new2@x.com')).toBe(true);
  });
});

describe('filterSuppressed', () => {
  it('returns subset of suppressed', async () => {
    await bulkImport(db, [
      { email: 'a@x.com', reason: 'manual' },
      { email: 'c@x.com', reason: 'manual' },
    ]);
    const set = await filterSuppressed(db, ['a@x.com', 'b@x.com', 'C@X.com']);
    expect(set.has('a@x.com')).toBe(true);
    expect(set.has('c@x.com')).toBe(true);
    expect(set.has('b@x.com')).toBe(false);
  });

  it('empty input returns empty set without query', async () => {
    expect((await filterSuppressed(db, [])).size).toBe(0);
  });
});

describe('removeSuppression', () => {
  it('deletes existing entry', async () => {
    await addSuppression(db, { email: 'r@x.com', reason: 'manual' });
    expect(await removeSuppression(db, 'r@x.com')).toBe(true);
    expect(await isSuppressed(db, 'r@x.com')).toBe(false);
  });

  it('returns false for unknown', async () => {
    expect(await removeSuppression(db, 'nope@x.com')).toBe(false);
  });
});
