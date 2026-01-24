import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

// Re-export les types depuis shared
export type { 
  LeadStatus, 
  CallStatus, 
  EmailStatus, 
  PhoneType, 
  WebsiteStatus, 
  LeadSource, 
  DbLead 
} from '../../../shared/types.js';

import type { DbLead, LeadStatus, CallStatus } from '../../../shared/types.js';
import type { Lead } from '@/types';

// Type alias for SQLite row results that contain full lead data
type DbLeadRow = DbLead;

/**
 * Transform DbLead to Lead (parse JSON fields)
 * Uses DbLeadRow to handle SQLite result typing
 */
export function transformDbLead(dbLead: DbLeadRow): Lead {
  return {
    ...dbLead,
    has_booking: Boolean(dbLead.has_booking),
    has_seo: Boolean(dbLead.has_seo),
    has_mobile_friendly: dbLead.has_mobile_friendly !== null ? Boolean(dbLead.has_mobile_friendly) : null,
    has_ssl: dbLead.has_ssl !== null ? Boolean(dbLead.has_ssl) : null,
    pain_points: dbLead.pain_points ? JSON.parse(dbLead.pain_points) : null,
  } as Lead;
}

// DB Path - Trouver le chemin vers data/leads.db
// 1. Priorité: variable d'environnement DATABASE_PATH
// 2. Fallback: chercher le dossier data/ relativement au cwd
function findDbPath(): string {
  if (process.env.DATABASE_PATH) {
    return process.env.DATABASE_PATH;
  }
  
  const cwd = process.cwd();
  
  // Cas 1: cwd = .../leads-finder/web → ../data/leads.db
  const fromWeb = path.join(cwd, '..', 'data', 'leads.db');
  if (fs.existsSync(path.dirname(fromWeb))) {
    return fromWeb;
  }
  
  // Cas 2: cwd = .../leads-finder (turbopack workspace) → data/leads.db  
  const fromRoot = path.join(cwd, 'data', 'leads.db');
  if (fs.existsSync(path.dirname(fromRoot))) {
    return fromRoot;
  }
  
  // Fallback: créer dans data/
  const dbDir = path.join(cwd, 'data');
  fs.mkdirSync(dbDir, { recursive: true });
  return path.join(dbDir, 'leads.db');
}

const DB_PATH = findDbPath();

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    migrateSchema(db);
  }
  return db;
}

/**
 * Migration du schéma - ajoute les tables et colonnes manquantes
 * Le worker crée le schéma initial, le web le complète si nécessaire
 */
function migrateSchema(database: Database.Database): void {
  // Vérifier les colonnes existantes
  const columns = database.prepare("PRAGMA table_info(leads)").all() as { name: string }[];
  const columnNames = new Set(columns.map(c => c.name));
  
  // Migrations des colonnes (le worker les crée, mais on s'assure qu'elles existent)
  const migrations: [string, string][] = [
    ['phone_type', "ALTER TABLE leads ADD COLUMN phone_type TEXT CHECK(phone_type IN ('pro', 'perso', 'unknown')) DEFAULT 'unknown'"],
    ['website_status', "ALTER TABLE leads ADD COLUMN website_status TEXT CHECK(website_status IN ('none', 'old', 'platform', 'modern'))"],
    ['score', "ALTER TABLE leads ADD COLUMN score INTEGER DEFAULT 50"],
    ['opening_hours', "ALTER TABLE leads ADD COLUMN opening_hours TEXT"],
    ['best_call_time', "ALTER TABLE leads ADD COLUMN best_call_time TEXT"],
    ['has_booking', "ALTER TABLE leads ADD COLUMN has_booking INTEGER DEFAULT 0"],
    ['has_seo', "ALTER TABLE leads ADD COLUMN has_seo INTEGER DEFAULT 0"],
    ['last_gmb_update', "ALTER TABLE leads ADD COLUMN last_gmb_update TEXT"],
    ['attempts_count', "ALTER TABLE leads ADD COLUMN attempts_count INTEGER DEFAULT 0"],
    ['opt_out', "ALTER TABLE leads ADD COLUMN opt_out INTEGER DEFAULT 0"],
    ['image_url', "ALTER TABLE leads ADD COLUMN image_url TEXT"],
  ];
  
  for (const [column, sql] of migrations) {
    if (!columnNames.has(column)) {
      try {
        database.exec(sql);
        console.log(`[DB] Migration: ajout colonne ${column}`);
      } catch {
        // Ignore si déjà existe
      }
    }
  }
  
  // Tables additionnelles pour le web
  database.exec(`
    -- Table historique des interactions
    CREATE TABLE IF NOT EXISTS lead_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lead_id INTEGER NOT NULL,
      type TEXT CHECK(type IN ('call', 'email', 'note', 'status_change', 'followup_set')) NOT NULL,
      old_value TEXT,
      new_value TEXT,
      note TEXT,
      duration_seconds INTEGER,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE
    );
    
    CREATE INDEX IF NOT EXISTS idx_history_lead ON lead_history(lead_id);
    CREATE INDEX IF NOT EXISTS idx_history_date ON lead_history(created_at);
    
    -- Table sessions de prospection
    CREATE TABLE IF NOT EXISTS call_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      started_at TEXT NOT NULL DEFAULT (datetime('now')),
      ended_at TEXT,
      total_calls INTEGER DEFAULT 0,
      total_reached INTEGER DEFAULT 0,
      total_voicemail INTEGER DEFAULT 0,
      total_scheduled INTEGER DEFAULT 0,
      notes TEXT
    );
    
    -- Table scripts d'appel
    CREATE TABLE IF NOT EXISTS call_scripts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      niche TEXT,
      type TEXT CHECK(type IN ('intro', 'objection', 'closing')) NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      is_active INTEGER DEFAULT 1
    );
  `);
}

