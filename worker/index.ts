/**
 * Worker Entry Point - Leads Finder
 * 
 * Ce fichier orchestre le démarrage du worker en différents modes:
 * - orchestrator: Mode intelligent multi-pipeline (recommandé)
 * - worker: Mode legacy avec boucle simple
 * - once: Exécution unique
 * - scrape/enrich/collect: Commandes individuelles
 */

import { WorkerOrchestrator } from './orchestrator';
import { collect } from './collect';
import { enrich } from './enrich';
import { enrichWebsiteAnalysis } from './enrichWebsite';
import { scrapeGoogleMaps } from './googleMapsScraper';
import { loadConfig } from './config';
import { getDb, closeDb } from './db';
import { formatDuration } from './utils';
import { logger as log } from './logger';

// ===== TYPES =====

interface CommandOptions {
  max?: number;
  interval?: number;
  parallel?: boolean;
}

// ===== COMMANDS =====

async function runOrchestrator(options: CommandOptions = {}): Promise<void> {
  const orchestrator = new WorkerOrchestrator({
    enableParallelPipelines: options.parallel !== false,
    maxEnrichPerCycle: options.max ?? 30,
  });
  
  await orchestrator.start();
}

async function runScrapeJob(): Promise<number> {
  const config = loadConfig();
  
  if (!config.scrape?.niches?.length || !config.scrape?.cities?.length) {
    log.warn('Pas de config scrape définie');
    log.sub('Définissez scrape.niches et scrape.cities dans config.json');
    return 0;
  }
  
  const leads = await scrapeGoogleMaps({
    niches: config.scrape.niches,
    cities: config.scrape.cities,
    saveToDb: true,
  });
  
  return leads.length;
}

async function runEnrichJob(maxLeads?: number): Promise<number> {
  const stats = await enrich(maxLeads);
  return stats.enriched;
}

async function runEnrichWebsiteJob(): Promise<void> {
  await enrichWebsiteAnalysis();
}

async function runCollectJob(): Promise<number> {
  const config = loadConfig();
  
  if (!config.input_csv) {
    log.warn('Pas de input_csv défini dans config.json');
    return 0;
  }
  
  try {
    const leads = await collect();
    return leads.length;
  } catch (err) {
    log.warn('Pas de CSV à importer ou erreur');
    return 0;
  }
}

async function runOnce(): Promise<void> {
  log.header('LEADS FINDER - Exécution unique');
  
  const startTime = Date.now();
  const config = loadConfig();
  
  // Étape 1: Collecte (si CSV configuré)
  if (config.input_csv) {
    log.section('ÉTAPE 1: COLLECTE CSV');
    await collect();
  }
  
  // Étape 2: Scraping (si configuré)
  if (config.scrape?.niches?.length && config.scrape?.cities?.length) {
    log.section('ÉTAPE 2: SCRAPING GOOGLE MAPS');
    await scrapeGoogleMaps({
      niches: config.scrape.niches,
      cities: config.scrape.cities,
      saveToDb: true,
    });
  }
  
  // Étape 3: Enrichissement
  log.section('ÉTAPE 3: ENRICHISSEMENT');
  await enrich();
  
  const duration = Date.now() - startTime;
  log.blank();
  log.success(`Terminé en ${formatDuration(duration)}`);
}

async function runFullPipeline(): Promise<void> {
  log.header('LEADS FINDER - Pipeline complet');
  
  const startTime = Date.now();
  
  // 1. Collect
  log.section('ÉTAPE 1/4: COLLECTE');
  await runCollectJob();
  
  // 2. Scrape
  log.section('ÉTAPE 2/4: SCRAPING');
  await runScrapeJob();
  
  // 3. Enrich Societe
  log.section('ÉTAPE 3/4: ENRICHISSEMENT');
  await runEnrichJob();
  
  // 4. Enrich Website
  log.section('ÉTAPE 4/4: ANALYSE SITES WEB');
  await runEnrichWebsiteJob();
  
  const duration = Date.now() - startTime;
  log.blank();
  log.success(`Pipeline complet terminé en ${formatDuration(duration)}`);
}

// ===== HELP =====

function printHelp(): void {
  console.log(`
🚀 Leads Finder Worker

USAGE:
  pnpm worker [command] [options]

COMMANDS:
  orchestrator    Mode intelligent multi-pipeline (recommandé pour production)
  worker          Mode boucle simple (legacy)
  full            Pipeline complet une fois (collect → scrape → enrich → website)
  once            Exécution unique simplifiée
  scrape          Scraper Google Maps uniquement
  enrich          Enrichir via Societe.com uniquement
  enrich:website  Analyser les sites web uniquement
  collect         Importer CSV uniquement
  help            Afficher cette aide

OPTIONS:
  --max=N         Nombre max de leads à traiter par cycle
  --interval=N    Intervalle entre cycles (minutes)
  --no-parallel   Désactiver l'exécution parallèle

EXEMPLES:
  pnpm worker orchestrator           # Mode production recommandé
  pnpm worker scrape                  # Scraping seul
  pnpm worker enrich --max=50        # Enrichir 50 leads
  pnpm worker full                   # Pipeline complet une fois

ENVIRONNEMENT:
  DEBUG=1         Activer les logs de debug
  CONFIG_PATH     Chemin vers config.json (défaut: ./config.json)
`);
}

// ===== CLI PARSING =====

function parseArgs(): { command: string; options: CommandOptions } {
  const args = process.argv.slice(2);
  const command = args[0] || 'orchestrator';
  const options: CommandOptions = {};
  
  for (const arg of args.slice(1)) {
    if (arg.startsWith('--max=')) {
      options.max = parseInt(arg.split('=')[1], 10);
    } else if (arg.startsWith('--interval=')) {
      options.interval = parseInt(arg.split('=')[1], 10);
    } else if (arg === '--no-parallel') {
      options.parallel = false;
    }
  }
  
  return { command, options };
}

// ===== MAIN =====

async function main(): Promise<void> {
  const { command, options } = parseArgs();
  
  // Init DB (sauf pour help)
  if (command !== 'help') {
    getDb();
  }
  
  try {
    switch (command) {
      case 'orchestrator':
      case 'brain':
        await runOrchestrator(options);
        break;
        
      case 'worker':
      case 'loop':
        // Legacy mode - utilise l'orchestrator avec config par défaut
        await runOrchestrator(options);
        break;
        
      case 'full':
      case 'pipeline':
        await runFullPipeline();
        closeDb();
        break;
        
      case 'scrape':
        await runScrapeJob();
        closeDb();
        break;
        
      case 'enrich':
        await runEnrichJob(options.max);
        closeDb();
        break;
        
      case 'enrich:website':
      case 'website':
        await runEnrichWebsiteJob();
        closeDb();
        break;
        
      case 'collect':
        await runCollectJob();
        closeDb();
        break;
        
      case 'once':
        await runOnce();
        closeDb();
        break;
        
      case 'help':
      case '--help':
      case '-h':
        printHelp();
        break;
        
      default:
        log.error(`Commande inconnue: ${command}`);
        log.sub('Utilisez "pnpm worker help" pour voir les commandes disponibles');
        process.exit(1);
    }
  } catch (error) {
    log.error(`Erreur fatale: ${(error as Error).message}`);
    closeDb();
    process.exit(1);
  }
}

main();
