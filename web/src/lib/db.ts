/**
 * Web Database Layer
 * 
 * This file re-exports the centralized queries from shared/queries
 * and provides web-specific extensions (like getNextLead with constants).
 * 
 * Migrations are handled by the worker (pnpm migrate).
 * The web assumes the database schema is already up to date.
 */

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

// ===== RE-EXPORTS FROM SHARED =====

// Re-export types
export type { 
  LeadStatus, 
  CallStatus, 
  EmailStatus, 
  PhoneType, 
  WebsiteStatus, 
  LeadSource, 
  DbLead 
} from '../../../shared/types.js';

// Re-export query types
export type {
  Lead,
  LeadFilters,
  AdvancedLeadFilters,
  LeadHistoryEntry,
  HistoryType,
  CallSession,
  LeadStats,
  GamifiedStats,
  TodayStats,
  StreakInfo,
  TopLead,
  StatsPeriod,
  FollowupLead,
  FollowupUrgency,
  // Scraper config types
  ScraperNiche,
  ScraperCity,
  ScraperSettings,
  ScraperConfigFromDb,
} from '../../../shared/queries/index.js';

// Re-export scraper config functions (used with getDb() directly)
export * as scraperConfig from '../../../shared/queries/scraperConfig.js';

// Import query functions (will be wrapped with getDb())
import * as queries from '../../../shared/queries/index.js';
import type { DbLead, LeadStatus, CallStatus } from '../../../shared/types.js';
import type { Lead } from '@/types';

// ===== DATABASE CONNECTION =====

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
  }
  return db;
}

// ===== TRANSFORMATION =====

/**
 * Transform DbLead to Lead (parse JSON fields)
 * @deprecated Use queries.transformDbLead instead
 */
export function transformDbLead(dbLead: DbLead): Lead {
  return queries.transformDbLead(dbLead) as Lead;
}

// ===== WRAPPED QUERY FUNCTIONS =====
// These wrap shared/queries functions with getDb() for convenience

// Lead queries
export function findLeads(filters: queries.LeadFilters = {}): Lead[] {
  return queries.findLeads(getDb(), filters) as Lead[];
}

export function findLeadsAdvanced(filters: queries.AdvancedLeadFilters = {}): Lead[] {
  return queries.findLeadsAdvanced(getDb(), filters) as Lead[];
}

export function countLeads(filters: Omit<queries.LeadFilters, 'limit' | 'offset' | 'orderBy' | 'orderDir'> = {}): number {
  return queries.countLeads(getDb(), filters);
}

export function countLeadsAdvanced(filters: Omit<queries.AdvancedLeadFilters, 'limit' | 'offset' | 'orderBy' | 'orderDir'> = {}): number {
  return queries.countLeadsAdvanced(getDb(), filters);
}

export function findById(id: number): Lead | null {
  return queries.findById(getDb(), id) as Lead | null;
}

export function updateLead(id: number, data: Partial<DbLead>): boolean {
  return queries.updateLead(getDb(), id, data);
}

export function updateStatus(id: number, status: LeadStatus): boolean {
  return queries.updateStatus(getDb(), id, status);
}

export function scheduleFollowup(id: number, date: string): boolean {
  return queries.scheduleFollowup(getDb(), id, date);
}

export function softDeleteLead(id: number): boolean {
  return queries.softDeleteLead(getDb(), id);
}

export function restoreLead(id: number): boolean {
  return queries.restoreLead(getDb(), id);
}

export function logCall(id: number, callStatus: CallStatus, note?: string): boolean {
  return queries.logCall(getDb(), id, callStatus, note);
}

export function addNote(id: number, note: string): boolean {
  return queries.addNote(getDb(), id, note);
}

export function markOptOut(id: number): boolean {
  return queries.markOptOut(getDb(), id);
}

export function getDistinctCities(): string[] {
  return queries.getDistinctCities(getDb());
}

export function getDistinctNiches(): string[] {
  return queries.getDistinctNiches(getDb());
}

export function getFollowups(): queries.FollowupLead[] {
  return queries.getFollowups(getDb());
}

// History queries
export function addHistory(entry: Omit<queries.LeadHistoryEntry, 'id' | 'created_at'>): number {
  return queries.addHistory(getDb(), entry);
}

export function getLeadHistory(leadId: number, limit = 50): queries.LeadHistoryEntry[] {
  return queries.getLeadHistory(getDb(), leadId, limit);
}

// Session queries
export function startSession(): queries.CallSession {
  return queries.startSession(getDb());
}

