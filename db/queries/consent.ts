/**
 * Consent log — preuve d'intérêt légitime ou d'opt-out reçu.
 *
 * Append-only. Sert de défense en cas de contrôle CNIL : pour chaque contact,
 * on doit pouvoir produire l'évidence du basis légal de la collecte/traitement.
 */

import { desc, eq } from 'drizzle-orm';
import type { DbClient } from '../client';
import { consentLog, type ConsentLogEntry, type NewConsentLogEntry } from '../schema';

export async function logConsent(db: DbClient, entry: NewConsentLogEntry): Promise<ConsentLogEntry | null> {
  const result = await db.insert(consentLog).values(entry).returning();
  return result[0] ?? null;
}

export async function findConsentByContact(db: DbClient, contactId: number): Promise<ConsentLogEntry[]> {
  return db
    .select()
    .from(consentLog)
    .where(eq(consentLog.contactId, contactId))
    .orderBy(desc(consentLog.createdAt));
}
