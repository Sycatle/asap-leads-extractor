import Database from 'better-sqlite3';
import path from 'path';
import type { DbLead, LeadStatus, CallStatus, EmailStatus } from './types.js';

// ===== CONNEXION =====

const DB_PATH = path.join(process.cwd(), 'data', 'leads.db');

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    initSchema();
  }
  return db;
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}

// ===== SCHEMA =====

function initSchema(): void {
  const database = getDb();
  
  database.exec(`
    CREATE TABLE IF NOT EXISTS leads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      phone TEXT UNIQUE NOT NULL,
      phone_type TEXT CHECK(phone_type IN ('pro', 'perso', 'unknown')) DEFAULT 'unknown',
      name TEXT NOT NULL,
      address TEXT NOT NULL,
      city TEXT NOT NULL,
      postal_code TEXT NOT NULL,
      website TEXT,
      website_status TEXT CHECK(website_status IN ('none', 'old', 'platform', 'modern')),
      maps_url TEXT NOT NULL,
      rating REAL,
      reviews_count INTEGER,
      niche TEXT,
      source TEXT CHECK(source IN ('gmb', 'annuaire', 'scraping', 'import', 'manual')) DEFAULT 'gmb',
      
      -- Enrichissement Pappers
      siren TEXT,
      siret TEXT,
      legal_name TEXT,
      dirigeant TEXT,
      
      -- Scoring & Enrichissement
      priority TEXT CHECK(priority IN ('high', 'medium', 'low')) DEFAULT 'medium',
      score INTEGER DEFAULT 50,
      
      -- Données GMB enrichies
      opening_hours TEXT,
      best_call_time TEXT,
      has_booking INTEGER DEFAULT 0,
      has_seo INTEGER DEFAULT 0,
      last_gmb_update TEXT,
      
      -- Suivi commercial
      status TEXT CHECK(status IN ('nouveau', 'contacte', 'qualifie', 'proposition', 'converti', 'perdu')) DEFAULT 'nouveau',
      call_status TEXT CHECK(call_status IN ('non_appele', 'appele', 'messagerie', 'rappeler', 'injoignable')) DEFAULT 'non_appele',
      email_status TEXT CHECK(email_status IN ('non_envoye', 'envoye', 'ouvert', 'repondu', 'bounce')) DEFAULT 'non_envoye',
      notes TEXT,
      attempts_count INTEGER DEFAULT 0,
      opt_out INTEGER DEFAULT 0,
      
      -- Dates
      last_contact_at TEXT,
      next_followup_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
    
    -- Index pour les recherches fréquentes
    CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
    CREATE INDEX IF NOT EXISTS idx_leads_city ON leads(city);
    CREATE INDEX IF NOT EXISTS idx_leads_priority ON leads(priority);
    CREATE INDEX IF NOT EXISTS idx_leads_next_followup ON leads(next_followup_at);
    CREATE INDEX IF NOT EXISTS idx_leads_call_status ON leads(call_status);
    CREATE INDEX IF NOT EXISTS idx_leads_score ON leads(score);
    CREATE INDEX IF NOT EXISTS idx_leads_opt_out ON leads(opt_out);
  `);
  
  // Migration: ajouter les nouvelles colonnes si elles n'existent pas
  migrateSchema(database);
}

function migrateSchema(database: Database.Database): void {
  const columns = database.prepare("PRAGMA table_info(leads)").all() as { name: string }[];
  const columnNames = new Set(columns.map(c => c.name));
  
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
  ];
  
  for (const [column, sql] of migrations) {
    if (!columnNames.has(column)) {
      try {
        database.exec(sql);
        console.log(`  ✓ Migration: ajout colonne ${column}`);
      } catch (err) {
        // Ignore si déjà existe
      }
    }
  }
}

// ===== OPÉRATIONS CRUD =====

import type { PhoneType, LeadSource, WebsiteStatus } from './types.js';

export interface InsertLead {
  phone: string;
  phone_type?: PhoneType;
  name: string;
  address: string;
  city: string;
  postal_code: string;
  website?: string | null;
  website_status?: WebsiteStatus | null;
  maps_url: string;
  rating?: number | null;
  reviews_count?: number | null;
  niche?: string | null;
  source?: LeadSource;
  priority?: 'high' | 'medium' | 'low';
  score?: number;
  opening_hours?: string | null;
  best_call_time?: string | null;
  has_booking?: boolean;
  has_seo?: boolean;
  last_gmb_update?: string | null;
}

/**
 * Détecter le type de téléphone (mobile = perso, fixe = pro)
 */
function detectPhoneType(phone: string): PhoneType {
  if (phone.startsWith('06') || phone.startsWith('07')) {
    return 'perso'; // Mobile = risque B2C
  }
  if (phone.startsWith('01') || phone.startsWith('02') || phone.startsWith('03') || 
      phone.startsWith('04') || phone.startsWith('05') || phone.startsWith('09')) {
    return 'pro'; // Fixe = probablement pro
  }
  return 'unknown';
}

/**
 * Calculer le score du lead (0-100)
 */
