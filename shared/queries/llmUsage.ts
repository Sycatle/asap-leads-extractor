/**
 * LLM usage tracking - centralized cost monitoring for Anthropic API calls.
 * Source de vérité pour le coût quotidien des features IA (mentions-légales, etc.)
 */

import type Database from 'better-sqlite3';

// Prix Anthropic en cents USD pour 1M tokens (cached: 2026-04, sync shared/models.md)
const PRICING_PER_MTOK_CENTS: Record<string, { input: number; output: number; cacheRead?: number; cacheWrite?: number }> = {
  'claude-opus-4-7':   { input: 500, output: 2500, cacheRead: 50, cacheWrite: 625 },
  'claude-opus-4-6':   { input: 500, output: 2500, cacheRead: 50, cacheWrite: 625 },
  'claude-sonnet-4-6': { input: 300, output: 1500, cacheRead: 30, cacheWrite: 375 },
  'claude-haiku-4-5':  { input: 100, output:  500, cacheRead: 10, cacheWrite: 125 },
};

export interface UsageRecord {
  model: string;
  feature: string;
  lead_id?: number | null;
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens?: number;
  cache_creation_input_tokens?: number;
  success?: boolean;
  error_message?: string | null;
}

export interface DailyCost {
  date: string;
  feature: string;
  model: string;
  calls: number;
  total_input_tokens: number;
  total_output_tokens: number;
  total_cost_usd_cents: number;
}

/**
 * Compute cost in USD cents (integer) from token counts.
 * Returns 0 if model is unknown — surfaced via logging upstream.
 */
export function computeCostCents(record: UsageRecord): number {
  const price = PRICING_PER_MTOK_CENTS[record.model];
  if (!price) return 0;

  const cacheRead = record.cache_read_input_tokens ?? 0;
  const cacheWrite = record.cache_creation_input_tokens ?? 0;
  const uncachedInput = Math.max(0, record.input_tokens - cacheRead - cacheWrite);

  const cents =
    (uncachedInput * price.input) / 1_000_000 +
    (record.output_tokens * price.output) / 1_000_000 +
    (cacheRead * (price.cacheRead ?? price.input * 0.1)) / 1_000_000 +
    (cacheWrite * (price.cacheWrite ?? price.input * 1.25)) / 1_000_000;

  return Math.round(cents);
}

export function recordUsage(db: Database.Database, record: UsageRecord): number {
  const cost = computeCostCents(record);
  db.prepare(
    `INSERT INTO llm_usage (
      provider, model, feature, lead_id,
      input_tokens, output_tokens,
      cache_read_input_tokens, cache_creation_input_tokens,
      cost_usd_cents, success, error_message
    ) VALUES (
      'anthropic', @model, @feature, @lead_id,
      @input_tokens, @output_tokens,
      @cache_read_input_tokens, @cache_creation_input_tokens,
      @cost_usd_cents, @success, @error_message
    )`,
  ).run({
    model: record.model,
    feature: record.feature,
    lead_id: record.lead_id ?? null,
    input_tokens: record.input_tokens,
    output_tokens: record.output_tokens,
    cache_read_input_tokens: record.cache_read_input_tokens ?? 0,
    cache_creation_input_tokens: record.cache_creation_input_tokens ?? 0,
    cost_usd_cents: cost,
    success: record.success === false ? 0 : 1,
    error_message: record.error_message ?? null,
  });
  return cost;
}

export function getDailyCost(db: Database.Database, days = 7): DailyCost[] {
  return db
    .prepare(
      `SELECT
        date(created_at) as date,
        feature,
        model,
        COUNT(*) as calls,
        SUM(input_tokens) as total_input_tokens,
        SUM(output_tokens) as total_output_tokens,
        SUM(cost_usd_cents) as total_cost_usd_cents
      FROM llm_usage
      WHERE created_at >= date('now', @offset)
      GROUP BY date(created_at), feature, model
      ORDER BY date DESC, total_cost_usd_cents DESC`,
    )
    .all({ offset: `-${days} days` }) as DailyCost[];
}

export function getTotalCostCents(db: Database.Database, days = 30): number {
  const row = db
    .prepare(
      `SELECT COALESCE(SUM(cost_usd_cents), 0) as total
       FROM llm_usage
       WHERE created_at >= date('now', @offset)`,
    )
    .get({ offset: `-${days} days` }) as { total: number };
  return row.total;
}
