/**
 * Sender accounts + pools — boîtes d'envoi rotatées par sender_pool.
 *
 * Le runner consomme un pool ; chaque enrollment tire un sender du pool
 * (round-robin), en sautant ceux qui ont atteint `dailyLimit` ou qui sont hors
 * fenêtre d'envoi.
 */

import { and, eq, inArray, sql } from 'drizzle-orm';
import type { DbClient } from '../client';
import {
  emailEvents,
  senderAccounts,
  senderPools,
  type NewSenderAccount,
  type NewSenderPool,
  type SenderAccount,
  type SenderPool,
} from '../schema';

// ===== ACCOUNTS =====

export async function listSenders(db: DbClient, onlyEnabled = false): Promise<SenderAccount[]> {
  const q = db.select().from(senderAccounts);
  return onlyEnabled ? q.where(eq(senderAccounts.enabled, true)) : q;
}

export async function findSenderById(db: DbClient, id: number): Promise<SenderAccount | null> {
  const rows = await db.select().from(senderAccounts).where(eq(senderAccounts.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function addSender(db: DbClient, sender: NewSenderAccount): Promise<SenderAccount | null> {
  const rows = await db.insert(senderAccounts).values(sender).returning();
  return rows[0] ?? null;
}

export async function updateSender(
  db: DbClient,
  id: number,
  data: Partial<NewSenderAccount>,
): Promise<boolean> {
  const rows = await db
    .update(senderAccounts)
    .set(data)
    .where(eq(senderAccounts.id, id))
    .returning({ id: senderAccounts.id });
  return rows.length > 0;
}

// ===== POOLS =====

export async function listPools(db: DbClient): Promise<SenderPool[]> {
  return db.select().from(senderPools);
}

export async function findPoolById(db: DbClient, id: number): Promise<SenderPool | null> {
  const rows = await db.select().from(senderPools).where(eq(senderPools.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function addPool(db: DbClient, pool: NewSenderPool): Promise<SenderPool | null> {
  const rows = await db.insert(senderPools).values(pool).returning();
  return rows[0] ?? null;
}

export async function setPoolAccounts(
  db: DbClient,
  poolId: number,
  accountIds: number[],
): Promise<boolean> {
  const rows = await db
    .update(senderPools)
    .set({ accountIds })
    .where(eq(senderPools.id, poolId))
    .returning({ id: senderPools.id });
  return rows.length > 0;
}

export async function getPoolSenders(db: DbClient, poolId: number): Promise<SenderAccount[]> {
  const pool = await findPoolById(db, poolId);
  if (!pool || pool.accountIds.length === 0) return [];
  return db
    .select()
    .from(senderAccounts)
    .where(and(inArray(senderAccounts.id, pool.accountIds), eq(senderAccounts.enabled, true)));
}

// ===== SENDING WINDOW / QUOTA =====

export async function countTodaySentBySender(db: DbClient, senderId: number): Promise<number> {
  const rows = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(emailEvents)
    .where(
      and(
        eq(emailEvents.senderAccountId, senderId),
        eq(emailEvents.type, 'sent'),
        sql`${emailEvents.at} >= date_trunc('day', now() at time zone 'UTC')`,
      ),
    );
  return rows[0]?.c ?? 0;
}

export interface SendingWindow {
  startHour: number;
  endHour: number;
  timezone: string;
  weekdays: number[]; // ISO 1=Mon..7=Sun
}

export function isWithinSendingWindow(window: SendingWindow | null | undefined, now = new Date()): boolean {
  if (!window) return true;
  // Approximation : on calcule en UTC pour stabilité, le runner peut être enrichi
  // pour vraies timezones via Intl.DateTimeFormat plus tard.
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: window.timezone,
    hour: '2-digit',
    hour12: false,
    weekday: 'short',
  });
  const parts = fmt.formatToParts(now);
  const hour = parseInt(parts.find((p) => p.type === 'hour')?.value ?? '0', 10);
  const weekday = parts.find((p) => p.type === 'weekday')?.value ?? 'Mon';
  const isoMap: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };
  const dow = isoMap[weekday] ?? 1;
  return window.weekdays.includes(dow) && hour >= window.startHour && hour < window.endHour;
}

export async function selectSenderForEnrollment(
  db: DbClient,
  poolId: number,
  excludeSenderIds: Set<number> = new Set(),
  now = new Date(),
): Promise<SenderAccount | null> {
  const senders = await getPoolSenders(db, poolId);
  if (senders.length === 0) return null;

  // Filtre fenêtre d'envoi + warmup ready + non exclu
  const eligible = senders.filter(
    (s) =>
      s.warmupStatus !== 'paused' &&
      !excludeSenderIds.has(s.id) &&
      isWithinSendingWindow(s.sendingWindow as SendingWindow | null, now),
  );
  if (eligible.length === 0) return null;

  // Round-robin par charge du jour : on prend celui qui a envoyé le moins
  const loads = await Promise.all(
    eligible.map(async (s) => ({ sender: s, sent: await countTodaySentBySender(db, s.id) })),
  );
  const available = loads.filter((l) => l.sent < l.sender.dailyLimit);
  if (available.length === 0) return null;
  available.sort((a, b) => a.sent - b.sent);
  return available[0].sender;
}