function computeScore(lead: InsertLead): number {
  let score = 50;
  
  // Pas de site web = +20
  if (!lead.website) score += 20;
  
  // Site vieux ou plateforme = +10
  if (lead.website_status === 'old' || lead.website_status === 'platform') score += 10;
  
  // Pas de réservation en ligne = +10
  if (lead.has_booking === false) score += 10;
  
  // Peu d'avis = +5
  if (lead.reviews_count != null && lead.reviews_count < 10) score += 5;
  
  // Mauvaise note = +5
  if (lead.rating != null && lead.rating < 4) score += 5;
  
  // Téléphone perso = -10 (risque B2C)
  const phoneType = lead.phone_type || detectPhoneType(lead.phone);
  if (phoneType === 'perso') score -= 10;
  
  // Bonne note = -10
  if (lead.rating != null && lead.rating >= 4.5 && lead.reviews_count != null && lead.reviews_count > 50) {
    score -= 10;
  }
  
  return Math.max(0, Math.min(100, score));
}

/**
 * Insérer ou mettre à jour un lead (upsert par téléphone)
 */
export function upsertLead(lead: InsertLead): DbLead | null {
  const database = getDb();
  
  const phoneType = lead.phone_type || detectPhoneType(lead.phone);
  const websiteStatus = lead.website_status || (lead.website ? null : 'none');
  const score = lead.score ?? computeScore(lead);
  const source = lead.source ?? 'gmb';
  
  const stmt = database.prepare(`
    INSERT INTO leads (
      phone, phone_type, name, address, city, postal_code, website, website_status,
      maps_url, rating, reviews_count, niche, source, priority, score,
      opening_hours, best_call_time, has_booking, has_seo, last_gmb_update
    )
    VALUES (
      @phone, @phone_type, @name, @address, @city, @postal_code, @website, @website_status,
      @maps_url, @rating, @reviews_count, @niche, @source, @priority, @score,
      @opening_hours, @best_call_time, @has_booking, @has_seo, @last_gmb_update
    )
    ON CONFLICT(phone) DO UPDATE SET
      name = excluded.name,
      address = excluded.address,
      city = excluded.city,
      postal_code = excluded.postal_code,
      website = COALESCE(excluded.website, leads.website),
      website_status = COALESCE(excluded.website_status, leads.website_status),
      maps_url = excluded.maps_url,
      rating = COALESCE(excluded.rating, leads.rating),
      reviews_count = COALESCE(excluded.reviews_count, leads.reviews_count),
      niche = COALESCE(excluded.niche, leads.niche),
      priority = excluded.priority,
      score = excluded.score,
      opening_hours = COALESCE(excluded.opening_hours, leads.opening_hours),
      best_call_time = COALESCE(excluded.best_call_time, leads.best_call_time),
      has_booking = COALESCE(excluded.has_booking, leads.has_booking),
      has_seo = COALESCE(excluded.has_seo, leads.has_seo),
      last_gmb_update = COALESCE(excluded.last_gmb_update, leads.last_gmb_update),
      updated_at = datetime('now')
    RETURNING *
  `);
  
  const result = stmt.get({
    phone: lead.phone,
    phone_type: phoneType,
    name: lead.name,
    address: lead.address,
    city: lead.city,
    postal_code: lead.postal_code,
    website: lead.website ?? null,
    website_status: websiteStatus,
    maps_url: lead.maps_url,
    rating: lead.rating ?? null,
    reviews_count: lead.reviews_count ?? null,
    niche: lead.niche ?? null,
    source: source,
    priority: lead.priority ?? 'medium',
    score: score,
    opening_hours: lead.opening_hours ?? null,
    best_call_time: lead.best_call_time ?? null,
    has_booking: lead.has_booking ? 1 : 0,
    has_seo: lead.has_seo ? 1 : 0,
    last_gmb_update: lead.last_gmb_update ?? null,
  }) as DbLead | undefined;
  
  return result ?? null;
}

/**
 * Insérer plusieurs leads en batch
 */
export function upsertLeads(leads: InsertLead[]): number {
  const database = getDb();
  let inserted = 0;
  
  const transaction = database.transaction((items: InsertLead[]) => {
    for (const lead of items) {
      const result = upsertLead(lead);
      if (result) inserted++;
    }
  });
  
  transaction(leads);
  return inserted;
}

/**
 * Trouver un lead par téléphone
 */
export function findByPhone(phone: string): DbLead | null {
  const database = getDb();
  const stmt = database.prepare('SELECT * FROM leads WHERE phone = ?');
  return (stmt.get(phone) as DbLead) ?? null;
}

/**
 * Trouver un lead par ID
 */
export function findById(id: number): DbLead | null {
  const database = getDb();
  const stmt = database.prepare('SELECT * FROM leads WHERE id = ?');
  return (stmt.get(id) as DbLead) ?? null;
}

// ===== FILTRES =====

export interface LeadFilters {
  status?: LeadStatus;
  call_status?: CallStatus;
  email_status?: EmailStatus;
  city?: string;
  niche?: string;
  priority?: 'high' | 'medium' | 'low';
  hasFollowup?: boolean;
  limit?: number;
  offset?: number;
}

