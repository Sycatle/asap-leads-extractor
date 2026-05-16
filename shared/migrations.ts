/**
 * Database Migration System
 * 
 * Provides a robust, version-controlled migration system for database schema changes.
 * Each migration has a unique ID, timestamp, and description.
 * Migrations are applied in order and tracked in the migrations table.
 */

import type Database from 'better-sqlite3';

export interface Migration {
  id: number;
  name: string;
  description: string;
  up: string | ((db: Database.Database) => void);
  down?: string | ((db: Database.Database) => void);
}

/**
 * All database migrations in chronological order
 * IMPORTANT: Never modify existing migrations, only add new ones
 */
export const migrations: Migration[] = [
  {
    id: 1,
    name: '001_initial_schema',
    description: 'Create initial leads table',
    up: `
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
        source TEXT CHECK(source IN ('gmb', 'annuaire', 'scraping', 'import', 'manual')) DEFAULT 'gmb',
        priority TEXT CHECK(priority IN ('high', 'medium', 'low')) DEFAULT 'medium',
        status TEXT CHECK(status IN ('nouveau', 'contacte', 'qualifie', 'proposition', 'converti', 'perdu')) DEFAULT 'nouveau',
        call_status TEXT CHECK(call_status IN ('non_appele', 'appele', 'messagerie', 'rappeler', 'injoignable')) DEFAULT 'non_appele',
        email_status TEXT CHECK(email_status IN ('non_envoye', 'envoye', 'ouvert', 'repondu', 'bounce')) DEFAULT 'non_envoye',
        siren TEXT,
        siret TEXT,
        legal_name TEXT,
        dirigeant TEXT,
        notes TEXT,
        last_contact_at TEXT,
        next_followup_at TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );
      
      CREATE INDEX IF NOT EXISTS idx_leads_phone ON leads(phone);
      CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
      CREATE INDEX IF NOT EXISTS idx_leads_city ON leads(city);
      CREATE INDEX IF NOT EXISTS idx_leads_priority ON leads(priority);
      CREATE INDEX IF NOT EXISTS idx_leads_next_followup ON leads(next_followup_at);
    `,
  },
  {
    id: 2,
    name: '002_add_lead_history',
    description: 'Create lead_history table for tracking interactions',
    up: `
      CREATE TABLE IF NOT EXISTS lead_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        lead_id INTEGER NOT NULL,
        type TEXT CHECK(type IN ('call', 'email', 'note', 'status_change', 'followup_set')) NOT NULL,
        old_value TEXT,
        new_value TEXT,
        note TEXT,
        duration_seconds INTEGER,
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (lead_id) REFERENCES leads(id)
      );
      
      CREATE INDEX IF NOT EXISTS idx_history_lead ON lead_history(lead_id);
      CREATE INDEX IF NOT EXISTS idx_history_date ON lead_history(created_at);
    `,
  },
  {
    id: 3,
    name: '003_add_call_sessions',
    description: 'Create call_sessions table for tracking call campaigns',
    up: `
      CREATE TABLE IF NOT EXISTS call_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        started_at TEXT NOT NULL,
        ended_at TEXT,
        total_calls INTEGER DEFAULT 0,
        total_reached INTEGER DEFAULT 0,
        total_voicemail INTEGER DEFAULT 0,
        total_scheduled INTEGER DEFAULT 0,
        notes TEXT
      );
    `,
  },
  {
    id: 4,
    name: '004_add_call_scripts',
    description: 'Create call_scripts table for managing sales scripts',
    up: `
      CREATE TABLE IF NOT EXISTS call_scripts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        niche TEXT,
        type TEXT CHECK(type IN ('intro', 'objection', 'closing')) NOT NULL,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        is_active INTEGER DEFAULT 1
      );
    `,
  },
  {
    id: 5,
    name: '005_add_phone_type',
    description: 'Add phone_type column to leads',
    up: "ALTER TABLE leads ADD COLUMN phone_type TEXT CHECK(phone_type IN ('pro', 'perso', 'unknown')) DEFAULT 'unknown'",
  },
  {
    id: 6,
    name: '006_add_website_status',
    description: 'Add website_status column to leads',
    up: "ALTER TABLE leads ADD COLUMN website_status TEXT CHECK(website_status IN ('none', 'old', 'platform', 'modern'))",
  },
  {
    id: 7,
    name: '007_add_score',
    description: 'Add score column to leads for prioritization',
    up: "ALTER TABLE leads ADD COLUMN score INTEGER DEFAULT 50",
  },
  {
    id: 8,
    name: '008_add_opening_hours',
    description: 'Add opening_hours and best_call_time columns',
    up: `
      ALTER TABLE leads ADD COLUMN opening_hours TEXT;
      ALTER TABLE leads ADD COLUMN best_call_time TEXT;
    `,
  },
  {
    id: 9,
    name: '009_add_enrichment_flags',
    description: 'Add has_booking, has_seo, last_gmb_update columns',
    up: `
      ALTER TABLE leads ADD COLUMN has_booking INTEGER DEFAULT 0;
      ALTER TABLE leads ADD COLUMN has_seo INTEGER DEFAULT 0;
      ALTER TABLE leads ADD COLUMN last_gmb_update TEXT;
    `,
  },
  {
    id: 10,
    name: '010_add_attempts_and_optout',
    description: 'Add attempts_count and opt_out columns',
    up: `
      ALTER TABLE leads ADD COLUMN attempts_count INTEGER DEFAULT 0;
      ALTER TABLE leads ADD COLUMN opt_out INTEGER DEFAULT 0;
    `,
  },
  {
    id: 11,
    name: '011_add_image_url',
    description: 'Add image_url column for Google Maps photos',
    up: "ALTER TABLE leads ADD COLUMN image_url TEXT",
  },
  {
    id: 12,
    name: '012_add_website_analysis',
    description: 'Add website analysis columns (CMS, mobile, SSL, performance, pain points)',
    up: `
      ALTER TABLE leads ADD COLUMN cms_type TEXT;
      ALTER TABLE leads ADD COLUMN has_mobile_friendly INTEGER;
      ALTER TABLE leads ADD COLUMN has_ssl INTEGER;
      ALTER TABLE leads ADD COLUMN page_load_time INTEGER;
      ALTER TABLE leads ADD COLUMN pain_points TEXT;
    `,
  },
  {
    id: 13,
    name: '013_update_call_status_values',
    description: 'Migrate messagerie and occupe call_status to valid values',
    up: (db) => {
      // Migrate any 'messagerie' or 'occupe' values to 'injoignable'
      db.prepare("UPDATE leads SET call_status = 'injoignable' WHERE call_status IN ('messagerie', 'occupe')").run();
    },
  },
  {
    id: 14,
    name: '014_add_missing_indexes',
    description: 'Add indexes for niche, call_status, score, created_at for better query performance',
    up: `
      CREATE INDEX IF NOT EXISTS idx_leads_niche ON leads(niche);
      CREATE INDEX IF NOT EXISTS idx_leads_call_status ON leads(call_status);
      CREATE INDEX IF NOT EXISTS idx_leads_score ON leads(score);
      CREATE INDEX IF NOT EXISTS idx_leads_created ON leads(created_at);
    `,
    down: `
      DROP INDEX IF EXISTS idx_leads_niche;
      DROP INDEX IF EXISTS idx_leads_call_status;
      DROP INDEX IF EXISTS idx_leads_score;
      DROP INDEX IF EXISTS idx_leads_created;
    `,
  },
  {
    id: 15,
    name: '015_add_soft_delete',
    description: 'Add deleted_at column for soft-delete support',
    up: `
      ALTER TABLE leads ADD COLUMN deleted_at TEXT DEFAULT NULL;
      CREATE INDEX IF NOT EXISTS idx_leads_deleted ON leads(deleted_at);
    `,
    down: `
      DROP INDEX IF EXISTS idx_leads_deleted;
      -- Note: SQLite doesn't support DROP COLUMN in older versions
    `,
  },
  {
    id: 16,
    name: '016_normalize_pain_points',
    description: 'Create lead_pain_points table and migrate existing data',
    up: (db) => {
      // Create normalized table
      db.exec(`
        CREATE TABLE IF NOT EXISTS lead_pain_points (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          lead_id INTEGER NOT NULL,
          pain_point TEXT NOT NULL,
          detected_at TEXT DEFAULT (datetime('now')),
          FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_pain_points_lead ON lead_pain_points(lead_id);
        CREATE INDEX IF NOT EXISTS idx_pain_points_type ON lead_pain_points(pain_point);
      `);
      
      // Migrate existing JSON data
      const leads = db.prepare("SELECT id, pain_points FROM leads WHERE pain_points IS NOT NULL AND pain_points != ''").all() as { id: number; pain_points: string }[];
      const insertStmt = db.prepare("INSERT INTO lead_pain_points (lead_id, pain_point) VALUES (?, ?)");
      
      for (const lead of leads) {
        try {
          const painPoints = JSON.parse(lead.pain_points);
          if (Array.isArray(painPoints)) {
            for (const point of painPoints) {
              if (typeof point === 'string' && point.trim()) {
                insertStmt.run(lead.id, point.trim());
              }
            }
          }
        } catch {
          // Skip invalid JSON
        }
      }
    },
    down: `DROP TABLE IF EXISTS lead_pain_points;`,
  },
  {
    id: 17,
    name: '017_create_stats_daily',
    description: 'Create stats_daily table for cached daily statistics',
    up: `
      CREATE TABLE IF NOT EXISTS stats_daily (
        date TEXT PRIMARY KEY,
        leads_created INTEGER DEFAULT 0,
        leads_contacted INTEGER DEFAULT 0,
        leads_qualified INTEGER DEFAULT 0,
        leads_converted INTEGER DEFAULT 0,
        leads_lost INTEGER DEFAULT 0,
        calls_made INTEGER DEFAULT 0,
        calls_reached INTEGER DEFAULT 0,
        calls_voicemail INTEGER DEFAULT 0,
        followups_set INTEGER DEFAULT 0,
        avg_score REAL DEFAULT 0,
        updated_at TEXT DEFAULT (datetime('now'))
      );
      
      CREATE INDEX IF NOT EXISTS idx_stats_daily_date ON stats_daily(date);
    `,
    down: `DROP TABLE IF EXISTS stats_daily;`,
  },
  {
    id: 18,
    name: '018_normalize_lead_calls',
    description: 'Create dedicated lead_calls table for call tracking',
    up: (db) => {
      // Create normalized calls table
      db.exec(`
        CREATE TABLE IF NOT EXISTS lead_calls (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          lead_id INTEGER NOT NULL,
          session_id INTEGER,
          outcome TEXT NOT NULL,
          duration_seconds INTEGER,
          note TEXT,
          called_at TEXT DEFAULT (datetime('now')),
          FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE,
          FOREIGN KEY (session_id) REFERENCES call_sessions(id) ON DELETE SET NULL
        );
        CREATE INDEX IF NOT EXISTS idx_lead_calls_lead ON lead_calls(lead_id);
        CREATE INDEX IF NOT EXISTS idx_lead_calls_session ON lead_calls(session_id);
        CREATE INDEX IF NOT EXISTS idx_lead_calls_date ON lead_calls(called_at);
        CREATE INDEX IF NOT EXISTS idx_lead_calls_outcome ON lead_calls(outcome);
      `);
      
      // Migrate existing call history
      const calls = db.prepare(`
        SELECT lead_id, new_value, note, duration_seconds, created_at 
        FROM lead_history 
        WHERE type = 'call'
      `).all() as { lead_id: number; new_value: string; note: string | null; duration_seconds: number | null; created_at: string }[];
      
      const insertStmt = db.prepare(`
        INSERT INTO lead_calls (lead_id, outcome, note, duration_seconds, called_at)
        VALUES (?, ?, ?, ?, ?)
      `);
      
      for (const call of calls) {
        insertStmt.run(call.lead_id, call.new_value || 'unknown', call.note, call.duration_seconds, call.created_at);
      }
    },
    down: `DROP TABLE IF EXISTS lead_calls;`,
  },
  {
    id: 19,
    name: '019_create_lead_notes',
    description: 'Create dedicated lead_notes table',
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS lead_notes (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          lead_id INTEGER NOT NULL,
          content TEXT NOT NULL,
          author TEXT DEFAULT 'system',
          created_at TEXT DEFAULT (datetime('now')),
          FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_lead_notes_lead ON lead_notes(lead_id);
        CREATE INDEX IF NOT EXISTS idx_lead_notes_date ON lead_notes(created_at);
      `);
      
      // Migrate existing notes from history
      const notes = db.prepare(`
        SELECT lead_id, note, created_at 
        FROM lead_history 
        WHERE type = 'note' AND note IS NOT NULL AND note != ''
      `).all() as { lead_id: number; note: string; created_at: string }[];
      
      const insertStmt = db.prepare(`
        INSERT INTO lead_notes (lead_id, content, created_at)
        VALUES (?, ?, ?)
      `);
      
      for (const note of notes) {
        insertStmt.run(note.lead_id, note.note, note.created_at);
      }
    },
    down: `DROP TABLE IF EXISTS lead_notes;`,
  },
  {
    id: 20,
    name: '020_create_lead_status_log',
    description: 'Create dedicated lead_status_log table for status transitions',
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS lead_status_log (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          lead_id INTEGER NOT NULL,
          from_status TEXT,
          to_status TEXT NOT NULL,
          reason TEXT,
          changed_at TEXT DEFAULT (datetime('now')),
          FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_status_log_lead ON lead_status_log(lead_id);
        CREATE INDEX IF NOT EXISTS idx_status_log_date ON lead_status_log(changed_at);
        CREATE INDEX IF NOT EXISTS idx_status_log_to ON lead_status_log(to_status);
      `);
      
      // Migrate existing status changes
      const changes = db.prepare(`
        SELECT lead_id, old_value, new_value, note, created_at 
        FROM lead_history 
        WHERE type = 'status_change'
      `).all() as { lead_id: number; old_value: string | null; new_value: string; note: string | null; created_at: string }[];
      
      const insertStmt = db.prepare(`
        INSERT INTO lead_status_log (lead_id, from_status, to_status, reason, changed_at)
        VALUES (?, ?, ?, ?, ?)
      `);
      
      for (const change of changes) {
        insertStmt.run(change.lead_id, change.old_value, change.new_value, change.note, change.created_at);
      }
    },
    down: `DROP TABLE IF EXISTS lead_status_log;`,
  },
  {
    id: 21,
    name: '021_create_scraper_config',
    description: 'Create scraper configuration tables (niches, cities, settings)',
    up: (db) => {
      // Table des settings clé/valeur
      db.exec(`
        CREATE TABLE IF NOT EXISTS scraper_settings (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL,
          description TEXT,
          updated_at TEXT DEFAULT (datetime('now'))
        );
      `);
      
      // Table des niches
      db.exec(`
        CREATE TABLE IF NOT EXISTS scraper_niches (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL UNIQUE,
          enabled INTEGER DEFAULT 1,
          priority INTEGER DEFAULT 0,
          created_at TEXT DEFAULT (datetime('now'))
        );
        CREATE INDEX IF NOT EXISTS idx_niches_enabled ON scraper_niches(enabled);
      `);
      
      // Table des villes
      db.exec(`
        CREATE TABLE IF NOT EXISTS scraper_cities (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL UNIQUE,
          enabled INTEGER DEFAULT 1,
          department TEXT,
          priority INTEGER DEFAULT 0,
          created_at TEXT DEFAULT (datetime('now'))
        );
        CREATE INDEX IF NOT EXISTS idx_cities_enabled ON scraper_cities(enabled);
      `);
      
      // Table des départements autorisés
      db.exec(`
        CREATE TABLE IF NOT EXISTS scraper_departments (
          code TEXT PRIMARY KEY,
          name TEXT,
          enabled INTEGER DEFAULT 1
        );
      `);
      
      // Table des mots-clés exclus
      db.exec(`
        CREATE TABLE IF NOT EXISTS scraper_exclude_keywords (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          keyword TEXT NOT NULL UNIQUE
        );
      `);
    },
    down: `
      DROP TABLE IF EXISTS scraper_settings;
      DROP TABLE IF EXISTS scraper_niches;
      DROP TABLE IF EXISTS scraper_cities;
      DROP TABLE IF EXISTS scraper_departments;
      DROP TABLE IF EXISTS scraper_exclude_keywords;
    `,
  },
  {
    id: 22,
    name: '022_composite_indexes_soft_delete',
    description: 'Composite indexes to speed up (deleted_at IS NULL AND ...) filters',
    up: `
      CREATE INDEX IF NOT EXISTS idx_leads_deleted_status ON leads(deleted_at, status);
      CREATE INDEX IF NOT EXISTS idx_leads_deleted_city ON leads(deleted_at, city);
      CREATE INDEX IF NOT EXISTS idx_leads_deleted_niche ON leads(deleted_at, niche);
      CREATE INDEX IF NOT EXISTS idx_leads_deleted_next_followup ON leads(deleted_at, next_followup_at);
      CREATE INDEX IF NOT EXISTS idx_leads_deleted_score ON leads(deleted_at, score);
    `,
    down: `
      DROP INDEX IF EXISTS idx_leads_deleted_status;
      DROP INDEX IF EXISTS idx_leads_deleted_city;
      DROP INDEX IF EXISTS idx_leads_deleted_niche;
      DROP INDEX IF EXISTS idx_leads_deleted_next_followup;
      DROP INDEX IF EXISTS idx_leads_deleted_score;
    `,
  },
];

