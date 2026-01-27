/**
 * Scraper Configuration Queries
 * 
 * Gestion de la configuration du scraper depuis la base de données.
 * Permet de modifier niches, villes, settings sans redémarrer le worker.
 */

import type Database from 'better-sqlite3';

// ===== TYPES =====

export interface ScraperNiche {
  id: number;
  name: string;
  enabled: boolean;
  priority: number;
  created_at: string;
}

export interface ScraperCity {
  id: number;
  name: string;
  enabled: boolean;
  department: string | null;
  priority: number;
  created_at: string;
}

export interface ScraperSettings {
  target: number;
  max_scrape_per_cycle: number;
  max_enrich_per_cycle: number;
  max_website_per_cycle: number;
  scrape_interval: number;
  enrich_interval: number;
  website_interval: number;
  collect_interval: number;
  enrich_priority_threshold: number;
  parallel_pipelines: boolean;
  auto_throttle: boolean;
  metrics_interval: number;
}

export interface ScraperConfigFromDb {
  niches: string[];
  cities: string[];
  allowed_departments: string[];
  exclude_keywords: string[];
  settings: Partial<ScraperSettings>;
}

// ===== HELPERS =====

/**
 * Check if scraper config tables exist
 */
export function hasScraperConfigTables(db: Database.Database): boolean {
  try {
    const result = db.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name='scraper_niches'
    `).get();
    return !!result;
  } catch {
    return false;
  }
}

// ===== NICHES =====

export function getNiches(db: Database.Database, enabledOnly = true): ScraperNiche[] {
  let sql = 'SELECT * FROM scraper_niches';
  if (enabledOnly) {
    sql += ' WHERE enabled = 1';
  }
  sql += ' ORDER BY priority DESC, name ASC';
  
  const rows = db.prepare(sql).all() as Array<Omit<ScraperNiche, 'enabled'> & { enabled: number }>;
  return rows.map(r => ({ ...r, enabled: Boolean(r.enabled) }));
}

export function getNicheNames(db: Database.Database): string[] {
  return getNiches(db, true).map(n => n.name);
}

export function addNiche(db: Database.Database, name: string, priority = 0): number {
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO scraper_niches (name, priority) VALUES (?, ?)
  `);
  const result = stmt.run(name.trim(), priority);
  return result.lastInsertRowid as number;
}

export function updateNiche(db: Database.Database, id: number, data: Partial<Pick<ScraperNiche, 'name' | 'enabled' | 'priority'>>): boolean {
  const fields: string[] = [];
  const params: Record<string, unknown> = { id };
  
  if (data.name !== undefined) {
    fields.push('name = @name');
    params.name = data.name.trim();
  }
  if (data.enabled !== undefined) {
    fields.push('enabled = @enabled');
    params.enabled = data.enabled ? 1 : 0;
  }
  if (data.priority !== undefined) {
    fields.push('priority = @priority');
    params.priority = data.priority;
  }
  
  if (fields.length === 0) return false;
  
  const stmt = db.prepare(`UPDATE scraper_niches SET ${fields.join(', ')} WHERE id = @id`);
  const result = stmt.run(params);
  return result.changes > 0;
}

export function deleteNiche(db: Database.Database, id: number): boolean {
  const stmt = db.prepare('DELETE FROM scraper_niches WHERE id = ?');
  const result = stmt.run(id);
  return result.changes > 0;
}

// ===== CITIES =====

export function getCities(db: Database.Database, enabledOnly = true): ScraperCity[] {
  let sql = 'SELECT * FROM scraper_cities';
  if (enabledOnly) {
    sql += ' WHERE enabled = 1';
  }
  sql += ' ORDER BY priority DESC, name ASC';
  
  const rows = db.prepare(sql).all() as Array<Omit<ScraperCity, 'enabled'> & { enabled: number }>;
  return rows.map(r => ({ ...r, enabled: Boolean(r.enabled) }));
}

export function getCityNames(db: Database.Database): string[] {
  return getCities(db, true).map(c => c.name);
}

