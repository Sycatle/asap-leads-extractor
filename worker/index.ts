import { collect } from './collect.js';
import { enrich } from './enrich.js';
import { exportCSV } from './export.js';
import { scrapeGoogleMaps } from './googleMapsScraper.js';
import { loadConfig } from './config.js';
import { getDb, closeDb } from './db.js';

const WORKER_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes par défaut

interface WorkerStats {
  runs: number;
  totalLeadsScraped: number;
  totalLeadsEnriched: number;
  lastRunAt: Date | null;
  errors: number;
}

const stats: WorkerStats = {
  runs: 0,
  totalLeadsScraped: 0,
  totalLeadsEnriched: 0,
  lastRunAt: null,
  errors: 0,
};

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

async function runScrapeJob(): Promise<number> {
  const config = loadConfig();
  
  if (!config.scrape?.niches?.length || !config.scrape?.cities?.length) {
    console.log('⚠ Pas de config scrape définie, skip...');
    return 0;
  }
  
  console.log('\n📍 JOB: Scraping Google Maps...');
  const leads = await scrapeGoogleMaps({
    niches: config.scrape.niches,
    cities: config.scrape.cities,
    saveToDb: true,
  });
  
  return leads.length;
}

async function runEnrichJob(): Promise<number> {
  console.log('\n🔍 JOB: Enrichissement Pappers...');
  const enriched = await enrich();
  return enriched.length;
}

async function runCollectJob(): Promise<number> {
  const config = loadConfig();
  
  if (!config.input_csv) {
    return 0;
  }
  
  console.log('\n📥 JOB: Import CSV...');
  try {
    const leads = await collect();
    return leads.length;
  } catch (err) {
    console.log('⚠ Pas de CSV à importer');
    return 0;
  }
}

async function runExportJob(): Promise<void> {
  console.log('\n📤 JOB: Export CSV...');
  exportCSV();
}

async function runCycle(): Promise<void> {
  const startTime = Date.now();
  stats.runs++;
  stats.lastRunAt = new Date();
  
  console.log('\n' + '='.repeat(60));
  console.log(`🔄 CYCLE #${stats.runs} - ${stats.lastRunAt.toLocaleString('fr-FR')}`);
  console.log('='.repeat(60));
  
  try {
    // 1. Scrape
    const scraped = await runScrapeJob();
    stats.totalLeadsScraped += scraped;
    
    // 2. Collect (import CSV si présent)
    await runCollectJob();
    
    // 3. Enrich
    const enriched = await runEnrichJob();
    stats.totalLeadsEnriched += enriched;
    
    // 4. Export
    await runExportJob();
    
    const duration = Date.now() - startTime;
    console.log('\n' + '-'.repeat(60));
    console.log(`✅ Cycle terminé en ${formatDuration(duration)}`);
    console.log(`   Leads scrappés: ${scraped} | Enrichis: ${enriched}`);
    console.log(`   Total cumulé: ${stats.totalLeadsScraped} scrappés, ${stats.totalLeadsEnriched} enrichis`);
    
  } catch (error) {
    stats.errors++;
    console.error('\n❌ Erreur dans le cycle:', error);
  }
}

async function runOnce(): Promise<void> {
  console.log('🚀 Leads Finder - Mode single run\n');
  
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

async function runWorker(): Promise<void> {
  const config = loadConfig();
  const intervalMs = (config.worker?.interval_minutes ?? 30) * 60 * 1000;
  
  console.log('🚀 Leads Finder - Worker Mode');
  console.log('='.repeat(60));
  console.log(`  Intervalle: ${intervalMs / 60000} minutes`);
  console.log(`  Niches: ${config.scrape?.niches?.join(', ') || 'non défini'}`);
  console.log(`  Villes: ${config.scrape?.cities?.join(', ') || 'non défini'}`);
  console.log('='.repeat(60));
  console.log('\n⏳ Worker démarré. Ctrl+C pour arrêter.\n');
  
  // Premier run immédiat
  await runCycle();
  
  // Boucle infinie
  const loop = async () => {
    console.log(`\n⏳ Prochain cycle dans ${intervalMs / 60000} minutes...`);
    await sleep(intervalMs);
    await runCycle();
    loop(); // Récursion pour boucle infinie
  };
  
  loop().catch(console.error);
  
  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n\n🛑 Arrêt du worker...');
    console.log(`   Runs effectués: ${stats.runs}`);
    console.log(`   Leads scrappés: ${stats.totalLeadsScraped}`);
    console.log(`   Erreurs: ${stats.errors}`);
    closeDb();
    process.exit(0);
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ===== CLI =====

const args = process.argv.slice(2);
const command = args[0] || 'once';

async function main() {
  // Init DB
  getDb();
  
  switch (command) {
    case 'worker':
    case 'loop':
      await runWorker();
      break;
      
    case 'scrape':
      await runScrapeJob();
      closeDb();
      break;
      
    case 'enrich':
      await runEnrichJob();
      closeDb();
      break;
      
    case 'export':
      await runExportJob();
      closeDb();
      break;
      
    case 'once':
    default:
      await runOnce();
      closeDb();
      break;
  }
}

main().catch((err) => {
  console.error('❌ Erreur fatale:', err);
  closeDb();
  process.exit(1);
});
