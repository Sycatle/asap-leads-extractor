/**
 * Legal Notice Enrichment - Navigation agent LLM
 *
 * Visite le site web du prospect, trouve la page "mentions légales",
 * extrait via Claude les informations structurées (RCS, capital, hébergeur,
 * email pro, dirigeant) et met à jour la fiche du lead.
 */

import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { type Browser, type Page } from 'playwright';
import { z } from 'zod';
import pLimit from 'p-limit';
import { and, desc, eq, isNotNull, isNull, sql } from 'drizzle-orm';
import { getDb } from '../db/client';
import { leads } from '../db/schema';
import { getTotalCostCents, recordUsage } from '../db/queries';
import { legalLogger as log } from './logger';
import { acquireBrowser, releaseBrowser } from './browserPool';
import { findLegalLink, fallbackPathCandidates, type AnchorLike } from './legalLinkFinder';
import 'dotenv/config';

const MODEL = process.env.LEGAL_AGENT_MODEL || 'claude-opus-4-7';
const MAX_PAGE_CHARS = 14_000;
const NAV_TIMEOUT = 25_000;
const CONCURRENT = Number(process.env.LEGAL_CONCURRENCY || 2);
const DEFAULT_BATCH_SIZE = 20;
// Budget mensuel (rolling 30j) en USD ; 0 = pas de limite
const BUDGET_USD = Number(process.env.LEGAL_BUDGET_USD || 0);

const LegalInfoSchema = z.object({
  legal_name: z.string().nullable().describe('Raison sociale exacte telle qu\'écrite sur la page'),
  siren: z.string().nullable().describe('SIREN (9 chiffres) sans espace ni tiret'),
  siret: z.string().nullable().describe('SIRET (14 chiffres) sans espace'),
  rcs: z.string().nullable().describe('Numéro RCS complet, ex: "RCS Paris B 123 456 789"'),
  capital: z.string().nullable().describe('Capital social tel qu\'écrit, ex: "10 000 €"'),
  dirigeant: z.string().nullable().describe('Nom du dirigeant / directeur de publication'),
  email: z.string().email().nullable().describe('Email pro de contact (legal/dirigeant), null si aucun'),
  hosting: z.string().nullable().describe('Nom de l\'hébergeur, ex: "OVH SAS", "AWS", "Vercel"'),
  notes: z.string().nullable().describe('Toute info légale pertinente non capturée ailleurs, sinon null'),
});

export type LegalInfo = z.infer<typeof LegalInfoSchema>;

interface LegalLeadRow {
  id: number;
  name: string;
  website: string;
}

async function getLeadsToEnrich(max: number): Promise<LegalLeadRow[]> {
  const rows = await getDb()
    .select({ id: leads.id, name: leads.name, website: leads.website })
    .from(leads)
    .where(and(
      isNull(leads.deletedAt),
      isNotNull(leads.website),
      sql`${leads.website} <> ''`,
      isNull(leads.legalExtractedAt),
    ))
    .orderBy(desc(leads.score), desc(leads.createdAt))
    .limit(max);
  return rows.filter((r): r is LegalLeadRow => r.website !== null);
}

async function markFailed(id: number, reason: string): Promise<void> {
  await getDb()
    .update(leads)
    .set({
      legalExtractedAt: sql`now()`,
      legalUrl: `error:${reason.slice(0, 200)}`,
    })
    .where(eq(leads.id, id));
}

async function saveLegalInfo(id: number, legalUrl: string, info: LegalInfo): Promise<void> {
  await getDb()
    .update(leads)
    .set({
      legalUrl,
      legalExtractedAt: sql`now()`,
      legalRcs: sql`COALESCE(${info.rcs}, ${leads.legalRcs})`,
      legalCapital: sql`COALESCE(${info.capital}, ${leads.legalCapital})`,
      legalEmail: sql`COALESCE(${info.email}, ${leads.legalEmail})`,
      legalHosting: sql`COALESCE(${info.hosting}, ${leads.legalHosting})`,
      siren: sql`COALESCE(${info.siren}, ${leads.siren})`,
      siret: sql`COALESCE(${info.siret}, ${leads.siret})`,
      legalName: sql`COALESCE(${info.legal_name}, ${leads.legalName})`,
      dirigeant: sql`COALESCE(${info.dirigeant}, ${leads.dirigeant})`,
    })
    .where(eq(leads.id, id));
}

async function collectAnchors(page: Page): Promise<AnchorLike[]> {
  return page.evaluate(() => {
    const out: { text: string; href: string }[] = [];
    document.querySelectorAll<HTMLAnchorElement>('a[href]').forEach((a) => {
      out.push({ text: (a.textContent || '').trim(), href: a.href });
    });
    return out;
  });
}

async function navigateToLegalPage(page: Page, homepage: string): Promise<string | null> {
  await page.goto(homepage, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT });
  // Allow some JS-rendered footers to mount
  await page.waitForTimeout(800);

  const anchors = await collectAnchors(page);
  const found = findLegalLink(anchors);
  if (found) return found;

  // Fallback: try standard slugs
  for (const candidate of fallbackPathCandidates(page.url())) {
    try {
      const resp = await page.goto(candidate, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT });
      if (resp && resp.ok()) return candidate;
    } catch {
      /* try next */
    }
  }
  return null;
}

