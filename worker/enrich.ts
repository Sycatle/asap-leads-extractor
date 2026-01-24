/**
 * Lead Enrichment - Societe.com (gratuit) avec fallback Pappers (payant)
 * 
 * Récupère SIREN, dirigeant et forme juridique depuis societe.com
 */

import { getDb, enrichLead } from './db.js';
import type { DbLead } from '../shared/types.js';
import { searchAndExtract, closeBrowser, type SocieteResult } from './enrichSociete.js';
import 'dotenv/config';

// ===== CONFIGURATION =====
const DEFAULT_BATCH_SIZE = 50;  // Leads par batch (moins agressif que Pappers)
const PROGRESS_INTERVAL = 1;    // Afficher progression tous les X leads

/**
 * Récupérer les leads à enrichir (pas encore de SIREN)
 */
function getLeadsToEnrich(maxLeads: number = DEFAULT_BATCH_SIZE): DbLead[] {
  const database = getDb();
  const stmt = database.prepare(`
    SELECT * FROM leads 
    WHERE siren IS NULL 
    AND opt_out = 0
    ORDER BY score DESC, created_at ASC
    LIMIT ?
  `);
  return stmt.all(maxLeads) as DbLead[];
}

/**
 * Enrichir un seul lead avec Societe.com
 */
export async function enrichSingleLead(lead: DbLead): Promise<boolean> {
  if (lead.siren) {
    return true; // Déjà enrichi
  }
  
  const result = await searchAndExtract(lead.name, lead.city);
  
  if (result) {
    const updated = enrichLead(lead.id, {
      siren: result.siren.replace(/\s/g, ''), // Remove spaces for storage
      legal_name: result.legal_name,
      dirigeant: result.dirigeant,
    });
    
    return updated !== null;
  }
  
  return false;
}

/**
 * Stats d'enrichissement
 */
export interface EnrichmentStats {
  total: number;
  enriched: number;
  withDirigeant: number;
  failed: number;
  duration: number;
}

/**
 * Main enrichment function - processes leads sequentially
 * (Societe.com requires slower pace than API)
 */
export async function enrich(maxLeads?: number): Promise<EnrichmentStats> {
  const batchSize = maxLeads || DEFAULT_BATCH_SIZE;
  const leadsToEnrich = getLeadsToEnrich(batchSize);
  
  const stats: EnrichmentStats = {
    total: leadsToEnrich.length,
    enriched: 0,
    withDirigeant: 0,
    failed: 0,
    duration: 0,
  };
  
  if (leadsToEnrich.length === 0) {
    console.log('✓ Aucun lead à enrichir');
    return stats;
  }

  console.log(`\n🔍 Enrichissement Societe.com de ${leadsToEnrich.length} leads...`);
  console.log(`   ⏱  Temps estimé: ~${Math.ceil(leadsToEnrich.length * 5 / 60)} minutes\n`);
  
  const startTime = Date.now();
  
  try {
    for (let i = 0; i < leadsToEnrich.length; i++) {
      const lead = leadsToEnrich[i];
      
      // Progress
      if ((i + 1) % PROGRESS_INTERVAL === 0 || i === 0) {
        const elapsed = (Date.now() - startTime) / 1000;
        const rate = elapsed > 0 ? (i / elapsed).toFixed(1) : '0';
        process.stdout.write(`\r🔍 ${i + 1}/${leadsToEnrich.length} | ✓ ${stats.enriched} enrichis | ${rate} leads/s`);
      }
      
      try {
        const result = await searchAndExtract(lead.name, lead.city);
        
        if (result) {
          const updated = enrichLead(lead.id, {
            siren: result.siren.replace(/\s/g, ''),
            legal_name: result.legal_name,
            dirigeant: result.dirigeant,
          });
          
          if (updated) {
            stats.enriched++;
            if (result.dirigeant) {
              stats.withDirigeant++;
            }
          }
        } else {
          stats.failed++;
        }
        
      } catch (error) {
        console.error(`\n  ✗ Erreur pour ${lead.name}:`, (error as Error).message);
        stats.failed++;
      }
    }
  } finally {
    // Always close browser
    await closeBrowser();
  }
  
  stats.duration = (Date.now() - startTime) / 1000;
  
  // Final summary
  console.log(`\n\n✅ Enrichissement terminé!`);
  console.log(`   📊 Total: ${stats.total} leads`);
  console.log(`   ✓ Enrichis: ${stats.enriched} (${Math.round(stats.enriched / stats.total * 100)}%)`);
  console.log(`   👤 Avec dirigeant: ${stats.withDirigeant}`);
  console.log(`   ✗ Échecs: ${stats.failed}`);
  console.log(`   ⏱  Durée: ${Math.round(stats.duration)}s`);
  
  return stats;
}

// Run standalone
const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  // Parse command line args
  const args = process.argv.slice(2);
  let maxLeads: number | undefined;
  
  for (const arg of args) {
    if (arg.startsWith('--max=')) {
      maxLeads = parseInt(arg.split('=')[1], 10);
    } else if (arg === '--all') {
      maxLeads = 10000; // Practical limit
    }
  }
  
  enrich(maxLeads)
    .then(() => {
      process.exit(0);
    })
    .catch((err) => {
      console.error('❌ Erreur:', err);
      process.exit(1);
    });
}
