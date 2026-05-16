import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import * as schema from '../schema';
import { computeCostCents, getDailyCost, getTotalCostCents, recordUsage } from './llmUsage';

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
  await pool.query('TRUNCATE TABLE llm_usage RESTART IDENTITY');
});

describe('computeCostCents', () => {
  it('prices Opus 4.7 input + output correctly', () => {
    expect(computeCostCents({
      model: 'claude-opus-4-7', feature: 't',
      input_tokens: 1_000_000, output_tokens: 1_000_000,
    })).toBe(3000);
  });

  it('discounts cache_read tokens', () => {
    expect(computeCostCents({
      model: 'claude-opus-4-7', feature: 't',
      input_tokens: 1_000_000, output_tokens: 0,
      cache_read_input_tokens: 1_000_000,
    })).toBe(50);
  });

  it('returns 0 for unknown model', () => {
    expect(computeCostCents({
      model: 'gpt-5', feature: 't',
      input_tokens: 1_000_000, output_tokens: 1_000_000,
    })).toBe(0);
  });

  it('Haiku 5x cheaper than Opus on input', () => {
    const opus = computeCostCents({ model: 'claude-opus-4-7', feature: 't', input_tokens: 1_000_000, output_tokens: 0 });
    const haiku = computeCostCents({ model: 'claude-haiku-4-5', feature: 't', input_tokens: 1_000_000, output_tokens: 0 });
    expect(opus / haiku).toBe(5);
  });
});

describe('recordUsage', () => {
  it('persists with computed cost', async () => {
    const cost = await recordUsage(db, {
      model: 'claude-opus-4-7', feature: 'legal',
      input_tokens: 2000, output_tokens: 500,
    });
    expect(cost).toBeGreaterThan(0);

    const rows = await db.select().from(schema.llmUsage);
    expect(rows).toHaveLength(1);
    expect(rows[0].feature).toBe('legal');
    expect(rows[0].costUsdCents).toBe(cost);
  });

  it('marks failures with success=false', async () => {
    await recordUsage(db, {
      model: 'claude-opus-4-7', feature: 'legal',
      input_tokens: 100, output_tokens: 0,
      success: false, error_message: 'parse failed',
    });
    const rows = await db.select().from(schema.llmUsage);
    expect(rows[0].success).toBe(false);
    expect(rows[0].errorMessage).toBe('parse failed');
  });
});

describe('aggregates', () => {
  it('getTotalCostCents sums all in window', async () => {
    await recordUsage(db, { model: 'claude-haiku-4-5', feature: 'legal', input_tokens: 1_000_000, output_tokens: 0 });
    await recordUsage(db, { model: 'claude-haiku-4-5', feature: 'legal', input_tokens: 1_000_000, output_tokens: 0 });
    expect(await getTotalCostCents(db, 30)).toBe(200);
  });

  it('getDailyCost groups by date/feature/model', async () => {
    await recordUsage(db, { model: 'claude-opus-4-7', feature: 'legal', input_tokens: 1_000_000, output_tokens: 0 });
    await recordUsage(db, { model: 'claude-opus-4-7', feature: 'legal', input_tokens: 1_000_000, output_tokens: 0 });
    const rows = await getDailyCost(db, 7);
    expect(rows).toHaveLength(1);
    expect(rows[0].calls).toBe(2);
    expect(rows[0].feature).toBe('legal');
  });
});
