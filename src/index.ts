import { collect } from './collect.js';
import { enrich } from './enrich.js';
import { exportCSV } from './export.js';

async function main() {
  console.log('🚀 Leads Finder - Démarrage\n');

  const startTime = Date.now();

  // Étape 1: Collecte
  console.log('📥 ÉTAPE 1: COLLECTE...');
  await collect();
  console.log('');

  // Étape 2: Enrichissement
  console.log('🔍 ÉTAPE 2: ENRICHISSEMENT...');
  await enrich();
  console.log('');

  // Étape 3: Export
  console.log('📤 ÉTAPE 3: EXPORT...');
  exportCSV();

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n⏱️  Terminé en ${duration}s`);
}

main().catch(console.error);
