import Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { migrations } from '../migrations';
import { computeCostCents, getDailyCost, getTotalCostCents, recordUsage } from './llmUsage';

function makeDb(): Database.Database {
  const db = new Database(':memory:');
  db.exec("CREATE TABLE IF NOT EXISTS migrations (id INTEGER PRIMARY KEY, name TEXT, description TEXT, applied_at TEXT DEFAULT (datetime('now')))");
  for (const m of migrations) {
    if (typeof m.up === 'string') db.exec(m.up);
    else m.up(db);
  }
  return db;
}

let db: Database.Database;
beforeEach(() => { db = makeDb(); });
afterEach(() => { db.close(); });

describe('computeCostCents', () => {
  it('prices Opus 4.7 input + output correctly', () => {
    // 1M input @ $5/Mtok + 1M output @ $25/Mtok = $30 = 3000 cents
    expect(computeCostCents({
      model: 'claude-opus-4-7',
      feature: 'test',
      input_tokens: 1_000_000,
      output_tokens: 1_000_000,
    })).toBe(3000);
  });

  it('discounts cache_read tokens (10x cheaper than uncached input)', () => {
    // 1M cache_read @ $0.50/Mtok + 0 output = 50 cents
    expect(computeCostCents({
      model: 'claude-opus-4-7',
      feature: 'test',
      input_tokens: 1_000_000,
      output_tokens: 0,
      cache_read_input_tokens: 1_000_000,
    })).toBe(50);
  });

  it('returns 0 for unknown model', () => {
    expect(computeCostCents({
      model: 'gpt-5',
      feature: 'test',
      input_tokens: 1_000_000,
      output_tokens: 1_000_000,
    })).toBe(0);
  });

  it('Haiku is 5x cheaper than Opus on input', () => {
    const opus = computeCostCents({ model: 'claude-opus-4-7', feature: 't', input_tokens: 1_000_000, output_tokens: 0 });
    const haiku = computeCostCents({ model: 'claude-haiku-4-5', feature: 't', input_tokens: 1_000_000, output_tokens: 0 });
    expect(opus / haiku).toBe(5);
  });
});

describe('recordUsage + queries', () => {
  it('stores a usage row with computed cost', () => {
    const cost = recordUsage(db, {
      model: 'claude-opus-4-7',
      feature: 'legal',
      input_tokens: 2000,
      output_tokens: 500,
    });
    expect(cost).toBeGreaterThan(0);

    const row = db.prepare('SELECT * FROM llm_usage').get() as { feature: string; cost_usd_cents: number };
    expect(row.feature).toBe('legal');
    expect(row.cost_usd_cents).toBe(cost);
  });

  it('marks failures with success=0', () => {
    recordUsage(db, {
      model: 'claude-opus-4-7',
      feature: 'legal',
      input_tokens: 100,
      output_tokens: 0,
      success: false,
      error_message: 'parse failed',
    });
    const row = db.prepare('SELECT success, error_message FROM llm_usage').get() as { success: number; error_message: string };
    expect(row.success).toBe(0);
    expect(row.error_message).toBe('parse failed');
  });

  it('getDailyCost aggregates by date/feature/model', () => {
    recordUsage(db, { model: 'claude-opus-4-7', feature: 'legal', input_tokens: 1_000_000, output_tokens: 0 });
    recordUsage(db, { model: 'claude-opus-4-7', feature: 'legal', input_tokens: 1_000_000, output_tokens: 0 });
    const rows = getDailyCost(db, 7);
    expect(rows).toHaveLength(1);
    expect(rows[0].calls).toBe(2);
    expect(rows[0].feature).toBe('legal');
  });

  it('getTotalCostCents sums all costs in window', () => {
    recordUsage(db, { model: 'claude-haiku-4-5', feature: 'legal', input_tokens: 1_000_000, output_tokens: 0 });
    recordUsage(db, { model: 'claude-haiku-4-5', feature: 'legal', input_tokens: 1_000_000, output_tokens: 0 });
    expect(getTotalCostCents(db, 30)).toBe(200); // 2 * 100 cents
  });
});
