/**
 * History Queries - Lead history operations
 */

import type Database from 'better-sqlite3';
import type { LeadHistoryEntry } from './types.js';

export function addHistory(db: Database.Database, entry: Omit<LeadHistoryEntry, 'id' | 'created_at'>): number {
  const stmt = db.prepare(`
    INSERT INTO lead_history (lead_id, type, old_value, new_value, note, duration_seconds)
    VALUES (@lead_id, @type, @old_value, @new_value, @note, @duration_seconds)
  `);
  const result = stmt.run({
    lead_id: entry.lead_id,
    type: entry.type,
    old_value: entry.old_value ?? null,
    new_value: entry.new_value ?? null,
    note: entry.note ?? null,
    duration_seconds: entry.duration_seconds ?? null,
  });
  return result.lastInsertRowid as number;
}

export function getLeadHistory(db: Database.Database, leadId: number, limit = 50): LeadHistoryEntry[] {
  const stmt = db.prepare(`
    SELECT * FROM lead_history 
    WHERE lead_id = ? 
    ORDER BY created_at DESC 
    LIMIT ?
  `);
  return stmt.all(leadId, limit) as LeadHistoryEntry[];
}

/**
 * Get history entries for multiple leads
 */
export function getLeadsHistory(db: Database.Database, leadIds: number[], limit = 100): LeadHistoryEntry[] {
  if (leadIds.length === 0) return [];
  
  const placeholders = leadIds.map(() => '?').join(',');
  const stmt = db.prepare(`
    SELECT * FROM lead_history 
    WHERE lead_id IN (${placeholders})
    ORDER BY created_at DESC 
    LIMIT ?
  `);
  return stmt.all(...leadIds, limit) as LeadHistoryEntry[];
}

/**
 * Count history entries by type for a period
 */
export function countHistoryByType(
  db: Database.Database, 
  type: string, 
  periodDays?: number
): number {
  let sql = `SELECT COUNT(*) as count FROM lead_history WHERE type = ?`;
  const params: unknown[] = [type];
  
  if (periodDays) {
    sql += ` AND created_at >= datetime('now', '-${periodDays} days')`;
  }
  
  const result = db.prepare(sql).get(...params) as { count: number };
  return result.count;
}