export function addCity(db: Database.Database, name: string, department?: string, priority = 0): number {
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO scraper_cities (name, department, priority) VALUES (?, ?, ?)
  `);
  const result = stmt.run(name.trim(), department ?? null, priority);
  return result.lastInsertRowid as number;
}

export function updateCity(db: Database.Database, id: number, data: Partial<Pick<ScraperCity, 'name' | 'enabled' | 'department' | 'priority'>>): boolean {
  const fields: string[] = [];
  const params: Record<string, unknown> = { id };
  
  if (data.name !== undefined) {
    fields.push('name = @name');
    params.name = data.name.trim();
  }
  if (data.enabled !== undefined) {
    fields.push('enabled = @enabled');
    params.enabled = data.enabled ? 1 : 0;
  }
  if (data.department !== undefined) {
    fields.push('department = @department');
    params.department = data.department;
  }
  if (data.priority !== undefined) {
    fields.push('priority = @priority');
    params.priority = data.priority;
  }
  
  if (fields.length === 0) return false;
  
  const stmt = db.prepare(`UPDATE scraper_cities SET ${fields.join(', ')} WHERE id = @id`);
  const result = stmt.run(params);
  return result.changes > 0;
}

export function deleteCity(db: Database.Database, id: number): boolean {
  const stmt = db.prepare('DELETE FROM scraper_cities WHERE id = ?');
  const result = stmt.run(id);
  return result.changes > 0;
}

// ===== DEPARTMENTS =====

export function getDepartments(db: Database.Database, enabledOnly = true): string[] {
  let sql = 'SELECT code FROM scraper_departments';
  if (enabledOnly) {
    sql += ' WHERE enabled = 1';
  }
  sql += ' ORDER BY code ASC';
  
  const rows = db.prepare(sql).all() as { code: string }[];
  return rows.map(r => r.code);
}

export function addDepartment(db: Database.Database, code: string, name?: string): boolean {
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO scraper_departments (code, name) VALUES (?, ?)
  `);
  const result = stmt.run(code.trim(), name ?? null);
  return result.changes > 0;
}

export function toggleDepartment(db: Database.Database, code: string, enabled: boolean): boolean {
  const stmt = db.prepare('UPDATE scraper_departments SET enabled = ? WHERE code = ?');
  const result = stmt.run(enabled ? 1 : 0, code);
  return result.changes > 0;
}

// ===== EXCLUDE KEYWORDS =====

export function getExcludeKeywords(db: Database.Database): string[] {
  const rows = db.prepare('SELECT keyword FROM scraper_exclude_keywords ORDER BY keyword').all() as { keyword: string }[];
  return rows.map(r => r.keyword);
}

