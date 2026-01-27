/**
 * Session Queries - Call session operations
 */

import type Database from 'better-sqlite3';
import type { CallSession } from './types.js';

export function startSession(db: Database.Database): CallSession {
  const stmt = db.prepare(`
    INSERT INTO call_sessions (started_at) VALUES (datetime('now'))
    RETURNING *
  `);
  return stmt.get() as CallSession;
}

export function endSession(db: Database.Database, id: number): CallSession | null {
  const stmt = db.prepare(`
    UPDATE call_sessions 
    SET ended_at = datetime('now')
    WHERE id = ?
    RETURNING *
  `);
  return (stmt.get(id) as CallSession) ?? null;
}

export function updateSessionStats(
  db: Database.Database, 
  id: number, 
  stats: Partial<Pick<CallSession, 'total_calls' | 'total_reached' | 'total_voicemail' | 'total_scheduled'>>
): boolean {
  const fields: string[] = [];
  const params: Record<string, unknown> = { id };

  if (stats.total_calls !== undefined) {
    fields.push('total_calls = total_calls + @total_calls');
    params.total_calls = stats.total_calls;
  }
  if (stats.total_reached !== undefined) {
    fields.push('total_reached = total_reached + @total_reached');
    params.total_reached = stats.total_reached;
  }
  if (stats.total_voicemail !== undefined) {
    fields.push('total_voicemail = total_voicemail + @total_voicemail');
    params.total_voicemail = stats.total_voicemail;
  }
  if (stats.total_scheduled !== undefined) {
    fields.push('total_scheduled = total_scheduled + @total_scheduled');
    params.total_scheduled = stats.total_scheduled;
  }

  if (fields.length === 0) return false;

  const stmt = db.prepare(`UPDATE call_sessions SET ${fields.join(', ')} WHERE id = @id`);
  const result = stmt.run(params);
  return result.changes > 0;
}

export function getActiveSession(db: Database.Database): CallSession | null {
  const stmt = db.prepare(`
    SELECT * FROM call_sessions 
    WHERE ended_at IS NULL 
    ORDER BY started_at DESC 
    LIMIT 1
  `);
  return (stmt.get() as CallSession) ?? null;
}

export function getSessionById(db: Database.Database, id: number): CallSession | null {
  const stmt = db.prepare('SELECT * FROM call_sessions WHERE id = ?');
  return (stmt.get(id) as CallSession) ?? null;
}

export function getRecentSessions(db: Database.Database, limit = 10): CallSession[] {
  const stmt = db.prepare(`
    SELECT * FROM call_sessions 
    ORDER BY started_at DESC 
    LIMIT ?
  `);
  return stmt.all(limit) as CallSession[];
}
