import Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { migrations } from '../migrations';
import {
  countLeads,
  findById,
  findLeads,
  getDistinctCities,
  getDistinctNiches,
  logCall,
  markOptOut,
  restoreLead,
  scheduleFollowup,
  softDeleteLead,
  updateStatus,
} from './leads';

function seed(db: Database.Database) {
  const insert = db.prepare(`
    INSERT INTO leads (phone, name, address, city, postal_code, maps_url, niche, status, score)
    VALUES (@phone, @name, @address, @city, @postal_code, @maps_url, @niche, @status, @score)
  `);
  const rows = [
    { phone: '0100000001', name: 'A Plomberie', address: '1 rue A', city: 'Paris', postal_code: '75001', maps_url: 'm1', niche: 'plombier', status: 'nouveau', score: 80 },
    { phone: '0100000002', name: 'B Plomberie', address: '2 rue B', city: 'Paris', postal_code: '75002', maps_url: 'm2', niche: 'plombier', status: 'contacte', score: 50 },
    { phone: '0100000003', name: 'C Élec', address: '3 rue C', city: 'Lyon', postal_code: '69001', maps_url: 'm3', niche: 'electricien', status: 'nouveau', score: 30 },
  ];
  for (const r of rows) insert.run(r);
}

function makeDb(): Database.Database {
  const db = new Database(':memory:');
  db.pragma('journal_mode = MEMORY');
  db.exec('CREATE TABLE IF NOT EXISTS migrations (id INTEGER PRIMARY KEY, name TEXT, description TEXT, applied_at TEXT DEFAULT (datetime(\'now\')))');
  for (const m of migrations) {
    if (typeof m.up === 'string') db.exec(m.up);
    else m.up(db);
    db.prepare('INSERT INTO migrations (id, name, description) VALUES (?, ?, ?)').run(m.id, m.name, m.description);
  }
  return db;
}

let db: Database.Database;

beforeEach(() => {
  db = makeDb();
  seed(db);
});

afterEach(() => {
  db.close();
});

describe('findLeads', () => {
  it('returns all non-deleted leads by default', () => {
    expect(findLeads(db)).toHaveLength(3);
  });

  it('filters by city', () => {
    const results = findLeads(db, { city: 'Paris' });
    expect(results).toHaveLength(2);
    expect(results.every((l) => l.city === 'Paris')).toBe(true);
  });

  it('filters by niche', () => {
    expect(findLeads(db, { niche: 'electricien' })).toHaveLength(1);
  });

  it('filters by status', () => {
    expect(findLeads(db, { status: 'nouveau' })).toHaveLength(2);
  });

  it('hides soft-deleted leads', () => {
    softDeleteLead(db, 1);
    expect(findLeads(db)).toHaveLength(2);
  });

  it('search is parameterized (resists injection)', () => {
    const malicious = "'; DROP TABLE leads; --";
    expect(() => findLeads(db, { search: malicious })).not.toThrow();
    expect(countLeads(db)).toBe(3);
  });
});

describe('lead mutations', () => {
  it('updateStatus changes status', () => {
    expect(updateStatus(db, 1, 'qualifie')).toBe(true);
    expect(findById(db, 1)?.status).toBe('qualifie');
  });

  it('scheduleFollowup writes date', () => {
    scheduleFollowup(db, 1, '2026-06-01');
    expect(findById(db, 1)?.next_followup_at).toBe('2026-06-01');
  });

  it('logCall updates call_status', () => {
    expect(logCall(db, 1, 'appele', 'OK')).toBe(true);
    expect(findById(db, 1)?.call_status).toBe('appele');
  });

  it('markOptOut + restore round-trip', () => {
    markOptOut(db, 1);
    expect(findById(db, 1)?.status).toBe('perdu');
    softDeleteLead(db, 2);
    expect(findLeads(db)).toHaveLength(2);
    restoreLead(db, 2);
    expect(findLeads(db)).toHaveLength(3);
  });
});

describe('distinct values', () => {
  it('returns unique cities', () => {
    expect(getDistinctCities(db).sort()).toEqual(['Lyon', 'Paris']);
  });

  it('returns unique niches', () => {
    expect(getDistinctNiches(db).sort()).toEqual(['electricien', 'plombier']);
  });
});

describe('composite index migration (022)', () => {
  it('creates idx_leads_deleted_status', () => {
    const idx = db.prepare("SELECT name FROM sqlite_master WHERE type='index' AND name=?")
      .get('idx_leads_deleted_status');
    expect(idx).toBeTruthy();
  });

  it('query uses composite index for soft-delete + status filter', () => {
    const plan = db.prepare("EXPLAIN QUERY PLAN SELECT * FROM leads WHERE deleted_at IS NULL AND status = 'nouveau'").all() as Array<{ detail: string }>;
    const usesIdx = plan.some((row) => row.detail.includes('idx_leads_deleted'));
    expect(usesIdx).toBe(true);
  });
});
