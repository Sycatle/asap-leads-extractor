/**
 * Suppression list GLOBALE.
 *
 * Un email présent ici bloque tout envoi futur toutes séquences confondues.
 * RFC 8058 (List-Unsubscribe one-click) + CNIL (droit d'opposition immédiat).
 *
 * Toujours vérifier `isSuppressed(email)` AVANT chaque envoi côté worker.
 */

import { desc, eq, inArray } from 'drizzle-orm';
import type { DbClient } from '../client';
import {
  suppressionList,
  type NewSuppressionEntry,
  type SuppressionEntry,
} from '../schema';

export async function isSuppressed(db: DbClient, email: string): Promise<boolean> {
  const normalized = email.trim().toLowerCase();
  const rows = await db
    .select({ email: suppressionList.email })
    .from(suppressionList)
    .where(eq(suppressionList.email, normalized))
    .limit(1);
  return rows.length > 0;
}

export async function filterSuppressed(db: DbClient, emails: string[]): Promise<Set<string>> {
  if (emails.length === 0) return new Set();
  const normalized = emails.map((e) => e.trim().toLowerCase());
  const rows = await db
    .select({ email: suppressionList.email })
    .from(suppressionList)
    .where(inArray(suppressionList.email, normalized));
  return new Set(rows.map((r) => r.email));
}

export async function addSuppression(
  db: DbClient,
  entry: { email: string; reason: NewSuppressionEntry['reason']; source?: string | null },
): Promise<SuppressionEntry | null> {
  const normalized = entry.email.trim().toLowerCase();
  const result = await db
    .insert(suppressionList)
    .values({ email: normalized, reason: entry.reason, source: entry.source ?? null })
    .onConflictDoNothing({ target: suppressionList.email })
    .returning();
  return result[0] ?? null;
}

export async function bulkImport(
  db: DbClient,
  entries: Array<{ email: string; reason: NewSuppressionEntry['reason']; source?: string }>,
): Promise<number> {
  if (entries.length === 0) return 0;
  const rows: NewSuppressionEntry[] = entries.map((e) => ({
    email: e.email.trim().toLowerCase(),
    reason: e.reason,
    source: e.source ?? null,
  }));
  const result = await db
    .insert(suppressionList)
    .values(rows)
    .onConflictDoNothing({ target: suppressionList.email })
    .returning({ email: suppressionList.email });
  return result.length;
}

export async function removeSuppression(db: DbClient, email: string): Promise<boolean> {
  const normalized = email.trim().toLowerCase();
  const result = await db
    .delete(suppressionList)
    .where(eq(suppressionList.email, normalized))
    .returning({ email: suppressionList.email });
  return result.length > 0;
}

export async function listSuppressions(db: DbClient, limit = 100): Promise<SuppressionEntry[]> {
  return db
    .select()
    .from(suppressionList)
    .orderBy(desc(suppressionList.createdAt))
    .limit(limit);
}
