import { createReadStream } from 'fs';
import { parse } from 'csv-parse';
import { loadConfig } from './config.js';
import { RawLead, Config } from '../shared/types.js';
import { upsertLeads, type InsertLead } from './db.js';
import { normalizePhone, extractPostalCode, normalizeCity } from './utils.js';
import { collectLogger as log } from './logger.js';

// Mapping colonnes CSV scraper → RawLead
function mapRow(row: Record<string, string>): RawLead | null {
  const phone = normalizePhone(row.phone || row.telephone || row.Phone || row.Telephone || '');
  if (!phone) return null; // Skip si pas de téléphone

  // Normaliser la ville (enlever tirets, majuscules, arrondissements)
  const rawCity = row.city || row.ville || row.City || '';
  const city = normalizeCity(rawCity);

  return {
    name: row.name || row.title || row.nom || row.Name || row.Title || '',
    phone,
    address: row.address || row.adresse || row.Address || '',
    city,
    postal_code: extractPostalCode(row.postal_code || row.postalCode || row.address || row.Address || ''),
    website: row.website || row.site || row.Website || undefined,
    maps_url: row.url || row.maps_url || row.link || row.Url || row.Link || '',
    rating: parseFloat(row.rating || row.note || row.Rating || '0') || undefined,
    reviews_count: parseInt(row.reviews || row.reviews_count || row.reviewsCount || row.Reviews || '0') || undefined,
    niche: row.niche || row.category || row.Niche || undefined,
  };
}



// Filtre par département autorisé
function isAllowedDepartment(postalCode: string, config: Config): boolean {
  if (!postalCode || config.allowed_departments.length === 0) return true;
  const dept = postalCode.substring(0, 2);
  return config.allowed_departments.includes(dept);
}

// Filtre chaînes exclues
function isExcludedChain(name: string, config: Config): boolean {
  const lower = name.toLowerCase();
  return config.exclude_keywords.some(kw => lower.includes(kw.toLowerCase()));
}

/**
 * Format error message safely
 */
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return String(error);
}

// Déduplication par téléphone
function dedupeByPhone(leads: RawLead[]): RawLead[] {
  const seen = new Set<string>();
  return leads.filter(lead => {
    if (seen.has(lead.phone)) return false;
    seen.add(lead.phone);
    return true;
  });
}

// Main
export async function collect(): Promise<RawLead[]> {
  const config = loadConfig();
  const leads: RawLead[] = [];

  return new Promise((resolve, reject) => {
    const stream = createReadStream(config.input_csv);
    
    stream.on('error', (error) => {
      log.error(`Erreur lecture fichier ${config.input_csv}: ${getErrorMessage(error)}`);
      reject(error);
    });
    
    stream
      .pipe(parse({ columns: true, skip_empty_lines: true, bom: true }))
      .on('data', (row: Record<string, string>) => {
        try {
          const lead = mapRow(row);
          if (lead &&
              isAllowedDepartment(lead.postal_code, config) &&
              !isExcludedChain(lead.name, config)) {
            leads.push(lead);
          }
        } catch (error) {
          // Skip invalid rows but log warning
          log.warn('Ligne CSV invalide, ignorée');
        }
      })
      .on('end', () => {
        const deduped = dedupeByPhone(leads);
        log.success(`Importés: ${leads.length} | Après dédup: ${deduped.length}`);

        // Sauvegarder en batch en SQLite (beaucoup plus efficace)
        const dbLeads: InsertLead[] = deduped.map(lead => ({
          phone: lead.phone,
          name: lead.name,
          address: lead.address,
          city: lead.city,
          postal_code: lead.postal_code,
          website: lead.website,
          website_status: lead.website ? undefined : 'none',
          maps_url: lead.maps_url,
          rating: lead.rating,
          reviews_count: lead.reviews_count,
          niche: lead.niche || null,
          source: 'import',
        }));
        
        try {
          const inserted = upsertLeads(dbLeads);
          log.success(`Sauvegardés en DB: ${inserted}/${deduped.length}`);
        } catch (error) {
          log.error(`Erreur sauvegarde DB: ${getErrorMessage(error)}`);
        }
        
        resolve(deduped);
      })
      .on('error', (error) => {
        log.error(`Erreur parsing CSV: ${getErrorMessage(error)}`);
        reject(error);
      });
  });
}

// Run standalone
const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  collect().catch(console.error);
}
