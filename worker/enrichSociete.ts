/**
 * Societe.com Scraper - Enrichissement gratuit des entreprises françaises
 * 
 * Récupère SIREN, dirigeant et forme juridique depuis societe.com
 */

import { chromium, Browser, Page } from 'playwright';
import { sleep } from './utils';

// ===== CONFIGURATION =====
const DEBUG = process.env.DEBUG === '1' || process.env.DEBUG === 'true';
const MIN_DELAY = 2000;  // Minimum entre requêtes (anti-bot)
const MAX_DELAY = 4000;  // Maximum entre requêtes
const REQUEST_TIMEOUT = 30000;  // Increased timeout

function debug(...args: unknown[]): void {
  if (DEBUG) console.log('[SOCIETE]', ...args);
}

// ===== TYPES =====
export interface SocieteResult {
  siren: string;
  legal_name: string;
  dirigeant?: string;
  forme_juridique?: string;
  url?: string;
}

interface SearchResult {
  name: string;
  url: string;
  siren?: string;
  city?: string;
}

// ===== BROWSER MANAGEMENT =====
let browser: Browser | null = null;
let browserPage: Page | null = null;

async function getBrowser(): Promise<Browser> {
  if (!browser) {
    browser = await chromium.launch({
      headless: true,
      args: [
        '--disable-blink-features=AutomationControlled',
        '--disable-dev-shm-usage',
        '--no-sandbox',
      ],
    });
  }
  return browser;
}

async function getPage(): Promise<Page> {
  if (!browserPage || browserPage.isClosed()) {
    const b = await getBrowser();
    const context = await b.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1920, height: 1080 },
      locale: 'fr-FR',
    });
    browserPage = await context.newPage();
    
    // First visit to accept cookies
    await browserPage.goto('https://www.societe.com/', { waitUntil: 'domcontentloaded' });
    await sleep(1500);
    
    // Try to accept/close RGPD popup (Didomi)
    const acceptButtons = [
      '#didomi-notice-agree-button',
      'button[aria-label="Accepter"]',
      '.didomi-continue-without-agreeing',
    ];
    
    for (const selector of acceptButtons) {
      try {
        const btn = await browserPage.$(selector);
        if (btn) {
          await btn.click();
          debug('Popup RGPD fermé');
          await sleep(1000);
          break;
        }
      } catch {
        // Ignore
      }
    }
  }
  return browserPage;
}

export async function closeBrowser(): Promise<void> {
  if (browserPage) {
    await browserPage.close().catch(() => {});
    browserPage = null;
  }
  if (browser) {
    await browser.close().catch(() => {});
    browser = null;
  }
}

// ===== UTILS =====
function randomDelay(): number {
  return MIN_DELAY + Math.random() * (MAX_DELAY - MIN_DELAY);
}

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Supprime les accents
    .replace(/[^a-z0-9\s]/g, '')      // Garde que alphanum
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Calcule la distance de Levenshtein entre deux chaînes
 */
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];
  
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }
  
  return matrix[b.length][a.length];
}

/**
 * Similarité avancée combinant plusieurs méthodes
 */
