/**
 * Website Analysis Enrichment
 * 
 * Enriches leads with website technology analysis:
 * - CMS detection (WordPress, Wix, Shopify, etc.)
 * - Quality indicators (mobile-friendly, SSL, performance)
 * - Pain points for sales conversations
 */

import pLimit from 'p-limit';
import { and, asc, eq, isNotNull, isNull, sql } from 'drizzle-orm';
import { getDb } from '../db/client';
import { leads, type Lead } from '../db/schema';

type CMSType = NonNullable<Lead['cmsType']>;
import { analyzeWebsite, generateNoWebsitePainPoints, generatePlatformPainPoints } from './websiteAnalyzer';
import { websiteLogger as log } from './logger';
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
async function getLeadsToAnalyze(maxLeads: number = MAX_LEADS_PER_RUN): Promise<Lead[]> {
  const db = getDb();
  const withWebsiteCount = Math.floor(maxLeads * WEBSITE_ANALYSIS_RATIO);
  const withoutWebsiteCount = Math.floor(maxLeads * (1 - WEBSITE_ANALYSIS_RATIO));

  // Postgres CASE priority sort
  const priorityOrder = sql`CASE ${leads.priority} WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END`;

  const [withWebsite, withoutWebsite] = await Promise.all([
    db.select().from(leads)
      .where(and(
        isNotNull(leads.website),
        sql`${leads.website} <> ''`,
        isNull(leads.cmsType),
        eq(leads.optOut, false),
        isNull(leads.deletedAt),
      ))
      .orderBy(asc(priorityOrder), sql`${leads.score} DESC`)
      .limit(withWebsiteCount),
    db.select().from(leads)
      .where(and(
        sql`(${leads.website} IS NULL OR ${leads.website} = '')`,
        isNull(leads.painPoints),
        eq(leads.optOut, false),
        isNull(leads.deletedAt),
      ))
      .orderBy(asc(priorityOrder), sql`${leads.score} DESC`)
      .limit(withoutWebsiteCount),
  ]);

  return [...withWebsite, ...withoutWebsite];
}

/**
 * Update a lead with website analysis output. Returns true if a row was changed.
 */
async function enrichLeadWebsiteAnalysis(
  leadId: number,
  data: {
    cms_type?: string | null;
    has_mobile_friendly?: boolean;
    has_ssl?: boolean;
    page_load_time?: number;
    pain_points?: string[];
  },
): Promise<boolean> {
  if (!leadId || leadId <= 0) {
    log.error(`enrichLeadWebsiteAnalysis: ID invalide ${leadId}`);
    return false;
  }

  const patch: Record<string, unknown> = { updatedAt: sql`now()` };
  if (data.cms_type !== undefined) patch.cmsType = data.cms_type as CMSType | null;
  if (data.has_mobile_friendly !== undefined) patch.hasMobileFriendly = data.has_mobile_friendly;
  if (data.has_ssl !== undefined) patch.hasSsl = data.has_ssl;
  if (data.page_load_time !== undefined) patch.pageLoadTime = data.page_load_time;
  if (data.pain_points !== undefined) patch.painPoints = data.pain_points;

  const result = await getDb()
    .update(leads)
    .set(patch)
    .where(eq(leads.id, leadId))
    .returning({ id: leads.id });
  return result.length > 0;
}

/**
 * Main enrichment function
 */
export async function enrichWebsiteAnalysis(): Promise<{ analyzed: number; errors: number }> {
  const leadsToAnalyze = await getLeadsToAnalyze(MAX_LEADS_PER_RUN);

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

  const tasks = leadsToAnalyze.map((lead) => limit(async () => {
    current++;
    log.sub(`[${current}/${leadsToAnalyze.length}] ${lead.name}`);

    try {
      if (!lead.website || lead.website === '') {
        const painPoints = generateNoWebsitePainPoints(lead.niche);
        const updated = await enrichLeadWebsiteAnalysis(lead.id, { cms_type: 'unknown', pain_points: painPoints });
        if (updated) analyzedCount++;
        return;
      }

      if (lead.websiteStatus === 'platform') {
        const painPoints = generatePlatformPainPoints(lead.website, lead.niche);
        const updated = await enrichLeadWebsiteAnalysis(lead.id, { cms_type: 'unknown', pain_points: painPoints });
        if (updated) analyzedCount++;
        return;
      }

      const analysis = await analyzeWebsite(lead.website, 15000);
      if (analysis) {
        const updated = await enrichLeadWebsiteAnalysis(lead.id, {
          cms_type: analysis.cms_type,
          has_mobile_friendly: analysis.has_mobile_friendly,
          has_ssl: analysis.has_ssl,
          page_load_time: analysis.page_load_time,
          pain_points: analysis.pain_points,
        });
        if (updated) analyzedCount++;
      } else {
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
