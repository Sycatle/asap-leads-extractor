import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import { sql } from 'drizzle-orm';
import * as schema from '../../db/schema';
import { addContact, findContactById } from '../../db/queries/contacts';
import { isSuppressed } from '../../db/queries/suppression';
import { insertLead } from '../../db/queries/leads';
import { runPurge } from './purge';

const DATABASE_URL = process.env.DATABASE_URL ?? 'postgresql://leads:leads@localhost:5434/leads_test';

let pool: Pool;
let db: ReturnType<typeof drizzle<typeof schema>>;
let leadId: number;

beforeAll(async () => {
  pool = new Pool({ connectionString: DATABASE_URL });
  db = drizzle(pool, { schema });
  await migrate(db, { migrationsFolder: './db/migrations' });
}, 30_000);

afterAll(async () => {
  await pool?.end();
});

beforeEach(async () => {
  await pool.query('TRUNCATE TABLE leads RESTART IDENTITY CASCADE');
  await pool.query('TRUNCATE TABLE suppression_list');
  const lead = await insertLead(db, {
    phone: '0100000050', name: 'Test', address: 'a', city: 'Paris',
    postalCode: '75001', mapsUrl: 'm', niche: 'plombier', status: 'nouveau', score: 50,
  });
  leadId = lead!.id;
});

async function setCollectedAtYearsAgo(contactId: number, years: number) {
  await db
    .update(schema.leadContacts)
    .set({ collectedAt: sql`now() - make_interval(years => ${years})` })
    .where(sql`${schema.leadContacts.id} = ${contactId}`);
}

describe('runPurge', () => {
  it('dry-run by default, returns candidates without modifying', async () => {
    const c = await addContact(db, { leadId, email: 'old@x.com', source: 'manual' });
    await setCollectedAtYearsAgo(c!.id, 4);
    const result = await runPurge(db);
    expect(result.candidates).toBe(1);
    expect(result.purged).toBe(0);
    expect(result.dryRun).toBe(true);
    expect((await findContactById(db, c!.id))?.deletedAt).toBeNull();
    expect(await isSuppressed(db, 'old@x.com')).toBe(false);
  });

  it('applies: soft-deletes + adds to suppression list', async () => {
    const cOld = await addContact(db, { leadId, email: 'old@x.com', source: 'manual' });
    const cRecent = await addContact(db, { leadId, email: 'recent@x.com', source: 'manual' });
    await setCollectedAtYearsAgo(cOld!.id, 4);
    // recent reste à now() — ne devrait pas être purgé
    const result = await runPurge(db, { apply: true });
    expect(result.candidates).toBe(1);
    expect(result.purged).toBe(1);
    expect(result.suppressed).toBe(1);
    expect((await findContactById(db, cOld!.id))?.deletedAt).toBeInstanceOf(Date);
    expect((await findContactById(db, cRecent!.id))?.deletedAt).toBeNull();
    expect(await isSuppressed(db, 'old@x.com')).toBe(true);
  });

  it('respects custom retention window', async () => {
    const c = await addContact(db, { leadId, email: '1y@x.com', source: 'manual' });
    await setCollectedAtYearsAgo(c!.id, 1);
    expect((await runPurge(db, { retentionYears: 3 })).candidates).toBe(0);
    expect((await runPurge(db, { retentionYears: 1 })).candidates).toBe(1);
  });
});