// ===== QUERIES =====

export interface LeadFilters {
  status?: LeadStatus;
  call_status?: CallStatus;
  city?: string;
  niche?: string;
  priority?: 'high' | 'medium' | 'low';
  search?: string;
  limit?: number;
  offset?: number;
  orderBy?: string;
  orderDir?: 'asc' | 'desc';
}

export function findLeads(filters: LeadFilters = {}): DbLead[] {
  const database = getDb();
  
  const conditions: string[] = [];
  const params: Record<string, unknown> = {};
  
  if (filters.status) {
    conditions.push('status = @status');
    params.status = filters.status;
  }
  
  if (filters.call_status) {
    conditions.push('call_status = @call_status');
    params.call_status = filters.call_status;
  }
  
  if (filters.city) {
    conditions.push('city LIKE @city');
    params.city = `%${filters.city}%`;
  }
  
  if (filters.niche) {
    conditions.push('niche = @niche');
    params.niche = filters.niche;
  }
  
  if (filters.priority) {
    conditions.push('priority = @priority');
    params.priority = filters.priority;
  }
  
  if (filters.search) {
    conditions.push('(name LIKE @search OR phone LIKE @search OR city LIKE @search)');
    params.search = `%${filters.search}%`;
  }
  
  let sql = 'SELECT * FROM leads';
  if (conditions.length > 0) {
    sql += ' WHERE ' + conditions.join(' AND ');
  }
  
  // Order
  const orderBy = filters.orderBy || 'created_at';
  const orderDir = filters.orderDir || 'desc';
  sql += ` ORDER BY ${orderBy} ${orderDir.toUpperCase()}`;
  
  // Pagination
  const limit = filters.limit || 25;
  const offset = filters.offset || 0;
  sql += ` LIMIT ${limit} OFFSET ${offset}`;
  
  const stmt = database.prepare(sql);
  return stmt.all(params) as DbLead[];
}

export function countLeads(filters: Omit<LeadFilters, 'limit' | 'offset' | 'orderBy' | 'orderDir'> = {}): number {
  const database = getDb();
  
  const conditions: string[] = [];
  const params: Record<string, unknown> = {};
  
  if (filters.status) {
    conditions.push('status = @status');
    params.status = filters.status;
  }
  if (filters.call_status) {
    conditions.push('call_status = @call_status');
    params.call_status = filters.call_status;
  }
  if (filters.city) {
    conditions.push('city LIKE @city');
    params.city = `%${filters.city}%`;
  }
  if (filters.priority) {
    conditions.push('priority = @priority');
    params.priority = filters.priority;
  }
  if (filters.search) {
    conditions.push('(name LIKE @search OR phone LIKE @search OR city LIKE @search)');
    params.search = `%${filters.search}%`;
  }
  
  let sql = 'SELECT COUNT(*) as count FROM leads';
  if (conditions.length > 0) {
    sql += ' WHERE ' + conditions.join(' AND ');
  }
  
  const stmt = database.prepare(sql);
  const result = stmt.get(params) as { count: number };
  return result.count;
}

