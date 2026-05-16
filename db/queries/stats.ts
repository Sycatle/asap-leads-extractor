/**
 * Lead stats queries - Drizzle async port of worker/db.ts getStats().
 */

import { and, isNull, sql } from 'drizzle-orm';
import type { DbClient } from '../client';
import { leads, type Lead } from '../schema';

export interface LeadStats {
  total: number;
  by_status: Record<Lead['status'], number>;
  by_call_status: Record<Lead['callStatus'], number>;
  by_priority: Record<string, number>;
  by_city: Record<string, number>;
  followups_today: number;
  contacted_today: number;
  needs_enrich_societe: number;
  needs_enrich_website: number;
  needs_enrich_legal: number;
  recently_added: number;
  recently_enriched: number;
}

export async function getStats(db: DbClient): Promise<LeadStats> {
  const notDeleted = isNull(leads.deletedAt);

  const [
    totalRow,
    statusRows,
    callRows,
    priorityRows,
    cityRows,
    [followups],
    [contacted],
    [needsSociete],
    [needsWebsite],
    [needsLegal],
    [recentlyAdded],
    [recentlyEnriched],
  ] = await Promise.all([
    db.select({ c: sql<number>`count(*)::int` }).from(leads).where(notDeleted),
    db.select({ s: leads.status, c: sql<number>`count(*)::int` }).from(leads).where(notDeleted).groupBy(leads.status),
    db.select({ s: leads.callStatus, c: sql<number>`count(*)::int` }).from(leads).where(notDeleted).groupBy(leads.callStatus),
    db.select({ p: leads.priority, c: sql<number>`count(*)::int` }).from(leads).where(notDeleted).groupBy(leads.priority),
    db.select({ city: leads.city, c: sql<number>`count(*)::int` }).from(leads).where(notDeleted).groupBy(leads.city)
      .orderBy(sql`count(*) DESC`).limit(10),
    db.select({ c: sql<number>`count(*)::int` }).from(leads)
      .where(and(notDeleted, sql`${leads.nextFollowupAt} <= now()`)),
    db.select({ c: sql<number>`count(*)::int` }).from(leads)
      .where(and(notDeleted, sql`date(${leads.lastContactAt}) = current_date`)),
    db.select({ c: sql<number>`count(*)::int` }).from(leads)
      .where(and(notDeleted, sql`${leads.siren} IS NULL`, sql`${leads.optOut} = false`)),
    db.select({ c: sql<number>`count(*)::int` }).from(leads)
      .where(and(notDeleted, sql`${leads.cmsType} IS NULL`, sql`${leads.optOut} = false`)),
    db.select({ c: sql<number>`count(*)::int` }).from(leads)
      .where(and(notDeleted, sql`${leads.legalExtractedAt} IS NULL`, sql`${leads.website} IS NOT NULL`)),
    db.select({ c: sql<number>`count(*)::int` }).from(leads)
      .where(sql`${leads.createdAt} > now() - interval '1 day'`),
    db.select({ c: sql<number>`count(*)::int` }).from(leads)
      .where(and(sql`${leads.siren} IS NOT NULL`, sql`${leads.updatedAt} > now() - interval '1 day'`)),
  ]);

  const by_status: Record<Lead['status'], number> = {
    nouveau: 0, contacte: 0, qualifie: 0, proposition: 0, converti: 0, perdu: 0,
  };
  for (const r of statusRows) by_status[r.s] = r.c;

  const by_call_status: Record<Lead['callStatus'], number> = {
    non_appele: 0, appele: 0, rappeler: 0, injoignable: 0,
  };
  for (const r of callRows) by_call_status[r.s] = r.c;

  const by_priority: Record<string, number> = {};
  for (const r of priorityRows) by_priority[r.p] = r.c;

  const by_city: Record<string, number> = {};
  for (const r of cityRows) by_city[r.city] = r.c;

  return {
    total: totalRow[0]?.c ?? 0,
    by_status,
    by_call_status,
    by_priority,
    by_city,
    followups_today: followups?.c ?? 0,
    contacted_today: contacted?.c ?? 0,
    needs_enrich_societe: needsSociete?.c ?? 0,
    needs_enrich_website: needsWebsite?.c ?? 0,
    needs_enrich_legal: needsLegal?.c ?? 0,
    recently_added: recentlyAdded?.c ?? 0,
    recently_enriched: recentlyEnriched?.c ?? 0,
  };
}

/**
 * Specialized count for prioritization decisions (orchestrator).
 */
export async function countNeedsEnrichSociete(db: DbClient): Promise<number> {
  const [row] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(leads)
    .where(and(isNull(leads.deletedAt), sql`${leads.siren} IS NULL`, sql`${leads.optOut} = false`));
  return row?.c ?? 0;
}

export async function countNeedsEnrichWebsite(db: DbClient): Promise<number> {
  const [row] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(leads)
    .where(and(isNull(leads.deletedAt), sql`${leads.cmsType} IS NULL`, sql`${leads.optOut} = false`));
  return row?.c ?? 0;
}

export async function countNeedsEnrichLegal(db: DbClient): Promise<number> {
  const [row] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(leads)
    .where(and(isNull(leads.deletedAt), sql`${leads.legalExtractedAt} IS NULL`, sql`${leads.website} IS NOT NULL`));
  return row?.c ?? 0;
}
