import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import * as schema from '../../db/schema';
import { addSender, findSenderById } from '../../db/queries/senders';
import { logEmailEvent } from '../../db/queries/emailEvents';
import { aggregateSenderHealthForDay, listSendersAtRisk } from '../../db/queries/senderHealth';
import { runSenderHealthAggregation } from './senderHealth';

const DATABASE_URL = process.env.DATABASE_URL ?? 'postgresql://leads:leads@localhost:5434/leads_test';

let pool: Pool;
let db: ReturnType<typeof drizzle<typeof schema>>;
let senderId: number;

beforeAll(async () => {
  pool = new Pool({ connectionString: DATABASE_URL });
  db = drizzle(pool, { schema });
  await migrate(db, { migrationsFolder: './db/migrations' });
}, 30_000);

afterAll(async () => {
  await pool?.end();
});

beforeEach(async () => {
  await pool.query('TRUNCATE TABLE sender_accounts, sender_health_daily, email_events RESTART IDENTITY CASCADE');
  const s = await addSender(db, {
    email: 's@t.com', domain: 't.com', provider: 'resend',
    providerConfig: { resendApiKey: 'k' }, dailyLimit: 100, warmupStatus: 'ready',
  });
  senderId = s!.id;
});

async function logEvent(type: schema.EmailEvent['type'], offsetMs = 0) {
  await logEmailEvent(db, {
    senderAccountId: senderId,
    type,
    messageId: 'm' + Math.random(),
  });
  if (offsetMs) {
    // antidatage de l'event si besoin
    await db.execute({
      sql: `UPDATE email_events SET at = at + interval '${offsetMs} milliseconds'`,
      args: [],
    } as never).catch(() => {});
  }
}

describe('aggregateSenderHealthForDay', () => {
  it('computes rates in basis points', async () => {
    for (let i = 0; i < 100; i++) await logEvent('sent');
    for (let i = 0; i < 95; i++) await logEvent('delivered');
    for (let i = 0; i < 5; i++) await logEvent('bounce');
    for (let i = 0; i < 50; i++) await logEvent('open');
    const date = new Date().toISOString().slice(0, 10);
    const row = await aggregateSenderHealthForDay(db, senderId, date);
    expect(row?.sent).toBe(100);
    expect(row?.delivered).toBe(95);
    expect(row?.bounced).toBe(5);
    expect(row?.bounceRateBps).toBe(500); // 5/100 = 5.00 %
    expect(row?.openRateBps).toBe(Math.round((50 / 95) * 10000));
  });

  it('flags alert when bounce > 3%', async () => {
    for (let i = 0; i < 100; i++) await logEvent('sent');
    for (let i = 0; i < 4; i++) await logEvent('bounce'); // 4 %
    const row = await aggregateSenderHealthForDay(db, senderId, new Date().toISOString().slice(0, 10));
    expect(row?.alertFlag).toBe(true);
  });

  it('does not alert with low signal (sent < 5)', async () => {
    for (let i = 0; i < 3; i++) await logEvent('sent');
    for (let i = 0; i < 1; i++) await logEvent('bounce'); // 33 % mais < 5 sent
    const row = await aggregateSenderHealthForDay(db, senderId, new Date().toISOString().slice(0, 10));
    expect(row?.alertFlag).toBe(false);
  });

  it('upserts on same (sender, date)', async () => {
    for (let i = 0; i < 10; i++) await logEvent('sent');
    const date = new Date().toISOString().slice(0, 10);
    await aggregateSenderHealthForDay(db, senderId, date);
    for (let i = 0; i < 5; i++) await logEvent('sent');
    const row2 = await aggregateSenderHealthForDay(db, senderId, date);
    expect(row2?.sent).toBe(15);
  });
});

describe('runSenderHealthAggregation', () => {
  it('auto-pauses on spam complaint above threshold', async () => {
    for (let i = 0; i < 200; i++) await logEvent('sent');
    for (let i = 0; i < 200; i++) await logEvent('delivered');
    for (let i = 0; i < 2; i++) await logEvent('complaint'); // 2/200 = 1 % >> 0.1 %
    const result = await runSenderHealthAggregation(db);
    expect(result.alerts).toBe(1);
    expect(result.paused).toBe(1);
    const after = await findSenderById(db, senderId);
    expect(after?.warmupStatus).toBe('paused');
  });

  it('listSendersAtRisk surfaces alert flag', async () => {
    for (let i = 0; i < 100; i++) await logEvent('sent');
    for (let i = 0; i < 5; i++) await logEvent('bounce'); // 5 %
    await runSenderHealthAggregation(db);
    const risk = await listSendersAtRisk(db, 2);
    expect(risk).toHaveLength(1);
  });
});
