import { readFileSync, existsSync } from 'fs';
import { Config } from '../shared/types';
import { getDb } from './db';
import { loadScraperConfigFromDb, hasScraperConfigTables } from '../shared/queries/scraperConfig';

// Default configuration values
const DEFAULT_CONFIG: Config = {
  target: 100,
  allowed_departments: [],
  exclude_keywords: [],
  worker: {
    enabled: true,
    interval_minutes: 30,
    max_leads_per_run: 100,
  },
};

/**
 * Load configuration from database if available, otherwise from JSON file.
 * 
 * Priority:
 * 1. Database (scraper_* tables) - allows runtime changes
 * 2. JSON file (config.json) - static fallback
 * 3. Default values
 * 
 * Environment variable overrides still apply on top.
 */
export function loadConfig(path?: string): Config {
  // First, try to load from database
  try {
    const db = getDb();
    if (hasScraperConfigTables(db)) {
      const dbConfig = loadScraperConfigFromDb(db);
      if (dbConfig && (dbConfig.niches.length > 0 || dbConfig.cities.length > 0)) {
        console.log('📦 Configuration chargée depuis la base de données');
        return mergeDbConfigWithDefaults(dbConfig, path);
      }
    }
  } catch {
    // DB not available yet, fall back to JSON
  }
  
  // Fallback to JSON file
  return loadConfigFromFile(path);
}

/**
 * Force reload configuration from database
 * Call this in worker loops to pick up config changes
 */
export function reloadConfigFromDb(): Config | null {
  try {
    const db = getDb();
    if (!hasScraperConfigTables(db)) {
      return null;
    }
    
    const dbConfig = loadScraperConfigFromDb(db);
    if (!dbConfig || (dbConfig.niches.length === 0 && dbConfig.cities.length === 0)) {
      return null;
    }
    
    return mergeDbConfigWithDefaults(dbConfig);
  } catch {
    return null;
  }
}

/**
 * Merge DB config with JSON defaults and apply env overrides
 */
function mergeDbConfigWithDefaults(
  dbConfig: ReturnType<typeof loadScraperConfigFromDb>,
  jsonPath?: string
): Config {
  // Load JSON as base for non-DB settings
  const jsonConfig = loadConfigFromFileRaw(jsonPath);
  
  const config: Config = {
    ...DEFAULT_CONFIG,
    ...jsonConfig,
    // Override with DB values
    target: dbConfig?.settings.target ?? jsonConfig?.target ?? DEFAULT_CONFIG.target,
    allowed_departments: dbConfig?.allowed_departments.length 
      ? dbConfig.allowed_departments 
      : jsonConfig?.allowed_departments ?? [],
    exclude_keywords: dbConfig?.exclude_keywords.length 
      ? dbConfig.exclude_keywords 
      : jsonConfig?.exclude_keywords ?? [],
    scrape: {
      niches: dbConfig?.niches ?? jsonConfig?.scrape?.niches ?? [],
      cities: dbConfig?.cities ?? jsonConfig?.scrape?.cities ?? [],
    },
    orchestrator: {
      ...jsonConfig?.orchestrator,
      ...(dbConfig?.settings.scrape_interval !== undefined && { scrape_interval: dbConfig.settings.scrape_interval }),
      ...(dbConfig?.settings.enrich_interval !== undefined && { enrich_interval: dbConfig.settings.enrich_interval }),
      ...(dbConfig?.settings.website_interval !== undefined && { website_interval: dbConfig.settings.website_interval }),
      ...(dbConfig?.settings.collect_interval !== undefined && { collect_interval: dbConfig.settings.collect_interval }),
      ...(dbConfig?.settings.max_scrape_per_cycle !== undefined && { max_scrape_per_cycle: dbConfig.settings.max_scrape_per_cycle }),
      ...(dbConfig?.settings.max_enrich_per_cycle !== undefined && { max_enrich_per_cycle: dbConfig.settings.max_enrich_per_cycle }),
      ...(dbConfig?.settings.max_website_per_cycle !== undefined && { max_website_per_cycle: dbConfig.settings.max_website_per_cycle }),
      ...(dbConfig?.settings.enrich_priority_threshold !== undefined && { enrich_priority_threshold: dbConfig.settings.enrich_priority_threshold }),
      ...(dbConfig?.settings.parallel_pipelines !== undefined && { parallel_pipelines: dbConfig.settings.parallel_pipelines }),
      ...(dbConfig?.settings.auto_throttle !== undefined && { auto_throttle: dbConfig.settings.auto_throttle }),
      ...(dbConfig?.settings.metrics_interval !== undefined && { metrics_interval: dbConfig.settings.metrics_interval }),
    },
    worker: jsonConfig?.worker ?? DEFAULT_CONFIG.worker,
  };
  
  // Apply environment variable overrides
  applyEnvOverrides(config);
  
  return config;
}

/**
 * Load config from JSON file only (raw, no validation)
 */
function loadConfigFromFileRaw(path?: string): Config | null {
  const configPath = path || process.env.CONFIG_PATH || 'config.json';
  
  if (!existsSync(configPath)) {
    return null;
  }
  
  try {
    const raw = readFileSync(configPath, 'utf-8');
    return JSON.parse(raw) as Config;
  } catch {
    return null;
  }
}

/**
 * Load and validate configuration from JSON file
 */
function loadConfigFromFile(path?: string): Config {
  const configPath = path || process.env.CONFIG_PATH || 'config.json';
  
  if (!existsSync(configPath)) {
    console.warn(`⚠ Fichier config non trouvé: ${configPath}`);
    console.warn('  Utilisation de la configuration par défaut');
    return DEFAULT_CONFIG as Config;
  }
  
  try {
    const raw = readFileSync(configPath, 'utf-8');
    const config = JSON.parse(raw) as Config;
    
    // Merge with defaults
    const mergedConfig: Config = {
      ...DEFAULT_CONFIG,
      ...config,
      worker: config.worker ? {
        ...DEFAULT_CONFIG.worker,
        ...config.worker,
      } : DEFAULT_CONFIG.worker,
    };
    
    // Apply environment variable overrides
    applyEnvOverrides(mergedConfig);
    
    // Validate critical fields
    validateConfig(mergedConfig);
    
    return mergedConfig;
  } catch (error) {
    console.error(`❌ Erreur lors du chargement de la config: ${(error as Error).message}`);
    console.warn('  Utilisation de la configuration par défaut');
    return DEFAULT_CONFIG as Config;
  }
}

/**
 * Apply environment variable overrides
 */
function applyEnvOverrides(config: Config): void {
  if (process.env.WORKER_INTERVAL) {
    const interval = parseInt(process.env.WORKER_INTERVAL, 10);
    if (!isNaN(interval) && config.worker) {
      config.worker.interval_minutes = interval;
    }
  }
}

/**
 * Validate configuration structure
 */
function validateConfig(config: Config): void {
  const warnings: string[] = [];
  
  if (!config.input_csv) {
    warnings.push('input_csv non défini');
  }
  
  if (!config.target || config.target <= 0) {
    warnings.push('target invalide ou non défini');
  }
  
  if (config.scrape) {
    if (!config.scrape.niches || config.scrape.niches.length === 0) {
      warnings.push('scrape.niches vide ou non défini');
    }
    if (!config.scrape.cities || config.scrape.cities.length === 0) {
      warnings.push('scrape.cities vide ou non défini');
    }
  }
  
  if (warnings.length > 0) {
    console.warn('⚠ Avertissements configuration:');
    warnings.forEach(w => console.warn(`  - ${w}`));
  }
}
