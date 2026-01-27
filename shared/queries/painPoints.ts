/**
 * Pain Points Queries - Operations on normalized pain_points table
 */

import type Database from 'better-sqlite3';
import type { DbLeadPainPoint } from '../types.js';

/**
 * Get all pain points for a lead
 */
export function getPainPointsForLead(db: Database.Database, leadId: number): DbLeadPainPoint[] {
  const stmt = db.prepare(`
    SELECT * FROM lead_pain_points 
    WHERE lead_id = ? 
    ORDER BY detected_at DESC
  `);
  return stmt.all(leadId) as DbLeadPainPoint[];
}

/**
 * Get pain points as string array (for backward compatibility)
 */
export function getPainPointsArray(db: Database.Database, leadId: number): string[] {
  const rows = getPainPointsForLead(db, leadId);
  return rows.map(r => r.pain_point);
}

/**
 * Add a pain point to a lead
 */
export function addPainPoint(db: Database.Database, leadId: number, painPoint: string): number {
  const stmt = db.prepare(`
    INSERT INTO lead_pain_points (lead_id, pain_point)
    VALUES (?, ?)
  `);
  const result = stmt.run(leadId, painPoint.trim());
  return result.lastInsertRowid as number;
}

/**
 * Add multiple pain points to a lead
 */
export function addPainPoints(db: Database.Database, leadId: number, painPoints: string[]): number {
  const stmt = db.prepare(`
    INSERT INTO lead_pain_points (lead_id, pain_point)
    VALUES (?, ?)
  `);
  
  let count = 0;
  for (const point of painPoints) {
    if (point.trim()) {
      stmt.run(leadId, point.trim());
      count++;
    }
  }
  return count;
}

/**
 * Remove a pain point
 */
export function removePainPoint(db: Database.Database, id: number): boolean {
  const stmt = db.prepare('DELETE FROM lead_pain_points WHERE id = ?');
  const result = stmt.run(id);
  return result.changes > 0;
}

/**
 * Clear all pain points for a lead
 */
export function clearPainPoints(db: Database.Database, leadId: number): number {
  const stmt = db.prepare('DELETE FROM lead_pain_points WHERE lead_id = ?');
  const result = stmt.run(leadId);
  return result.changes;
}

/**
 * Find leads by pain point
 */
export function findLeadsByPainPoint(db: Database.Database, painPoint: string, limit = 100): number[] {
  const stmt = db.prepare(`
    SELECT DISTINCT lead_id FROM lead_pain_points 
    WHERE pain_point LIKE ? 
    LIMIT ?
  `);
  const rows = stmt.all(`%${painPoint}%`, limit) as { lead_id: number }[];
  return rows.map(r => r.lead_id);
}

/**
 * Get pain point statistics
 */
export function getPainPointStats(db: Database.Database): { pain_point: string; count: number }[] {
  const stmt = db.prepare(`
    SELECT pain_point, COUNT(*) as count 
    FROM lead_pain_points 
    GROUP BY pain_point 
    ORDER BY count DESC
  `);
  return stmt.all() as { pain_point: string; count: number }[];
}
