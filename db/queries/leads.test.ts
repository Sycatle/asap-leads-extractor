import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import * as schema from '../schema';
import {
  countLeads,
  findById,
  findLeads,
  findLeadsAdvanced,
  getDistinctCities,
  getDistinctNiches,
  getExistingPhones,
  insertLead,
  logCall,
  markOptOut,
  restoreLead,
  scheduleFollowup,
  softDeleteLead,
  updateStatus,
} from './leads';

// Tests requièrent un Postgres disponible (DATABASE_URL ou défaut docker compose).
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
  // Reset complet entre tests pour isoler les états
  await pool.query('TRUNCATE TABLE leads RESTART IDENTITY CASCADE');

  await insertLead(db, {
    phone: '0100000001', name: 'A Plomberie', address: '1 rue A', city: 'Paris',
    postalCode: '75001', mapsUrl: 'm1', niche: 'plombier', status: 'nouveau', score: 80,
  });
  await insertLead(db, {
    phone: '0100000002', name: 'B Plomberie', address: '2 rue B', city: 'Paris',
    postalCode: '75002', mapsUrl: 'm2', niche: 'plombier', status: 'contacte', score: 50,
  });
  await insertLead(db, {
    phone: '0100000003', name: 'C Élec', address: '3 rue C', city: 'Lyon',
    postalCode: '69001', mapsUrl: 'm3', niche: 'electricien', status: 'nouveau', score: 30,
  });
});

describe('findLeads', () => {
  it('returns all non-deleted leads by default', async () => {
    expect(await findLeads(db)).toHaveLength(3);
  });

  it('filters by city', async () => {
    const results = await findLeads(db, { city: 'Paris' });
    expect(results).toHaveLength(2);
    expect(results.every((l) => l.city === 'Paris')).toBe(true);
  });

  it('filters by niche', async () => {
    expect(await findLeads(db, { niche: 'electricien' })).toHaveLength(1);
  });

  it('filters by status', async () => {
    expect(await findLeads(db, { status: 'nouveau' })).toHaveLength(2);
  });

  it('hides soft-deleted leads', async () => {
    const all = await findLeads(db);
    await softDeleteLead(db, all[0].id);
    expect(await findLeads(db)).toHaveLength(2);
  });

  it('parameterized search resists injection', async () => {
    const malicious = "'; DROP TABLE leads; --";
    await expect(findLeads(db, { search: malicious })).resolves.not.toThrow();
    expect(await countLeads(db)).toBe(3);
  });
});

describe('findLeadsAdvanced', () => {
  it('combines hasLegalExtracted filter with website', async () => {
    const all = await findLeads(db);
    await db.update(schema.leads).set({ website: 'https://example.fr', legalExtractedAt: new Date() })
      .where(schema.leads.id.eq?.(all[0].id) ?? (await import('drizzle-orm')).eq(schema.leads.id, all[0].id));
    const r1 = await findLeadsAdvanced(db, { hasLegalExtracted: 'yes' });
    expect(r1).toHaveLength(1);
    const r2 = await findLeadsAdvanced(db, { hasLegalExtracted: 'no' });
    expect(r2).toHaveLength(2);
  });
});

describe('lead mutations', () => {
  it('updateStatus changes status', async () => {
    const all = await findLeads(db);
    expect(await updateStatus(db, all[0].id, 'qualifie')).toBe(true);
    expect((await findById(db, all[0].id))?.status).toBe('qualifie');
  });

  it('scheduleFollowup writes date', async () => {
    const all = await findLeads(db);
    await scheduleFollowup(db, all[0].id, new Date('2026-06-01T10:00:00Z'));
    const after = await findById(db, all[0].id);
    expect(after?.nextFollowupAt).toBeInstanceOf(Date);
  });

  it('logCall updates callStatus', async () => {
    const all = await findLeads(db);
    expect(await logCall(db, all[0].id, 'appele')).toBe(true);
    expect((await findById(db, all[0].id))?.callStatus).toBe('appele');
  });

  it('markOptOut + restore round-trip', async () => {
    const all = await findLeads(db);
    await markOptOut(db, all[0].id);
    expect((await findById(db, all[0].id))?.status).toBe('perdu');
    await softDeleteLead(db, all[1].id);
    expect(await findLeads(db)).toHaveLength(2);
    await restoreLead(db, all[1].id);
    expect(await findLeads(db)).toHaveLength(3);
  });
});

describe('distinct values', () => {
  it('returns unique cities', async () => {
    expect((await getDistinctCities(db)).sort()).toEqual(['Lyon', 'Paris']);
  });

  it('returns unique niches', async () => {
    expect((await getDistinctNiches(db)).sort()).toEqual(['electricien', 'plombier']);
  });
});

describe('getExistingPhones', () => {
  it('returns Set of all phones', async () => {
    const phones = await getExistingPhones(db);
    expect(phones.size).toBe(3);
    expect(phones.has('0100000001')).toBe(true);
  });
});
