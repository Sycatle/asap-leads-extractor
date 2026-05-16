#!/usr/bin/env node
import { Command } from 'commander';
import { enrich } from './enrich';
import { scrapeGoogleMaps } from './googleMapsScraper';
import { loadConfig } from './config';
import { closeDb, getDb } from '../db/client';
import { getStats } from '../db/queries';
import { runPurge } from './cron/purge';
import { logger as log } from './logger';

const program = new Command();

program
  .name('leads-finder')
  .description('Générateur de leads call-ready pour prospection')
  .version('2.0.0');

// Commande: run (pipeline complet)
program
  .command('run')
  .description('Exécute le pipeline complet: scrape → enrich (full SQLite)')
  .option('-c, --config <path>', 'Chemin vers le fichier config', 'config.json')
  .option('--skip-enrich', 'Sauter l\'étape d\'enrichissement')
  .action(async (options) => {
    log.header('LEADS FINDER - Pipeline complet');
    const startTime = Date.now();
    const config = loadConfig();

    log.section('ÉTAPE 1: SCRAPING');
    const niches = config.scrape?.niches || ['coiffeur'];
    const cities = config.scrape?.cities || ['Le Mans'];
    await scrapeGoogleMaps({ niches, cities, saveToDb: true });

    if (!options.skipEnrich) {
      log.section('ÉTAPE 2: ENRICHISSEMENT');
      await enrich();
    } else {
      log.info('ÉTAPE 2: ENRICHISSEMENT (skipped)');
    }

    const stats = await getStats(getDb());
    log.blank();
    log.success(`En base: ${stats.total} leads total`);

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    log.success(`Terminé en ${duration}s`);
    await closeDb();
  });

// Commande: scrape (Google Maps)
program
  .command('scrape')
  .description('Scraper Google Maps pour collecter des leads (sauvegarde directe en SQLite)')
  .option('--niches <niches>', 'Niches à scraper (séparées par virgule)', 'coiffeur')
  .option('--cities <cities>', 'Villes à scraper (séparées par virgule)', 'Le Mans')
  .option('--skip-enrich', 'Sauter l\'enrichissement Pappers')
  .action(async (options) => {
    log.header('LEADS FINDER - Mode Scraping');
    const startTime = Date.now();
    const config = loadConfig();

    // Utiliser les options CLI ou la config
    const niches = options.niches ? options.niches.split(',').map((s: string) => s.trim()) : config.scrape?.niches || ['coiffeur'];
    const cities = options.cities ? options.cities.split(',').map((s: string) => s.trim()) : config.scrape?.cities || ['Le Mans'];

    // Étape 1: Scraping + sauvegarde DB
    log.section('ÉTAPE 1: SCRAPING GOOGLE MAPS');
    const leads = await scrapeGoogleMaps({ 
      niches, 
      cities,
      saveToDb: true
    });
    
    // Filtrer les chaînes exclues (déjà fait lors de l'upsert, mais afficher le count)
    const filteredCount = leads.filter(lead => {
      const lower = lead.name.toLowerCase();
      return !config.exclude_keywords.some(kw => lower.includes(kw.toLowerCase()));
    }).length;
    
    log.success(`Leads scrapés: ${leads.length} (${filteredCount} après filtrage chaînes)`);

    // Étape 2: Enrichissement
    if (!options.skipEnrich) {
      log.section('ÉTAPE 2: ENRICHISSEMENT');
      await enrich();
    } else {
      log.info('ÉTAPE 2: ENRICHISSEMENT (skipped)');
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    
    // Stats DB
    const stats = await getStats(getDb());
    log.blank();
    log.success(`En base: ${stats.total} leads total`);
    log.success(`Terminé en ${duration}s`);
    await closeDb();
  });

// Commande: enrich
program
  .command('enrich')
  .description('Enrichir les leads avec Pappers (SIREN + dirigeant)')
  .action(async () => {
    await enrich();
  });

// Commande: stats
program
  .command('stats')
  .description('Afficher les statistiques des leads en base')
  .option('--by-city', 'Afficher par ville')
  .option('--by-status', 'Afficher par statut')
  .action(async (options) => {
    const stats = await getStats(getDb());
    
    log.header('STATISTIQUES LEADS');
    log.kv('Total en base', stats.total);
    
    log.blank();
    log.raw('  Par statut:');
    log.raw(`    Nouveau:     ${stats.by_status.nouveau}`);
    log.raw(`    Contacté:    ${stats.by_status.contacte}`);
    log.raw(`    Qualifié:    ${stats.by_status.qualifie}`);
    log.raw(`    Proposition: ${stats.by_status.proposition}`);
    log.raw(`    Converti:    ${stats.by_status.converti}`);
    log.raw(`    Perdu:       ${stats.by_status.perdu}`);
    
    log.blank();
    log.raw('  Par appel:');
    log.raw(`    Non appelé:   ${stats.by_call_status.non_appele}`);
    log.raw(`    Appelé:       ${stats.by_call_status.appele}`);
    log.raw(`    À rappeler:   ${stats.by_call_status.rappeler}`);
    log.raw(`    Injoignable:  ${stats.by_call_status.injoignable}`);
    
    log.blank();
    log.raw('  Par priorité:');
    log.raw(`    High:   ${stats.by_priority.high || 0}`);
    log.raw(`    Medium: ${stats.by_priority.medium || 0}`);
    log.raw(`    Low:    ${stats.by_priority.low || 0}`);
    
    if (options.byCity || Object.keys(stats.by_city).length <= 10) {
      log.blank();
      log.raw('  Par ville:');
      for (const [city, count] of Object.entries(stats.by_city)) {
        log.raw(`    ${city}: ${count}`);
      }
    }
    
    log.blank();
    log.raw('  Aujourd\'hui:');
    log.raw(`    Relances prévues: ${stats.followups_today}`);
    log.raw(`    Contactés:        ${stats.contacted_today}`);
    
    if (stats.total > 0) {
      const conversionRate = ((stats.by_status.converti / stats.total) * 100).toFixed(1);
      log.blank();
      log.success(`Taux conversion: ${conversionRate}%`);
    }
    
    await closeDb();
  });

// Commande: purge (RGPD CNIL — rétention 3 ans après dernier contact)
program
  .command('purge')
  .description('Purge RGPD : supprime les contacts inactifs depuis 3 ans')
  .option('--apply', 'Applique la purge (sinon dry-run)')
  .option('--years <years>', 'Rétention en années', '3')
  .action(async (options) => {
    log.header('PURGE RGPD');
    const result = await runPurge(getDb(), {
      apply: !!options.apply,
      retentionYears: parseInt(options.years, 10),
    });
    log.kv('Candidats', result.candidates);
    log.kv('Purgés', result.purged);
    log.kv('Ajoutés à suppression list', result.suppressed);
    log.kv('Mode', result.dryRun ? 'dry-run' : 'appliqué');
    await closeDb();
  });

program.parse();
