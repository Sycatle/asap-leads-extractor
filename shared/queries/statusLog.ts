/**
 * Status Log Queries - Operations on normalized lead_status_log table
 */

import type Database from 'better-sqlite3';
import type { DbLeadStatusLog, LeadStatus } from '../types.js';

/**
 * Get status history for a lead
 */
export function getStatusHistory(db: Database.Database, leadId: number, limit = 50): DbLeadStatusLog[] {
  const stmt = db.prepare(`
    SELECT * FROM lead_status_log 
    WHERE lead_id = ? 
    ORDER BY changed_at DESC
    LIMIT ?
  `);
  return stmt.all(leadId, limit) as DbLeadStatusLog[];
}

/**
 * Log a status change
 */
export function logStatusChange(
  db: Database.Database, 
  leadId: number, 
  fromStatus: string | null, 
  toStatus: string,
  reason?: string
): number {
  const stmt = db.prepare(`
    INSERT INTO lead_status_log (lead_id, from_status, to_status, reason)
    VALUES (?, ?, ?, ?)
  `);
  const result = stmt.run(leadId, fromStatus, toStatus, reason ?? null);
  return result.lastInsertRowid as number;
}

/**
 * Get conversion funnel stats
 */
export function getConversionFunnel(
  db: Database.Database, 
  periodDays?: number
): { to_status: string; count: number }[] {
  let sql = `
    SELECT to_status, COUNT(*) as count 
    FROM lead_status_log
  `;
  
  if (periodDays) {
    sql += ` WHERE changed_at >= datetime('now', '-${periodDays} days')`;
  }
  
  sql += ` GROUP BY to_status ORDER BY count DESC`;
  
  const stmt = db.prepare(sql);
  return stmt.all() as { to_status: string; count: number }[];
}

/**
 * Get status transitions (from -> to)
 */
export function getStatusTransitions(
  db: Database.Database, 
  periodDays?: number
): { from_status: string | null; to_status: string; count: number }[] {
  let sql = `
    SELECT from_status, to_status, COUNT(*) as count 
    FROM lead_status_log
  `;
  
  if (periodDays) {
    sql += ` WHERE changed_at >= datetime('now', '-${periodDays} days')`;
  }
  
  sql += ` GROUP BY from_status, to_status ORDER BY count DESC`;
  
  const stmt = db.prepare(sql);
  return stmt.all() as { from_status: string | null; to_status: string; count: number }[];
}

/**
 * Get time to convert (average days from nouveau to converti)
 */
export function getAverageTimeToConvert(db: Database.Database): number | null {
  const stmt = db.prepare(`
    SELECT AVG(julianday(converted.changed_at) - julianday(created.changed_at)) as avg_days
    FROM lead_status_log created
    INNER JOIN lead_status_log converted ON created.lead_id = converted.lead_id
    WHERE created.to_status = 'nouveau'
    AND converted.to_status = 'converti'
  `);
  const result = stmt.get() as { avg_days: number | null };
  return result.avg_days;
}

/**
 * Get leads that reached a specific status
 */
export function getLeadsByStatusReached(
  db: Database.Database, 
  status: LeadStatus,
  periodDays?: number,
  limit = 100
): number[] {
  let sql = `
    SELECT DISTINCT lead_id FROM lead_status_log 
    WHERE to_status = ?
  `;
  
  if (periodDays) {
    sql += ` AND changed_at >= datetime('now', '-${periodDays} days')`;
  }
  
  sql += ` ORDER BY changed_at DESC LIMIT ?`;
  
  const stmt = db.prepare(sql);
  const rows = stmt.all(status, limit) as { lead_id: number }[];
  return rows.map(r => r.lead_id);
}

/**
 * Get conversion rate between two statuses
 */
export function getConversionRate(
  db: Database.Database, 
  fromStatus: LeadStatus, 
  toStatus: LeadStatus
): number {
  const fromCount = db.prepare(`
    SELECT COUNT(DISTINCT lead_id) as count 
    FROM lead_status_log 
    WHERE to_status = ?
  `).get(fromStatus) as { count: number };
  
  const toCount = db.prepare(`
    SELECT COUNT(DISTINCT lead_id) as count 
    FROM lead_status_log 
    WHERE to_status = ? 
    AND lead_id IN (SELECT lead_id FROM lead_status_log WHERE to_status = ?)
  `).get(toStatus, fromStatus) as { count: number };
  
  if (fromCount.count === 0) return 0;
  return Math.round((toCount.count / fromCount.count) * 100);
}
