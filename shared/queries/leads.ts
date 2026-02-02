/**
 * Lead Queries - Centralized database operations for leads
 * 
 * Toutes les requêtes liées aux leads passent par ce module.
 * Import depuis shared/queries dans worker ET web.
 */

import type Database from 'better-sqlite3';
import type { DbLead, LeadStatus, CallStatus } from '../types';
import type { Lead, LeadFilters, AdvancedLeadFilters, FollowupLead } from './types';
import { transformDbLead } from './types';
import { sanitizeOrderBy, sanitizeOrderDir, softDeleteFilter, combineConditions } from './security';

// ===== FIND LEADS =====

function buildBasicConditions(filters: LeadFilters): { conditions: string[]; params: Record<string, unknown> } {
  const conditions: string[] = [];
  const params: Record<string, unknown> = {};

  // Soft-delete filter
  const deleteFilter = softDeleteFilter(filters.includeDeleted);
  if (deleteFilter) conditions.push(deleteFilter);

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

  return { conditions, params };
}

function buildAdvancedConditions(filters: AdvancedLeadFilters): { conditions: string[]; params: Record<string, unknown> } {
  const { conditions, params } = buildBasicConditions(filters);

  // Enhanced search - searches across more fields
  if (filters.search) {
    // Override basic search with advanced search
    const idx = conditions.findIndex(c => c.includes('name LIKE @search'));
    if (idx !== -1) {
      conditions[idx] = `(
        name LIKE @search 
        OR phone LIKE @search 
        OR city LIKE @search 
        OR address LIKE @search
        OR legal_name LIKE @search
        OR dirigeant LIKE @search
        OR siren LIKE @search
        OR siret LIKE @search
        OR niche LIKE @search
        OR postal_code LIKE @search
      )`;
    }
  }

  // Boolean filters
  if (filters.hasWebsite === 'yes') {
    conditions.push("website IS NOT NULL AND website != ''");
  } else if (filters.hasWebsite === 'no') {
    conditions.push("(website IS NULL OR website = '')");
  }

  if (filters.hasDirigeant === 'yes') {
    conditions.push("dirigeant IS NOT NULL AND dirigeant != ''");
  } else if (filters.hasDirigeant === 'no') {
    conditions.push("(dirigeant IS NULL OR dirigeant = '')");
  }

  if (filters.hasSiren === 'yes') {
    conditions.push("siren IS NOT NULL AND siren != ''");
  } else if (filters.hasSiren === 'no') {
    conditions.push("(siren IS NULL OR siren = '')");
  }

  if (filters.hasPhone === 'yes') {
    conditions.push("phone IS NOT NULL AND phone != ''");
  } else if (filters.hasPhone === 'no') {
    conditions.push("(phone IS NULL OR phone = '')");
  }

  // Range filters
  if (filters.scoreMin !== undefined) {
    conditions.push('score >= @scoreMin');
    params.scoreMin = filters.scoreMin;
  }

  if (filters.scoreMax !== undefined) {
    conditions.push('score <= @scoreMax');
    params.scoreMax = filters.scoreMax;
  }

  if (filters.ratingMin !== undefined) {
    conditions.push('rating >= @ratingMin');
    params.ratingMin = filters.ratingMin;
  }

  if (filters.ratingMax !== undefined) {
    conditions.push('rating <= @ratingMax');
    params.ratingMax = filters.ratingMax;
  }

  // Date filters
  if (filters.createdAfter) {
    conditions.push("created_at >= @createdAfter");
    params.createdAfter = filters.createdAfter;
  }

  if (filters.createdBefore) {
    conditions.push("created_at <= @createdBefore");
    params.createdBefore = filters.createdBefore + ' 23:59:59';
  }

  return { conditions, params };
}

/**
 * Find leads with basic filters
 * Returns raw DbLead (use transformDbLead for frontend)
 */
export function findLeadsRaw(db: Database.Database, filters: LeadFilters = {}): DbLead[] {
  const { conditions, params } = buildBasicConditions(filters);

  let sql = 'SELECT * FROM leads';
  if (conditions.length > 0) {
    sql += ' WHERE ' + conditions.join(' AND ');
  }

  // Order - sécurisé contre injection SQL
  const orderBy = sanitizeOrderBy(filters.orderBy);
  const orderDir = sanitizeOrderDir(filters.orderDir);
  sql += ` ORDER BY ${orderBy} ${orderDir}`;

  // Pagination
  const limit = filters.limit || 25;
  const offset = filters.offset || 0;
  sql += ` LIMIT ${limit} OFFSET ${offset}`;

  const stmt = db.prepare(sql);
  return stmt.all(params) as DbLead[];
}

/**
 * Find leads with basic filters - returns transformed Lead
 */
export function findLeads(db: Database.Database, filters: LeadFilters = {}): Lead[] {
  return findLeadsRaw(db, filters).map(transformDbLead);
}

/**
 * Find leads with advanced filters
 */
export function findLeadsAdvancedRaw(db: Database.Database, filters: AdvancedLeadFilters = {}): DbLead[] {
  const { conditions, params } = buildAdvancedConditions(filters);

  let sql = 'SELECT * FROM leads';
  if (conditions.length > 0) {
    sql += ' WHERE ' + conditions.join(' AND ');
  }

  const orderBy = sanitizeOrderBy(filters.orderBy);
  const orderDir = sanitizeOrderDir(filters.orderDir);
  sql += ` ORDER BY ${orderBy} ${orderDir}`;

  const limit = filters.limit || 25;
  const offset = filters.offset || 0;
  sql += ` LIMIT ${limit} OFFSET ${offset}`;

  const stmt = db.prepare(sql);
  return stmt.all(params) as DbLead[];
}

