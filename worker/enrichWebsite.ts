/**
 * Website Analysis Enrichment
 * 
 * Enriches leads with website technology analysis:
 * - CMS detection (WordPress, Wix, Shopify, etc.)
 * - Quality indicators (mobile-friendly, SSL, performance)
 * - Pain points for sales conversations
 */

import pLimit from 'p-limit';
import { getDb, enrichLeadWebsiteAnalysis } from './db.js';
import type { DbLead } from '../shared/types.js';
import { analyzeWebsite, generateNoWebsitePainPoints, generatePlatformPainPoints } from './websiteAnalyzer.js';
import 'dotenv/config';

// Configuration constants
const CONCURRENT_ANALYSES = 2; // Max number of simultaneous website analyses
const MAX_LEADS_PER_RUN = 50;  // Total leads to analyze per run
const WEBSITE_ANALYSIS_RATIO = 0.7; // 70% leads with websites, 30% without

// Rate limit: 2 analyses simultanées max (Playwright peut être gourmand)
const limit = pLimit(CONCURRENT_ANALYSES);

/**
 * Récupérer les leads à analyser
 * - Leads avec un site web mais pas encore analysé (cms_type = null)
 * - Leads sans site web pour générer pain points
 * - Priorité aux leads high/medium
 */
function getLeadsToAnalyze(maxLeads: number = MAX_LEADS_PER_RUN): DbLead[] {
  const database = getDb();
  
  // Calculate allocation
  const withWebsiteCount = Math.floor(maxLeads * WEBSITE_ANALYSIS_RATIO);
  const withoutWebsiteCount = Math.floor(maxLeads * (1 - WEBSITE_ANALYSIS_RATIO));
  
  // Leads avec website mais pas encore analysés
  const withWebsiteStmt = database.prepare(`
    SELECT * FROM leads 
    WHERE website IS NOT NULL 
    AND website != ''
    AND cms_type IS NULL
    AND opt_out = 0
    ORDER BY 
      CASE priority 
        WHEN 'high' THEN 1 
        WHEN 'medium' THEN 2 
        ELSE 3 
      END,
      score DESC
    LIMIT ?
  `);
  
  // Leads sans website mais pas de pain_points générés
  const withoutWebsiteStmt = database.prepare(`
    SELECT * FROM leads 
    WHERE (website IS NULL OR website = '')
    AND pain_points IS NULL
    AND opt_out = 0
    ORDER BY 
      CASE priority 
        WHEN 'high' THEN 1 
        WHEN 'medium' THEN 2 
        ELSE 3 
      END,
      score DESC
    LIMIT ?
  `);
  
  const withWebsite = withWebsiteStmt.all(withWebsiteCount) as DbLead[];
  const withoutWebsite = withoutWebsiteStmt.all(withoutWebsiteCount) as DbLead[];
  
  return [...withWebsite, ...withoutWebsite];
}

/**
 * Main enrichment function
 */
export async function enrichWebsiteAnalysis(): Promise<void> {
  const leadsToAnalyze = getLeadsToAnalyze(MAX_LEADS_PER_RUN);
  
  if (leadsToAnalyze.length === 0) {
    console.log('✓ Aucun lead à analyser (déjà tous enrichis)');
    return;
  }

  let analyzedCount = 0;
  let errorCount = 0;
  let current = 0;

  console.log(`\n🔍 Analyse de ${leadsToAnalyze.length} sites web...`);

  const tasks = leadsToAnalyze.map(lead => limit(async () => {
    current++;
    process.stdout.write(`\r🔍 Analyse: ${current}/${leadsToAnalyze.length} (✓ ${analyzedCount} | ✗ ${errorCount})`);

    try {
      // Cas 1: Pas de site web - générer pain points génériques
      if (!lead.website || lead.website === '') {
        const painPoints = generateNoWebsitePainPoints(lead.niche);
        
        const updated = enrichLeadWebsiteAnalysis(lead.id, {
          cms_type: 'unknown',
          pain_points: painPoints,
        });
        
        if (updated) {
          analyzedCount++;
        }
        return;
      }
      
      // Cas 2: Site plateforme (Planity, FB, etc.) - pain points spécifiques
      if (lead.website_status === 'platform') {
        const painPoints = generatePlatformPainPoints(lead.website, lead.niche);
        
        const updated = enrichLeadWebsiteAnalysis(lead.id, {
          cms_type: 'unknown',
          pain_points: painPoints,
        });
        
        if (updated) {
          analyzedCount++;
        }
        return;
      }
      
      // Cas 3: Analyser le site web réel avec timeout robuste
      const analysis = await analyzeWebsite(lead.website, 15000);
      
      if (analysis) {
        const updated = enrichLeadWebsiteAnalysis(lead.id, {
          cms_type: analysis.cms_type,
          has_mobile_friendly: analysis.has_mobile_friendly,
          has_ssl: analysis.has_ssl,
          page_load_time: analysis.page_load_time,
          pain_points: analysis.pain_points,
        });
        
        if (updated) {
          analyzedCount++;
        }
      } else {
        // Analysis failed but didn't throw - count as error
        errorCount++;
        console.error(`\n  ✗ Analyse échouée pour lead ${lead.id} (${lead.website})`);
      }
    } catch (error) {
      errorCount++;
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`\n  ✗ Erreur lead ${lead.id} (${lead.website}): ${errorMessage}`);
      
      // Log stack trace in debug mode
      if (process.env.DEBUG) {
        console.error(error);
      }
    }
  }));

  await Promise.all(tasks);

  console.log(`\n✓ Analysés: ${analyzedCount}/${leadsToAnalyze.length} (${errorCount} erreurs)`);
  console.log(`\n💡 Conseils:`);
  console.log(`  - Les pain points sont maintenant visibles sur la page de call`);
  console.log(`  - Utilisez ces informations pour personnaliser votre approche`);
  console.log(`  - Ré-exécutez cette commande pour analyser plus de leads\n`);
}

// Run standalone
const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  enrichWebsiteAnalysis()
    .then(() => {
      console.log('✓ Enrichissement terminé');
      process.exit(0);
    })
    .catch((err) => {
      console.error('❌ Erreur:', err);
      process.exit(1);
    });
}
