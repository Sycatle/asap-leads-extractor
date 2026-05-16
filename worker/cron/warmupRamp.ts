/**
 * Warmup ramp — augmente progressivement `dailyLimit` des senders en warmup.
 *
 * Courbe (semaines depuis warmupStartedAt):
 *   sem 1 :  5 emails/jour
 *   sem 2 : 10
 *   sem 3 : 20
 *   sem 4 : 50
 *   sem 5+ : 100 (warmupStatus → ready)
 *
 * À exécuter quotidiennement.
 */

import { eq } from 'drizzle-orm';
import type { DbClient } from '../../db/client';
import { listSenders, updateSender } from '../../db/queries';
import { senderAccounts } from '../../db/schema';
import { logger as log } from '../logger';

const RAMP: Array<{ weekFrom: number; dailyLimit: number; status: 'warming' | 'ready' }> = [
  { weekFrom: 0, dailyLimit: 5, status: 'warming' },
  { weekFrom: 1, dailyLimit: 10, status: 'warming' },
  { weekFrom: 2, dailyLimit: 20, status: 'warming' },
  { weekFrom: 3, dailyLimit: 50, status: 'warming' },
  { weekFrom: 4, dailyLimit: 100, status: 'ready' },
];

export function targetForWeek(week: number): { dailyLimit: number; status: 'warming' | 'ready' } {
  let target = RAMP[0];
  for (const r of RAMP) {
    if (week >= r.weekFrom) target = r;
  }
  return { dailyLimit: target.dailyLimit, status: target.status };
}

export interface WarmupResult {
  inspected: number;
  updated: number;
  promoted: number;
}

export async function runWarmupRamp(db: DbClient, now = new Date()): Promise<WarmupResult> {
  const senders = await listSenders(db, false);
  const result: WarmupResult = { inspected: 0, updated: 0, promoted: 0 };

  for (const s of senders) {
    if (s.warmupStatus === 'paused' || s.warmupStatus === 'ready') continue;
    if (!s.warmupStartedAt) {
      // initialise warmupStartedAt à la date de création
      await db
        .update(senderAccounts)
        .set({ warmupStartedAt: s.createdAt })
        .where(eq(senderAccounts.id, s.id));
      s.warmupStartedAt = s.createdAt;
    }
    result.inspected += 1;

    const week = Math.floor(
      (now.getTime() - new Date(s.warmupStartedAt).getTime()) / (7 * 24 * 60 * 60 * 1000),
    );
    const target = targetForWeek(week);

    if (s.dailyLimit !== target.dailyLimit || s.warmupStatus !== target.status) {
      await updateSender(db, s.id, {
        dailyLimit: target.dailyLimit,
        warmupStatus: target.status,
      });
      result.updated += 1;
      if (target.status === 'ready') {
        result.promoted += 1;
        log.success(`[warmup] sender ${s.email} promoted to ready (week ${week})`);
      } else {
        log.info(`[warmup] sender ${s.email}: week ${week} → daily ${target.dailyLimit}`);
      }
    }
  }

  return result;
}
