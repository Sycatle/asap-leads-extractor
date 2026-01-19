import { createReadStream } from 'fs';
import { parse } from 'csv-parse';
import { loadConfig } from './config.js';
import { RawLead, Config } from '../shared/types.js';
import { upsertLeads, type InsertLead } from './db.js';
import { normalizePhone, extractPostalCode } from './utils.js';

// Mapping colonnes CSV scraper → RawLead
function mapRow(row: Record<string, string>): RawLead | null {
  const phone = normalizePhone(row.phone || row.telephone || row.Phone || row.Telephone || '');
  if (!phone) return null; // Skip si pas de téléphone

  return {
    name: row.name || row.title || row.nom || row.Name || row.Title || '',
    phone,
    address: row.address || row.adresse || row.Address || '',
    city: row.city || row.ville || row.City || '',
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
    createReadStream(config.input_csv)
      .pipe(parse({ columns: true, skip_empty_lines: true, bom: true }))
      .on('data', (row: Record<string, string>) => {
        const lead = mapRow(row);
        if (lead &&
            isAllowedDepartment(lead.postal_code, config) &&
            !isExcludedChain(lead.name, config)) {
          leads.push(lead);
        }
      })
      .on('end', () => {
        const deduped = dedupeByPhone(leads);
        console.log(`✓ Importés: ${leads.length}`);
        console.log(`✓ Après dédup: ${deduped.length}`);

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
        
        const inserted = upsertLeads(dbLeads);
        console.log(`✓ Sauvegardés en DB: ${inserted}/${deduped.length}`);
        resolve(deduped);
      })
      .on('error', reject);
  });
}

// Run standalone
const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  collect().catch(console.error);
}
