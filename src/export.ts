import { readFileSync, writeFileSync } from 'fs';
import { stringify } from 'csv-stringify/sync';
import { EnrichedLead } from './types.js';
import { loadConfig } from './config.js';

// Tri par priorité
function sortByPriority(leads: EnrichedLead[]): EnrichedLead[] {
  const order = { high: 0, medium: 1, low: 2 };
  return [...leads].sort((a, b) => order[a.priority] - order[b.priority]);
}

// Main
export function exportCSV(): void {
  const config = loadConfig();
  const leads: EnrichedLead[] = JSON.parse(
    readFileSync('data/leads_enriched.json', 'utf-8')
  );

  // Trier et limiter
  const sorted = sortByPriority(leads);
  const final = sorted.slice(0, config.target);

  // Colonnes CSV
  const columns = [
    'name',
    'phone',
    'city',
    'postal_code',
    'address',
    'website',
    'maps_url',
    'rating',
    'reviews_count',
    'siren',
    'legal_name',
    'dirigeant',
    'priority',
  ];

  const csv = stringify(final, {
    header: true,
    columns,
  });

  writeFileSync('data/leads.csv', csv);

  // Stats finales
  const stats = {
    total_imported: leads.length,
    with_siren: leads.filter(l => l.siren).length,
    with_dirigeant: leads.filter(l => l.dirigeant).length,
    exported: final.length,
    by_priority: {
      high: final.filter(l => l.priority === 'high').length,
      medium: final.filter(l => l.priority === 'medium').length,
      low: final.filter(l => l.priority === 'low').length,
    },
  };

  console.log('\n========== RAPPORT ==========');
  console.log(`✓ Total importés: ${stats.total_imported}`);
  console.log(`✓ Avec SIREN: ${stats.with_siren}`);
  console.log(`✓ Avec dirigeant: ${stats.with_dirigeant}`);
  console.log(`✓ Exportés: ${stats.exported}`);
  console.log(`  → High priority: ${stats.by_priority.high}`);
  console.log(`  → Medium priority: ${stats.by_priority.medium}`);
  console.log(`  → Low priority: ${stats.by_priority.low}`);
  console.log(`\n📁 Fichier: data/leads.csv`);
}

// Run standalone
const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  exportCSV();
}