async function extractPageText(page: Page): Promise<string> {
  const text = await page.evaluate(() => document.body?.innerText || '');
  return text.slice(0, MAX_PAGE_CHARS).trim();
}

async function extractLegalInfo(
  client: Anthropic,
  businessName: string,
  pageText: string,
  leadId: number,
): Promise<LegalInfo> {
  let response;
  try {
    response = await client.messages.parse({
      model: MODEL,
      max_tokens: 1024,
      system: [
        {
          type: 'text',
          text:
            'Tu extrais des informations légales structurées depuis une page "mentions légales" française. ' +
            'Réponds uniquement avec les valeurs trouvées dans le texte fourni. ' +
            'Si une info est absente ou incertaine, mets null.',
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [
        {
          role: 'user',
          content: `Entreprise: ${businessName}\n\nContenu de la page mentions-légales:\n\n${pageText}`,
        },
      ],
      output_config: {
        format: zodOutputFormat(LegalInfoSchema),
      },
    });
  } catch (err) {
    await recordUsage(getDb(), {
      model: MODEL,
      feature: 'legal',
      lead_id: leadId,
      input_tokens: 0,
      output_tokens: 0,
      success: false,
      error_message: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }

  await recordUsage(getDb(), {
    model: MODEL,
    feature: 'legal',
    lead_id: leadId,
    input_tokens: response.usage.input_tokens,
    output_tokens: response.usage.output_tokens,
    cache_read_input_tokens: response.usage.cache_read_input_tokens ?? 0,
    cache_creation_input_tokens: response.usage.cache_creation_input_tokens ?? 0,
  });

  if (!response.parsed_output) {
    throw new Error('LLM extraction returned no parsed output');
  }
  return response.parsed_output;
}

async function processLead(browser: Browser, client: Anthropic, lead: LegalLeadRow): Promise<void> {
  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1366, height: 800 },
    locale: 'fr-FR',
  });
  const page = await context.newPage();

  try {
    const homepage = lead.website.startsWith('http') ? lead.website : `https://${lead.website}`;
    const legalUrl = await navigateToLegalPage(page, homepage);

    if (!legalUrl) {
      log.warn(`[#${lead.id}] ${lead.name}: page mentions-légales introuvable`);
      await markFailed(lead.id, 'legal_page_not_found');
      return;
    }

    const pageText = await extractPageText(page);
    if (pageText.length < 80) {
      log.warn(`[#${lead.id}] ${lead.name}: contenu mentions-légales vide`);
      await markFailed(lead.id, 'empty_legal_page');
      return;
    }

    const info = await extractLegalInfo(client, lead.name, pageText, lead.id);
    await saveLegalInfo(lead.id, legalUrl, info);
    log.success(
      `[#${lead.id}] ${lead.name}: extracted (siren=${info.siren ?? '-'}, host=${info.hosting ?? '-'}, email=${
        info.email ?? '-'
      })`,
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.error(`[#${lead.id}] ${lead.name}: ${msg}`);
    await markFailed(lead.id, msg);
  } finally {
    await context.close();
  }
}

export async function enrichLegalNotices(maxLeads = DEFAULT_BATCH_SIZE): Promise<{ processed: number }> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY manquante dans .env');
  }

  // Budget guard : refuse si le coût mensuel atteint déjà la limite
  if (BUDGET_USD > 0) {
    const spentCents = await getTotalCostCents(getDb(), 30);
    if (spentCents >= BUDGET_USD * 100) {
      log.warn(
        `Budget LLM 30j atteint : $${(spentCents / 100).toFixed(2)} >= $${BUDGET_USD.toFixed(2)}. Pipeline arrêtée.`,
      );
      return { processed: 0 };
    }
  }

  const leads = await getLeadsToEnrich(maxLeads);
  if (leads.length === 0) {
    log.info('Aucun lead à enrichir (tous traités ou pas de website)');
    return { processed: 0 };
  }

  log.info(
    `Enrichissement légal: ${leads.length} lead(s) (concurrent=${CONCURRENT}, modèle=${MODEL}${
      BUDGET_USD > 0 ? `, budget $${BUDGET_USD}/30j` : ''
    })`,
  );

  const client = new Anthropic();
  const browser = await acquireBrowser();

  const limit = pLimit(CONCURRENT);
  try {
    await Promise.all(leads.map((lead) => limit(() => processLead(browser, client, lead))));
  } finally {
    await releaseBrowser();
  }

  const [dayCents, monthCents] = await Promise.all([getTotalCostCents(getDb(), 1), getTotalCostCents(getDb(), 30)]);
  log.info(
    `Coût LLM : aujourd'hui $${(dayCents / 100).toFixed(2)} | 30j $${(monthCents / 100).toFixed(2)}`,
  );

  return { processed: leads.length };
}