/**
 * Create the migrations table if it doesn't exist
 */
export function createMigrationsTable(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS migrations (
      id INTEGER PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      description TEXT NOT NULL,
      applied_at TEXT DEFAULT (datetime('now'))
    )
  `);
}

/**
 * Get the list of applied migrations
 */
export function getAppliedMigrations(db: Database.Database): Set<number> {
  const rows = db.prepare('SELECT id FROM migrations ORDER BY id').all() as { id: number }[];
  return new Set(rows.map(r => r.id));
}

/**
 * Mark a migration as applied
 */
export function markMigrationApplied(
  db: Database.Database,
  migration: Migration
): void {
  db.prepare('INSERT INTO migrations (id, name, description) VALUES (?, ?, ?)')
    .run(migration.id, migration.name, migration.description);
}

/**
 * Run all pending migrations
 */
export function runMigrations(db: Database.Database): void {
  console.log('[Migrations] Checking for pending migrations...');
  
  // Create migrations table
  createMigrationsTable(db);
  
  // Get applied migrations
  const appliedMigrations = getAppliedMigrations(db);
  
  // Find pending migrations
  const pendingMigrations = migrations.filter(m => !appliedMigrations.has(m.id));
  
  if (pendingMigrations.length === 0) {
    console.log('[Migrations] ✓ Database is up to date');
    return;
  }
  
  console.log(`[Migrations] Found ${pendingMigrations.length} pending migration(s)`);
  
  // Run each pending migration in a transaction
  for (const migration of pendingMigrations) {
    console.log(`[Migrations] Running: ${migration.name} - ${migration.description}`);
    
    try {
      db.exec('BEGIN TRANSACTION');
      
      // Execute migration
      if (typeof migration.up === 'string') {
        db.exec(migration.up);
      } else {
        migration.up(db);
      }
      
      // Mark as applied
      markMigrationApplied(db, migration);
      
      db.exec('COMMIT');
      console.log(`[Migrations] ✓ Applied: ${migration.name}`);
    } catch (error) {
      db.exec('ROLLBACK');
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[Migrations] ✗ Failed to apply ${migration.name}: ${errorMessage}`);
      throw new Error(`Migration ${migration.name} failed: ${errorMessage}`);
    }
  }
  
  console.log('[Migrations] ✓ All migrations applied successfully');
}

