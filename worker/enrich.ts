/**
 * Lead Enrichment - Societe.com (gratuit)
 * Récupère SIREN, dirigeant et forme juridique depuis societe.com.
 */

import { and, asc, desc, isNull, sql } from 'drizzle-orm';
import { getDb } from '../db/client';
import { leads, type Lead } from '../db/schema';
import { searchAndExtract, closeBrowser } from './enrichSociete';
import { enrichLogger as log } from './logger';
import 'dotenv/config';

const DEFAULT_BATCH_SIZE = 50;

async function getLeadsToEnrich(maxLeads: number = DEFAULT_BATCH_SIZE): Promise<Lead[]> {
  return getDb()
    .select()
    .from(leads)
    .where(and(isNull(leads.siren), sql`${leads.optOut} = false`, isNull(leads.deletedAt)))
    .orderBy(desc(leads.score), asc(leads.createdAt))
    .limit(maxLeads);
}

async function applyEnrichment(id: number, data: { siren: string; legal_name: string; dirigeant?: string }): Promise<boolean> {
  const result = await getDb()
    .update(leads)
    .set({
      siren: data.siren,
      legalName: data.legal_name,
      dirigeant: data.dirigeant ?? null,
      updatedAt: sql`now()`,
    })
    .where(sql`${leads.id} = ${id}`)
    .returning({ id: leads.id });
  return result.length > 0;
}

export async function enrichSingleLead(lead: Lead): Promise<boolean> {
  if (lead.siren) return true;
  const result = await searchAndExtract(lead.name, lead.city);
  if (!result) return false;
  return applyEnrichment(lead.id, {
    siren: result.siren.replace(/\s/g, ''),
    legal_name: result.legal_name,
    dirigeant: result.dirigeant,
  });
}

export interface EnrichmentStats {
  total: number;
  enriched: number;
  withDirigeant: number;
  failed: number;
  duration: number;
}

export async function enrich(maxLeads?: number): Promise<EnrichmentStats> {
  const batchSize = maxLeads || DEFAULT_BATCH_SIZE;
  const leadsToEnrich = await getLeadsToEnrich(batchSize);

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

  log.header('ENRICHISSEMENT SOCIETE.COM');
  log.kv('Leads à traiter', leadsToEnrich.length);
  log.kv('Temps estimé', `~${Math.ceil((leadsToEnrich.length * 5) / 60)} min`);
  log.blank();

  const startTime = Date.now();

  try {
    for (let i = 0; i < leadsToEnrich.length; i++) {
      const lead = leadsToEnrich[i];
      log.sub(`[${i + 1}/${leadsToEnrich.length}] ${lead.name} (${lead.city})`);

      try {
        const result = await searchAndExtract(lead.name, lead.city);
        if (result) {
          const updated = await applyEnrichment(lead.id, {
            siren: result.siren.replace(/\s/g, ''),
            legal_name: result.legal_name,
            dirigeant: result.dirigeant,
          });
          if (updated) {
            stats.enriched++;
            if (result.dirigeant) stats.withDirigeant++;
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
    await closeBrowser();
  }

  stats.duration = (Date.now() - startTime) / 1000;

  log.blank();
  log.section('RÉSULTAT ENRICHISSEMENT');
  log.kv('Total traités', stats.total);
  log.kv('Enrichis', `${stats.enriched} (${stats.total ? Math.round((stats.enriched / stats.total) * 100) : 0}%)`);
  log.kv('Avec dirigeant', stats.withDirigeant);
  log.kv('Échecs', stats.failed);
  log.kv('Durée', `${Math.round(stats.duration)}s`);

  return stats;
}

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  const args = process.argv.slice(2);
  let maxLeads: number | undefined;
  for (const arg of args) {
    if (arg.startsWith('--max=')) maxLeads = parseInt(arg.split('=')[1], 10);
    else if (arg === '--all') maxLeads = 10000;
  }
  enrich(maxLeads)
    .then(() => process.exit(0))
    .catch((err) => { console.error('❌ Erreur:', err); process.exit(1); });
}
