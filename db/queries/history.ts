/**
 * Lead history & log helpers (Drizzle async port).
 *
 * Le legacy lead_history (events polymorphes) a été normalisé en migration 016+
 * en plusieurs tables : lead_status_log, lead_calls, lead_notes.
 * On expose ici une vue unifiée pour l'UI + des helpers "withHistory" qui
 * combinent UPDATE leads + INSERT log dans une transaction.
 */

import { and, desc, eq, sql } from 'drizzle-orm';
import type { DbClient } from '../client';
import { leadCalls, leadNotes, leadStatusLog, leads } from '../schema';

export type HistoryType = 'call' | 'email' | 'note' | 'status_change' | 'followup_set';

export interface LeadHistoryEntry {
  id: number;
  lead_id: number;
  type: HistoryType;
  old_value: string | null;
  new_value: string | null;
  note: string | null;
  duration_seconds: number | null;
  created_at: string;
}

/**
 * Vue unifiée : merge lead_status_log + lead_calls + lead_notes en LeadHistoryEntry.
 * Ordre antéchronologique (dernier event d'abord).
 */
export async function getLeadHistory(db: DbClient, leadId: number, limit = 50): Promise<LeadHistoryEntry[]> {
  const [statuses, calls, notes] = await Promise.all([
    db.select().from(leadStatusLog).where(eq(leadStatusLog.leadId, leadId)).orderBy(desc(leadStatusLog.changedAt)).limit(limit),
    db.select().from(leadCalls).where(eq(leadCalls.leadId, leadId)).orderBy(desc(leadCalls.calledAt)).limit(limit),
    db.select().from(leadNotes).where(eq(leadNotes.leadId, leadId)).orderBy(desc(leadNotes.createdAt)).limit(limit),
  ]);

  const unified: LeadHistoryEntry[] = [
    ...statuses.map((s) => ({
      id: s.id,
      lead_id: s.leadId,
      type: 'status_change' as HistoryType,
      old_value: s.fromStatus,
      new_value: s.toStatus,
      note: s.reason,
      duration_seconds: null,
      created_at: s.changedAt.toISOString(),
    })),
    ...calls.map((c) => ({
      id: c.id,
      lead_id: c.leadId,
      type: 'call' as HistoryType,
      old_value: null,
      new_value: c.outcome,
      note: c.note,
      duration_seconds: c.durationSeconds,
      created_at: c.calledAt.toISOString(),
    })),
    ...notes.map((n) => ({
      id: n.id,
      lead_id: n.leadId,
      type: 'note' as HistoryType,
      old_value: null,
      new_value: null,
      note: n.content,
      duration_seconds: null,
      created_at: n.createdAt.toISOString(),
    })),
  ];

  unified.sort((a, b) => b.created_at.localeCompare(a.created_at));
  return unified.slice(0, limit);
}

/**
 * Generic addHistory — route vers la bonne table normalisée selon le type.
 */
export async function addHistory(
  db: DbClient,
  entry: Omit<LeadHistoryEntry, 'id' | 'created_at'>,
): Promise<number> {
  switch (entry.type) {
    case 'status_change': {
      const [row] = await db.insert(leadStatusLog).values({
        leadId: entry.lead_id,
        fromStatus: entry.old_value,
        toStatus: entry.new_value ?? 'unknown',
        reason: entry.note,
      }).returning({ id: leadStatusLog.id });
      return row.id;
    }
    case 'call': {
      const [row] = await db.insert(leadCalls).values({
        leadId: entry.lead_id,
        outcome: entry.new_value ?? 'unknown',
        durationSeconds: entry.duration_seconds,
        note: entry.note,
      }).returning({ id: leadCalls.id });
      return row.id;
    }
    case 'note': {
      const [row] = await db.insert(leadNotes).values({
        leadId: entry.lead_id,
        content: entry.note ?? '',
        author: 'web',
      }).returning({ id: leadNotes.id });
      return row.id;
    }
    case 'email':
    case 'followup_set': {
      // Pas de table dédiée pour ces types ; on note dans lead_notes
      // avec un préfixe de type pour traçabilité.
      const [row] = await db.insert(leadNotes).values({
        leadId: entry.lead_id,
        content: `[${entry.type}] ${entry.note ?? entry.new_value ?? ''}`,
        author: 'web',
      }).returning({ id: leadNotes.id });
      return row.id;
    }
  }
}

// ===== "WITH HISTORY" COMBINED ACTIONS =====