export function findById(id: number): DbLead | null {
  const database = getDb();
  const stmt = database.prepare('SELECT * FROM leads WHERE id = ?');
  return (stmt.get(id) as DbLead) ?? null;
}

export function updateLead(id: number, data: Partial<DbLead>): boolean {
  const database = getDb();
  
  const fields: string[] = [];
  const params: Record<string, unknown> = { id };
  
  const allowedFields = ['status', 'call_status', 'email_status', 'priority', 'notes', 'next_followup_at'];
  
  for (const field of allowedFields) {
    if (field in data) {
      fields.push(`${field} = @${field}`);
      params[field] = data[field as keyof DbLead];
    }
  }
  
  if (fields.length === 0) return false;
  
  fields.push("updated_at = datetime('now')");
  
  const sql = `UPDATE leads SET ${fields.join(', ')} WHERE id = @id`;
  const stmt = database.prepare(sql);
  const result = stmt.run(params);
  return result.changes > 0;
}

export function logCall(id: number, callStatus: CallStatus, note?: string): boolean {
  const database = getDb();
  const stmt = database.prepare(`
    UPDATE leads 
    SET 
      call_status = ?,
      last_contact_at = datetime('now'),
      notes = CASE 
        WHEN notes IS NULL THEN ?
        WHEN ? IS NULL THEN notes
        ELSE notes || char(10) || ?
      END,
      updated_at = datetime('now')
    WHERE id = ?
  `);
  const timestamp = new Date().toLocaleString('fr-FR');
  const formattedNote = note ? `[${timestamp}] 📞 ${note}` : null;
  const result = stmt.run(callStatus, formattedNote, formattedNote, formattedNote, id);
  return result.changes > 0;
}

export function addNote(id: number, note: string): boolean {
  const database = getDb();
  const stmt = database.prepare(`
    UPDATE leads 
    SET 
      notes = CASE 
        WHEN notes IS NULL THEN ?
        ELSE notes || char(10) || ?
      END,
      updated_at = datetime('now')
    WHERE id = ?
  `);
  const timestamp = new Date().toLocaleString('fr-FR');
  const formattedNote = `[${timestamp}] ${note}`;
  const result = stmt.run(formattedNote, formattedNote, id);
  return result.changes > 0;
}

export function updateStatus(id: number, status: LeadStatus): boolean {
  const database = getDb();
  const stmt = database.prepare(`
    UPDATE leads 
    SET status = ?, updated_at = datetime('now')
    WHERE id = ?
  `);
  const result = stmt.run(status, id);
  return result.changes > 0;
}

export function scheduleFollowup(id: number, date: string): boolean {
  const database = getDb();
  const stmt = database.prepare(`
    UPDATE leads 
    SET next_followup_at = ?, updated_at = datetime('now')
    WHERE id = ?
  `);
  const result = stmt.run(date, id);
  return result.changes > 0;
}

// ===== STATS =====

export interface LeadStats {
  total: number;
  by_status: Record<LeadStatus, number>;
  by_call_status: Record<CallStatus, number>;
  by_priority: Record<string, number>;
  by_city: Record<string, number>;
  followups_today: number;
  to_call: number;
}

export function getStats(): LeadStats {
  const database = getDb();
  
  const total = (database.prepare('SELECT COUNT(*) as count FROM leads').get() as { count: number }).count;
  
  const statusRows = database.prepare('SELECT status, COUNT(*) as count FROM leads GROUP BY status').all() as { status: LeadStatus; count: number }[];
  const by_status: Record<LeadStatus, number> = {
    nouveau: 0, contacte: 0, qualifie: 0, proposition: 0, converti: 0, perdu: 0
  };
  for (const row of statusRows) {
    by_status[row.status] = row.count;
  }
  
  const callRows = database.prepare('SELECT call_status, COUNT(*) as count FROM leads GROUP BY call_status').all() as { call_status: CallStatus; count: number }[];
  const by_call_status: Record<CallStatus, number> = {
    non_appele: 0, appele: 0, rappeler: 0, injoignable: 0
  };
  for (const row of callRows) {
    by_call_status[row.call_status] = row.count;
  }
  
  const priorityRows = database.prepare('SELECT priority, COUNT(*) as count FROM leads GROUP BY priority').all() as { priority: string; count: number }[];
  const by_priority: Record<string, number> = {};
  for (const row of priorityRows) {
    by_priority[row.priority] = row.count;
  }
  
  const cityRows = database.prepare('SELECT city, COUNT(*) as count FROM leads GROUP BY city ORDER BY count DESC LIMIT 10').all() as { city: string; count: number }[];
  const by_city: Record<string, number> = {};
  for (const row of cityRows) {
    by_city[row.city] = row.count;
  }
  
  const followups_today = (database.prepare(`
    SELECT COUNT(*) as count FROM leads 
    WHERE date(next_followup_at) <= date('now')
  `).get() as { count: number }).count;
  
  const to_call = (database.prepare(`
    SELECT COUNT(*) as count FROM leads 
    WHERE call_status = 'non_appele' AND status = 'nouveau'
  `).get() as { count: number }).count;
  
  return {
    total,
    by_status,
    by_call_status,
    by_priority,
    by_city,
    followups_today,
    to_call,
  };
}

