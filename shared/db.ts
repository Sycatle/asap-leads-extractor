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

/**
 * Initialize database schema using the migration system
 */
function initSchema(database: Database.Database): void {
  const { runMigrations } = require('./migrations.js');
  runMigrations(database);
}
