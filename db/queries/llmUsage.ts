/**
 * LLM usage tracking - Drizzle async port.
 */

import { and, desc, gte, sql, sum } from 'drizzle-orm';
import type { DbClient } from '../client';
import { llmUsage, type NewLlmUsage } from '../schema';

// Prix Anthropic en cents USD pour 1M tokens (cached: 2026-04)
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

export async function recordUsage(db: DbClient, record: UsageRecord): Promise<number> {
  const cost = computeCostCents(record);
  const row: NewLlmUsage = {
    provider: 'anthropic',
    model: record.model,
    feature: record.feature,
    leadId: record.lead_id ?? null,
    inputTokens: record.input_tokens,
    outputTokens: record.output_tokens,
    cacheReadInputTokens: record.cache_read_input_tokens ?? 0,
    cacheCreationInputTokens: record.cache_creation_input_tokens ?? 0,
    costUsdCents: cost,
    success: record.success !== false,
    errorMessage: record.error_message ?? null,
  };
  await db.insert(llmUsage).values(row);
  return cost;
}

export async function getDailyCost(db: DbClient, days = 7): Promise<DailyCost[]> {
  const rows = await db
    .select({
      date: sql<string>`to_char(${llmUsage.createdAt}, 'YYYY-MM-DD')`,
      feature: llmUsage.feature,
      model: llmUsage.model,
      calls: sql<number>`count(*)::int`,
      total_input_tokens: sql<number>`coalesce(sum(${llmUsage.inputTokens}), 0)::int`,
      total_output_tokens: sql<number>`coalesce(sum(${llmUsage.outputTokens}), 0)::int`,
      total_cost_usd_cents: sql<number>`coalesce(sum(${llmUsage.costUsdCents}), 0)::int`,
    })
    .from(llmUsage)
    .where(gte(llmUsage.createdAt, sql`now() - make_interval(days => ${days})`))
    .groupBy(sql`to_char(${llmUsage.createdAt}, 'YYYY-MM-DD')`, llmUsage.feature, llmUsage.model)
    .orderBy(desc(sql`to_char(${llmUsage.createdAt}, 'YYYY-MM-DD')`), desc(sql`sum(${llmUsage.costUsdCents})`));
  return rows;
}

export async function getTotalCostCents(db: DbClient, days = 30): Promise<number> {
  const result = await db
    .select({ total: sql<number>`coalesce(sum(${llmUsage.costUsdCents}), 0)::int` })
    .from(llmUsage)
    .where(gte(llmUsage.createdAt, sql`now() - make_interval(days => ${days})`));
  return result[0]?.total ?? 0;
}
