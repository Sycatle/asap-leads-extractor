/**
 * Lead contacts — N personnes contactables par lead.
 *
 * Un email donné peut exister sur plusieurs leads (cas où la même personne
 * apparaît sur deux entreprises). Unicité (lead_id, email).
 */

import { and, asc, eq, isNull, sql } from 'drizzle-orm';
import type { DbClient } from '../client';
import { leadContacts, type LeadContact, type NewLeadContact } from '../schema';

export async function addContact(db: DbClient, contact: NewLeadContact): Promise<LeadContact | null> {
  const result = await db
    .insert(leadContacts)
    .values(contact)
    .onConflictDoUpdate({
      target: [leadContacts.leadId, leadContacts.email],
      set: {
        firstName: contact.firstName,
        lastName: contact.lastName,
        role: contact.role,
        phone: contact.phone,
        linkedinUrl: contact.linkedinUrl,
        source: contact.source,
        deletedAt: null,
      },
    })
    .returning();
  return result[0] ?? null;
}

export async function findContactsByLead(db: DbClient, leadId: number, includeDeleted = false): Promise<LeadContact[]> {
  const where = includeDeleted
    ? eq(leadContacts.leadId, leadId)
    : and(eq(leadContacts.leadId, leadId), isNull(leadContacts.deletedAt));
  return db.select().from(leadContacts).where(where).orderBy(asc(leadContacts.collectedAt));
}

export async function findContactByEmail(db: DbClient, email: string): Promise<LeadContact[]> {
  return db
    .select()
    .from(leadContacts)
    .where(and(eq(leadContacts.email, email), isNull(leadContacts.deletedAt)));
}

export async function findContactById(db: DbClient, id: number): Promise<LeadContact | null> {
  const result = await db.select().from(leadContacts).where(eq(leadContacts.id, id)).limit(1);
  return result[0] ?? null;
}

export async function verifyContact(
  db: DbClient,
  id: number,
  status: LeadContact['verifiedStatus'],
): Promise<boolean> {
  const result = await db
    .update(leadContacts)
    .set({ verifiedStatus: status, verifiedAt: new Date() })
    .where(eq(leadContacts.id, id))
    .returning({ id: leadContacts.id });
  return result.length > 0;
}

export async function markContacted(db: DbClient, id: number): Promise<boolean> {
  const result = await db
    .update(leadContacts)
    .set({ lastContactedAt: sql`now()` })
    .where(eq(leadContacts.id, id))
    .returning({ id: leadContacts.id });
  return result.length > 0;
}

export async function softDeleteContact(db: DbClient, id: number): Promise<boolean> {
  const result = await db
    .update(leadContacts)
    .set({ deletedAt: new Date() })
    .where(eq(leadContacts.id, id))
    .returning({ id: leadContacts.id });
  return result.length > 0;
}
