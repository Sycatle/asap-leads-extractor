import { writeFileSync } from 'fs';
import { stringify } from 'csv-stringify/sync';
import { getDb } from './db.js';
import { loadConfig } from './config.js';
import type { DbLead } from '../shared/types.js';

/**
 * Récupérer les leads à exporter, triés par score puis priorité
 */
function getLeadsToExport(limit: number = 1000): DbLead[] {
  const database = getDb();
  const stmt = database.prepare(`
    SELECT * FROM leads 
    WHERE opt_out = 0
    ORDER BY 
      CASE priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END,
      score DESC,
      created_at DESC
    LIMIT ?
  `);
  return stmt.all(limit) as DbLead[];
}

// Main
export function exportCSV(): void {
  const config = loadConfig();
  const leads = getLeadsToExport(config.target || 1000);

  if (leads.length === 0) {
    console.log('✓ Aucun lead à exporter');
    return;
  }

  // Colonnes CSV enrichies
  const columns = [
    'name',
    'phone',
    'phone_type',
    'city',
    'postal_code',
    'address',
    'website',
    'website_status',
    'maps_url',
    'rating',
    'reviews_count',
    'niche',
    'siren',
    'legal_name',
    'dirigeant',
    'priority',
    'score',
    'best_call_time',
    'has_booking',
    'status',
    'call_status',
    'attempts_count',
  ];

  const csv = stringify(leads, {
    header: true,
    columns,
  });

  writeFileSync('data/leads.csv', csv);

  // Stats finales
  const stats = {
    total: leads.length,
    with_siren: leads.filter(l => l.siren).length,
    with_dirigeant: leads.filter(l => l.dirigeant).length,
    by_priority: {
      high: leads.filter(l => l.priority === 'high').length,
      medium: leads.filter(l => l.priority === 'medium').length,
      low: leads.filter(l => l.priority === 'low').length,
    },
    by_status: {
      nouveau: leads.filter(l => l.status === 'nouveau').length,
      contacte: leads.filter(l => l.status === 'contacte').length,
    },
    avg_score: Math.round(leads.reduce((sum, l) => sum + (l.score || 50), 0) / leads.length),
  };

  console.log('\n========== RAPPORT EXPORT ==========');
  console.log(`✓ Total exportés: ${stats.total}`);
  console.log(`✓ Score moyen: ${stats.avg_score}/100`);
  console.log(`✓ Avec SIREN: ${stats.with_siren}`);
  console.log(`✓ Avec dirigeant: ${stats.with_dirigeant}`);
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
