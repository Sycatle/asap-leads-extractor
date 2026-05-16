import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import { eq } from 'drizzle-orm';
import * as schema from '../../db/schema';
import { addContact } from '../../db/queries/contacts';
import { addSender, addPool, setPoolAccounts } from '../../db/queries/senders';
import { addTemplate } from '../../db/queries/templates';
import { addSequence, addStep } from '../../db/queries/sequences';
import { enrollContact, findEnrollmentById } from '../../db/queries/enrollments';
import { listEventsByEnrollment } from '../../db/queries/emailEvents';
import { addSuppression, isSuppressed } from '../../db/queries/suppression';
import { insertLead, updateLead } from '../../db/queries/leads';
import { runSequenceTick } from './sequenceRunner';

const DATABASE_URL = process.env.DATABASE_URL ?? 'postgresql://leads:leads@localhost:5434/leads_test';

let pool: Pool;
let db: ReturnType<typeof drizzle<typeof schema>>;

// Mock du provider Resend : intercepte send() pour ne pas appeler l'API réelle
vi.mock('../sending/registry', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../sending/registry')>();
  return {
    ...actual,
    getProvider: () => ({
      name: 'resend' as const,
      send: vi.fn().mockResolvedValue({ messageId: 'mock-msg-' + Math.random().toString(36).slice(2) }),
      parseWebhook: vi.fn().mockReturnValue([]),
    }),
  };
});

beforeAll(async () => {
  process.env.UNSUB_TOKEN_SECRET = 'test-secret-with-enough-entropy-1234567890';
  process.env.APP_DOMAIN = 'test.local';
  pool = new Pool({ connectionString: DATABASE_URL });
  db = drizzle(pool, { schema });
  await migrate(db, { migrationsFolder: './db/migrations' });
}, 30_000);

afterAll(async () => {
  await pool?.end();
});

beforeEach(async () => {
  await pool.query('TRUNCATE TABLE leads, suppression_list RESTART IDENTITY CASCADE');
  await pool.query('TRUNCATE TABLE templates, sequences, sender_accounts, sender_pools RESTART IDENTITY CASCADE');
});

async function setupSequence(opts: { steps: Array<{ channel: 'email' | 'wait'; delayHours: number; useTemplate?: boolean }> }) {
  const lead = await insertLead(db, {
    phone: '0100000010', name: 'Test', address: 'a', city: 'Paris',
    postalCode: '75001', mapsUrl: 'm', niche: 'plombier', status: 'nouveau', score: 50,
  });
  await updateLead(db, lead!.id, { dataSource: 'Google Maps' });
  const contact = await addContact(db, {
    leadId: lead!.id, email: 'target@example.com', firstName: 'Jean', source: 'manual',
  });
  const sender = await addSender(db, {
    email: 'sales@try.test', domain: 'try.test', displayName: 'Sales Bot',
    provider: 'resend', providerConfig: { resendApiKey: 'test-key' },
    dailyLimit: 100, warmupStatus: 'ready',
  });
  const pool_ = await addPool(db, { name: 'p1', accountIds: [sender!.id] });
  const template = await addTemplate(db, {
    name: 'tpl1', subject: 'Hello {{firstName}}', bodyHtml: '<p>Hi {{firstName}}</p>', bodyText: 'Hi {{firstName}}',
  });
  const seq = await addSequence(db, { name: 's1', senderPoolId: pool_!.id });
  // set sequence to active (default is draft)
  await db.update(schema.sequences).set({ status: 'active' }).where(eq(schema.sequences.id, seq!.id));

  for (let i = 0; i < opts.steps.length; i++) {
    const s = opts.steps[i];
    await addStep(db, {
      sequenceId: seq!.id,
      order: i,
      channel: s.channel,
      delayHours: s.delayHours,
      templateId: s.channel === 'email' ? template!.id : null,
    });
  }
  const enrollment = await enrollContact(db, {
    sequenceId: seq!.id, leadId: lead!.id, contactId: contact!.id,
  });
  return { seq, contact, lead, sender, template, enrollment };
}

describe('runSequenceTick', () => {
  it('sends an email step and logs a sent event', async () => {
    const { enrollment, contact } = await setupSequence({
      steps: [{ channel: 'email', delayHours: 24 }],
    });
    const stats = await runSequenceTick(db);
    expect(stats.sent).toBe(1);

    const events = await listEventsByEnrollment(db, enrollment!.id);
    expect(events.some((e) => e.type === 'sent')).toBe(true);

    // markContacted a mis à jour lastContactedAt
    const refreshed = await db.select().from(schema.leadContacts)
      .where(eq(schema.leadContacts.id, contact!.id)).limit(1);
    expect(refreshed[0]?.lastContactedAt).toBeInstanceOf(Date);
  });

  it('skips when contact is in suppression list', async () => {
    await addSuppression(db, { email: 'blocked@example.com', reason: 'user_request' });
    const { enrollment, contact } = await setupSequence({
      steps: [{ channel: 'email', delayHours: 24 }],
    });
    // change l'email du contact pour matcher la suppression
    await db.update(schema.leadContacts).set({ email: 'blocked@example.com' })
      .where(eq(schema.leadContacts.id, contact!.id));

    const stats = await runSequenceTick(db);
    expect(stats.suppressed).toBe(1);
    expect(stats.sent).toBe(0);

    const updated = await findEnrollmentById(db, enrollment!.id);
    expect(updated?.status).toBe('unsub');
  });

  it('advances through wait step without sending', async () => {
    const { enrollment } = await setupSequence({
      steps: [
        { channel: 'wait', delayHours: 1 },
        { channel: 'email', delayHours: 0 },
      ],
    });
    const stats = await runSequenceTick(db);
    expect(stats.sent).toBe(0);
    expect(stats.skipped).toBe(1);
    const updated = await findEnrollmentById(db, enrollment!.id);
    expect(updated?.currentStep).toBe(1);
  });

  it('finishes when no more steps', async () => {
    const { enrollment } = await setupSequence({
      steps: [{ channel: 'email', delayHours: 0 }],
    });
    await runSequenceTick(db); // sends step 0
    // re-advance next run to now so tick picks it up again
    await db.update(schema.enrollments).set({ nextRunAt: new Date() })
      .where(eq(schema.enrollments.id, enrollment!.id));
    const stats2 = await runSequenceTick(db);
    expect(stats2.finished).toBe(1);
    const updated = await findEnrollmentById(db, enrollment!.id);
    expect(updated?.status).toBe('finished');
  });

  it('global suppression survives across sequences (RGPD invariant)', async () => {
    const { contact } = await setupSequence({
      steps: [{ channel: 'email', delayHours: 0 }],
    });
    await addSuppression(db, { email: contact!.email, reason: 'user_request' });
    expect(await isSuppressed(db, contact!.email)).toBe(true);
    // tick : doit refuser même si l'enrollment est techniquement active
    const stats = await runSequenceTick(db);
    expect(stats.suppressed + stats.skipped).toBeGreaterThanOrEqual(1);
    expect(stats.sent).toBe(0);
  });
});
