import { chromium, Browser, Page } from 'playwright';
import { RawLead } from './types.js';
import { upsertLead, closeDb, type InsertLead } from './db.js';

const DELAY_BETWEEN_ACTIONS = 1000;
const SCROLL_PAUSE = 800;
const MAX_RESULTS_PER_QUERY = 20;

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function extractPostalCode(address: string): string {
  const match = address.match(/\b(\d{5})\b/);
  return match ? match[1] : '';
}

function extractCity(address: string): string {
  // Gérer les apostrophes et caractères spéciaux
  const match = address.match(/\d{5}\s+([A-Za-zÀ-ÿ\s\-'']+)/);
  if (match) {
    return match[1].trim().replace(/\s+/g, ' ');
  }
  return '';
}

// Calculer le meilleur moment d'appel basé sur les horaires
function computeBestCallTime(openingHours: string | undefined): string | undefined {
  if (!openingHours) return undefined;
  
  // Chercher les horaires d'ouverture typiques
  // Format attendu: "Lundi 9:00-12:00, 14:00-18:00"
  const timePattern = /(\d{1,2}):(\d{2})/g;
  const times: number[] = [];
  
  let match;
  while ((match = timePattern.exec(openingHours)) !== null) {
    times.push(parseInt(match[1], 10));
  }
  
  if (times.length === 0) return undefined;
  
  // Trouver l'heure d'ouverture la plus fréquente
  const openHour = Math.min(...times.filter(h => h >= 7 && h <= 12));
  
  if (openHour && openHour < 12) {
    // Suggérer 30 min après l'ouverture (le temps qu'ils s'installent)
    const suggestedHour = openHour + 1;
    return `${suggestedHour}h-${suggestedHour + 1}h`;
  }
  
  // Par défaut: milieu de matinée
  return '10h-11h';
}

// Extraire le nom depuis l'URL Google Maps
function extractNameFromUrl(url: string): string {
  const match = url.match(/\/maps\/place\/([^/@]+)/);
  if (match) {
    return decodeURIComponent(match[1].replace(/\+/g, ' '));
  }
  return '';
}

// Nettoyer le nom (retirer les descriptions marketing)
function cleanName(name: string): string {
  // Couper au premier séparateur type | ou -
  let cleaned = name.split(/\s*[|]\s*/)[0];
  
  // Si le nom est encore trop long, couper au premier tiret avec espaces
  if (cleaned.length > 50) {
    cleaned = cleaned.split(/\s+-\s+/)[0];
  }
  
  // Retirer les parenthèses et leur contenu
  cleaned = cleaned.replace(/\s*\([^)]*\)\s*/g, ' ');
  
  return cleaned.trim().replace(/\s+/g, ' ');
}

// Vérifier si le nom est valide
function isValidName(name: string): boolean {
  const invalid = ['résultat', 'sponsorisé', 'sponsored', 'annonce', 'publicité'];
  const lower = name.toLowerCase();
  return name.length > 2 && !invalid.some(i => lower.includes(i));
}

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

