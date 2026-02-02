#!/usr/bin/env tsx
/**
 * Import Config to Database
 * 
 * Migre la configuration de config.json vers les tables scraper_* de la base de données.
 * 
 * Usage:
 *   pnpm tsx worker/importConfig.ts [--dry-run]
 */

import { getDb, closeDb } from './db';
import { runMigrations } from '../shared/migrations';
import { importConfigToDb, getNicheNames, getCityNames, getDepartments, getExcludeKeywords } from '../shared/queries/scraperConfig';
import { readFileSync, existsSync } from 'fs';

const DRY_RUN = process.argv.includes('--dry-run');

async function main() {
  console.log('🔄 Import de la configuration vers la base de données\n');
  
  if (DRY_RUN) {
    console.log('⚠️  Mode dry-run - aucune modification ne sera effectuée\n');
  }
  
  // Load JSON config
  const configPath = process.env.CONFIG_PATH || 'config.json';
  if (!existsSync(configPath)) {
    console.error(`❌ Fichier config non trouvé: ${configPath}`);
    process.exit(1);
  }
  
  const config = JSON.parse(readFileSync(configPath, 'utf-8'));
  
  console.log('📋 Configuration à importer:');
  console.log(`   Niches: ${config.scrape?.niches?.length || 0}`);
  console.log(`   Villes: ${config.scrape?.cities?.length || 0}`);
  console.log(`   Départements: ${config.allowed_departments?.length || 0}`);
  console.log(`   Mots exclus: ${config.exclude_keywords?.length || 0}`);
  console.log();
  
  if (DRY_RUN) {
    console.log('Niches:');
    config.scrape?.niches?.forEach((n: string) => console.log(`  - ${n}`));
    console.log('\nVilles:');
    config.scrape?.cities?.forEach((c: string) => console.log(`  - ${c}`));
    console.log('\nDépartements:');
    config.allowed_departments?.forEach((d: string) => console.log(`  - ${d}`));
    console.log('\nMots exclus:');
    config.exclude_keywords?.forEach((k: string) => console.log(`  - ${k}`));
    
    console.log('\n✅ Dry-run terminé. Exécutez sans --dry-run pour appliquer.');
    return;
  }
  
  // Get DB and run migrations
  const db = getDb();
  console.log('📦 Application des migrations...');
  runMigrations(db);
  
  // Check existing data
  const existingNiches = getNicheNames(db);
  const existingCities = getCityNames(db);
  
  if (existingNiches.length > 0 || existingCities.length > 0) {
    console.log('\n⚠️  Données existantes détectées:');
    console.log(`   Niches: ${existingNiches.length}`);
    console.log(`   Villes: ${existingCities.length}`);
    console.log('\n   L\'import ajoutera les nouvelles entrées sans supprimer les existantes.');
    console.log('   Pour repartir de zéro, videz d\'abord les tables scraper_*.\n');
  }
  
  // Import
  console.log('📥 Import en cours...');
  
  importConfigToDb(db, {
    niches: config.scrape?.niches,
    cities: config.scrape?.cities,
    allowed_departments: config.allowed_departments,
    exclude_keywords: config.exclude_keywords,
    target: config.target,
    orchestrator: config.orchestrator,
  });
  
  // Verify
  const finalNiches = getNicheNames(db);
  const finalCities = getCityNames(db);
  const finalDepts = getDepartments(db);
  const finalExclude = getExcludeKeywords(db);
  
  console.log('\n✅ Import terminé:');
  console.log(`   Niches: ${finalNiches.length}`);
  console.log(`   Villes: ${finalCities.length}`);
  console.log(`   Départements: ${finalDepts.length}`);
  console.log(`   Mots exclus: ${finalExclude.length}`);
  
  console.log('\n📋 Le worker chargera maintenant la config depuis la base de données.');
  console.log('   Vous pouvez modifier les niches/villes directement en base sans redémarrer.');
  
  closeDb();
}

main().catch(err => {
  console.error('❌ Erreur:', err.message);
  closeDb();
  process.exit(1);
});
