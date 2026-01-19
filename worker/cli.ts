#!/usr/bin/env node
import { Command } from 'commander';
import { collect } from './collect.js';
import { enrich } from './enrich.js';
import { scrapeGoogleMaps } from './googleMapsScraper.js';
import { loadConfig } from './config.js';
import { getStats, findLeads, closeDb, countLeads } from './db.js';

const program = new Command();

program
  .name('leads-finder')
  .description('Générateur de leads call-ready pour prospection')
  .version('1.0.0');

// Commande: run (pipeline complet)
program
  .command('run')
  .description('Exécute le pipeline complet: collect → enrich (full SQLite)')
  .option('-c, --config <path>', 'Chemin vers le fichier config', 'config.json')
  .option('--skip-enrich', 'Sauter l\'étape d\'enrichissement Pappers')
  .action(async (options) => {
    console.log('🚀 Leads Finder - Pipeline complet\n');
    const startTime = Date.now();

    console.log('📥 ÉTAPE 1: COLLECTE...');
    await collect();
    console.log('');

    if (!options.skipEnrich) {
      console.log('🔍 ÉTAPE 2: ENRICHISSEMENT...');
      await enrich();
      console.log('');
    } else {
      console.log('⏭️  ÉTAPE 2: ENRICHISSEMENT (skipped)\n');
    }

    const stats = getStats();
    console.log(`📊 En base: ${stats.total} leads total`);

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\n⏱️  Terminé en ${duration}s`);
    closeDb();
  });

// Commande: scrape (Google Maps)
program
  .command('scrape')
  .description('Scraper Google Maps pour collecter des leads (sauvegarde directe en SQLite)')
  .option('--niches <niches>', 'Niches à scraper (séparées par virgule)', 'coiffeur')
  .option('--cities <cities>', 'Villes à scraper (séparées par virgule)', 'Le Mans')
  .option('--skip-enrich', 'Sauter l\'enrichissement Pappers')
  .action(async (options) => {
    console.log('🚀 Leads Finder - Mode Scraping\n');
    const startTime = Date.now();
    const config = loadConfig();

    // Utiliser les options CLI ou la config
    const niches = options.niches ? options.niches.split(',').map((s: string) => s.trim()) : config.scrape?.niches || ['coiffeur'];
    const cities = options.cities ? options.cities.split(',').map((s: string) => s.trim()) : config.scrape?.cities || ['Le Mans'];

    // Étape 1: Scraping + sauvegarde DB
    console.log('🌐 ÉTAPE 1: SCRAPING GOOGLE MAPS...\n');
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
    
    console.log(`✓ Leads scrapés: ${leads.length} (${filteredCount} après filtrage chaînes)`);

    // Étape 2: Enrichissement
    if (!options.skipEnrich) {
      console.log('\n🔍 ÉTAPE 2: ENRICHISSEMENT...');
      await enrich();
      console.log('');
    } else {
      console.log('\n⏭️  ÉTAPE 2: ENRICHISSEMENT (skipped)\n');
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    
    // Stats DB
    const stats = getStats();
    console.log(`📊 En base: ${stats.total} leads total`);
    
    console.log(`\n⏱️  Terminé en ${duration}s`);
    closeDb();
  });

// Commande: collect
program
  .command('collect')
  .description('Importer et nettoyer le CSV source')
  .option('-f, --file <path>', 'Fichier CSV à importer (override config)')
  .action(async () => {
    console.log('📥 COLLECTE...\n');
    await collect();
  });

// Commande: enrich
program
  .command('enrich')
  .description('Enrichir les leads avec Pappers (SIREN + dirigeant)')
  .action(async () => {
    console.log('🔍 ENRICHISSEMENT...\n');
    await enrich();
  });

// Commande: stats
program
  .command('stats')
  .description('Afficher les statistiques des leads en base')
  .option('--by-city', 'Afficher par ville')
  .option('--by-status', 'Afficher par statut')
  .action(async (options) => {
    const stats = getStats();
    
    console.log('📊 STATISTIQUES LEADS\n');
    console.log(`Total en base: ${stats.total}`);
    
    console.log('\n📋 Par statut:');
    console.log(`  🆕 Nouveau:     ${stats.by_status.nouveau}`);
    console.log(`  📞 Contacté:    ${stats.by_status.contacte}`);
    console.log(`  ✅ Qualifié:    ${stats.by_status.qualifie}`);
    console.log(`  📝 Proposition: ${stats.by_status.proposition}`);
    console.log(`  🎉 Converti:    ${stats.by_status.converti}`);
    console.log(`  ❌ Perdu:       ${stats.by_status.perdu}`);
    
    console.log('\n📞 Par appel:');
    console.log(`  Non appelé:   ${stats.by_call_status.non_appele}`);
    console.log(`  Appelé:       ${stats.by_call_status.appele}`);
    console.log(`  Messagerie:   ${stats.by_call_status.messagerie}`);
    console.log(`  À rappeler:   ${stats.by_call_status.rappeler}`);
    console.log(`  Injoignable:  ${stats.by_call_status.injoignable}`);
    
    console.log('\n⭐ Par priorité:');
    console.log(`  High:   ${stats.by_priority.high || 0}`);
    console.log(`  Medium: ${stats.by_priority.medium || 0}`);
    console.log(`  Low:    ${stats.by_priority.low || 0}`);
    
    if (options.byCity || Object.keys(stats.by_city).length <= 10) {
      console.log('\n🏙️  Par ville:');
      for (const [city, count] of Object.entries(stats.by_city)) {
        console.log(`  ${city}: ${count}`);
      }
    }
    
    console.log('\n📅 Aujourd\'hui:');
    console.log(`  Relances prévues: ${stats.followups_today}`);
    console.log(`  Contactés:        ${stats.contacted_today}`);
    
    if (stats.total > 0) {
      const conversionRate = ((stats.by_status.converti / stats.total) * 100).toFixed(1);
      console.log(`\n🏆 Taux conversion: ${conversionRate}%`);
    }
    
    closeDb();
  });

program.parse();