export function endSession(id: number): queries.CallSession | null {
  return queries.endSession(getDb(), id);
}

export function updateSessionStats(
  id: number, 
  stats: Partial<Pick<queries.CallSession, 'total_calls' | 'total_reached' | 'total_voicemail' | 'total_scheduled'>>
): boolean {
  return queries.updateSessionStats(getDb(), id, stats);
}

export function getActiveSession(): queries.CallSession | null {
  return queries.getActiveSession(getDb());
}

export function getSessionById(id: number): queries.CallSession | null {
  return queries.getSessionById(getDb(), id);
}

// Stats queries
export function getStats(): queries.LeadStats {
  return queries.getStats(getDb());
}

export function getGamifiedStats(period: queries.StatsPeriod = '24h'): queries.GamifiedStats {
  return queries.getGamifiedStats(getDb(), period);
}

// ===== WEB-SPECIFIC: NEXT LEAD ALGORITHM =====

import { LEAD_SELECTION_CONFIG } from './constants.js';

/**
 * Vérifie si l'heure actuelle correspond au best_call_time du lead
 */
function matchesBestCallTime(bestCallTime: string | null): boolean {
  if (!bestCallTime) return false;
  
  const now = new Date();
  const currentHour = now.getHours();
  
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
  
  // Bonus contexte d'appel
  if (matchesBestCallTime(lead.best_call_time)) {
    adjustedScore += config.bonusBestCallTime;
  }
  if (!lead.website) {
    adjustedScore += config.bonusNoWebsite;
  }
  if (lead.priority === 'high') {
    adjustedScore += config.bonusPriorityHigh;
  } else if (lead.priority === 'medium') {
    adjustedScore += config.bonusPriorityMedium;
  }
  if (lead.phone_type === 'perso') {
    adjustedScore += config.bonusPhonePerso;
  }
  
  // Bonus informations enrichies
  if (lead.dirigeant) {
    adjustedScore += config.bonusDirigeant;
  }
  if (lead.siren) {
    adjustedScore += config.bonusSiren;
  }
  if (lead.pain_points) {
    try {
      const painPoints = JSON.parse(lead.pain_points);
      if (Array.isArray(painPoints) && painPoints.length > 0) {
        adjustedScore += config.bonusPainPoints;
      }
    } catch {
      // Ignore parse errors
    }
  }
  if (lead.cms_type || lead.page_load_time) {
    adjustedScore += config.bonusWebsiteAnalyzed;
  }
  if (lead.rating && lead.rating >= 4.0) {
    adjustedScore += config.bonusGoodRating;
  }
  if (lead.reviews_count && lead.reviews_count > 0) {
    adjustedScore += config.bonusHasReviews;
  }
  
  // Malus tentatives
  adjustedScore -= (lead.attempts_count || 0) * config.malusPerAttempt;
  
  return adjustedScore;
}

export interface NextLeadOptions {
  excludeIds?: number[];
  recentNiches?: string[];
}

