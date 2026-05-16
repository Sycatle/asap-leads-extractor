/**
 * Sequences + steps — définition de la cadence d'envoi.
 */

import { and, asc, eq, sql } from 'drizzle-orm';
import type { DbClient } from '../client';
import {
  sequences,
  sequenceSteps,
  type NewSequence,
  type NewSequenceStep,
  type Sequence,
  type SequenceStep,
} from '../schema';

// ===== SEQUENCES =====

export async function listSequences(db: DbClient, status?: Sequence['status']): Promise<Sequence[]> {
  const q = db.select().from(sequences).orderBy(asc(sequences.name));
  return status ? q.where(eq(sequences.status, status)) : q;
}

export async function findSequenceById(db: DbClient, id: number): Promise<Sequence | null> {
  const rows = await db.select().from(sequences).where(eq(sequences.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function addSequence(db: DbClient, seq: NewSequence): Promise<Sequence | null> {
  const rows = await db.insert(sequences).values(seq).returning();
  return rows[0] ?? null;
}

export async function updateSequence(
  db: DbClient,
  id: number,
  data: Partial<NewSequence>,
): Promise<boolean> {
  const rows = await db
    .update(sequences)
    .set({ ...data, updatedAt: sql`now()` })
    .where(eq(sequences.id, id))
    .returning({ id: sequences.id });
  return rows.length > 0;
}

// ===== STEPS =====

export async function listSteps(db: DbClient, sequenceId: number): Promise<SequenceStep[]> {
  return db
    .select()
    .from(sequenceSteps)
    .where(eq(sequenceSteps.sequenceId, sequenceId))
    .orderBy(asc(sequenceSteps.order));
}

export async function findStepByOrder(
  db: DbClient,
  sequenceId: number,
  order: number,
): Promise<SequenceStep | null> {
  const rows = await db
    .select()
    .from(sequenceSteps)
    .where(and(eq(sequenceSteps.sequenceId, sequenceId), eq(sequenceSteps.order, order)))
    .limit(1);
  return rows[0] ?? null;
}

export async function addStep(db: DbClient, step: NewSequenceStep): Promise<SequenceStep | null> {
  const rows = await db.insert(sequenceSteps).values(step).returning();
  return rows[0] ?? null;
}

export async function deleteStep(db: DbClient, id: number): Promise<boolean> {
  const rows = await db
    .delete(sequenceSteps)
    .where(eq(sequenceSteps.id, id))
    .returning({ id: sequenceSteps.id });
  return rows.length > 0;
}
