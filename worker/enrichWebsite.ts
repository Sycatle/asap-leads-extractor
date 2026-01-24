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
import { websiteLogger as log, ProgressBar } from './logger.js';
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
export async function enrichWebsiteAnalysis(): Promise<{ analyzed: number; errors: number }> {
  const leadsToAnalyze = getLeadsToAnalyze(MAX_LEADS_PER_RUN);
  
  if (leadsToAnalyze.length === 0) {
    log.success('Aucun lead à analyser (déjà tous enrichis)');
    return { analyzed: 0, errors: 0 };
  }

  let analyzedCount = 0;
  let errorCount = 0;
  let current = 0;

  log.header('ANALYSE SITES WEB');
  log.kv('Leads à traiter', leadsToAnalyze.length);
  log.blank();
  
  const progress = new ProgressBar({ total: leadsToAnalyze.length, label: 'Analyse', logger: log });

  const tasks = leadsToAnalyze.map(lead => limit(async () => {
    current++;
    progress.update(current, `✓ ${analyzedCount} | ✗ ${errorCount}`);

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
        log.debug(`Analyse échouée pour lead ${lead.id} (${lead.website})`);
      }
    } catch (error) {
      errorCount++;
      const errorMessage = error instanceof Error ? error.message : String(error);
      log.debug(`Erreur lead ${lead.id}: ${errorMessage}`);
    }
  }));

  await Promise.all(tasks);

  progress.complete();
  log.blank();
  log.section('RÉSULTAT ANALYSE');
  log.kv('Analysés', `${analyzedCount}/${leadsToAnalyze.length}`);
  log.kv('Erreurs', errorCount);
  log.kv('Taux succès', `${Math.round((analyzedCount / leadsToAnalyze.length) * 100)}%`);
  
  return { analyzed: analyzedCount, errors: errorCount };
}

// Run standalone
const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  enrichWebsiteAnalysis()
    .then((stats) => {
      log.success(`Terminé: ${stats.analyzed} analysés`);
      process.exit(0);
    })
    .catch((err) => {
      log.error(`Erreur: ${(err as Error).message}`);
      process.exit(1);
    });
}
