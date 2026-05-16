/**
 * Daily aggregation of sender health metrics + alert + auto-pause.
 *
 * Règles (par défaut, voir DEFAULT_THRESHOLDS) :
 *  - bounce rate > 3 % → alerte
 *  - spam complaint rate > 0.1 % → alerte + auto-pause du sender
 *  - open rate < 30 % (avec >=10 delivered) → alerte
 *
 * Sortie : flag alert dans `sender_health_daily`, notif via `sendAlert`.
 */

import { eq } from 'drizzle-orm';
import type { DbClient } from '../../db/client';
import {
  aggregateAllSenders,
  DEFAULT_THRESHOLDS,
  listSendersAtRisk,
  updateSender,
} from '../../db/queries';
import { senderAccounts, type SenderHealthDaily } from '../../db/schema';
import { logger as log } from '../logger';
import { sendAdminAlert } from '../sending/alerts';

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

export interface SenderHealthOptions {
  date?: string;
  apply?: boolean;
}

export interface SenderHealthResult {
  date: string;
  rows: number;
  alerts: number;
  paused: number;
}

export async function runSenderHealthAggregation(
  db: DbClient,
  opts: SenderHealthOptions = {},
): Promise<SenderHealthResult> {
  const date = opts.date ?? todayUtc();
  const apply = opts.apply ?? true;

  const aggregated = await aggregateAllSenders(db, date, DEFAULT_THRESHOLDS);
  log.info(`[senderHealth] aggregated ${aggregated.length} sender(s) for ${date}`);

  const alerts = aggregated.filter((r) => r.alertFlag);
  if (alerts.length === 0) {
    return { date, rows: aggregated.length, alerts: 0, paused: 0 };
  }

  let paused = 0;
  for (const row of alerts) {
    log.info(`[senderHealth] ALERT sender=${row.senderAccountId} bounceBps=${row.bounceRateBps} complaintBps=${row.complaintRateBps} openBps=${row.openRateBps}`);
    if (apply && shouldAutoPause(row)) {
      await updateSender(db, row.senderAccountId, { warmupStatus: 'paused' });
      paused += 1;
      log.error(`[senderHealth] auto-paused sender ${row.senderAccountId} (complaints over threshold)`);
    }
  }

  if (apply) {
    const recent = await listSendersAtRisk(db, 2);
    const senderIds = Array.from(new Set(recent.map((r) => r.senderAccountId)));
    if (senderIds.length > 0) {
      const senders = await db.select().from(senderAccounts).where(eq(senderAccounts.id, senderIds[0]));
      const summary = recent
        .map((r) => `sender=${r.senderAccountId} date=${r.date} bounce=${(r.bounceRateBps / 100).toFixed(2)}% complaint=${(r.complaintRateBps / 100).toFixed(2)}% open=${(r.openRateBps / 100).toFixed(2)}%`)
        .join('\n');
      await sendAdminAlert({
        subject: `[leadsflow] ${recent.length} sender alert(s) on ${date}`,
        text: `${summary}\n\nSenders potentially affected: ${senders.map((s) => s.email).join(', ')}`,
      }).catch((err) => log.error(`[senderHealth] alert send failed: ${err}`));
    }
  }

  return { date, rows: aggregated.length, alerts: alerts.length, paused };
}

function shouldAutoPause(row: SenderHealthDaily): boolean {
  return row.complaintRateBps > DEFAULT_THRESHOLDS.complaintMaxBps;
}
