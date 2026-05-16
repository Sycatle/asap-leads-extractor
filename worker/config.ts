import { readFileSync, existsSync } from 'fs';
import { Config } from '../shared/types';

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
  // DB-backed scraper config (anciens shared/queries/scraperConfig.ts) à porter
  // sur Drizzle dans une itération ultérieure ; pour l'instant on lit config.json.
  return loadConfigFromFile(path);
}

/**
 * Force reload configuration (placeholder — voir loadConfig pour le TODO Drizzle).
 */
export function reloadConfigFromDb(): Config | null {
  return null;
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
