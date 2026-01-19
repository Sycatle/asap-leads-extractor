import { request } from 'undici';
import pLimit from 'p-limit';
import { PappersResult } from '../shared/types.js';
import { getDb, enrichLead } from './db.js';
import type { DbLead } from '../shared/types.js';
import { sleep, retryWithBackoff } from './utils.js';
import 'dotenv/config';

const PAPPERS_API_KEY = process.env.PAPPERS_API_KEY;
const PAPPERS_BASE_URL = 'https://api.pappers.fr/v2';
const MAX_RETRIES = 3;

// Rate limit: 2 requêtes/seconde (laissons p-limit gérer le rythme)
const limit = pLimit(2);

// Warn once about missing API key
if (!PAPPERS_API_KEY) {
  console.warn('\n⚠ PAPPERS_API_KEY non définie - enrichissement désactivé');
  console.warn('  Définissez PAPPERS_API_KEY dans .env pour activer l\'enrichissement\n');
}

// Recherche entreprise par nom + ville avec retry automatique
async function searchPappers(name: string, city: string, retryCount = 0): Promise<PappersResult | null> {
  if (!PAPPERS_API_KEY) {
    return null;
  }

  const query = encodeURIComponent(`${name} ${city}`);
  const url = `${PAPPERS_BASE_URL}/recherche?api_token=${PAPPERS_API_KEY}&q=${query}&par_page=1`;

  try {
    const { statusCode, body } = await request(url);

    if (statusCode === 429) {
      // Rate limited, attendre et retry avec backoff exponentiel
      if (retryCount >= MAX_RETRIES) {
        console.log('  ⚠ Rate limit dépassé après plusieurs tentatives');
        return null;
      }
      const backoffDelay = Math.min(2000 * Math.pow(2, retryCount), 10000);
      console.log(`  ⚠ Rate limited, attente ${backoffDelay}ms... (tentative ${retryCount + 1}/${MAX_RETRIES})`);
      await sleep(backoffDelay);
      return searchPappers(name, city, retryCount + 1);
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



/**
 * Enrichir un seul lead immédiatement (utilisé par le scraper)
 * Retourne true si enrichi avec succès
 */
export async function enrichSingleLead(lead: DbLead): Promise<boolean> {
  if (!PAPPERS_API_KEY) {
    return false;
  }
  
  if (lead.siren) {
    // Déjà enrichi
    return true;
  }
  
  const result = await searchPappers(lead.name, lead.city);
  
  if (result) {
    const dirigeant = extractDirigeant(result);
    
    const updated = enrichLead(lead.id, {
      siren: result.siren,
      siret: result.siret,
      legal_name: result.nom_entreprise,
      dirigeant,
    });
    
    return updated !== null;
  }
  
  return false;
}

/**
 * Récupérer les leads à enrichir (pas encore de SIREN)
 */
function getLeadsToEnrich(maxLeads: number = 100): DbLead[] {
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

// Main
export async function enrich(): Promise<DbLead[]> {
  const leadsToEnrich = getLeadsToEnrich(100);
  
  if (leadsToEnrich.length === 0) {
    console.log('✓ Aucun lead à enrichir');
    return [];
  }

  let enrichedCount = 0;
  let current = 0;

  console.log(`🔍 Enrichissement de ${leadsToEnrich.length} leads...`);

  // Retirer le sleep explicite - laissons p-limit gérer le rythme naturellement
  const tasks = leadsToEnrich.map(lead => limit(async () => {
    current++;
    process.stdout.write(`\r🔍 Enrichissement: ${current}/${leadsToEnrich.length}`);

    const result = await searchPappers(lead.name, lead.city);

    if (result) {
      const dirigeant = extractDirigeant(result);
      
      const updated = enrichLead(lead.id, {
        siren: result.siren,
        siret: result.siret,
        legal_name: result.nom_entreprise,
        dirigeant,
      });
      
      if (updated) {
        enrichedCount++;
      }
    }
  }));

  await Promise.all(tasks);

  console.log(`\n✓ Enrichis SIREN: ${enrichedCount}/${leadsToEnrich.length}`);
  
  return leadsToEnrich;
}

// Run standalone
const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  enrich()
    .then(() => {
      console.log('✓ Enrichissement terminé');
      process.exit(0);
    })
    .catch((err) => {
      console.error('❌ Erreur:', err);
      process.exit(1);
    });
}