// ===== CITIES & NICHES =====

export function getDistinctCities(): string[] {
  const database = getDb();
  const rows = database.prepare("SELECT DISTINCT city FROM leads WHERE city != '' ORDER BY city").all() as { city: string }[];
  return rows.map(r => r.city);
}

export function getDistinctNiches(): string[] {
  const database = getDb();
  const rows = database.prepare('SELECT DISTINCT niche FROM leads WHERE niche IS NOT NULL ORDER BY niche').all() as { niche: string }[];
  return rows.map(r => r.niche);
}

// ===== HISTORIQUE =====

export type HistoryType = 'call' | 'email' | 'note' | 'status_change' | 'followup_set';

export interface LeadHistoryEntry {
  id: number;
  lead_id: number;
  type: HistoryType;
  old_value: string | null;
  new_value: string | null;
  note: string | null;
  duration_seconds: number | null;
  created_at: string;
}

export function addHistory(entry: Omit<LeadHistoryEntry, 'id' | 'created_at'>): number {
  const database = getDb();
  const stmt = database.prepare(`
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

export function getLeadHistory(leadId: number, limit = 50): LeadHistoryEntry[] {
  const database = getDb();
  const stmt = database.prepare(`
    SELECT * FROM lead_history 
    WHERE lead_id = ? 
    ORDER BY created_at DESC 
    LIMIT ?
  `);
  return stmt.all(leadId, limit) as LeadHistoryEntry[];
}

// ===== SESSIONS =====

export interface CallSession {
  id: number;
  started_at: string;
  ended_at: string | null;
  total_calls: number;
  total_reached: number;
  total_voicemail: number;
  total_scheduled: number;
  notes: string | null;
}

export function startSession(): CallSession {
  const database = getDb();
  const stmt = database.prepare(`
    INSERT INTO call_sessions (started_at) VALUES (datetime('now'))
    RETURNING *
  `);
  return stmt.get() as CallSession;
}

export function endSession(id: number): CallSession | null {
  const database = getDb();
  const stmt = database.prepare(`
    UPDATE call_sessions 
    SET ended_at = datetime('now')
    WHERE id = ?
    RETURNING *
  `);
  return (stmt.get(id) as CallSession) ?? null;
}

export function updateSessionStats(id: number, stats: Partial<Pick<CallSession, 'total_calls' | 'total_reached' | 'total_voicemail' | 'total_scheduled'>>): boolean {
  const database = getDb();
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
  
  const stmt = database.prepare(`UPDATE call_sessions SET ${fields.join(', ')} WHERE id = @id`);
  const result = stmt.run(params);
  return result.changes > 0;
}

export function getActiveSession(): CallSession | null {
  const database = getDb();
  const stmt = database.prepare(`
    SELECT * FROM call_sessions 
    WHERE ended_at IS NULL 
    ORDER BY started_at DESC 
    LIMIT 1
  `);
  return (stmt.get() as CallSession) ?? null;
}

export function getSessionById(id: number): CallSession | null {
  const database = getDb();
  const stmt = database.prepare('SELECT * FROM call_sessions WHERE id = ?');
  return (stmt.get(id) as CallSession) ?? null;
}

// ===== NEXT LEAD (INTELLIGENT) =====

import { LEAD_SELECTION_CONFIG } from './constants';

/**
 * Vérifie si l'heure actuelle correspond au best_call_time du lead
 * Format attendu: "10h-12h" ou "14h-18h" ou "10h-12h, 14h-18h"
 */
function matchesBestCallTime(bestCallTime: string | null): boolean {
  if (!bestCallTime) return false;
  
  const now = new Date();
  const currentHour = now.getHours();
  
  // Parser les plages horaires
  const ranges = bestCallTime.split(',').map(r => r.trim());
  
  for (const range of ranges) {
    const match = range.match(/(\d{1,2})h?\s*[-–]\s*(\d{1,2})h?/i);
    if (match) {
      const start = parseInt(match[1]);
      const end = parseInt(match[2]);
      if (currentHour >= start && currentHour < end) {
        return true;
      }
    }
  }
  
  return false;
}

/**
 * Calcule le score ajusté pour un lead selon l'algorithme intelligent
 */
function calculateAdjustedScore(lead: DbLead): number {
  const config = LEAD_SELECTION_CONFIG;
  let adjustedScore = lead.score || 50;
  
  // Bonus heure optimale
  if (matchesBestCallTime(lead.best_call_time)) {
    adjustedScore += config.bonusBestCallTime;
  }
  
  // Bonus pas de site web
  if (!lead.website) {
    adjustedScore += config.bonusNoWebsite;
  }
  
  // Bonus priorité
  if (lead.priority === 'high') {
    adjustedScore += config.bonusPriorityHigh;
  } else if (lead.priority === 'medium') {
    adjustedScore += config.bonusPriorityMedium;
  }
  
  // Malus tentatives
  adjustedScore -= (lead.attempts_count || 0) * config.malusPerAttempt;
  
  // Malus numéro perso
  if (lead.phone_type === 'perso') {
    adjustedScore -= config.malusPhonePerso;
  }
  
  return adjustedScore;
}

export interface NextLeadOptions {
  excludeIds?: number[];
  recentNiches?: string[]; // Les niches des derniers leads appelés
}

export function getNextLead(excludeIds: number[] = [], options: Omit<NextLeadOptions, 'excludeIds'> = {}): Lead | null {
  const database = getDb();
  const config = LEAD_SELECTION_CONFIG;
  
  const excludeClause = excludeIds.length > 0 
    ? `AND id NOT IN (${excludeIds.join(',')})` 
    : '';
  
  // Filtres globaux (toujours appliqués)
  const globalFilters = `
    AND opt_out = 0
    AND status NOT IN ('converti', 'perdu')
    AND attempts_count < ${config.maxAttempts}
    AND (last_contact_at IS NULL OR last_contact_at < datetime('now', '-${config.coolingOffHours} hours'))
  `;
  
  // Filtre de rotation des niches (éviter les mêmes niches consécutives)
  let nicheFilter = '';
  if (options.recentNiches && options.recentNiches.length >= config.maxConsecutiveSameNiche) {
    const lastNiche = options.recentNiches[0];
    const consecutiveCount = options.recentNiches.filter(n => n === lastNiche).length;
    if (consecutiveCount >= config.maxConsecutiveSameNiche && lastNiche) {
      nicheFilter = `AND (niche IS NULL OR niche != '${lastNiche.replace(/'/g, "''")}') `;
    }
  }
  
  // 1. Relances en retard (plus ancien d'abord) - PRIORITÉ ABSOLUE
  const overdue = database.prepare(`
    SELECT * FROM leads 
    WHERE next_followup_at < datetime('now')
    ${globalFilters}
    ${excludeClause}
    ${nicheFilter}
    ORDER BY next_followup_at ASC
    LIMIT 1
  `).get() as DbLeadRow | undefined;
  if (overdue) return transformDbLead(overdue);
  
  // 2. Relances aujourd'hui (plus tôt d'abord)
  const todayFollowup = database.prepare(`
    SELECT * FROM leads 
    WHERE date(next_followup_at) = date('now')
    AND datetime(next_followup_at) >= datetime('now')
    ${globalFilters}
    ${excludeClause}
    ${nicheFilter}
    ORDER BY next_followup_at ASC
    LIMIT 1
  `).get() as DbLeadRow | undefined;
  if (todayFollowup) return transformDbLead(todayFollowup);
  
  // 3. Nouveaux leads jamais appelés - triés par SCORE AJUSTÉ
  const freshLeads = database.prepare(`
    SELECT * FROM leads 
    WHERE call_status = 'non_appele'
    AND status = 'nouveau'
    ${globalFilters}
    ${excludeClause}
    ${nicheFilter}
    ORDER BY created_at ASC
    LIMIT 50
  `).all() as DbLeadRow[];
  
  if (freshLeads.length > 0) {
    // Calculer le score ajusté pour chaque lead et trier
    const scoredLeads = freshLeads
      .map(lead => ({ lead, adjustedScore: calculateAdjustedScore(lead) }))
      .sort((a, b) => b.adjustedScore - a.adjustedScore);
    
    return transformDbLead(scoredLeads[0].lead);
  }
  
  // 4. Leads à rappeler depuis > 24h - triés par SCORE AJUSTÉ
  const staleLeads = database.prepare(`
    SELECT * FROM leads 
    WHERE call_status = 'rappeler'
    AND last_contact_at < datetime('now', '-1 day')
    ${globalFilters}
    ${excludeClause}
    ${nicheFilter}
    ORDER BY last_contact_at ASC
    LIMIT 50
  `).all() as DbLeadRow[];
  
  if (staleLeads.length > 0) {
    const scoredLeads = staleLeads
      .map(lead => ({ lead, adjustedScore: calculateAdjustedScore(lead) }))
      .sort((a, b) => b.adjustedScore - a.adjustedScore);
    
    return transformDbLead(scoredLeads[0].lead);
  }
  
  // 5. Fallback sans filtre de niche (si on a bloqué par rotation)
  if (nicheFilter) {
    return getNextLead(excludeIds, { recentNiches: [] });
  }
  
  return null;
}

