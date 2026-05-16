/**
 * "Next lead" smart selection algorithm.
 *
 * Heuristique :
 * 1. Relances en retard (next_followup_at < now)
 * 2. Relances du jour (next_followup_at = today)
 * 3. Leads jamais appelés (non_appele + nouveau) triés par score
 * 4. Leads à rappeler depuis >24h
 * 5. Fallback : tout autre lead non appelé
 */

import { and, asc, desc, eq, isNull, notInArray, sql } from 'drizzle-orm';
import type { DbClient } from '../client';
import { leads, type Lead } from '../schema';

interface SelectionOptions {
  excludeIds?: number[];
  niche?: string | null;
}

export async function getNextLead(db: DbClient, options: SelectionOptions = {}): Promise<Lead | null> {
  const conditions = [isNull(leads.deletedAt), eq(leads.optOut, false)];
  if (options.excludeIds && options.excludeIds.length > 0) {
    conditions.push(notInArray(leads.id, options.excludeIds));
  }
  if (options.niche) {
    conditions.push(eq(leads.niche, options.niche));
  }

  // 1. Overdue followups
  const overdue = await db.select().from(leads)
    .where(and(...conditions, sql`${leads.nextFollowupAt} < now()`, sql`${leads.status} NOT IN ('converti','perdu')`))
    .orderBy(asc(leads.nextFollowupAt))
    .limit(1);
  if (overdue[0]) return overdue[0];

  // 2. Today's followups
  const todayFollowup = await db.select().from(leads)
    .where(and(...conditions, sql`date(${leads.nextFollowupAt}) = current_date`, sql`${leads.nextFollowupAt} >= now()`))
    .orderBy(asc(leads.nextFollowupAt))
    .limit(1);
  if (todayFollowup[0]) return todayFollowup[0];

  // 3. Fresh leads (non_appele + nouveau), high score first
  const fresh = await db.select().from(leads)
    .where(and(...conditions, eq(leads.callStatus, 'non_appele'), eq(leads.status, 'nouveau')))
    .orderBy(desc(leads.score), asc(leads.createdAt))
    .limit(1);
  if (fresh[0]) return fresh[0];

  // 4. Stale "rappeler" (>24h since last contact)
  const stale = await db.select().from(leads)
    .where(and(...conditions, eq(leads.callStatus, 'rappeler'), sql`${leads.lastContactAt} < now() - interval '1 day'`))
    .orderBy(asc(leads.lastContactAt))
    .limit(1);
  if (stale[0]) return stale[0];

  // 5. Fallback : any non-appele
  const fallback = await db.select().from(leads)
    .where(and(...conditions, eq(leads.callStatus, 'non_appele')))
    .orderBy(desc(leads.score))
    .limit(1);
  return fallback[0] ?? null;
}