export function findLeadsAdvanced(db: Database.Database, filters: AdvancedLeadFilters = {}): Lead[] {
  return findLeadsAdvancedRaw(db, filters).map(transformDbLead);
}

// ===== COUNT LEADS =====

export function countLeads(db: Database.Database, filters: Omit<LeadFilters, 'limit' | 'offset' | 'orderBy' | 'orderDir'> = {}): number {
  const { conditions, params } = buildBasicConditions(filters);

  let sql = 'SELECT COUNT(*) as count FROM leads';
  if (conditions.length > 0) {
    sql += ' WHERE ' + conditions.join(' AND ');
  }

  const stmt = db.prepare(sql);
  const result = stmt.get(params) as { count: number };
  return result.count;
}

export function countLeadsAdvanced(db: Database.Database, filters: Omit<AdvancedLeadFilters, 'limit' | 'offset' | 'orderBy' | 'orderDir'> = {}): number {
  const { conditions, params } = buildAdvancedConditions(filters);

  let sql = 'SELECT COUNT(*) as count FROM leads';
  if (conditions.length > 0) {
    sql += ' WHERE ' + conditions.join(' AND ');
  }

  const stmt = db.prepare(sql);
  const result = stmt.get(params) as { count: number };
  return result.count;
}

// ===== FIND BY ID =====

export function findByIdRaw(db: Database.Database, id: number, includeDeleted = false): DbLead | null {
  const deleteFilter = softDeleteFilter(includeDeleted);
  const whereClause = deleteFilter ? `WHERE id = ? AND ${deleteFilter}` : 'WHERE id = ?';
  
  const stmt = db.prepare(`SELECT * FROM leads ${whereClause}`);
  const row = stmt.get(id) as DbLead | undefined;
  return row ?? null;
}

export function findById(db: Database.Database, id: number, includeDeleted = false): Lead | null {
  const row = findByIdRaw(db, id, includeDeleted);
  return row ? transformDbLead(row) : null;
}

// ===== UPDATE LEAD =====

export function updateLead(db: Database.Database, id: number, data: Partial<DbLead>): boolean {
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

  const sql = `UPDATE leads SET ${fields.join(', ')} WHERE id = @id AND deleted_at IS NULL`;
  const stmt = db.prepare(sql);
  const result = stmt.run(params);
  return result.changes > 0;
}

export function updateStatus(db: Database.Database, id: number, status: LeadStatus): boolean {
  const stmt = db.prepare(`
    UPDATE leads 
    SET status = ?, updated_at = datetime('now')
    WHERE id = ? AND deleted_at IS NULL
  `);
  const result = stmt.run(status, id);
  return result.changes > 0;
}

export function scheduleFollowup(db: Database.Database, id: number, date: string): boolean {
  const stmt = db.prepare(`
    UPDATE leads 
    SET next_followup_at = ?, updated_at = datetime('now')
    WHERE id = ? AND deleted_at IS NULL
  `);
  const result = stmt.run(date, id);
  return result.changes > 0;
}

// ===== SOFT DELETE =====

export function softDeleteLead(db: Database.Database, id: number): boolean {
  const stmt = db.prepare(`
    UPDATE leads 
    SET deleted_at = datetime('now'), updated_at = datetime('now')
    WHERE id = ? AND deleted_at IS NULL
  `);
  const result = stmt.run(id);
  return result.changes > 0;
}

export function restoreLead(db: Database.Database, id: number): boolean {
  const stmt = db.prepare(`
    UPDATE leads 
    SET deleted_at = NULL, updated_at = datetime('now')
    WHERE id = ?
  `);
  const result = stmt.run(id);
  return result.changes > 0;
}

// ===== CALL OPERATIONS =====

export function logCall(db: Database.Database, id: number, callStatus: CallStatus, note?: string): boolean {
  const stmt = db.prepare(`
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
    WHERE id = ? AND deleted_at IS NULL
  `);
  const timestamp = new Date().toLocaleString('fr-FR');
  const formattedNote = note ? `[${timestamp}] 📞 ${note}` : null;
  const result = stmt.run(callStatus, formattedNote, formattedNote, formattedNote, id);
  return result.changes > 0;
}

export function addNote(db: Database.Database, id: number, note: string): boolean {
  const stmt = db.prepare(`
    UPDATE leads 
    SET 
      notes = CASE 
        WHEN notes IS NULL THEN ?
        ELSE notes || char(10) || ?
      END,
      updated_at = datetime('now')
    WHERE id = ? AND deleted_at IS NULL
  `);
  const timestamp = new Date().toLocaleString('fr-FR');
  const formattedNote = `[${timestamp}] ${note}`;
  const result = stmt.run(formattedNote, formattedNote, id);
  return result.changes > 0;
}

export function markOptOut(db: Database.Database, id: number): boolean {
  const stmt = db.prepare(`
    UPDATE leads 
    SET opt_out = 1, status = 'perdu', updated_at = datetime('now')
    WHERE id = ? AND deleted_at IS NULL
  `);
  const result = stmt.run(id);
  return result.changes > 0;
}

// ===== DISTINCT VALUES =====

export function getDistinctCities(db: Database.Database): string[] {
  const rows = db.prepare("SELECT DISTINCT city FROM leads WHERE city != '' AND deleted_at IS NULL ORDER BY city").all() as { city: string }[];
  return rows.map(r => r.city);
}

export function getDistinctNiches(db: Database.Database): string[] {
  const rows = db.prepare('SELECT DISTINCT niche FROM leads WHERE niche IS NOT NULL AND deleted_at IS NULL ORDER BY niche').all() as { niche: string }[];
  return rows.map(r => r.niche);
}

// ===== FOLLOWUPS =====

export function getFollowups(db: Database.Database): FollowupLead[] {
  const rows = db.prepare(`
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
    AND deleted_at IS NULL
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
