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