export function addExcludeKeyword(db: Database.Database, keyword: string): boolean {
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO scraper_exclude_keywords (keyword) VALUES (?)
  `);
  const result = stmt.run(keyword.trim());
  return result.changes > 0;
}

export function removeExcludeKeyword(db: Database.Database, keyword: string): boolean {
  const stmt = db.prepare('DELETE FROM scraper_exclude_keywords WHERE keyword = ?');
  const result = stmt.run(keyword.trim());
  return result.changes > 0;
}

// ===== SETTINGS =====

export function getSetting(db: Database.Database, key: string): string | null {
  const row = db.prepare('SELECT value FROM scraper_settings WHERE key = ?').get(key) as { value: string } | undefined;
  return row?.value ?? null;
}

export function getSettingNumber(db: Database.Database, key: string, defaultValue: number): number {
  const value = getSetting(db, key);
  if (value === null) return defaultValue;
  const parsed = parseFloat(value);
  return isNaN(parsed) ? defaultValue : parsed;
}

export function getSettingBoolean(db: Database.Database, key: string, defaultValue: boolean): boolean {
  const value = getSetting(db, key);
  if (value === null) return defaultValue;
  return value === 'true' || value === '1';
}

export function setSetting(db: Database.Database, key: string, value: string | number | boolean, description?: string): boolean {
  const strValue = String(value);
  const stmt = db.prepare(`
    INSERT INTO scraper_settings (key, value, description, updated_at)
    VALUES (?, ?, ?, datetime('now'))
    ON CONFLICT(key) DO UPDATE SET 
      value = excluded.value, 
      updated_at = datetime('now')
  `);
  const result = stmt.run(key, strValue, description ?? null);
  return result.changes > 0;
}

export function getAllSettings(db: Database.Database): Record<string, string> {
  const rows = db.prepare('SELECT key, value FROM scraper_settings').all() as { key: string; value: string }[];
  const settings: Record<string, string> = {};
  for (const row of rows) {
    settings[row.key] = row.value;
  }
  return settings;
}

// ===== FULL CONFIG =====

/**
 * Load all scraper config from database
 */
export function loadScraperConfigFromDb(db: Database.Database): ScraperConfigFromDb | null {
  if (!hasScraperConfigTables(db)) {
    return null;
  }
  
  // Check if there's any data
  const nicheCount = (db.prepare('SELECT COUNT(*) as count FROM scraper_niches').get() as { count: number }).count;
  const cityCount = (db.prepare('SELECT COUNT(*) as count FROM scraper_cities').get() as { count: number }).count;
  
  if (nicheCount === 0 && cityCount === 0) {
    return null; // No data, use JSON config
  }
  
  const allSettings = getAllSettings(db);
  
  return {
    niches: getNicheNames(db),
    cities: getCityNames(db),
    allowed_departments: getDepartments(db),
    exclude_keywords: getExcludeKeywords(db),
    settings: {
      target: allSettings.target ? parseInt(allSettings.target, 10) : undefined,
      max_scrape_per_cycle: allSettings.max_scrape_per_cycle ? parseInt(allSettings.max_scrape_per_cycle, 10) : undefined,
      max_enrich_per_cycle: allSettings.max_enrich_per_cycle ? parseInt(allSettings.max_enrich_per_cycle, 10) : undefined,
      max_website_per_cycle: allSettings.max_website_per_cycle ? parseInt(allSettings.max_website_per_cycle, 10) : undefined,
      scrape_interval: allSettings.scrape_interval ? parseInt(allSettings.scrape_interval, 10) : undefined,
      enrich_interval: allSettings.enrich_interval ? parseInt(allSettings.enrich_interval, 10) : undefined,
      website_interval: allSettings.website_interval ? parseInt(allSettings.website_interval, 10) : undefined,
      collect_interval: allSettings.collect_interval ? parseInt(allSettings.collect_interval, 10) : undefined,
      enrich_priority_threshold: allSettings.enrich_priority_threshold ? parseInt(allSettings.enrich_priority_threshold, 10) : undefined,
      parallel_pipelines: allSettings.parallel_pipelines !== undefined ? getSettingBoolean(db, 'parallel_pipelines', true) : undefined,
      auto_throttle: allSettings.auto_throttle !== undefined ? getSettingBoolean(db, 'auto_throttle', true) : undefined,
      metrics_interval: allSettings.metrics_interval ? parseInt(allSettings.metrics_interval, 10) : undefined,
    },
  };
}

/**
 * Import config from JSON to database (initial migration)
 */
export function importConfigToDb(
  db: Database.Database, 
  config: {
    niches?: string[];
    cities?: string[];
    allowed_departments?: string[];
    exclude_keywords?: string[];
    target?: number;
    orchestrator?: {
      scrape_interval?: number;
      enrich_interval?: number;
      website_interval?: number;
      collect_interval?: number;
      max_scrape_per_cycle?: number;
      max_enrich_per_cycle?: number;
      max_website_per_cycle?: number;
      enrich_priority_threshold?: number;
      parallel_pipelines?: boolean;
      auto_throttle?: boolean;
      metrics_interval?: number;
    };
  }
): void {
  // Import niches
  if (config.niches) {
    for (const niche of config.niches) {
      addNiche(db, niche);
    }
  }
  
  // Import cities
  if (config.cities) {
    for (const city of config.cities) {
      addCity(db, city);
    }
  }
  
  // Import departments
  if (config.allowed_departments) {
    for (const dept of config.allowed_departments) {
      addDepartment(db, dept);
    }
  }
  
  // Import exclude keywords
  if (config.exclude_keywords) {
    for (const keyword of config.exclude_keywords) {
      addExcludeKeyword(db, keyword);
    }
  }
  
  // Import settings
  if (config.target) {
    setSetting(db, 'target', config.target, 'Target number of leads');
  }
  
  if (config.orchestrator) {
    const orch = config.orchestrator;
    if (orch.scrape_interval !== undefined) setSetting(db, 'scrape_interval', orch.scrape_interval, 'Minutes between scrape cycles');
    if (orch.enrich_interval !== undefined) setSetting(db, 'enrich_interval', orch.enrich_interval, 'Minutes between enrich cycles');
    if (orch.website_interval !== undefined) setSetting(db, 'website_interval', orch.website_interval, 'Minutes between website analysis cycles');
    if (orch.collect_interval !== undefined) setSetting(db, 'collect_interval', orch.collect_interval, 'Minutes between collect cycles');
    if (orch.max_scrape_per_cycle !== undefined) setSetting(db, 'max_scrape_per_cycle', orch.max_scrape_per_cycle, 'Max scrape requests per cycle');
    if (orch.max_enrich_per_cycle !== undefined) setSetting(db, 'max_enrich_per_cycle', orch.max_enrich_per_cycle, 'Max leads to enrich per cycle');
    if (orch.max_website_per_cycle !== undefined) setSetting(db, 'max_website_per_cycle', orch.max_website_per_cycle, 'Max websites to analyze per cycle');
    if (orch.enrich_priority_threshold !== undefined) setSetting(db, 'enrich_priority_threshold', orch.enrich_priority_threshold, 'Leads threshold to prioritize enrich over scrape');
    if (orch.parallel_pipelines !== undefined) setSetting(db, 'parallel_pipelines', orch.parallel_pipelines, 'Enable parallel pipeline execution');
    if (orch.auto_throttle !== undefined) setSetting(db, 'auto_throttle', orch.auto_throttle, 'Enable auto-throttle based on load');
    if (orch.metrics_interval !== undefined) setSetting(db, 'metrics_interval', orch.metrics_interval, 'Seconds between metrics updates');
  }
}