// Scraper avec extraction depuis le panneau latéral (plus rapide)
async function scrapeQuery(page: Page, query: string): Promise<RawLead[]> {
  const leads: RawLead[] = [];
  
  console.log(`  🔍 Recherche: "${query}"`);
  
  const searchUrl = `https://www.google.com/maps/search/${encodeURIComponent(query)}`;
  await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await sleep(2000);
  
  // Accepter cookies
  try {
    const acceptBtn = page.locator('button').filter({ hasText: /Tout accepter|Accept all/i }).first();
    if (await acceptBtn.isVisible({ timeout: 2000 })) {
      await acceptBtn.click();
      await sleep(1000);
    }
  } catch { /* ignore */ }
  
  // Attendre les résultats
  try {
    await page.waitForSelector('div[role="feed"]', { timeout: 10000 });
  } catch {
    console.log(`  ⚠ Pas de résultats`);
    return leads;
  }
  
  // Scroll pour charger plus
  const feed = page.locator('div[role="feed"]').first();
  for (let i = 0; i < 3; i++) {
    await feed.evaluate(el => el.scrollBy(0, 800));
    await sleep(SCROLL_PAUSE);
  }
  
  // Récupérer tous les éléments de la liste
  const items = page.locator('div[role="feed"] > div > div > a[href*="/maps/place/"]');
  const count = await items.count();
  console.log(`  📍 ${count} établissements trouvés`);
  
  for (let i = 0; i < Math.min(count, MAX_RESULTS_PER_QUERY); i++) {
    try {
      const item = items.nth(i);
      
      // Cliquer pour ouvrir le panneau latéral
      await item.click();
      await sleep(DELAY_BETWEEN_ACTIONS);
      
      // Attendre que le panneau se charge
      await page.waitForSelector('h1', { timeout: 5000 });
      await sleep(500);
      
      // Nom - plusieurs stratégies
      let name = '';
      
      // 1. Essayer depuis le H1 du panneau de détails (pas celui de la recherche)
      const h1Elements = await page.locator('h1').all();
      for (const h1 of h1Elements) {
        const text = await h1.textContent({ timeout: 1000 }).catch(() => '');
        // Ignorer "Résultats" ou textes trop courts
        if (text && text.length > 2 && !text.toLowerCase().includes('résultat')) {
          name = text.trim();
          break;
        }
      }
      
      // 2. Fallback: extraire depuis l'URL
      if (!name || name.toLowerCase().includes('résultat')) {
        name = extractNameFromUrl(page.url());
      }
      
      // 3. Fallback: aria-label du lien cliqué
      if (!name) {
        const ariaLabel = await item.getAttribute('aria-label').catch(() => '');
        if (ariaLabel) name = ariaLabel;
      }
      
      // Valider le nom
      if (!name || !isValidName(name)) {
        process.stdout.write(`\r  ⏭ Skip (nom invalide): ${i+1}/${count}   `);
        continue;
      }
      
      // Téléphone - chercher le bouton avec l'icône téléphone
      let phone = '';
      const allButtons = await page.locator('button[data-tooltip*="téléphone"], button[aria-label*="téléphone"], button[data-item-id*="phone"]').all();
      for (const btn of allButtons) {
        const label = await btn.getAttribute('aria-label') || await btn.getAttribute('data-item-id') || '';
        const match = label.match(/(\+?33[\s.-]?\d[\s.-]?\d{2}[\s.-]?\d{2}[\s.-]?\d{2}[\s.-]?\d{2}|0\d[\s.-]?\d{2}[\s.-]?\d{2}[\s.-]?\d{2}[\s.-]?\d{2})/);
        if (match) {
          phone = normalizePhone(match[1]);
          break;
        }
      }
      
      // Alternative: chercher dans le texte de la page
      if (!phone) {
        const allText = await page.locator('div[role="region"], div[class*="fontBodyMedium"]').allTextContents();
        for (const text of allText) {
          const match = text.match(/(0[1-9][\s.-]?\d{2}[\s.-]?\d{2}[\s.-]?\d{2}[\s.-]?\d{2})/);
          if (match) {
            phone = normalizePhone(match[1]);
            break;
          }
        }
      }
      
      // Skip si pas de téléphone
      if (!phone) {
        process.stdout.write(`\r  ⏭ Skip (pas de tel): ${i+1}/${count}`);
        continue;
      }
      
      // Adresse
      let address = '';
      const addressBtn = page.locator('button[data-item-id="address"]').first();
      if (await addressBtn.count() > 0) {
        address = await addressBtn.textContent({ timeout: 1000 }) || '';
      }
      
      // Website
      let website: string | undefined;
      const websiteLink = page.locator('a[data-item-id="authority"]').first();
      if (await websiteLink.count() > 0) {
        website = await websiteLink.getAttribute('href') || undefined;
      }
      
      // Rating
      let rating: number | undefined;
      const ratingSpan = page.locator('span[role="img"]').first();
      if (await ratingSpan.count() > 0) {
        const ariaLabel = await ratingSpan.getAttribute('aria-label') || '';
        const match = ariaLabel.match(/([\d,\.]+)/);
        if (match) rating = parseFloat(match[1].replace(',', '.'));
      }
      
      // Reviews
      let reviews_count: number | undefined;
      const reviewsText = await page.locator('button[jsaction*="review"]').first().textContent({ timeout: 1000 }).catch(() => '') || '';
      const reviewMatch = reviewsText.match(/\(?([\d\s]+)\)?/);
      if (reviewMatch) reviews_count = parseInt(reviewMatch[1].replace(/\s/g, ''));
      
      // Horaires d'ouverture
      let opening_hours: string | undefined;
      try {
        const hoursBtn = page.locator('button[data-item-id="oh"]').first();
        if (await hoursBtn.count() > 0) {
          const hoursText = await hoursBtn.textContent({ timeout: 1000 });
          if (hoursText) opening_hours = hoursText.trim();
        }
      } catch { /* ignore */ }
      
      // Réservation en ligne
      let has_booking = false;
      try {
        const bookingLinks = await page.locator('a[href*="book"], a[href*="reservation"], a[href*="rdv"], button:has-text("Réserver")').count();
        has_booking = bookingLinks > 0;
      } catch { /* ignore */ }
      
      const lead: RawLead & { niche: string } = {
        name: cleanName(name),
        phone,
        address: address.replace(/^[^a-zA-Z0-9]+/, '').trim(),
        city: extractCity(address) || query.split(' ').pop() || '',
        postal_code: extractPostalCode(address),
        website,
        maps_url: page.url(),
        rating,
        reviews_count,
        niche: query.split(' ')[0], // Premier mot = niche
        opening_hours,
        has_booking,
      };
      
      leads.push(lead);
      
      const hasWebsite = website ? '🌐' : '📞';
      process.stdout.write(`\r  ✓ ${leads.length}: ${cleanName(name).substring(0, 30).padEnd(30)} ${hasWebsite}   `);
      
    } catch (err) {
      // Continuer sur erreur
      continue;
    }
  }
  
  console.log('');
  return leads;
}

export interface ScrapeConfig {
  niches: string[];
  cities: string[];
  maxPerQuery?: number;
  saveToDb?: boolean;
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
  
  // Sauvegarder en DB si demandé
  if (config.saveToDb) {
    let inserted = 0;
    for (const lead of uniqueLeads) {
      const priority = lead.website ? 'medium' : 'high';
      const extendedLead = lead as RawLead & { niche?: string };
      const dbLead: InsertLead = {
        phone: lead.phone,
        name: lead.name,
        address: lead.address,
        city: lead.city,
        postal_code: lead.postal_code,
        website: lead.website,
        website_status: lead.website ? undefined : 'none',
        maps_url: lead.maps_url,
        rating: lead.rating,
        reviews_count: lead.reviews_count,
        niche: extendedLead.niche || null,
        source: 'gmb',
        priority,
        opening_hours: lead.opening_hours,
        has_booking: lead.has_booking,
        best_call_time: computeBestCallTime(lead.opening_hours),
      };
      const result = upsertLead(dbLead);
      if (result) inserted++;
    }
    console.log(`✓ Insérés en DB: ${inserted}`);
  }
  
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
