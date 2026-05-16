/**
 * Worker Entry Point - Leads Finder
 * 
 * Ce fichier orchestre le démarrage du worker en différents modes:
 * - orchestrator: Mode intelligent multi-pipeline (recommandé)
 * - once: Exécution unique
 * - scrape/enrich/enrich:website/enrich:legal: Commandes individuelles
 * - full: Pipeline complet une fois
 */

import { WorkerOrchestrator } from './orchestrator';
import { enrich } from './enrich';
import { enrichWebsiteAnalysis } from './enrichWebsite';
import { enrichLegalNotices } from './enrichLegal';
import { scrapeGoogleMaps } from './googleMapsScraper';
import { loadConfig } from './config';
import { getDb, closeDb } from '../db/client';
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

async function runEnrichLegalJob(maxLeads?: number): Promise<number> {
  const { processed } = await enrichLegalNotices(maxLeads);
  return processed;
}

async function runOnce(): Promise<void> {
  log.header('LEADS FINDER - Exécution unique');

  const startTime = Date.now();
  const config = loadConfig();

  // Étape 1: Scraping (si configuré)
  if (config.scrape?.niches?.length && config.scrape?.cities?.length) {
    log.section('ÉTAPE 1: SCRAPING GOOGLE MAPS');
    await scrapeGoogleMaps({
      niches: config.scrape.niches,
      cities: config.scrape.cities,
      saveToDb: true,
    });
  }

  // Étape 2: Enrichissement
  log.section('ÉTAPE 2: ENRICHISSEMENT');
  await enrich();

  const duration = Date.now() - startTime;
  log.blank();
  log.success(`Terminé en ${formatDuration(duration)}`);
}

async function runFullPipeline(): Promise<void> {
  log.header('LEADS FINDER - Pipeline complet');

  const startTime = Date.now();

  // 1. Scrape
  log.section('ÉTAPE 1/3: SCRAPING');
  await runScrapeJob();

  // 2. Enrich Societe
  log.section('ÉTAPE 2/3: ENRICHISSEMENT');
  await runEnrichJob();

  // 3. Enrich Website
  log.section('ÉTAPE 3/3: ANALYSE SITES WEB');
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
  full            Pipeline complet une fois (scrape → enrich → website)
  once            Exécution unique simplifiée
  scrape          Scraper Google Maps uniquement
  enrich          Enrichir via Societe.com uniquement
  enrich:website  Analyser les sites web uniquement
  enrich:legal    Visiter mentions-légales via agent LLM (Claude) et extraire RCS/capital/email/hébergeur
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
        await runOrchestrator(options);
        break;

      case 'full':
        await runFullPipeline();
        await closeDb();
        break;
        
      case 'scrape':
        await runScrapeJob();
        await closeDb();
        break;
        
      case 'enrich':
        await runEnrichJob(options.max);
        await closeDb();
        break;
        
      case 'enrich:website':
        await runEnrichWebsiteJob();
        await closeDb();
        break;

      case 'enrich:legal':
        await runEnrichLegalJob(options.max);
        await closeDb();
        break;
        
      case 'once':
        await runOnce();
        await closeDb();
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
    await closeDb();
    process.exit(1);
  }
}

main();
