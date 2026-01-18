import { createReadStream, writeFileSync } from 'fs';
import { parse } from 'csv-parse';
import { loadConfig } from './config.js';
import { RawLead, Config } from './types.js';

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
  };
}

// Normalise téléphone FR (format: 0612345678)
function normalizePhone(raw: string): string {
  const cleaned = raw.replace(/[\s.\-()]/g, '');
  // Format FR: commence par 0 ou +33
  if (cleaned.startsWith('+33')) {
    return '0' + cleaned.slice(3);
  }
  if (cleaned.startsWith('33') && cleaned.length === 11) {
    return '0' + cleaned.slice(2);
  }
  if (/^0[1-9]\d{8}$/.test(cleaned)) {
    return cleaned;
  }
  return ''; // Invalide
}

// Extrait code postal de l'adresse
function extractPostalCode(input: string): string {
  const match = input.match(/\b(\d{5})\b/);
  return match ? match[1] : '';
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

        // Sauvegarde intermédiaire
        writeFileSync('data/leads_raw.json', JSON.stringify(deduped, null, 2));
        console.log(`✓ Sauvegardé: data/leads_raw.json`);
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
