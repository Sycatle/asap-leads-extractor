import { request } from 'undici';
import pLimit from 'p-limit';
import { PappersResult } from './types.js';
import { getDb, enrichLead } from './db.js';
import type { DbLead } from './types.js';
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

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
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

  if (!PAPPERS_API_KEY) {
    console.log('⚠ PAPPERS_API_KEY non définie - enrichissement désactivé');
    console.log('  Définissez PAPPERS_API_KEY dans .env pour activer l\'enrichissement\n');
    return leadsToEnrich;
  }

  console.log(`🔍 Enrichissement de ${leadsToEnrich.length} leads...`);

  const tasks = leadsToEnrich.map(lead => limit(async () => {
    current++;
    process.stdout.write(`\r🔍 Enrichissement: ${current}/${leadsToEnrich.length}`);

    const result = await searchPappers(lead.name, lead.city);
    
    // Pause entre requêtes
    await sleep(500);

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
