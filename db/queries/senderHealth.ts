/**
 * Sender health metrics — agrégation quotidienne.
 *
 * Ratios stockés en basis points (1/10000) pour précision sans float :
 *   bounceRateBps = 100 → 1.00 %
 *   complaintRateBps = 10 → 0.10 %
 */

import { and, desc, eq, gte, sql } from 'drizzle-orm';
import type { DbClient } from '../client';
import {
  emailEvents,
  senderAccounts,
  senderHealthDaily,
  type NewSenderHealthDaily,
  type SenderHealthDaily,
} from '../schema';

export interface HealthThresholds {
  /** seuil bounce rate en basis points (300 = 3 %) */
  bounceMaxBps: number;
  /** seuil spam complaint rate en basis points (10 = 0.10 %) */
  complaintMaxBps: number;
  /** open rate en dessous duquel on alerte (3000 = 30 %) */
  openMinBps: number;
}

export const DEFAULT_THRESHOLDS: HealthThresholds = {
  bounceMaxBps: 300,
  complaintMaxBps: 10,
  openMinBps: 3000,
};

interface AggregateRow {
  sent: number;
  delivered: number;
  bounced: number;
  complained: number;
  opened: number;
  clicked: number;
  replied: number;
}

function ratioBps(numerator: number, denominator: number): number {
  if (denominator === 0) return 0;
  return Math.round((numerator * 10000) / denominator);
}

function shouldAlert(row: NewSenderHealthDaily, thresholds: HealthThresholds): boolean {
  if (row.sent && row.sent < 5) return false; // pas assez de signal
  if ((row.bounceRateBps ?? 0) > thresholds.bounceMaxBps) return true;
  if ((row.complaintRateBps ?? 0) > thresholds.complaintMaxBps) return true;
  if ((row.openRateBps ?? 0) < thresholds.openMinBps && (row.delivered ?? 0) >= 10) return true;
  return false;
}

export async function aggregateSenderHealthForDay(
  db: DbClient,
  senderAccountId: number,
  date: string, // YYYY-MM-DD
  thresholds: HealthThresholds = DEFAULT_THRESHOLDS,
): Promise<SenderHealthDaily | null> {
  const rows = await db
    .select({ type: emailEvents.type, c: sql<number>`count(*)::int` })
    .from(emailEvents)
    .where(
      and(
        eq(emailEvents.senderAccountId, senderAccountId),
        sql`to_char(${emailEvents.at} at time zone 'UTC', 'YYYY-MM-DD') = ${date}`,
      ),
    )
    .groupBy(emailEvents.type);

  const agg: AggregateRow = {
    sent: 0, delivered: 0, bounced: 0, complained: 0, opened: 0, clicked: 0, replied: 0,
  };
  for (const r of rows) {
    if (r.type === 'sent') agg.sent = r.c;
    else if (r.type === 'delivered') agg.delivered = r.c;
    else if (r.type === 'bounce') agg.bounced = r.c;
    else if (r.type === 'complaint') agg.complained = r.c;
    else if (r.type === 'open') agg.opened = r.c;
    else if (r.type === 'click') agg.clicked = r.c;
    else if (r.type === 'reply') agg.replied = r.c;
  }

  const denomEngagement = agg.delivered || agg.sent;
  const record: NewSenderHealthDaily = {
    senderAccountId,
    date,
    sent: agg.sent,
    delivered: agg.delivered,
    bounced: agg.bounced,
    complained: agg.complained,
    opened: agg.opened,
    clicked: agg.clicked,
    replied: agg.replied,
    bounceRateBps: ratioBps(agg.bounced, agg.sent),
    complaintRateBps: ratioBps(agg.complained, agg.delivered),
    openRateBps: ratioBps(agg.opened, denomEngagement),
    replyRateBps: ratioBps(agg.replied, denomEngagement),
    alertFlag: false,
  };
  record.alertFlag = shouldAlert(record, thresholds);

  const result = await db
    .insert(senderHealthDaily)
    .values(record)
    .onConflictDoUpdate({
      target: [senderHealthDaily.senderAccountId, senderHealthDaily.date],
      set: {
        sent: record.sent,
        delivered: record.delivered,
        bounced: record.bounced,
        complained: record.complained,
        opened: record.opened,
        clicked: record.clicked,
        replied: record.replied,
        bounceRateBps: record.bounceRateBps,
        complaintRateBps: record.complaintRateBps,
        openRateBps: record.openRateBps,
        replyRateBps: record.replyRateBps,
        alertFlag: record.alertFlag,
        updatedAt: sql`now()`,
      },
    })
    .returning();
  return result[0] ?? null;
}

export async function listHealthForSender(
  db: DbClient,
  senderAccountId: number,
  days = 30,
): Promise<SenderHealthDaily[]> {
  return db
    .select()
    .from(senderHealthDaily)
    .where(
      and(
        eq(senderHealthDaily.senderAccountId, senderAccountId),
        gte(senderHealthDaily.date, sql`(now() - make_interval(days => ${days}))::date::text`),
      ),
    )
    .orderBy(desc(senderHealthDaily.date));
}

export async function listSendersAtRisk(db: DbClient, lookbackDays = 2): Promise<SenderHealthDaily[]> {
  return db
    .select()
    .from(senderHealthDaily)
    .where(
      and(
        eq(senderHealthDaily.alertFlag, true),
        gte(senderHealthDaily.date, sql`(now() - make_interval(days => ${lookbackDays}))::date::text`),
      ),
    )
    .orderBy(desc(senderHealthDaily.date));
}

export async function aggregateAllSenders(
  db: DbClient,
  date: string,
  thresholds: HealthThresholds = DEFAULT_THRESHOLDS,
): Promise<SenderHealthDaily[]> {
  const senders = await db.select({ id: senderAccounts.id }).from(senderAccounts);
  const results: SenderHealthDaily[] = [];
  for (const s of senders) {
    const r = await aggregateSenderHealthForDay(db, s.id, date, thresholds);
    if (r) results.push(r);
  }
  return results;
}
