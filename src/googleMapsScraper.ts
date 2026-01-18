import { chromium, Browser, Page } from 'playwright';
import { RawLead } from './types.js';

const DELAY_BETWEEN_ACTIONS = 1500; // 1.5s entre chaque action
const SCROLL_PAUSE = 1000;
const MAX_RESULTS_PER_QUERY = 20; // Limiter pour aller plus vite

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Extraire le code postal depuis l'adresse
function extractPostalCode(address: string): string {
  const match = address.match(/\b(\d{5})\b/);
  return match ? match[1] : '';
}

// Extraire la ville depuis l'adresse
function extractCity(address: string): string {
  const match = address.match(/\d{5}\s+([A-Za-zÀ-ÿ\s-]+)/);
  return match ? match[1].trim() : '';
}

// Normaliser le téléphone FR
function normalizePhone(raw: string): string {
  const cleaned = raw.replace(/[\s.\-()]/g, '');
  if (cleaned.startsWith('+33')) {
    return '0' + cleaned.slice(3);
  }
  if (/^0[1-9]\d{8}$/.test(cleaned)) {
    return cleaned;
  }
  return '';
}

// Scraper une seule recherche Google Maps
async function scrapeQuery(page: Page, query: string): Promise<RawLead[]> {
  const leads: RawLead[] = [];
  
  console.log(`  🔍 Recherche: "${query}"`);
  
  // Naviguer vers Google Maps
  const searchUrl = `https://www.google.com/maps/search/${encodeURIComponent(query)}`;
  await page.goto(searchUrl, { waitUntil: 'domcontentloaded' });
  await sleep(3000);
  
  // Accepter les cookies si popup
  try {
    const acceptButton = page.locator('button').filter({ hasText: /Tout accepter|Accept all/i }).first();
    if (await acceptButton.isVisible({ timeout: 3000 })) {
      await acceptButton.click();
      await sleep(2000);
    }
  } catch {
    // Pas de popup cookies
  }
  
  // Attendre la liste des résultats (plusieurs sélecteurs possibles)
  const feedSelectors = [
    'div[role="feed"]',
    'div[aria-label*="Résultats"]',
    'div.m6QErb[aria-label]',
  ];
  
  let feedFound = false;
  for (const selector of feedSelectors) {
    try {
      await page.waitForSelector(selector, { timeout: 5000 });
      feedFound = true;
      break;
    } catch {
      continue;
    }
  }
  
  if (!feedFound) {
    console.log(`  ⚠ Aucun résultat pour "${query}"`);
    return leads;
  }
  
  // Trouver tous les liens d'établissements
  await sleep(2000);
  
  // Scroll pour charger les résultats
  const scrollContainer = page.locator('div[role="feed"], div.m6QErb').first();
  for (let i = 0; i < 5; i++) {
    await scrollContainer.evaluate(el => el.scrollBy(0, 1000));
    await sleep(SCROLL_PAUSE);
  }
  
  // Collecter tous les liens vers les établissements
  const placeLinks = await page.locator('a[href*="/maps/place/"]').all();
  console.log(`  📍 ${placeLinks.length} établissements trouvés`);
  
  const visitedUrls = new Set<string>();
  
  for (let i = 0; i < Math.min(placeLinks.length, MAX_RESULTS_PER_QUERY); i++) {
    try {
      const href = await placeLinks[i].getAttribute('href');
      if (!href || visitedUrls.has(href)) continue;
      visitedUrls.add(href);
      
      // Naviguer vers la page de l'établissement
      await page.goto(href, { waitUntil: 'domcontentloaded' });
      await sleep(DELAY_BETWEEN_ACTIONS);
      
      // Extraire le nom
      const nameEl = page.locator('h1').first();
      const name = await nameEl.textContent({ timeout: 3000 }).catch(() => null);
      if (!name) continue;
      
      // Extraire le téléphone
      let phone = '';
      const phoneButton = page.locator('button[data-item-id*="phone"]').first();
      if (await phoneButton.count() > 0) {
        const ariaLabel = await phoneButton.getAttribute('aria-label') || '';
        const phoneMatch = ariaLabel.match(/(\+?[\d\s.()-]+)/);
        if (phoneMatch) {
          phone = normalizePhone(phoneMatch[1]);
        }
      }
      
      // Alternative: chercher dans le texte
      if (!phone) {
        const pageText = await page.locator('body').textContent() || '';
        const phoneMatch = pageText.match(/(?:0|\+33)[1-9](?:[\s.-]*\d{2}){4}/);
        if (phoneMatch) {
          phone = normalizePhone(phoneMatch[0]);
        }
      }
      
      // Skip si pas de téléphone
      if (!phone) {
        continue;
      }
      
      // Extraire l'adresse
      let address = '';
      const addressButton = page.locator('button[data-item-id="address"]').first();
      if (await addressButton.count() > 0) {
        address = await addressButton.textContent() || '';
      }
      
      // Extraire le website
      let website: string | undefined;
      const websiteLink = page.locator('a[data-item-id="authority"]').first();
      if (await websiteLink.count() > 0) {
        website = await websiteLink.getAttribute('href') || undefined;
      }
      
      // Extraire le rating
      let rating: number | undefined;
      const ratingText = await page.locator('div[role="img"][aria-label*="étoile"]').first().getAttribute('aria-label').catch(() => null);
      if (ratingText) {
        const match = ratingText.match(/([\d,]+)/);
        if (match) {
          rating = parseFloat(match[1].replace(',', '.'));
        }
      }
      
      // Extraire le nombre d'avis
      let reviews_count: number | undefined;
      const reviewsText = await page.locator('button[jsaction*="review"]').first().textContent().catch(() => null);
      if (reviewsText) {
        const match = reviewsText.match(/([\d\s]+)/);
        if (match) {
          reviews_count = parseInt(match[1].replace(/\s/g, ''));
        }
      }
      
      leads.push({
        name: name.trim(),
        phone,
        address: address.trim(),
        city: extractCity(address),
        postal_code: extractPostalCode(address),
        website,
        maps_url: page.url(),
        rating,
        reviews_count,
      });
      
      process.stdout.write(`\r  ✓ Extrait: ${leads.length}`);
      
    } catch (error) {
      continue;
    }
  }
  
  console.log('');
  
  // Retourner à la page de recherche pour la prochaine query
  return leads;
}

