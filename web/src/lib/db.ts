import Database from 'better-sqlite3';
import path from 'path';

// Types
export type LeadStatus = 'nouveau' | 'contacte' | 'qualifie' | 'proposition' | 'converti' | 'perdu';
export type CallStatus = 'non_appele' | 'appele' | 'messagerie' | 'rappeler' | 'injoignable';
export type EmailStatus = 'non_envoye' | 'envoye' | 'ouvert' | 'repondu' | 'bounce';

export interface DbLead {
  id: number;
  phone: string;
  name: string;
  address: string;
  city: string;
  postal_code: string;
  website: string | null;
  maps_url: string;
  rating: number | null;
  reviews_count: number | null;
  niche: string | null;
  source: string;
  siren: string | null;
  siret: string | null;
  legal_name: string | null;
  dirigeant: string | null;
  priority: 'high' | 'medium' | 'low';
  status: LeadStatus;
  call_status: CallStatus;
  email_status: EmailStatus;
  notes: string | null;
  last_contact_at: string | null;
  next_followup_at: string | null;
  created_at: string;
  updated_at: string;
}

// DB Path - points to parent project's data folder
const DB_PATH = path.join(process.cwd(), '..', 'data', 'leads.db');

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    initSchema();
  }
  return db;
}

function initSchema(): void {
  const database = getDb();
  
  database.exec(`
    CREATE TABLE IF NOT EXISTS leads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      phone TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      address TEXT NOT NULL,
      city TEXT NOT NULL,
      postal_code TEXT NOT NULL,
      website TEXT,
      maps_url TEXT NOT NULL,
      rating REAL,
      reviews_count INTEGER,
      niche TEXT,
      source TEXT DEFAULT 'google_maps',
      siren TEXT,
      siret TEXT,
      legal_name TEXT,
      dirigeant TEXT,
      priority TEXT CHECK(priority IN ('high', 'medium', 'low')) DEFAULT 'medium',
      status TEXT CHECK(status IN ('nouveau', 'contacte', 'qualifie', 'proposition', 'converti', 'perdu')) DEFAULT 'nouveau',
      call_status TEXT CHECK(call_status IN ('non_appele', 'appele', 'messagerie', 'rappeler', 'injoignable')) DEFAULT 'non_appele',
      email_status TEXT CHECK(email_status IN ('non_envoye', 'envoye', 'ouvert', 'repondu', 'bounce')) DEFAULT 'non_envoye',
      notes TEXT,
      last_contact_at TEXT,
      next_followup_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
    
    CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
    CREATE INDEX IF NOT EXISTS idx_leads_city ON leads(city);
    CREATE INDEX IF NOT EXISTS idx_leads_priority ON leads(priority);
    CREATE INDEX IF NOT EXISTS idx_leads_next_followup ON leads(next_followup_at);
    CREATE INDEX IF NOT EXISTS idx_leads_call_status ON leads(call_status);
    
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
    non_appele: 0, appele: 0, messagerie: 0, rappeler: 0, injoignable: 0
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

export function getNextLead(excludeIds: number[] = []): DbLead | null {
  const database = getDb();
  
  const excludeClause = excludeIds.length > 0 
    ? `AND id NOT IN (${excludeIds.join(',')})` 
    : '';
  
  // 1. Relances en retard (plus ancien d'abord)
  const overdue = database.prepare(`
    SELECT * FROM leads 
    WHERE next_followup_at < datetime('now')
    AND status NOT IN ('converti', 'perdu')
    ${excludeClause}
    ORDER BY next_followup_at ASC
    LIMIT 1
  `).get() as DbLead | undefined;
  if (overdue) return overdue;
  
  // 2. Relances aujourd'hui (plus tôt d'abord)
  const today = database.prepare(`
    SELECT * FROM leads 
    WHERE date(next_followup_at) = date('now')
    AND datetime(next_followup_at) >= datetime('now')
    AND status NOT IN ('converti', 'perdu')
    ${excludeClause}
    ORDER BY next_followup_at ASC
    LIMIT 1
  `).get() as DbLead | undefined;
  if (today) return today;
  
  // 3. Nouveaux leads jamais appelés (priority DESC)
  const fresh = database.prepare(`
    SELECT * FROM leads 
    WHERE call_status = 'non_appele'
    AND status = 'nouveau'
    ${excludeClause}
    ORDER BY 
      CASE priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
      created_at ASC
    LIMIT 1
  `).get() as DbLead | undefined;
  if (fresh) return fresh;
  
  // 4. Leads à rappeler depuis > 24h
  const stale = database.prepare(`
    SELECT * FROM leads 
    WHERE call_status = 'rappeler'
    AND last_contact_at < datetime('now', '-1 day')
    AND status NOT IN ('converti', 'perdu')
    ${excludeClause}
    ORDER BY last_contact_at ASC
    LIMIT 1
  `).get() as DbLead | undefined;
  
  return stale ?? null;
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
  note?: string,
  autoScheduleFollowup = true
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
  let nextFollowup = lead.next_followup_at;
  let newStatus = lead.status;
  
  // Auto-schedule followup if messagerie
  if (autoScheduleFollowup && callStatus === 'messagerie') {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(10, 0, 0, 0);
    nextFollowup = tomorrow.toISOString().slice(0, 19).replace('T', ' ');
    
    addHistory({
      lead_id: id,
      type: 'followup_set',
      old_value: lead.next_followup_at,
      new_value: nextFollowup,
      note: 'Auto-relance après messagerie',
      duration_seconds: null,
    });
  }
  
  // Auto-update status to 'contacte' if first real contact
  if (lead.status === 'nouveau' && ['appele', 'messagerie'].includes(callStatus)) {
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