export async function updateStatusWithHistory(
  db: DbClient,
  leadId: number,
  status: typeof leads.$inferSelect.status,
  note?: string,
): Promise<boolean> {
  return db.transaction(async (tx) => {
    const current = await tx.select({ status: leads.status }).from(leads).where(eq(leads.id, leadId)).limit(1);
    if (current.length === 0) return false;

    await tx.insert(leadStatusLog).values({
      leadId,
      fromStatus: current[0].status,
      toStatus: status,
      reason: note ?? null,
    });

    const result = await tx
      .update(leads)
      .set({ status, updatedAt: sql`now()` })
      .where(eq(leads.id, leadId))
      .returning({ id: leads.id });
    return result.length > 0;
  });
}

export async function logCallWithHistory(
  db: DbClient,
  leadId: number,
  callStatus: typeof leads.$inferSelect.callStatus,
  note?: string,
  durationSec?: number,
  sessionId?: number,
): Promise<boolean> {
  return db.transaction(async (tx) => {
    await tx.insert(leadCalls).values({
      leadId,
      sessionId: sessionId ?? null,
      outcome: callStatus,
      durationSeconds: durationSec ?? null,
      note: note ?? null,
    });

    const result = await tx
      .update(leads)
      .set({
        callStatus,
        lastContactAt: sql`now()`,
        attemptsCount: sql`${leads.attemptsCount} + 1`,
        updatedAt: sql`now()`,
      })
      .where(eq(leads.id, leadId))
      .returning({ id: leads.id });
    return result.length > 0;
  });
}

export async function scheduleFollowupWithHistory(
  db: DbClient,
  leadId: number,
  date: string,
  note?: string,
): Promise<boolean> {
  return db.transaction(async (tx) => {
    await tx.insert(leadNotes).values({
      leadId,
      content: `[followup_set] ${date}${note ? ' - ' + note : ''}`,
      author: 'web',
    });

    const result = await tx
      .update(leads)
      .set({ nextFollowupAt: new Date(date), updatedAt: sql`now()` })
      .where(eq(leads.id, leadId))
      .returning({ id: leads.id });
    return result.length > 0;
  });
}

export async function addNoteWithHistory(db: DbClient, leadId: number, note: string): Promise<boolean> {
  return db.transaction(async (tx) => {
    await tx.insert(leadNotes).values({ leadId, content: note, author: 'web' });

    const result = await tx
      .update(leads)
      .set({
        notes: sql`COALESCE(${leads.notes} || E'\n', '') || ${note}`,
        updatedAt: sql`now()`,
      })
      .where(eq(leads.id, leadId))
      .returning({ id: leads.id });
    return result.length > 0;
  });
}

/**
 * Followups list with urgency classification (overdue/today/tomorrow/this_week/later).
 */
export type FollowupUrgency = 'overdue' | 'today' | 'tomorrow' | 'this_week' | 'later';

export interface FollowupLead {
  id: number;
  name: string;
  phone: string;
  city: string | null;
  next_followup_at: string | null;
  call_status: string;
  status: string;
  urgency: FollowupUrgency;
}

export async function getFollowups(db: DbClient): Promise<FollowupLead[]> {
  const rows = await db
    .select({
      id: leads.id,
      name: leads.name,
      phone: leads.phone,
      city: leads.city,
      next_followup_at: leads.nextFollowupAt,
      call_status: leads.callStatus,
      status: leads.status,
    })
    .from(leads)
    .where(and(
      sql`${leads.nextFollowupAt} IS NOT NULL`,
      sql`${leads.deletedAt} IS NULL`,
      sql`${leads.status} NOT IN ('converti', 'perdu')`,
    ))
    .orderBy(sql`${leads.nextFollowupAt} ASC`);

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrowStart = new Date(todayStart);
  tomorrowStart.setDate(tomorrowStart.getDate() + 1);
  const dayAfterTomorrow = new Date(tomorrowStart);
  dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 1);
  const endOfWeek = new Date(todayStart);
  endOfWeek.setDate(endOfWeek.getDate() + 7);

  return rows.map((r) => {
    const date = r.next_followup_at as Date | null;
    let urgency: FollowupUrgency = 'later';
    if (date) {
      if (date < todayStart) urgency = 'overdue';
      else if (date < tomorrowStart) urgency = 'today';
      else if (date < dayAfterTomorrow) urgency = 'tomorrow';
      else if (date < endOfWeek) urgency = 'this_week';
    }
    return {
      ...r,
      next_followup_at: date ? date.toISOString() : null,
      urgency,
    };
  });
}
