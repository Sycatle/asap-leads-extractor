#!/usr/bin/env tsx
/**
 * Migration Script - Normalisation des villes et niches
 * 
 * Normalise les données existantes en base:
 * - Villes: "- PARIS" → "Paris", arrondissements → ville principale
 * - Niches: fragments → valeurs complètes depuis config.json
 * 
 * Usage:
 *   pnpm tsx worker/migrateNormalize.ts [--dry-run] [--verbose]
 */

import { getDb, closeDb } from './db';
import { loadConfig } from './config';
import { normalizeCity } from './utils';

// ===== CONFIGURATION =====

const NICHE_MAPPING: Record<string, string | null> = {
  // Fragments → valeurs complètes
  'expert': 'expert comptable',
  'entreprise': 'expert comptable',
  'cabinet': 'expert comptable',
  'comptable': 'expert comptable',
  'extension': 'extension maison',
  'rénovation': 'rénovation intérieure',
  'pompe': 'pompe à chaleur',
  'architecte': 'architecte intérieur',
  'diagnostiqueur': 'diagnostiqueur immobilier',
  'démoussage': 'couvreur',
  'nettoyage': 'couvreur',
  'devis': null, // Ignorer, pas une vraie niche
};

// ===== HELPERS =====

function normalizeNiche(niche: string | null, validNiches: string[]): string | null {
  if (!niche) return null;
  
  const lower = niche.toLowerCase().trim();
  
  // Vérifier si c'est déjà une niche valide
  const exactMatch = validNiches.find(n => n.toLowerCase() === lower);
  if (exactMatch) return exactMatch;
  
  // Vérifier le mapping
  if (NICHE_MAPPING[lower] !== undefined) {
    return NICHE_MAPPING[lower];
  }
  
  // Vérifier si c'est un fragment d'une niche valide
  for (const validNiche of validNiches) {
    if (validNiche.toLowerCase().includes(lower) || lower.includes(validNiche.toLowerCase())) {
      return validNiche;
    }
  }
  
  // Garder tel quel si pas de correspondance
  return niche;
}

interface MigrationStats {
  total: number;
  citiesUpdated: number;
  nichesUpdated: number;
  skipped: number;
  errors: number;
}

// ===== MAIN MIGRATION =====

async function runMigration(options: { dryRun: boolean; verbose: boolean }): Promise<MigrationStats> {
  const { dryRun, verbose } = options;
  const config = loadConfig();
  const validNiches = config.scrape?.niches || [];
  
  const db = getDb();
  
  const stats: MigrationStats = {
    total: 0,
    citiesUpdated: 0,
    nichesUpdated: 0,
    skipped: 0,
    errors: 0,
  };
  
  console.log('\n' + '═'.repeat(60));
  console.log('  MIGRATION: Normalisation des villes et niches');
  console.log('═'.repeat(60));
  console.log(`  Mode: ${dryRun ? '🔍 DRY RUN (aucune modification)' : '⚡ LIVE'}`);
  console.log(`  Niches valides: ${validNiches.join(', ')}`);
  console.log('─'.repeat(60) + '\n');
  
  // Récupérer tous les leads
  const leads = db.prepare('SELECT id, city, niche FROM leads').all() as Array<{
    id: number;
    city: string | null;
    niche: string | null;
  }>;
  
  stats.total = leads.length;
  console.log(`📊 ${leads.length} leads à traiter\n`);
  
  // Préparer les statements
  const updateCity = db.prepare('UPDATE leads SET city = ? WHERE id = ?');
  const updateNiche = db.prepare('UPDATE leads SET niche = ? WHERE id = ?');
  const updateBoth = db.prepare('UPDATE leads SET city = ?, niche = ? WHERE id = ?');
  
  // Transaction pour performance
  const transaction = db.transaction(() => {
    for (const lead of leads) {
      try {
        const newCity = lead.city ? normalizeCity(lead.city) : null;
        const newNiche = normalizeNiche(lead.niche, validNiches);
        
        const cityChanged = newCity !== lead.city;
        const nicheChanged = newNiche !== lead.niche;
        
        if (!cityChanged && !nicheChanged) {
          stats.skipped++;
          continue;
        }
        
        if (verbose) {
          if (cityChanged) {
            console.log(`  [${lead.id}] Ville: "${lead.city}" → "${newCity}"`);
          }
          if (nicheChanged) {
            console.log(`  [${lead.id}] Niche: "${lead.niche}" → "${newNiche}"`);
          }
        }
        
        if (!dryRun) {
          if (cityChanged && nicheChanged) {
            updateBoth.run(newCity, newNiche, lead.id);
          } else if (cityChanged) {
            updateCity.run(newCity, lead.id);
          } else {
            updateNiche.run(newNiche, lead.id);
          }
        }
        
        if (cityChanged) stats.citiesUpdated++;
        if (nicheChanged) stats.nichesUpdated++;
        
      } catch (error) {
        stats.errors++;
        console.error(`  ❌ Erreur lead ${lead.id}:`, (error as Error).message);
      }
    }
  });
  
  transaction();
  
  // Résumé
  console.log('\n' + '─'.repeat(60));
  console.log('  RÉSULTAT');
  console.log('─'.repeat(60));
  console.log(`  Total traités:    ${stats.total}`);
  console.log(`  Villes modifiées: ${stats.citiesUpdated}`);
  console.log(`  Niches modifiées: ${stats.nichesUpdated}`);
  console.log(`  Inchangés:        ${stats.skipped}`);
  console.log(`  Erreurs:          ${stats.errors}`);
  console.log('═'.repeat(60) + '\n');
  
  if (dryRun && (stats.citiesUpdated > 0 || stats.nichesUpdated > 0)) {
    console.log('💡 Pour appliquer les changements, relancez sans --dry-run\n');
  }
  
  return stats;
}