// ===== FOLLOWUPS =====

export interface FollowupLead extends DbLead {
  urgency: 'overdue' | 'today' | 'tomorrow' | 'week';
}

export function getFollowups(): FollowupLead[] {
  const database = getDb();
  
  const rows = database.prepare(`
    SELECT *,
      CASE 
        WHEN next_followup_at < datetime('now') THEN 'overdue'
        WHEN date(next_followup_at) = date('now') THEN 'today'
        WHEN date(next_followup_at) = date('now', '+1 day') THEN 'tomorrow'
        ELSE 'week'
      END as urgency
    FROM leads 
    WHERE next_followup_at IS NOT NULL
    AND next_followup_at <= datetime('now', '+7 days')
    AND status NOT IN ('converti', 'perdu')
    ORDER BY 
      CASE 
        WHEN next_followup_at < datetime('now') THEN 0
        WHEN date(next_followup_at) = date('now') THEN 1
        WHEN date(next_followup_at) = date('now', '+1 day') THEN 2
        ELSE 3
      END,
      next_followup_at ASC
  `).all() as FollowupLead[];
  
  return rows;
}

// ===== ENHANCED LOG CALL WITH HISTORY =====

export function logCallWithHistory(
  id: number, 
  callStatus: CallStatus, 
  note?: string
): boolean {
  const database = getDb();
  const lead = findById(id);
  if (!lead) return false;
  
  // Add to history
  addHistory({
    lead_id: id,
    type: 'call',
    old_value: lead.call_status,
    new_value: callStatus,
    note: note ?? null,
    duration_seconds: null,
  });
  
  // Prepare updates
  const nextFollowup = lead.next_followup_at;
  let newStatus = lead.status;
  
  // Auto-update status to 'contacte' if first real contact
  if (lead.status === 'nouveau' && callStatus === 'appele') {
    newStatus = 'contacte';
    addHistory({
      lead_id: id,
      type: 'status_change',
      old_value: lead.status,
      new_value: newStatus,
      note: 'Premier contact',
      duration_seconds: null,
    });
  }
  
  // Update lead
  const stmt = database.prepare(`
    UPDATE leads 
    SET 
      call_status = ?,
      status = ?,
      last_contact_at = datetime('now'),
      next_followup_at = ?,
      notes = CASE 
        WHEN notes IS NULL THEN ?
        WHEN ? IS NULL THEN notes
        ELSE notes || char(10) || ?
      END,
      updated_at = datetime('now')
    WHERE id = ?
  `);
  
  const timestamp = new Date().toLocaleString('fr-FR');
  const formattedNote = note ? `[${timestamp}] 📞 ${note}` : null;
  
  const result = stmt.run(
    callStatus, 
    newStatus, 
    nextFollowup, 
    formattedNote, 
    formattedNote, 
    formattedNote, 
    id
  );
  
  return result.changes > 0;
}

