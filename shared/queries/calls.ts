/**
 * Lead Calls Queries - Operations on normalized lead_calls table
 */

import type Database from 'better-sqlite3';
import type { DbLeadCall } from '../types';

/**
 * Get all calls for a lead
 */
export function getCallsForLead(db: Database.Database, leadId: number, limit = 50): DbLeadCall[] {
  const stmt = db.prepare(`
    SELECT * FROM lead_calls 
    WHERE lead_id = ? 
    ORDER BY called_at DESC
    LIMIT ?
  `);
  return stmt.all(leadId, limit) as DbLeadCall[];
}

/**
 * Get calls for a session
 */
export function getCallsForSession(db: Database.Database, sessionId: number): DbLeadCall[] {
  const stmt = db.prepare(`
    SELECT * FROM lead_calls 
    WHERE session_id = ? 
    ORDER BY called_at ASC
  `);
  return stmt.all(sessionId) as DbLeadCall[];
}

/**
 * Record a new call
 */
export function recordCall(
  db: Database.Database, 
  leadId: number, 
  outcome: string, 
  options: { sessionId?: number; durationSeconds?: number; note?: string } = {}
): number {
  const stmt = db.prepare(`
    INSERT INTO lead_calls (lead_id, session_id, outcome, duration_seconds, note)
    VALUES (?, ?, ?, ?, ?)
  `);
  const result = stmt.run(
    leadId, 
    options.sessionId ?? null, 
    outcome, 
    options.durationSeconds ?? null, 
    options.note ?? null
  );
  return result.lastInsertRowid as number;
}

/**
 * Get call count for a lead
 */
export function getCallCount(db: Database.Database, leadId: number): number {
  const stmt = db.prepare('SELECT COUNT(*) as count FROM lead_calls WHERE lead_id = ?');
  const result = stmt.get(leadId) as { count: number };
  return result.count;
}

/**
 * Get call statistics for a period
 */
export function getCallStats(
  db: Database.Database, 
  periodDays?: number
): { outcome: string; count: number }[] {
  let sql = `
    SELECT outcome, COUNT(*) as count 
    FROM lead_calls
  `;
  
  if (periodDays) {
    sql += ` WHERE called_at >= datetime('now', '-${periodDays} days')`;
  }
  
  sql += ` GROUP BY outcome ORDER BY count DESC`;
  
  const stmt = db.prepare(sql);
  return stmt.all() as { outcome: string; count: number }[];
}

/**
 * Get calls per day for a period
 */
export function getCallsPerDay(
  db: Database.Database, 
  periodDays = 7
): { date: string; count: number; reached: number }[] {
  const stmt = db.prepare(`
    SELECT 
      date(called_at) as date,
      COUNT(*) as count,
      SUM(CASE WHEN outcome IN ('appele', 'interesse', 'rdv_pris', 'devis_envoye') THEN 1 ELSE 0 END) as reached
    FROM lead_calls
    WHERE called_at >= datetime('now', '-${periodDays} days')
    GROUP BY date(called_at)
    ORDER BY date ASC
  `);
  return stmt.all() as { date: string; count: number; reached: number }[];
}

/**
 * Get last call for a lead
 */
export function getLastCall(db: Database.Database, leadId: number): DbLeadCall | null {
  const stmt = db.prepare(`
    SELECT * FROM lead_calls 
    WHERE lead_id = ? 
    ORDER BY called_at DESC 
    LIMIT 1
  `);
  return (stmt.get(leadId) as DbLeadCall) ?? null;
}

/**
 * Get average call duration
 */
export function getAverageCallDuration(db: Database.Database, periodDays?: number): number {
  let sql = `
    SELECT AVG(duration_seconds) as avg 
    FROM lead_calls 
    WHERE duration_seconds IS NOT NULL
  `;
  
  if (periodDays) {
    sql += ` AND called_at >= datetime('now', '-${periodDays} days')`;
  }
  
  const stmt = db.prepare(sql);
  const result = stmt.get() as { avg: number | null };
  return result.avg ?? 0;
}