export function getNextLead(excludeIds: number[] = [], options: Omit<NextLeadOptions, 'excludeIds'> = {}): Lead | null {
  const database = getDb();
  const config = LEAD_SELECTION_CONFIG;
  
  const params: Record<string, unknown> = {
    maxAttempts: config.maxAttempts,
    coolingOffHours: `-${config.coolingOffHours} hours`,
  };
  
  let excludeClause = '';
  if (excludeIds.length > 0) {
    const validIds = excludeIds.filter(id => Number.isInteger(id) && id > 0);
    if (validIds.length > 0) {
      const placeholders = validIds.map((_, i) => `@excludeId${i}`).join(',');
      excludeClause = `AND id NOT IN (${placeholders})`;
      validIds.forEach((id, i) => { params[`excludeId${i}`] = id; });
    }
  }
  
  const globalFilters = `
    AND opt_out = 0
    AND status NOT IN ('converti', 'perdu')
    AND attempts_count < @maxAttempts
    AND (last_contact_at IS NULL OR last_contact_at < datetime('now', @coolingOffHours))
    AND deleted_at IS NULL
  `;
  
  let nicheFilter = '';
  if (options.recentNiches && options.recentNiches.length >= config.maxConsecutiveSameNiche) {
    const lastNiche = options.recentNiches[0];
    const consecutiveCount = options.recentNiches.filter(n => n === lastNiche).length;
    if (consecutiveCount >= config.maxConsecutiveSameNiche && lastNiche) {
      nicheFilter = `AND (niche IS NULL OR niche != @excludeNiche)`;
      params.excludeNiche = lastNiche;
    }
  }
  
  // 1. Relances en retard
  const overdue = database.prepare(`
    SELECT * FROM leads 
    WHERE next_followup_at < datetime('now')
    ${globalFilters}
    ${excludeClause}
    ${nicheFilter}
    ORDER BY next_followup_at ASC
    LIMIT 1
  `).get(params) as DbLead | undefined;
  if (overdue) return transformDbLead(overdue);
  
  // 2. Relances aujourd'hui
  const todayFollowup = database.prepare(`
    SELECT * FROM leads 
    WHERE date(next_followup_at) = date('now')
    AND datetime(next_followup_at) >= datetime('now')
    ${globalFilters}
    ${excludeClause}
    ${nicheFilter}
    ORDER BY next_followup_at ASC
    LIMIT 1
  `).get(params) as DbLead | undefined;
  if (todayFollowup) return transformDbLead(todayFollowup);
  
  // 3. Nouveaux leads jamais appelés - triés par score ajusté
  const freshLeads = database.prepare(`
    SELECT * FROM leads 
    WHERE call_status = 'non_appele'
    AND status = 'nouveau'
    ${globalFilters}
    ${excludeClause}
    ${nicheFilter}
    ORDER BY created_at ASC
    LIMIT 50
  `).all(params) as DbLead[];
  
  if (freshLeads.length > 0) {
    const scoredLeads = freshLeads
      .map(lead => ({ lead, adjustedScore: calculateAdjustedScore(lead) }))
      .sort((a, b) => b.adjustedScore - a.adjustedScore);
    
    return transformDbLead(scoredLeads[0].lead);
  }
  
  // 4. Leads à rappeler depuis > 24h
  const staleLeads = database.prepare(`
    SELECT * FROM leads 
    WHERE call_status = 'rappeler'
    AND last_contact_at < datetime('now', '-1 day')
    ${globalFilters}
    ${excludeClause}
    ${nicheFilter}
    ORDER BY last_contact_at ASC
    LIMIT 50
  `).all(params) as DbLead[];
  
  if (staleLeads.length > 0) {
    const scoredLeads = staleLeads
      .map(lead => ({ lead, adjustedScore: calculateAdjustedScore(lead) }))
      .sort((a, b) => b.adjustedScore - a.adjustedScore);
    
    return transformDbLead(scoredLeads[0].lead);
  }
  
  // 5. Fallback sans filtre de niche
  if (nicheFilter) {
    return getNextLead(excludeIds, { recentNiches: [] });
  }
  
  return null;
}

// ===== WEB-SPECIFIC: LOG WITH HISTORY =====

export function logCallWithHistory(
  id: number, 
  callStatus: CallStatus, 
  note?: string
): boolean {
  const lead = findById(id);
  if (!lead) return false;
  
  addHistory({
    lead_id: id,
    type: 'call',
    old_value: lead.call_status,
    new_value: callStatus,
    note: note ?? null,
    duration_seconds: null,
  });
  
  let newStatus = lead.status;
  
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
  
  const database = getDb();
  const stmt = database.prepare(`
    UPDATE leads 
    SET 
      call_status = ?,
      status = ?,
      last_contact_at = datetime('now'),
      notes = CASE 
        WHEN notes IS NULL THEN ?
        WHEN ? IS NULL THEN notes
        ELSE notes || char(10) || ?
      END,
      updated_at = datetime('now')
    WHERE id = ? AND deleted_at IS NULL
  `);
  
  const timestamp = new Date().toLocaleString('fr-FR');
  const formattedNote = note ? `[${timestamp}] 📞 ${note}` : null;
  
  const result = stmt.run(
    callStatus, 
    newStatus, 
    formattedNote, 
    formattedNote, 
    formattedNote, 
    id
  );
  
  return result.changes > 0;
}

export function updateStatusWithHistory(id: number, status: LeadStatus, note?: string): boolean {
  const lead = findById(id);
  if (!lead) return false;
  
  addHistory({
    lead_id: id,
    type: 'status_change',
    old_value: lead.status,
    new_value: status,
    note: note ?? null,
    duration_seconds: null,
  });
  
  return updateStatus(id, status);
}

export function scheduleFollowupWithHistory(id: number, date: string, note?: string): boolean {
  const lead = findById(id);
  if (!lead) return false;
  
  addHistory({
    lead_id: id,
    type: 'followup_set',
    old_value: lead.next_followup_at,
    new_value: date,
    note: note ?? null,
    duration_seconds: null,
  });
  
  return scheduleFollowup(id, date);
}