export function updateStatusWithHistory(id: number, status: LeadStatus, note?: string): boolean {
  const database = getDb();
  const lead = findById(id);
  if (!lead) return false;
  
  // Add to history
  addHistory({
    lead_id: id,
    type: 'status_change',
    old_value: lead.status,
    new_value: status,
    note: note ?? null,
    duration_seconds: null,
  });
  
  const stmt = database.prepare(`
    UPDATE leads 
    SET status = ?, updated_at = datetime('now')
    WHERE id = ?
  `);
  const result = stmt.run(status, id);
  return result.changes > 0;
}

export function scheduleFollowupWithHistory(id: number, date: string, note?: string): boolean {
  const database = getDb();
  const lead = findById(id);
  if (!lead) return false;
  
  // Add to history
  addHistory({
    lead_id: id,
    type: 'followup_set',
    old_value: lead.next_followup_at,
    new_value: date,
    note: note ?? null,
    duration_seconds: null,
  });
  
  const stmt = database.prepare(`
    UPDATE leads 
    SET next_followup_at = ?, updated_at = datetime('now')
    WHERE id = ?
  `);
  const result = stmt.run(date, id);
  return result.changes > 0;
}

// ===== GAMIFIED STATS =====

export interface TodayStats {
  calls_today: number;
  calls_goal: number;
  contacts_today: number;
  rdv_today: number;
  avg_call_duration: number;
}

