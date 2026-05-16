/**
 * Lead Enrichment - Societe.com (gratuit) avec fallback Pappers (payant)
 * 
 * Récupère SIREN, dirigeant et forme juridique depuis societe.com
 */

import { getDb } from './db';
import type { DbLead } from '../shared/types';
import { searchAndExtract, closeBrowser } from './enrichSociete';
import { enrichLogger as log } from './logger';
import 'dotenv/config';

// ===== CONFIGURATION =====
const DEFAULT_BATCH_SIZE = 50;  // Leads par batch (moins agressif que Pappers)

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
    log.success('Aucun lead à enrichir');
    return stats;
  }

  log.header(`ENRICHISSEMENT SOCIETE.COM`);
  log.kv('Leads à traiter', leadsToEnrich.length);
  log.kv('Temps estimé', `~${Math.ceil(leadsToEnrich.length * 5 / 60)} min`);
  log.blank();
  
  const startTime = Date.now();
  const progress = new ProgressBar({ total: leadsToEnrich.length, label: 'Enrichissement', logger: log });
  
  try {
    for (let i = 0; i < leadsToEnrich.length; i++) {
      const lead = leadsToEnrich[i];
      
      progress.update(i + 1, `✓ ${stats.enriched}`);
      
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
        log.error(`Erreur pour ${lead.name}: ${(error as Error).message}`);
        stats.failed++;
      }
    }
  } finally {
    // Always close browser
    await closeBrowser();
  }
  
  stats.duration = (Date.now() - startTime) / 1000;
  
  // Final summary
  progress.complete();
  log.blank();
  log.section('RÉSULTAT ENRICHISSEMENT');
  log.kv('Total traités', stats.total);
  log.kv('Enrichis', `${stats.enriched} (${Math.round(stats.enriched / stats.total * 100)}%)`);
  log.kv('Avec dirigeant', stats.withDirigeant);
  log.kv('Échecs', stats.failed);
  log.kv('Durée', `${Math.round(stats.duration)}s`);
  
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