export interface ScrapeConfig {
  niches: string[];
  cities: string[];
  maxPerQuery?: number;
}

export async function scrapeGoogleMaps(config: ScrapeConfig): Promise<RawLead[]> {
  const allLeads: RawLead[] = [];
  
  console.log('🌐 Démarrage du scraper Google Maps\n');
  console.log(`  Niches: ${config.niches.join(', ')}`);
  console.log(`  Villes: ${config.cities.join(', ')}`);
  console.log(`  Requêtes totales: ${config.niches.length * config.cities.length}\n`);
  
  const browser: Browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  
  const context = await browser.newContext({
    locale: 'fr-FR',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  });
  
  const page = await context.newPage();
  
  try {
    for (const niche of config.niches) {
      for (const city of config.cities) {
        const query = `${niche} ${city}`;
        const leads = await scrapeQuery(page, query);
        allLeads.push(...leads);
        
        // Pause entre les recherches
        await sleep(DELAY_BETWEEN_ACTIONS * 2);
      }
    }
  } finally {
    await browser.close();
  }
  
  // Déduplication par téléphone
  const seen = new Set<string>();
  const uniqueLeads = allLeads.filter(lead => {
    if (seen.has(lead.phone)) return false;
    seen.add(lead.phone);
    return true;
  });
  
  console.log(`\n✓ Total brut: ${allLeads.length}`);
  console.log(`✓ Après dédup: ${uniqueLeads.length}`);
  
  return uniqueLeads;
}

// Test standalone
const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  scrapeGoogleMaps({
    niches: ['coiffeur'],
    cities: ['Le Mans'],
  }).then(leads => {
    console.log(`\nTest terminé: ${leads.length} leads`);
  }).catch(console.error);
}