function similarity(a: string, b: string): number {
  const normA = normalizeName(a);
  const normB = normalizeName(b);
  
  if (normA === normB) return 1;
  if (!normA || !normB) return 0;
  
  // 1. Word overlap similarity
  const wordsA = normA.split(' ').filter(w => w.length > 2);
  const wordsB = normB.split(' ').filter(w => w.length > 2);
  
  let wordMatches = 0;
  const usedWordsB = new Set<number>();
  
  for (const wordA of wordsA) {
    let bestMatchIdx = -1;
    let bestMatchScore = 0;
    
    for (let i = 0; i < wordsB.length; i++) {
      if (usedWordsB.has(i)) continue;
      
      const wordB = wordsB[i];
      
      // Exact match
      if (wordA === wordB) {
        bestMatchIdx = i;
        bestMatchScore = 1;
        break;
      }
      
      // Prefix match (ex: "coiff" matches "coiffure")
      if (wordA.startsWith(wordB) || wordB.startsWith(wordA)) {
        const score = Math.min(wordA.length, wordB.length) / Math.max(wordA.length, wordB.length);
        if (score > bestMatchScore) {
          bestMatchScore = score;
          bestMatchIdx = i;
        }
      }
      
      // Levenshtein for typos (only for longer words)
      if (wordA.length >= 4 && wordB.length >= 4) {
        const maxLen = Math.max(wordA.length, wordB.length);
        const dist = levenshteinDistance(wordA, wordB);
        const score = 1 - (dist / maxLen);
        if (score > 0.7 && score > bestMatchScore) {
          bestMatchScore = score;
          bestMatchIdx = i;
        }
      }
    }
    
    if (bestMatchIdx >= 0) {
      wordMatches += bestMatchScore;
      usedWordsB.add(bestMatchIdx);
    }
  }
  
  const maxWords = Math.max(wordsA.length, wordsB.length);
  if (maxWords === 0) return 0;
  
  const wordScore = wordMatches / maxWords;
  
  // 2. Substring containment bonus
  let containmentBonus = 0;
  if (normA.includes(normB) || normB.includes(normA)) {
    const shorter = normA.length < normB.length ? normA : normB;
    const longer = normA.length >= normB.length ? normA : normB;
    containmentBonus = shorter.length / longer.length * 0.3;
  }
  
  // 3. First word match bonus (company name often starts with key word)
  let firstWordBonus = 0;
  if (wordsA.length > 0 && wordsB.length > 0) {
    if (wordsA[0] === wordsB[0]) {
      firstWordBonus = 0.2;
    } else if (wordsA[0].startsWith(wordsB[0]) || wordsB[0].startsWith(wordsA[0])) {
      firstWordBonus = 0.1;
    }
  }
  
  return Math.min(1, wordScore + containmentBonus + firstWordBonus);
}

function extractSirenFromUrl(url: string): string | undefined {
  // URL format: /societe/nom-entreprise-123456789.html
  const match = url.match(/-(\d{9})\.html/);
  return match ? match[1] : undefined;
}

function extractNameFromUrl(url: string): string {
  // URL format: /societe/nom-entreprise-123456789.html
  const match = url.match(/\/societe\/(.+)-\d{9}\.html/);
  if (match) {
    // Convert slug to readable name: "coiffure-allegre" -> "COIFFURE ALLEGRE"
    return match[1].replace(/-/g, ' ').toUpperCase();
  }
  return '';
}

function formatSiren(siren: string): string {
  // Format: 123 456 789
  return siren.replace(/(\d{3})(\d{3})(\d{3})/, '$1 $2 $3');
}

// ===== SEARCH =====
async function searchSociete(page: Page, name: string, city: string): Promise<SearchResult[]> {
  // Clean the query: remove special chars that break search
  const cleanName = name
    .replace(/['`']/g, ' ')  // Replace apostrophes with space
    .replace(/[^\w\s-àâäéèêëïîôùûüÿçœæ]/gi, '') // Remove other special chars (keep accents)
    .replace(/\s+/g, ' ')     // Normalize spaces
    .trim()
    .split(' ')
    .filter(w => w.length > 1) // Remove single letters (L, D, etc.)
    .join(' ');
  
  const query = `${cleanName} ${city}`.trim();
  const searchUrl = `https://www.societe.com/cgi-bin/search?q=${encodeURIComponent(query)}`;
  
  debug(`Recherche: ${query}`);
  debug(`URL: ${searchUrl}`);
  
  try {
    await page.goto(searchUrl, { 
      waitUntil: 'domcontentloaded',  // Faster than networkidle
      timeout: REQUEST_TIMEOUT 
    });
    
    // Wait for results to load (SPA - results loaded via JS)
    await page.waitForSelector('#serpResults ul[data-q], .ui-serp-empty', { timeout: 15000 }).catch(() => {});
    
    // Additional wait for dynamic content
    await sleep(2500);
    
    // Debug: check data-q attribute
    const dataQ = await page.$eval('#serpResults ul', el => el.getAttribute('data-q')).catch(() => null);
    debug(`data-q: ${dataQ}`);
    
    // If 404, return empty
    if (dataQ === '404') {
      debug('Recherche retourne 404');
      return [];
    }
    
    // Check for CAPTCHA
    const bodyClass = await page.evaluate(() => document.body.className);
    if (bodyClass.includes('captcha')) {
      console.warn('  ⚠️ CAPTCHA détecté - pause recommandée');
      return [];
    }
    
    // Check no results
    const noResult = await page.$('.ui-serp-empty');
    if (noResult) {
      debug('Aucun résultat');
      return [];
    }
    
    // Extract company results - get all unique company URLs
    const urls = await page.$$eval('#serpResults a[href*="/societe/"]', (links) => {
      const seen = new Set<string>();
      const results: string[] = [];
      
      for (const link of links) {
        let url = (link as HTMLAnchorElement).href.split('#')[0]; // Remove hash
        
        // Extract SIREN to check uniqueness
        const sirenMatch = url.match(/-(\d{9})\.html/);
        if (sirenMatch && !seen.has(sirenMatch[1])) {
          seen.add(sirenMatch[1]);
          results.push(url);
        }
        
        if (results.length >= 5) break;
      }
      
      return results;
    });
    
    // Build results with name from URL
    const results: SearchResult[] = urls.map(url => {
      const siren = extractSirenFromUrl(url);
      const name = extractNameFromUrl(url);
      return { name, url, city: '', siren };
    }).filter(r => r.siren && r.name);
    
    debug(`Trouvé ${results.length} entreprises uniques`);
    
    return results;
    
  } catch (error) {
    debug('Erreur recherche:', (error as Error).message);
    return [];
  }
}

