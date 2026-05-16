import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import { eq, sql } from 'drizzle-orm';
import * as schema from '../../db/schema';
import { addSender, findSenderById } from '../../db/queries/senders';
import { runWarmupRamp, targetForWeek } from './warmupRamp';

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
  await pool.query('TRUNCATE TABLE sender_accounts RESTART IDENTITY CASCADE');
});

describe('targetForWeek', () => {
  it('week 0 → 5/warming, week 4 → 100/ready', () => {
    expect(targetForWeek(0)).toEqual({ dailyLimit: 5, status: 'warming' });
    expect(targetForWeek(1)).toEqual({ dailyLimit: 10, status: 'warming' });
    expect(targetForWeek(2)).toEqual({ dailyLimit: 20, status: 'warming' });
    expect(targetForWeek(3)).toEqual({ dailyLimit: 50, status: 'warming' });
    expect(targetForWeek(4)).toEqual({ dailyLimit: 100, status: 'ready' });
    expect(targetForWeek(99)).toEqual({ dailyLimit: 100, status: 'ready' });
  });
});

describe('runWarmupRamp', () => {
  it('skips ready and paused senders', async () => {
    await addSender(db, { email: 'a@t.com', domain: 't.com', warmupStatus: 'ready', dailyLimit: 100 });
    await addSender(db, { email: 'b@t.com', domain: 't.com', warmupStatus: 'paused', dailyLimit: 50 });
    const r = await runWarmupRamp(db);
    expect(r.inspected).toBe(0);
  });

  it('promotes warming sender at week 4', async () => {
    const s = await addSender(db, {
      email: 'c@t.com', domain: 't.com', warmupStatus: 'warming', dailyLimit: 5,
    });
    // simule 30 jours en arrière
    await db
      .update(schema.senderAccounts)
      .set({ warmupStartedAt: sql`now() - interval '30 days'` })
      .where(eq(schema.senderAccounts.id, s!.id));
    const r = await runWarmupRamp(db);
    expect(r.promoted).toBe(1);
    const after = await findSenderById(db, s!.id);
    expect(after?.warmupStatus).toBe('ready');
    expect(after?.dailyLimit).toBe(100);
  });

  it('initialises warmupStartedAt if null', async () => {
    const s = await addSender(db, {
      email: 'd@t.com', domain: 't.com', warmupStatus: 'warming', dailyLimit: 5,
    });
    await runWarmupRamp(db);
    const after = await findSenderById(db, s!.id);
    expect(after?.warmupStartedAt).toBeInstanceOf(Date);
  });

  it('ramps progressively (week 2 → 20)', async () => {
    const s = await addSender(db, {
      email: 'e@t.com', domain: 't.com', warmupStatus: 'warming', dailyLimit: 5,
    });
    await db
      .update(schema.senderAccounts)
      .set({ warmupStartedAt: sql`now() - interval '14 days'` })
      .where(eq(schema.senderAccounts.id, s!.id));
    await runWarmupRamp(db);
    const after = await findSenderById(db, s!.id);
    expect(after?.dailyLimit).toBe(20);
    expect(after?.warmupStatus).toBe('warming');
  });
});