/**
 * Lister les leads avec filtres
 */
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
  
  if (filters.email_status) {
    conditions.push('email_status = @email_status');
    params.email_status = filters.email_status;
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
  
  if (filters.hasFollowup) {
    conditions.push('next_followup_at IS NOT NULL AND date(next_followup_at) <= date("now")');
  }
  
  let sql = 'SELECT * FROM leads';
  if (conditions.length > 0) {
    sql += ' WHERE ' + conditions.join(' AND ');
  }
  sql += ' ORDER BY created_at DESC';
  
  if (filters.limit) {
    sql += ` LIMIT ${filters.limit}`;
    if (filters.offset) {
      sql += ` OFFSET ${filters.offset}`;
    }
  }
  
  const stmt = database.prepare(sql);
  return stmt.all(params) as DbLead[];
}

// ===== MISE À JOUR STATUTS =====

/**
 * Mettre à jour le statut principal
 */
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

/**
 * Enregistrer un appel
 */
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

/**
 * Enregistrer un email
 */
export function logEmail(id: number, emailStatus: EmailStatus, note?: string): boolean {
  const database = getDb();
  const stmt = database.prepare(`
    UPDATE leads 
    SET 
      email_status = ?,
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
  const formattedNote = note ? `[${timestamp}] 📧 ${note}` : null;
  const result = stmt.run(emailStatus, formattedNote, formattedNote, formattedNote, id);
  return result.changes > 0;
}

/**
 * Ajouter une note
 */
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

/**
 * Planifier une relance
 */
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

/**
 * Enrichir un lead (données Pappers)
 */
export function enrichLead(id: number, data: {
  siren?: string;
  siret?: string;
  legal_name?: string;
  dirigeant?: string;
}): boolean {
  const database = getDb();
  const stmt = database.prepare(`
    UPDATE leads 
    SET 
      siren = COALESCE(?, siren),
      siret = COALESCE(?, siret),
      legal_name = COALESCE(?, legal_name),
      dirigeant = COALESCE(?, dirigeant),
      updated_at = datetime('now')
    WHERE id = ?
  `);
  const result = stmt.run(data.siren ?? null, data.siret ?? null, data.legal_name ?? null, data.dirigeant ?? null, id);
  return result.changes > 0;
}

// ===== STATISTIQUES =====

export interface LeadStats {
  total: number;
  by_status: Record<LeadStatus, number>;
  by_call_status: Record<CallStatus, number>;
  by_priority: Record<string, number>;
  by_city: Record<string, number>;
  followups_today: number;
  contacted_today: number;
}

export function getStats(): LeadStats {
  const database = getDb();
  
  const total = (database.prepare('SELECT COUNT(*) as count FROM leads').get() as { count: number }).count;
  
  // Par statut
  const statusRows = database.prepare('SELECT status, COUNT(*) as count FROM leads GROUP BY status').all() as { status: LeadStatus; count: number }[];
  const by_status: Record<LeadStatus, number> = {
    nouveau: 0, contacte: 0, qualifie: 0, proposition: 0, converti: 0, perdu: 0
  };
  for (const row of statusRows) {
    by_status[row.status] = row.count;
  }
  
  // Par call_status
  const callRows = database.prepare('SELECT call_status, COUNT(*) as count FROM leads GROUP BY call_status').all() as { call_status: CallStatus; count: number }[];
  const by_call_status: Record<CallStatus, number> = {
    non_appele: 0, appele: 0, messagerie: 0, rappeler: 0, injoignable: 0
  };
  for (const row of callRows) {
    by_call_status[row.call_status] = row.count;
  }
  
  // Par priorité
  const priorityRows = database.prepare('SELECT priority, COUNT(*) as count FROM leads GROUP BY priority').all() as { priority: string; count: number }[];
  const by_priority: Record<string, number> = {};
  for (const row of priorityRows) {
    by_priority[row.priority] = row.count;
  }
  
  // Par ville (top 10)
  const cityRows = database.prepare('SELECT city, COUNT(*) as count FROM leads GROUP BY city ORDER BY count DESC LIMIT 10').all() as { city: string; count: number }[];
  const by_city: Record<string, number> = {};
  for (const row of cityRows) {
    by_city[row.city] = row.count;
  }
  
  // Relances aujourd'hui
  const followups_today = (database.prepare(`
    SELECT COUNT(*) as count FROM leads 
    WHERE date(next_followup_at) <= date('now')
  `).get() as { count: number }).count;
  
  // Contactés aujourd'hui
  const contacted_today = (database.prepare(`
    SELECT COUNT(*) as count FROM leads 
    WHERE date(last_contact_at) = date('now')
  `).get() as { count: number }).count;
  
  return {
    total,
    by_status,
    by_call_status,
    by_priority,
    by_city,
    followups_today,
    contacted_today,
  };
}

/**
 * Compter les leads
 */
export function countLeads(filters: LeadFilters = {}): number {
  const leads = findLeads({ ...filters, limit: undefined, offset: undefined });
  return leads.length;
}