// ===== EXTRACT COMPANY DATA =====
async function extractCompanyData(page: Page, url: string, siren: string, nameFromUrl: string): Promise<SocieteResult | null> {
  debug(`Extraction fiche: ${url}`);
  
  // We already have SIREN and name from URL - that's the minimum
  const result: SocieteResult = {
    siren: formatSiren(siren),
    legal_name: nameFromUrl,
    url,
  };
  
  try {
    await page.goto(url, { 
      waitUntil: 'domcontentloaded',
      timeout: REQUEST_TIMEOUT 
    });
    
    // Wait for main content
    await page.waitForSelector('h1, .identite, [data-view]', { timeout: 10000 }).catch(() => {});
    await sleep(1500);
    
    // Check for rate limit page
    const pageTitle = await page.title();
    if (pageTitle.includes('requêtes') || pageTitle.includes('erreur')) {
      debug('Rate limited - using URL data only');
      return result; // Return what we have from URL
    }
    
    // Extract legal name from page (more accurate than URL)
    const legal_name = await page.$eval(
      'h1',
      el => el.textContent?.trim() || ''
    ).catch(() => '');
    
    if (legal_name && !legal_name.includes('requêtes') && legal_name.length > 2) {
      result.legal_name = legal_name;
    }
    
    // Try to extract dirigeant - look for specific patterns
    // The dirigeants are often in a section with specific data attributes
    const dirigeantData = await page.evaluate(() => {
      // Method 1: Look for dirigeant cards/blocks
      const dirigeantBlocks = document.querySelectorAll('[data-view="dirigeants"] li, .dirigeant-card, .ui-dirigeant');
      for (const block of dirigeantBlocks) {
        const nameEl = block.querySelector('a, .name, strong');
        const name = nameEl?.textContent?.trim();
        if (name && name.length > 3) {
          return name;
        }
      }
      
      // Method 2: Look in dt/dd pairs
      const dtElements = document.querySelectorAll('dt');
      for (const dt of dtElements) {
        const label = dt.textContent?.toLowerCase() || '';
        if (label.includes('dirigeant') || label.includes('gérant') || label.includes('président')) {
          const dd = dt.nextElementSibling;
          const name = dd?.textContent?.trim();
          if (name && name.length > 3) {
            return name;
          }
        }
      }
      
      // Method 3: Look for links in dirigeant section
      const dirigeantSection = document.querySelector('#dirigeants, [data-view="dirigeants"]');
      if (dirigeantSection) {
        const link = dirigeantSection.querySelector('a[href*="/dirigeant/"]');
        if (link) {
          return link.textContent?.trim();
        }
      }
      
      return null;
    }).catch(() => null);
    
    if (dirigeantData) {
      result.dirigeant = dirigeantData;
      debug(`Dirigeant trouvé: ${dirigeantData}`);
    }
    
    // Extract forme juridique
    const forme = await page.evaluate(() => {
      const dtElements = document.querySelectorAll('dt');
      for (const dt of dtElements) {
        const label = dt.textContent?.toLowerCase() || '';
        if (label.includes('forme juridique') || label.includes('statut')) {
          const dd = dt.nextElementSibling;
          return dd?.textContent?.trim();
        }
      }
      return null;
    }).catch(() => null);
    
    if (forme) {
      result.forme_juridique = forme;
    }
    
    return result;
    
  } catch (error) {
    debug('Erreur extraction (using URL data):', (error as Error).message);
    return result; // Return what we have from URL
  }
}

