#!/usr/bin/env node
import { Command } from 'commander';
import { collect } from './collect.js';
import { enrich } from './enrich.js';
import { exportCSV } from './export.js';

const program = new Command();

program
  .name('leads-finder')
  .description('Générateur de leads call-ready pour prospection')
  .version('1.0.0');

// Commande: run (pipeline complet)
program
  .command('run')
  .description('Exécute le pipeline complet: collect → enrich → export')
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
      // Copier leads_raw vers leads_enriched pour l'export
      const { readFileSync, writeFileSync } = await import('fs');
      const raw = JSON.parse(readFileSync('data/leads_raw.json', 'utf-8'));
      const enriched = raw.map((l: Record<string, unknown>) => ({ ...l, priority: l.website ? 'medium' : 'high' }));
      writeFileSync('data/leads_enriched.json', JSON.stringify(enriched, null, 2));
    }

    console.log('📤 ÉTAPE 3: EXPORT...');
    exportCSV();

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\n⏱️  Terminé en ${duration}s`);
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

// Commande: export
program
  .command('export')
  .description('Exporter les leads en CSV')
  .option('-n, --limit <number>', 'Nombre de leads à exporter', '100')
  .action(() => {
    console.log('📤 EXPORT...\n');
    exportCSV();
  });

// Commande: stats
program
  .command('stats')
  .description('Afficher les statistiques des leads enrichis')
  .action(async () => {
    const { readFileSync, existsSync } = await import('fs');
    
    if (!existsSync('data/leads_enriched.json')) {
      console.log('❌ Aucun lead enrichi trouvé. Lance d\'abord: leads-finder run');
      return;
    }

    const leads = JSON.parse(readFileSync('data/leads_enriched.json', 'utf-8'));
    
    console.log('📊 STATISTIQUES\n');
    console.log(`Total leads: ${leads.length}`);
    console.log(`Avec SIREN: ${leads.filter((l: Record<string, unknown>) => l.siren).length}`);
    console.log(`Avec dirigeant: ${leads.filter((l: Record<string, unknown>) => l.dirigeant).length}`);
    console.log(`Avec site web: ${leads.filter((l: Record<string, unknown>) => l.website).length}`);
    console.log(`\nPar priorité:`);
    console.log(`  High: ${leads.filter((l: Record<string, unknown>) => l.priority === 'high').length}`);
    console.log(`  Medium: ${leads.filter((l: Record<string, unknown>) => l.priority === 'medium').length}`);
    console.log(`  Low: ${leads.filter((l: Record<string, unknown>) => l.priority === 'low').length}`);
  });

program.parse();
