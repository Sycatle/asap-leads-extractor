import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import { eq } from 'drizzle-orm';
import * as schema from '../../db/schema';
import { insertLead, findById as findLeadById } from '../../db/queries/leads';
import { addContact } from '../../db/queries/contacts';
import { addPool, addSender } from '../../db/queries/senders';
import { addSequence } from '../../db/queries/sequences';
import { enrollContact, findEnrollmentById } from '../../db/queries/enrollments';
import { addLeadEmail, findLeadEmailById } from '../../db/queries/leadEmails';
import { isSuppressed } from '../../db/queries/suppression';
import { dispatchReplyAction } from './replyActions';

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
  await pool.query('TRUNCATE TABLE leads, suppression_list, sender_accounts, sender_pools, sequences RESTART IDENTITY CASCADE');
});

async function setup(opts: { contactEmail?: string } = {}) {
  const lead = await insertLead(db, {
    phone: '0100000020', name: 'Test', address: 'a', city: 'Paris',
    postalCode: '75001', mapsUrl: 'm', niche: 'plombier', status: 'nouveau', score: 50,
  });
  const contact = await addContact(db, {
    leadId: lead!.id, email: opts.contactEmail ?? 'prospect@example.com', source: 'manual',
  });
  const sender = await addSender(db, { email: 's@try.t', domain: 'try.t' });
  const pool_ = await addPool(db, { name: 'p', accountIds: [sender!.id] });
  const seq = await addSequence(db, { name: 'seq', senderPoolId: pool_!.id });
  await db.update(schema.sequences).set({ status: 'active' })
    .where(eq(schema.sequences.id, seq!.id));
  const enrollment = await enrollContact(db, {
    sequenceId: seq!.id, leadId: lead!.id, contactId: contact!.id,
  });
  const email = await addLeadEmail(db, {
    enrollmentId: enrollment!.id,
    contactId: contact!.id,
    leadId: lead!.id,
    direction: 'inbound',
    fromEmail: contact!.email,
    toEmail: 'reply@inbound.t',
    subject: 'Re: Hi',
    bodyText: 'body',
  });
  return { lead, contact, enrollment, email };
}

describe('dispatchReplyAction', () => {
  it('unsub_request → suppression + pause enrollment + opt_out consent', async () => {
    const { contact, enrollment, email } = await setup();
    await dispatchReplyAction(db, email!, {
      intent: 'unsub_request', confidence: 0.95, ooo_until: null,
      suggested_action: 'remove', summary: 'unsub',
    });
    expect(await isSuppressed(db, contact!.email)).toBe(true);
    expect((await findEnrollmentById(db, enrollment!.id))?.status).toBe('unsub');
  });

  it('positive → lead.status=qualifie + enrollment.replied', async () => {
    const { lead, enrollment, email } = await setup();
    const result = await dispatchReplyAction(db, email!, {
      intent: 'positive', confidence: 0.9, ooo_until: null,
      suggested_action: 'book call', summary: 'interested',
    });
    expect(result.leadStatusChanged).toBe('qualifie');
    expect((await findLeadById(db, lead!.id))?.status).toBe('qualifie');
    expect((await findEnrollmentById(db, enrollment!.id))?.status).toBe('replied');
  });

  it('negative → lead.status=perdu', async () => {
    const { lead, email } = await setup();
    await dispatchReplyAction(db, email!, {
      intent: 'negative', confidence: 0.9, ooo_until: null,
      suggested_action: 'drop', summary: 'not interested',
    });
    expect((await findLeadById(db, lead!.id))?.status).toBe('perdu');
  });

  it('ooo with date → enrollment paused + nextRunAt = date', async () => {
    const { enrollment, email } = await setup();
    const resumeIso = new Date(Date.now() + 21 * 24 * 3600 * 1000).toISOString();
    await dispatchReplyAction(db, email!, {
      intent: 'ooo', confidence: 0.8, ooo_until: resumeIso,
      suggested_action: 'retry later', summary: 'OOO',
    });
    const updated = await findEnrollmentById(db, enrollment!.id);
    expect(updated?.status).toBe('paused');
    expect(updated?.nextRunAt.getTime()).toBeGreaterThan(Date.now() + 10 * 24 * 3600 * 1000);
  });

  it('marks the email handled', async () => {
    const { email } = await setup();
    await dispatchReplyAction(db, email!, {
      intent: 'neutral', confidence: 0.7, ooo_until: null,
      suggested_action: 'wait', summary: 'noted',
    });
    expect((await findLeadEmailById(db, email!.id))?.handled).toBe(true);
  });
});