export interface StreakInfo {
  current_streak: number;
  best_streak: number;
  last_activity_date: string | null;
}

export interface TopLead {
  id: number;
  name: string;
  city: string;
  niche: string | null;
  phone: string;
  score: number;
  priority: string;
  website: string | null;
  website_status: string | null;
  pain_points: string[] | null;
  reason: string; // Why this lead is recommended
}

export interface GamifiedStats {
  today: TodayStats;
  streak: StreakInfo;
  top_leads: TopLead[];
  weekly_performance: {
    calls: number[];
    contacts: number[];
    labels: string[];
  };
  conversion_rate: number;
}

export type StatsPeriod = '24h' | '7d' | '30d' | 'all';

function getPeriodFilter(period: StatsPeriod): string {
  switch (period) {
    case '24h':
      return "AND created_at >= datetime('now', '-1 day')";
    case '7d':
      return "AND created_at >= datetime('now', '-7 days')";
    case '30d':
      return "AND created_at >= datetime('now', '-30 days')";
    case 'all':
      return '';
  }
}

function getPeriodDays(period: StatsPeriod): number {
  switch (period) {
    case '24h': return 1;
    case '7d': return 7;
    case '30d': return 30;
    case 'all': return 365;
  }
}

export function getGamifiedStats(period: StatsPeriod = '24h'): GamifiedStats {
  const database = getDb();
  const periodFilter = getPeriodFilter(period);
  const periodDays = getPeriodDays(period);
  
  // === PERIOD STATS ===
  const callsCount = (database.prepare(`
    SELECT COUNT(*) as count FROM lead_history 
    WHERE type = 'call' ${periodFilter}
  `).get() as { count: number }).count;
  
  const contactsCount = (database.prepare(`
    SELECT COUNT(*) as count FROM lead_history 
    WHERE type = 'call' 
    ${periodFilter}
    AND new_value IN ('interesse', 'rdv_pris', 'devis_envoye', 'rappeler')
  `).get() as { count: number }).count;
  
  const rdvCount = (database.prepare(`
    SELECT COUNT(*) as count FROM lead_history 
    WHERE type = 'call' 
    ${periodFilter}
    AND new_value = 'rdv_pris'
  `).get() as { count: number }).count;
  
  const avgDuration = (database.prepare(`
    SELECT AVG(duration_seconds) as avg FROM lead_history 
    WHERE type = 'call' 
    ${periodFilter}
    AND duration_seconds IS NOT NULL
  `).get() as { avg: number | null }).avg ?? 0;

  // Daily goal based on period
  const callsGoal = period === '24h' ? 25 : period === '7d' ? 175 : period === '30d' ? 500 : 1000;
  
  // === STREAK CALCULATION ===
  // Get days with activity in last 30 days
  const activityDays = database.prepare(`
    SELECT DISTINCT date(created_at) as day FROM lead_history 
    WHERE type = 'call'
    AND created_at >= datetime('now', '-30 days')
    ORDER BY day DESC
  `).all() as { day: string }[];
  
  let currentStreak = 0;
  const checkDate = new Date();
  checkDate.setHours(0, 0, 0, 0);
  
  // Check if there's activity today
  const todayStr = checkDate.toISOString().split('T')[0];
  const hasActivityToday = activityDays.some(d => d.day === todayStr);
  
  if (!hasActivityToday) {
    // Check yesterday - if no activity, streak is broken
    checkDate.setDate(checkDate.getDate() - 1);
  }
  
  // Clone to avoid mutating the check date
  const streakDate = new Date(checkDate);
  for (const activityDay of activityDays) {
    const expectedDate = streakDate.toISOString().split('T')[0];
    if (activityDay.day === expectedDate) {
      currentStreak++;
      streakDate.setDate(streakDate.getDate() - 1);
    } else if (activityDay.day < expectedDate) {
      break; // Streak broken
    }
  }
  
  // Best streak (simplified - would need historical tracking for accuracy)
  const bestStreak = Math.max(currentStreak, 5); // Placeholder
  
  // === TOP LEADS ===
  const topLeadsRows = database.prepare(`
    SELECT 
      id, name, city, niche, phone, score, priority, website, website_status, pain_points
    FROM leads 
    WHERE status = 'nouveau' 
    AND call_status = 'non_appele'
    AND (opt_out IS NULL OR opt_out = 0)
    ORDER BY 
      CASE WHEN website IS NULL OR website = '' THEN 0 ELSE 1 END,
      score DESC,
      priority = 'high' DESC
    LIMIT 5
  `).all() as DbLead[];
  
  const topLeads: TopLead[] = topLeadsRows.map(lead => {
    let reason = '';
    if (!lead.website) {
      reason = '🚫 Pas de site web';
    } else if (lead.website_status === 'old') {
      reason = '⚠️ Site vieillot';
    } else if (lead.website_status === 'platform') {
      reason = '📦 Site plateforme limitant';
    } else if (lead.score && lead.score >= 70) {
      reason = '⭐ Score élevé';
    } else {
      reason = '📞 À contacter';
    }
    
    return {
      id: lead.id,
      name: lead.name,
      city: lead.city,
      niche: lead.niche,
      phone: lead.phone,
      score: lead.score ?? 50,
      priority: lead.priority,
      website: lead.website,
      website_status: lead.website_status,
      pain_points: lead.pain_points ? JSON.parse(lead.pain_points) : null,
      reason,
    };
  });
  
  // === PERFORMANCE BY PERIOD ===
  const weeklyData = database.prepare(`
    SELECT 
      date(created_at) as day,
      COUNT(*) as calls,
      SUM(CASE WHEN new_value IN ('interesse', 'rdv_pris', 'devis_envoye', 'rappeler') THEN 1 ELSE 0 END) as contacts
    FROM lead_history 
    WHERE type = 'call'
    AND created_at >= datetime('now', '-${periodDays} days')
    GROUP BY date(created_at)
    ORDER BY day
  `).all() as { day: string; calls: number; contacts: number }[];
  
  // Fill in missing days based on period
  const labels: string[] = [];
  const calls: number[] = [];
  const contacts: number[] = [];
  const dayNames = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
  
  const displayDays = Math.min(periodDays, 30); // Max 30 days for chart
  for (let i = displayDays - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dayStr = d.toISOString().split('T')[0];
    const dayData = weeklyData.find(w => w.day === dayStr);
    
    // For longer periods, use date format
    if (periodDays <= 7) {
      labels.push(dayNames[d.getDay()]);
    } else {
      labels.push(`${d.getDate()}/${d.getMonth() + 1}`);
    }
    calls.push(dayData?.calls ?? 0);
    contacts.push(dayData?.contacts ?? 0);
  }
  
  // === CONVERSION RATE ===
  const totalLeads = (database.prepare('SELECT COUNT(*) as count FROM leads').get() as { count: number }).count;
  const convertedLeads = (database.prepare("SELECT COUNT(*) as count FROM leads WHERE status = 'converti'").get() as { count: number }).count;
  const conversionRate = totalLeads > 0 ? Math.round((convertedLeads / totalLeads) * 100) : 0;
  
  return {
    today: {
      calls_today: callsCount,
      calls_goal: callsGoal,
      contacts_today: contactsCount,
      rdv_today: rdvCount,
      avg_call_duration: Math.round(avgDuration),
    },
    streak: {
      current_streak: currentStreak,
      best_streak: bestStreak,
      last_activity_date: activityDays[0]?.day ?? null,
    },
    top_leads: topLeads,
    weekly_performance: {
      calls,
      contacts,
      labels,
    },
    conversion_rate: conversionRate,
  };
}
