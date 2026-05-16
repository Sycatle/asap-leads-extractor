import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import * as schema from '../schema';
import {
  addContact,
  findContactById,
  findContactByEmail,
  findContactsByLead,
  markContacted,
  softDeleteContact,
  verifyContact,
} from './contacts';
import { insertLead } from './leads';

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
  const lead = await insertLead(db, {
    phone: '0100000099', name: 'Test Co', address: '1 rue Test', city: 'Paris',
    postalCode: '75001', mapsUrl: 'm', niche: 'plombier', status: 'nouveau', score: 50,
  });
  leadId = lead!.id;
});

describe('addContact', () => {
  it('inserts a new contact', async () => {
    const c = await addContact(db, { leadId, email: 'a@b.com', firstName: 'Jean', source: 'manual' });
    expect(c?.email).toBe('a@b.com');
    expect(c?.verifiedStatus).toBe('unverified');
  });

  it('upserts on (leadId, email) and resurrects soft-deleted', async () => {
    const c1 = await addContact(db, { leadId, email: 'dup@b.com', firstName: 'A', source: 'manual' });
    await softDeleteContact(db, c1!.id);
    const c2 = await addContact(db, { leadId, email: 'dup@b.com', firstName: 'B', source: 'pappers' });
    expect(c2?.id).toBe(c1?.id);
    expect(c2?.firstName).toBe('B');
    expect(c2?.deletedAt).toBeNull();
  });
});

describe('find', () => {
  it('findContactsByLead returns active only', async () => {
    const c1 = await addContact(db, { leadId, email: 'x@b.com', source: 'manual' });
    await addContact(db, { leadId, email: 'y@b.com', source: 'manual' });
    await softDeleteContact(db, c1!.id);
    expect(await findContactsByLead(db, leadId)).toHaveLength(1);
    expect(await findContactsByLead(db, leadId, true)).toHaveLength(2);
  });

  it('findContactByEmail across leads', async () => {
    await addContact(db, { leadId, email: 'shared@b.com', source: 'manual' });
    expect((await findContactByEmail(db, 'shared@b.com'))).toHaveLength(1);
  });

  it('findContactById returns row', async () => {
    const c = await addContact(db, { leadId, email: 'z@b.com', source: 'manual' });
    expect((await findContactById(db, c!.id))?.email).toBe('z@b.com');
  });
});

describe('mutations', () => {
  it('verifyContact updates status + timestamp', async () => {
    const c = await addContact(db, { leadId, email: 'v@b.com', source: 'manual' });
    expect(await verifyContact(db, c!.id, 'valid')).toBe(true);
    const after = await findContactById(db, c!.id);
    expect(after?.verifiedStatus).toBe('valid');
    expect(after?.verifiedAt).toBeInstanceOf(Date);
  });

  it('markContacted sets lastContactedAt', async () => {
    const c = await addContact(db, { leadId, email: 'm@b.com', source: 'manual' });
    expect(await markContacted(db, c!.id)).toBe(true);
    const after = await findContactById(db, c!.id);
    expect(after?.lastContactedAt).toBeInstanceOf(Date);
  });
});