// ===== MAIN SEARCH FUNCTION =====
/**
 * Recherche et extrait les données d'une entreprise sur societe.com
 * @param name Nom de l'entreprise (depuis Google Maps)
 * @param city Ville de l'entreprise
 * @returns Données enrichies ou null si non trouvé
 */
export async function searchAndExtract(name: string, city: string): Promise<SocieteResult | null> {
  const page = await getPage();
  
  // Anti-bot delay
  await sleep(randomDelay());
  
  // Search
  const results = await searchSociete(page, name, city);
  
  if (results.length === 0) {
    debug(`Aucun résultat pour "${name}" à ${city}`);
    return null;
  }
  
  // Find best match
  let bestMatch = results[0];
  let bestScore = 0;
  
  for (const result of results) {
    const score = similarity(name, result.name);
    
    // Bonus if city matches
    const cityBonus = result.city?.toLowerCase().includes(city.toLowerCase()) ? 0.15 : 0;
    const totalScore = score + cityBonus;
    
    debug(`  Match: "${result.name}" score=${score.toFixed(2)} total=${totalScore.toFixed(2)}`);
    
    if (totalScore > bestScore) {
      bestScore = totalScore;
      bestMatch = result;
    }
  }
  
  // Lower threshold - 0.15 is enough for partial matches
  if (bestScore < 0.15) {
    debug(`Pas de match suffisant (score: ${bestScore.toFixed(2)})`);
    return null;
  }
  
  debug(`Meilleur match: "${bestMatch.name}" (score: ${bestScore.toFixed(2)})`);
  
  // Small delay before fetching details
  await sleep(randomDelay() / 2);
  
  // Extract full data - pass SIREN and name from URL as fallback
  const data = await extractCompanyData(page, bestMatch.url, bestMatch.siren || '', bestMatch.name);
  
  return data;
}

// ===== BATCH ENRICHMENT =====
export interface EnrichmentStats {
  total: number;
  enriched: number;
  failed: number;
  skipped: number;
}

/**
 * Enrichit un batch de leads avec societe.com
 */
export async function enrichBatch(
  leads: Array<{ id: number; name: string; city: string }>,
  onProgress?: (current: number, total: number) => void,
  onResult?: (id: number, result: SocieteResult | null) => void
): Promise<EnrichmentStats> {
  const stats: EnrichmentStats = {
    total: leads.length,
    enriched: 0,
    failed: 0,
    skipped: 0,
  };
  
  for (let i = 0; i < leads.length; i++) {
    const lead = leads[i];
    
    if (onProgress) {
      onProgress(i + 1, leads.length);
    }
    
    try {
      const result = await searchAndExtract(lead.name, lead.city);
      
      if (result) {
        stats.enriched++;
      } else {
        stats.failed++;
      }
      
      if (onResult) {
        onResult(lead.id, result);
      }
      
    } catch (error) {
      console.error(`  ✗ Erreur pour ${lead.name}:`, (error as Error).message);
      stats.failed++;
      
      if (onResult) {
        onResult(lead.id, null);
      }
    }
  }
  
  return stats;
}

// ===== CLI TEST =====
if (import.meta.url === `file://${process.argv[1]}`) {
  const testName = process.argv[2] || 'Coiffure Marie';
  const testCity = process.argv[3] || 'Le Mans';
  
  console.log(`\n🔍 Test recherche: "${testName}" à ${testCity}\n`);
  
  searchAndExtract(testName, testCity)
    .then(result => {
      if (result) {
        console.log('✅ Résultat:');
        console.log(`   SIREN: ${result.siren}`);
        console.log(`   Nom légal: ${result.legal_name}`);
        console.log(`   Dirigeant: ${result.dirigeant || 'Non trouvé'}`);
        console.log(`   Forme: ${result.forme_juridique || 'Non trouvée'}`);
      } else {
        console.log('❌ Aucun résultat trouvé');
      }
    })
    .catch(err => console.error('Erreur:', err))
    .finally(() => closeBrowser());
}
