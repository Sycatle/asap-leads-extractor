import { readFileSync, existsSync } from 'fs';
import { Config } from '../shared/types.js';

// Default configuration values
const DEFAULT_CONFIG: Config = {
  input_csv: '',
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
 * Load and validate configuration
 * Supports environment variable overrides:
 * - CONFIG_PATH: path to config file
 * - WORKER_INTERVAL: override worker interval in minutes
 */
export function loadConfig(path?: string): Config {
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
    if (process.env.WORKER_INTERVAL) {
      const interval = parseInt(process.env.WORKER_INTERVAL, 10);
      if (!isNaN(interval) && mergedConfig.worker) {
        mergedConfig.worker.interval_minutes = interval;
      }
    }
    
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
