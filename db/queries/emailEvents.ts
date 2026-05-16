/**
 * Email events — append-only log de tous les évènements liés à un envoi.
 *
 * Sert au runner (évaluer conditions branchées sur opened/clicked/replied),
 * au monitoring (sender health), et au reporting (funnel).
 */

import { and, desc, eq, sql } from 'drizzle-orm';
import type { DbClient } from '../client';
import {
  emailEvents,
  type EmailEvent,
  type NewEmailEvent,
} from '../schema';

export async function logEmailEvent(db: DbClient, ev: NewEmailEvent): Promise<EmailEvent | null> {
  const rows = await db.insert(emailEvents).values(ev).returning();
  return rows[0] ?? null;
}

export async function listEventsByEnrollment(
  db: DbClient,
  enrollmentId: number,
): Promise<EmailEvent[]> {
  return db
    .select()
    .from(emailEvents)
    .where(eq(emailEvents.enrollmentId, enrollmentId))
    .orderBy(desc(emailEvents.at));
}

export async function hasEvent(
  db: DbClient,
  enrollmentId: number,
  type: EmailEvent['type'],
): Promise<boolean> {
  const rows = await db
    .select({ id: emailEvents.id })
    .from(emailEvents)
    .where(and(eq(emailEvents.enrollmentId, enrollmentId), eq(emailEvents.type, type)))
    .limit(1);
  return rows.length > 0;
}

export async function findEventByMessageId(
  db: DbClient,
  messageId: string,
  type: EmailEvent['type'],
): Promise<EmailEvent | null> {
  const rows = await db
    .select()
    .from(emailEvents)
    .where(and(eq(emailEvents.messageId, messageId), eq(emailEvents.type, type)))
    .limit(1);
  return rows[0] ?? null;
}

export interface FunnelMetrics {
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  replied: number;
  bounced: number;
  unsub: number;
  complained: number;
}

export async function getFunnelMetrics(db: DbClient, sequenceId: number): Promise<FunnelMetrics> {
  const rows = await db
    .select({ type: emailEvents.type, c: sql<number>`count(*)::int` })
    .from(emailEvents)
    .innerJoin(
      sql`enrollments`,
      sql`enrollments.id = ${emailEvents.enrollmentId} and enrollments.sequence_id = ${sequenceId}`,
    )
    .groupBy(emailEvents.type);
  const m: FunnelMetrics = {
    sent: 0, delivered: 0, opened: 0, clicked: 0,
    replied: 0, bounced: 0, unsub: 0, complained: 0,
  };
  for (const r of rows) {
    if (r.type === 'sent') m.sent = r.c;
    else if (r.type === 'delivered') m.delivered = r.c;
    else if (r.type === 'open') m.opened = r.c;
    else if (r.type === 'click') m.clicked = r.c;
    else if (r.type === 'reply') m.replied = r.c;
    else if (r.type === 'bounce') m.bounced = r.c;
    else if (r.type === 'unsub') m.unsub = r.c;
    else if (r.type === 'complaint') m.complained = r.c;
  }
  return m;
}
