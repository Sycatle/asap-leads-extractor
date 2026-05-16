import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import * as schema from '../schema';
import { addContact } from './contacts';
import { findConsentByContact, logConsent } from './consent';
import { insertLead } from './leads';

const DATABASE_URL = process.env.DATABASE_URL ?? 'postgresql://leads:leads@localhost:5434/leads_test';

let pool: Pool;
let db: ReturnType<typeof drizzle<typeof schema>>;
let contactId: number;

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
  const lead = await insertLead(db, {
    phone: '0100000077', name: 'Test', address: 'a', city: 'Paris',
    postalCode: '75001', mapsUrl: 'm', niche: 'plombier', status: 'nouveau', score: 50,
  });
  const c = await addContact(db, { leadId: lead!.id, email: 'c@x.com', source: 'manual' });
  contactId = c!.id;
});

describe('consent log', () => {
  it('logs and retrieves entries in reverse chrono', async () => {
    await logConsent(db, { contactId, basis: 'legitimate_interest', evidence: 'scraped from public GMB on 2026-05-16' });
    await logConsent(db, { contactId, basis: 'opt_out_received', evidence: 'unsub link clicked' });
    const entries = await findConsentByContact(db, contactId);
    expect(entries).toHaveLength(2);
    expect(entries[0].basis).toBe('opt_out_received');
    expect(entries[1].basis).toBe('legitimate_interest');
  });
});
