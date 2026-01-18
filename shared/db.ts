import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

// ===== CONNEXION PARTAGÉE =====

let db: Database.Database | null = null;
let dbPath: string | null = null;

/**
 * Trouver le chemin vers la base de données
 * Priorité: DATABASE_PATH env > recherche automatique
 */
function findDbPath(): string {
  if (process.env.DATABASE_PATH) {
    return process.env.DATABASE_PATH;
  }
  
  const cwd = process.cwd();
  
  // Cas 1: cwd = .../leads-finder → data/leads.db
  const fromRoot = path.join(cwd, 'data', 'leads.db');
  if (fs.existsSync(path.dirname(fromRoot))) {
    return fromRoot;
  }
  
  // Cas 2: cwd = .../leads-finder/web → ../data/leads.db
  const fromWeb = path.join(cwd, '..', 'data', 'leads.db');
  if (fs.existsSync(path.dirname(fromWeb))) {
    return fromWeb;
  }
  
  // Cas 3: cwd = .../leads-finder/worker → ../data/leads.db
  const fromWorker = path.join(cwd, '..', 'data', 'leads.db');
  if (fs.existsSync(path.dirname(fromWorker))) {
    return fromWorker;
  }
  
  // Fallback: créer dans data/
  const dbDir = path.join(cwd, 'data');
  fs.mkdirSync(dbDir, { recursive: true });
  return path.join(dbDir, 'leads.db');
}

/**
 * Obtenir l'instance de la base de données
 */
export function getDb(): Database.Database {
  if (!db) {
    dbPath = findDbPath();
    
    // Créer le dossier si nécessaire
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    initSchema(db);
  }
  return db;
}

/**
 * Fermer la connexion
 */
export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
    dbPath = null;
  }
}

/**
 * Obtenir le chemin de la DB (pour debug)
 */
export function getDbPath(): string {
  return dbPath || findDbPath();
}

// ===== SCHEMA =====

function initSchema(database: Database.Database): void {
  database.exec(`
    -- Table principale des leads
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
  
  // Migration des colonnes existantes
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
        console.log(`[DB] Migration: ajout colonne ${column}`);
      } catch {
        // Ignore si déjà existe
      }
    }
  }
}
