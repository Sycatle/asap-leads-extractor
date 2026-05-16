/**
 * Call session queries - Drizzle async port.
 */

import { desc, eq, isNull, sql } from 'drizzle-orm';
import type { DbClient } from '../client';
import { callSessions } from '../schema';

export interface CallSession {
  id: number;
  started_at: string;
  ended_at: string | null;
  total_calls: number;
  total_reached: number;
  total_voicemail: number;
  total_scheduled: number;
}

function toApi(row: typeof callSessions.$inferSelect): CallSession {
  return {
    id: row.id,
    started_at: row.startedAt.toISOString(),
    ended_at: row.endedAt ? row.endedAt.toISOString() : null,
    total_calls: row.totalCalls,
    total_reached: row.totalReached,
    total_voicemail: row.totalVoicemail,
    total_scheduled: row.totalScheduled,
  };
}

export async function startSession(db: DbClient): Promise<CallSession> {
  const [row] = await db.insert(callSessions).values({}).returning();
  return toApi(row);
}

export async function endSession(db: DbClient, id: number): Promise<CallSession | null> {
  const [row] = await db
    .update(callSessions)
    .set({ endedAt: sql`now()` })
    .where(eq(callSessions.id, id))
    .returning();
  return row ? toApi(row) : null;
}

export async function getActiveSession(db: DbClient): Promise<CallSession | null> {
  const [row] = await db
    .select()
    .from(callSessions)
    .where(isNull(callSessions.endedAt))
    .orderBy(desc(callSessions.startedAt))
    .limit(1);
  return row ? toApi(row) : null;
}

export async function getSessionById(db: DbClient, id: number): Promise<CallSession | null> {
  const [row] = await db.select().from(callSessions).where(eq(callSessions.id, id)).limit(1);
  return row ? toApi(row) : null;
}

export async function updateSessionStats(
  db: DbClient,
  id: number,
  stats: Partial<Pick<CallSession, 'total_calls' | 'total_reached' | 'total_voicemail' | 'total_scheduled'>>,
): Promise<boolean> {
  const patch: Record<string, unknown> = {};
  if (stats.total_calls !== undefined) patch.totalCalls = stats.total_calls;
  if (stats.total_reached !== undefined) patch.totalReached = stats.total_reached;
  if (stats.total_voicemail !== undefined) patch.totalVoicemail = stats.total_voicemail;
  if (stats.total_scheduled !== undefined) patch.totalScheduled = stats.total_scheduled;
  if (Object.keys(patch).length === 0) return false;

  const result = await db
    .update(callSessions)
    .set(patch)
    .where(eq(callSessions.id, id))
    .returning({ id: callSessions.id });
  return result.length > 0;
}