// ===== ANALYSE PRÉ-MIGRATION =====

function analyzeData(): void {
  const db = getDb();
  
  console.log('\n' + '═'.repeat(60));
  console.log('  ANALYSE DES DONNÉES ACTUELLES');
  console.log('═'.repeat(60) + '\n');
  
  // Top villes actuelles
  const cities = db.prepare(`
    SELECT city, COUNT(*) as count 
    FROM leads 
    WHERE city IS NOT NULL AND city != ''
    GROUP BY city 
    ORDER BY count DESC 
    LIMIT 20
  `).all() as Array<{ city: string; count: number }>;
  
  console.log('🏙️  Top 20 villes:');
  for (const { city, count } of cities) {
    const normalized = normalizeCity(city);
    const changed = normalized !== city ? ` → "${normalized}"` : '';
    console.log(`    ${count.toString().padStart(4)} │ ${city}${changed}`);
  }
  
  // Top niches actuelles
  console.log('\n🏷️  Niches:');
  const niches = db.prepare(`
    SELECT niche, COUNT(*) as count 
    FROM leads 
    WHERE niche IS NOT NULL AND niche != ''
    GROUP BY niche 
    ORDER BY count DESC
  `).all() as Array<{ niche: string; count: number }>;
  
  const config = loadConfig();
  const validNiches = config.scrape?.niches || [];
  
  for (const { niche, count } of niches) {
    const normalized = normalizeNiche(niche, validNiches);
    const status = normalized === niche ? '✓' : normalized ? `→ "${normalized}"` : '✗ (supprimé)';
    console.log(`    ${count.toString().padStart(4)} │ ${niche.padEnd(25)} ${status}`);
  }
  
  console.log('\n' + '═'.repeat(60) + '\n');
}

// ===== CLI =====

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const verbose = args.includes('--verbose') || args.includes('-v');
const analyze = args.includes('--analyze');

if (args.includes('--help') || args.includes('-h')) {
  console.log(`
Usage: pnpm tsx worker/migrateNormalize.ts [options]

Options:
  --dry-run     Afficher les changements sans les appliquer
  --verbose     Afficher chaque modification
  --analyze     Analyser les données actuelles sans modifier
  --help        Afficher cette aide

Exemples:
  pnpm tsx worker/migrateNormalize.ts --analyze
  pnpm tsx worker/migrateNormalize.ts --dry-run
  pnpm tsx worker/migrateNormalize.ts --verbose
`);
  process.exit(0);
}

if (analyze) {
  analyzeData();
  closeDb();
  process.exit(0);
}

runMigration({ dryRun, verbose })
  .then((stats) => {
    closeDb();
    process.exit(stats.errors > 0 ? 1 : 0);
  })
  .catch((err) => {
    console.error('❌ Erreur fatale:', err);
    closeDb();
    process.exit(1);
  });
