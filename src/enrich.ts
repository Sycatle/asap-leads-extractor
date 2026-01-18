import { readFileSync, writeFileSync } from 'fs';
import { request } from 'undici';
import pLimit from 'p-limit';
import { RawLead, EnrichedLead, PappersResult } from './types.js';
import 'dotenv/config';

const PAPPERS_API_KEY = process.env.PAPPERS_API_KEY;
const PAPPERS_BASE_URL = 'https://api.pappers.fr/v2';

// Rate limit: 2 requêtes/seconde
const limit = pLimit(2);

// Recherche entreprise par nom + ville
async function searchPappers(name: string, city: string): Promise<PappersResult | null> {
  if (!PAPPERS_API_KEY) {
    return null;
  }

  const query = encodeURIComponent(`${name} ${city}`);
  const url = `${PAPPERS_BASE_URL}/recherche?api_token=${PAPPERS_API_KEY}&q=${query}&par_page=1`;

  try {
    const { statusCode, body } = await request(url);

    if (statusCode === 429) {
      // Rate limited, attendre et retry
      console.log('  ⚠ Rate limited, attente 2s...');
      await sleep(2000);
      return searchPappers(name, city);
    }

    if (statusCode === 401) {
      console.log('  ⚠ Clé API Pappers invalide');
      return null;
    }

    if (statusCode !== 200) {
      return null;
    }

    const data = await body.json() as { resultats?: PappersResult[] };
    return data.resultats?.[0] || null;
  } catch (error) {
    console.error(`  ✗ Erreur Pappers pour ${name}:`, (error as Error).message);
    return null;
  }
}

// Récupérer dirigeant principal
function extractDirigeant(result: PappersResult): string | undefined {
  const rep = result.representants?.find(r =>
    r.qualite?.toLowerCase().includes('gérant') ||
    r.qualite?.toLowerCase().includes('président') ||
    r.qualite?.toLowerCase().includes('directeur')
  ) || result.representants?.[0];

  if (rep) {
    return `${rep.prenom} ${rep.nom}`.trim();
  }
  return undefined;
}

// Calcul priorité
function computePriority(lead: RawLead): 'high' | 'medium' | 'low' {
  // High: pas de site web = opportunité
  if (!lead.website) return 'high';
  // Low: site existe et bonnes reviews
  if (lead.rating && lead.rating >= 4.5 && lead.reviews_count && lead.reviews_count > 50) {
    return 'low';
  }
  return 'medium';
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Main
export async function enrich(): Promise<EnrichedLead[]> {
  const raw: RawLead[] = JSON.parse(readFileSync('data/leads_raw.json', 'utf-8'));
  const enriched: EnrichedLead[] = [];

  let enrichedCount = 0;
  let current = 0;

  if (!PAPPERS_API_KEY) {
    console.log('⚠ PAPPERS_API_KEY non définie - enrichissement désactivé');
    console.log('  Les leads seront exportés sans SIREN/dirigeant\n');
  }

  const tasks = raw.map(lead => limit(async () => {
    current++;
    process.stdout.write(`\r🔍 Enrichissement: ${current}/${raw.length}`);

    let result: PappersResult | null = null;
    
    if (PAPPERS_API_KEY) {
      result = await searchPappers(lead.name, lead.city);
      // Pause entre requêtes
      await sleep(500);
    }

    const enrichedLead: EnrichedLead = {
      ...lead,
      priority: computePriority(lead),
    };

    if (result) {
      enrichedLead.siren = result.siren;
      enrichedLead.siret = result.siret;
      enrichedLead.legal_name = result.nom_entreprise;
      enrichedLead.dirigeant = extractDirigeant(result);
      enrichedCount++;
    }

    enriched.push(enrichedLead);
  }));

  await Promise.all(tasks);

  console.log(`\n✓ Enrichis SIREN: ${enrichedCount}/${raw.length}`);

  // Sauvegarde
  writeFileSync('data/leads_enriched.json', JSON.stringify(enriched, null, 2));
  console.log('✓ Sauvegardé: data/leads_enriched.json');
  
  return enriched;
}

// Run standalone
const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  enrich().catch(console.error);
}
