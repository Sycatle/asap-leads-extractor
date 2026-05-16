/**
 * Enrollments — un contact dans une séquence.
 *
 * Le runner sélectionne ceux qui sont `active` et `nextRunAt <= now()`.
 */

import { and, asc, eq, inArray, lte, sql } from 'drizzle-orm';
import type { DbClient } from '../client';
import {
  enrollments,
  type Enrollment,
  type NewEnrollment,
} from '../schema';

export async function enrollContact(
  db: DbClient,
  data: NewEnrollment,
): Promise<Enrollment | null> {
  const rows = await db
    .insert(enrollments)
    .values(data)
    .onConflictDoNothing({ target: [enrollments.sequenceId, enrollments.contactId] })
    .returning();
  return rows[0] ?? null;
}

export async function bulkEnroll(
  db: DbClient,
  rows: NewEnrollment[],
): Promise<number> {
  if (rows.length === 0) return 0;
  const result = await db
    .insert(enrollments)
    .values(rows)
    .onConflictDoNothing({ target: [enrollments.sequenceId, enrollments.contactId] })
    .returning({ id: enrollments.id });
  return result.length;
}

export async function findEnrollmentById(db: DbClient, id: number): Promise<Enrollment | null> {
  const rows = await db.select().from(enrollments).where(eq(enrollments.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function listDueEnrollments(
  db: DbClient,
  limit = 100,
  now = new Date(),
): Promise<Enrollment[]> {
  return db
    .select()
    .from(enrollments)
    .where(and(eq(enrollments.status, 'active'), lte(enrollments.nextRunAt, now)))
    .orderBy(asc(enrollments.nextRunAt))
    .limit(limit);
}

export async function advanceEnrollment(
  db: DbClient,
  id: number,
  data: { currentStep?: number; nextRunAt: Date; lastSenderId?: number | null },
): Promise<boolean> {
  const rows = await db
    .update(enrollments)
    .set(data)
    .where(eq(enrollments.id, id))
    .returning({ id: enrollments.id });
  return rows.length > 0;
}

export async function deferEnrollment(
  db: DbClient,
  id: number,
  nextRunAt: Date,
): Promise<boolean> {
  return advanceEnrollment(db, id, { nextRunAt });
}

export async function terminateEnrollment(
  db: DbClient,
  id: number,
  status: Enrollment['status'],
  reason?: string,
): Promise<boolean> {
  const rows = await db
    .update(enrollments)
    .set({ status, finishedAt: sql`now()`, lastError: reason ?? null })
    .where(eq(enrollments.id, id))
    .returning({ id: enrollments.id });
  return rows.length > 0;
}

export async function pauseEnrollmentsByContact(
  db: DbClient,
  contactId: number,
  status: Enrollment['status'] = 'unsub',
): Promise<number> {
  const rows = await db
    .update(enrollments)
    .set({ status, finishedAt: sql`now()` })
    .where(and(eq(enrollments.contactId, contactId), eq(enrollments.status, 'active')))
    .returning({ id: enrollments.id });
  return rows.length;
}

export async function listEnrollmentsBySequence(
  db: DbClient,
  sequenceId: number,
  status?: Enrollment['status'],
): Promise<Enrollment[]> {
  const conds = [eq(enrollments.sequenceId, sequenceId)];
  if (status) conds.push(eq(enrollments.status, status));
  return db.select().from(enrollments).where(and(...conds));
}

export async function findEnrollmentsByIds(
  db: DbClient,
  ids: number[],
): Promise<Enrollment[]> {
  if (ids.length === 0) return [];
  return db.select().from(enrollments).where(inArray(enrollments.id, ids));
}
