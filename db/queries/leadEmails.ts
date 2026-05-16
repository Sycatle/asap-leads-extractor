/**
 * Lead emails — historique outbound + inbound par contact/lead.
 *
 * Sert au reply classifier (lecture body inbound), au routage humain (inbox),
 * et à l'historique consolidé d'un lead.
 */

import { and, desc, eq } from 'drizzle-orm';
import type { DbClient } from '../client';
import {
  leadEmails,
  type LeadEmail,
  type NewLeadEmail,
} from '../schema';

export async function addLeadEmail(db: DbClient, email: NewLeadEmail): Promise<LeadEmail | null> {
  const rows = await db.insert(leadEmails).values(email).returning();
  return rows[0] ?? null;
}

export async function findLeadEmailById(db: DbClient, id: number): Promise<LeadEmail | null> {
  const rows = await db.select().from(leadEmails).where(eq(leadEmails.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function listInboundUnhandled(db: DbClient, limit = 50): Promise<LeadEmail[]> {
  return db
    .select()
    .from(leadEmails)
    .where(and(eq(leadEmails.direction, 'inbound'), eq(leadEmails.handled, false)))
    .orderBy(desc(leadEmails.receivedAt))
    .limit(limit);
}

export async function listEmailsByLead(db: DbClient, leadId: number): Promise<LeadEmail[]> {
  return db
    .select()
    .from(leadEmails)
    .where(eq(leadEmails.leadId, leadId))
    .orderBy(desc(leadEmails.receivedAt));
}

export async function updateClassification(
  db: DbClient,
  id: number,
  data: {
    intent: LeadEmail['intent'];
    classifierConfidence: number;
    classifierSummary?: string | null;
    classifierMeta?: Record<string, unknown>;
  },
): Promise<boolean> {
  const rows = await db
    .update(leadEmails)
    .set({
      intent: data.intent,
      classifierConfidence: data.classifierConfidence,
      classifierSummary: data.classifierSummary ?? null,
      classifierMeta: data.classifierMeta ?? null,
    })
    .where(eq(leadEmails.id, id))
    .returning({ id: leadEmails.id });
  return rows.length > 0;
}

export async function markHandled(db: DbClient, id: number): Promise<boolean> {
  const rows = await db
    .update(leadEmails)
    .set({ handled: true })
    .where(eq(leadEmails.id, id))
    .returning({ id: leadEmails.id });
  return rows.length > 0;
}