/**
 * Rollback the last migration (use with caution!)
 */
export function rollbackLastMigration(db: Database.Database): void {
  const appliedMigrations = getAppliedMigrations(db);
  
  if (appliedMigrations.size === 0) {
    console.log('[Migrations] No migrations to rollback');
    return;
  }
  
  // Find the last applied migration
  const lastMigrationId = Math.max(...Array.from(appliedMigrations));
  const lastMigration = migrations.find(m => m.id === lastMigrationId);
  
  if (!lastMigration) {
    throw new Error(`Migration ${lastMigrationId} not found in migrations list`);
  }
  
  if (!lastMigration.down) {
    throw new Error(`Migration ${lastMigration.name} does not have a rollback script`);
  }
  
  console.log(`[Migrations] Rolling back: ${lastMigration.name}`);
  
  try {
    db.exec('BEGIN TRANSACTION');
    
    // Execute rollback
    if (typeof lastMigration.down === 'string') {
      db.exec(lastMigration.down);
    } else {
      lastMigration.down(db);
    }
    
    // Remove from migrations table
    db.prepare('DELETE FROM migrations WHERE id = ?').run(lastMigrationId);
    
    db.exec('COMMIT');
    console.log(`[Migrations] ✓ Rolled back: ${lastMigration.name}`);
  } catch (error) {
    db.exec('ROLLBACK');
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Rollback of ${lastMigration.name} failed: ${errorMessage}`);
  }
}

/**
 * Get migration status (for debugging/monitoring)
 */
export function getMigrationStatus(db: Database.Database): {
  total: number;
  applied: number;
  pending: number;
  appliedMigrations: Array<{ id: number; name: string; applied_at: string }>;
  pendingMigrations: Array<{ id: number; name: string; description: string }>;
} {
  createMigrationsTable(db);
  
  const appliedRows = db.prepare('SELECT id, name, applied_at FROM migrations ORDER BY id').all() as Array<{
    id: number;
    name: string;
    applied_at: string;
  }>;
  
  const appliedIds = new Set(appliedRows.map(r => r.id));
  const pendingMigs = migrations.filter(m => !appliedIds.has(m.id));
  
  return {
    total: migrations.length,
    applied: appliedRows.length,
    pending: pendingMigs.length,
    appliedMigrations: appliedRows,
    pendingMigrations: pendingMigs.map(m => ({
      id: m.id,
      name: m.name,
      description: m.description,
    })),
  };
}
