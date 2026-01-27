/**
 * Lead Notes Queries - Operations on normalized lead_notes table
 */

import type Database from 'better-sqlite3';
import type { DbLeadNote } from '../types.js';

/**
 * Get all notes for a lead
 */
export function getNotesForLead(db: Database.Database, leadId: number, limit = 50): DbLeadNote[] {
  const stmt = db.prepare(`
    SELECT * FROM lead_notes 
    WHERE lead_id = ? 
    ORDER BY created_at DESC
    LIMIT ?
  `);
  return stmt.all(leadId, limit) as DbLeadNote[];
}

/**
 * Add a note to a lead
 */
export function addLeadNote(
  db: Database.Database, 
  leadId: number, 
  content: string, 
  author = 'user'
): number {
  const stmt = db.prepare(`
    INSERT INTO lead_notes (lead_id, content, author)
    VALUES (?, ?, ?)
  `);
  const result = stmt.run(leadId, content.trim(), author);
  return result.lastInsertRowid as number;
}

/**
 * Update a note
 */
export function updateNote(db: Database.Database, id: number, content: string): boolean {
  const stmt = db.prepare(`
    UPDATE lead_notes 
    SET content = ?
    WHERE id = ?
  `);
  const result = stmt.run(content.trim(), id);
  return result.changes > 0;
}

/**
 * Delete a note
 */
export function deleteNote(db: Database.Database, id: number): boolean {
  const stmt = db.prepare('DELETE FROM lead_notes WHERE id = ?');
  const result = stmt.run(id);
  return result.changes > 0;
}

/**
 * Get note count for a lead
 */
export function getNoteCount(db: Database.Database, leadId: number): number {
  const stmt = db.prepare('SELECT COUNT(*) as count FROM lead_notes WHERE lead_id = ?');
  const result = stmt.get(leadId) as { count: number };
  return result.count;
}

/**
 * Search notes content
 */
export function searchNotes(db: Database.Database, query: string, limit = 100): DbLeadNote[] {
  const stmt = db.prepare(`
    SELECT * FROM lead_notes 
    WHERE content LIKE ? 
    ORDER BY created_at DESC
    LIMIT ?
  `);
  return stmt.all(`%${query}%`, limit) as DbLeadNote[];
}
