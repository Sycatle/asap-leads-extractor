import { chromium, Browser, Page } from 'playwright';
import { RawLead } from '../shared/types.js';
import { upsertLead, closeDb, type InsertLead } from './db.js';

// ===== DEBUG MODE =====
const DEBUG = process.env.DEBUG === '1' || process.env.DEBUG === 'true';

function debug(...args: unknown[]): void {
  if (DEBUG) console.log('[DEBUG]', ...args);
}

function debugData(label: string, data: unknown): void {
  if (DEBUG) console.log(`[DEBUG] ${label}:`, JSON.stringify(data, null, 2));
}

const DELAY_BETWEEN_ACTIONS = 1000;
const SCROLL_PAUSE = 800;
const MAX_RESULTS_PER_QUERY = 30; // Augmenté pour récupérer plus de leads

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

// Nettoyer le nom (retirer uniquement les termes de recherche redondants)
function cleanName(name: string, niche?: string): string {
  let cleaned = name.trim();
  
  // Retirer la ville si elle est répétée à la fin (ex: "Coiffeur Angers" quand on cherche "coiffeur Angers")
  // Mais garder les distinctions type "| Lorette |" ou "- Centre"
  
  // Retirer uniquement les suffixes génériques redondants
  const genericSuffixes = [
    /\s*-\s*(?:Salon de )?(?:Coiffure|Coiffeur)\s*$/i,
    /\s*-\s*(?:Hair Salon|Hairdresser)\s*$/i,
  ];
  
  for (const pattern of genericSuffixes) {
    cleaned = cleaned.replace(pattern, '');
  }
  
  // Nettoyer les espaces multiples
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
  
  console.log(`\n  🔍 Recherche: "${query}"`);
  
  const searchUrl = `https://www.google.com/maps/search/${encodeURIComponent(query)}`;
  debug('URL:', searchUrl);
  
  await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await sleep(2000);
  
  debug('Page chargée, URL actuelle:', page.url());
  
  // Accepter cookies
  try {
    const acceptBtn = page.locator('button').filter({ hasText: /Tout accepter|Accept all/i }).first();
    if (await acceptBtn.isVisible({ timeout: 2000 })) {
      debug('Bouton cookies trouvé, clic...');
      await acceptBtn.click();
      await sleep(1000);
    }
  } catch { /* ignore */ }
  
  // Attendre les résultats
  try {
    await page.waitForSelector('div[role="feed"]', { timeout: 10000 });
    debug('Feed de résultats trouvé');
  } catch {
    console.log(`  ⚠ Pas de résultats pour "${query}"`);
    debug('Sélecteur div[role="feed"] non trouvé');
    
    // Debug: afficher les éléments présents
    if (DEBUG) {
      const html = await page.content();
      debug('Longueur HTML:', html.length);
      const title = await page.title();
      debug('Titre de la page:', title);
    }
    return leads;
  }
  
  // Scroll pour charger plus de résultats
  const feed = page.locator('div[role="feed"]').first();
  debug('Scroll pour charger plus de résultats...');
  let lastCount = 0;
  for (let i = 0; i < 8; i++) {
    await feed.evaluate(el => el.scrollBy(0, 1000));
    await sleep(SCROLL_PAUSE);
    
    // Vérifier si de nouveaux éléments sont apparus
    const currentCount = await page.locator('div[role="feed"] > div > div > a[href*="/maps/place/"]').count();
    debug(`Scroll ${i+1}: ${currentCount} items`);
    
    // Arrêter si on a atteint la limite ou plus de nouveaux résultats
    if (currentCount >= MAX_RESULTS_PER_QUERY || currentCount === lastCount) {
      debug('Fin du scroll (limite atteinte ou pas de nouveaux résultats)');
      break;
    }
    lastCount = currentCount;
  }
  
  // Récupérer tous les éléments de la liste
  const items = page.locator('div[role="feed"] > div > div > a[href*="/maps/place/"]');
  const count = await items.count();
  console.log(`  📍 ${count} établissements trouvés`);
  debug('Nombre d\'items dans le feed:', count);
  
  if (count === 0) {
    // Debug: essayer d'autres sélecteurs
    const altItems = await page.locator('a[href*="/maps/place/"]').count();
    debug('Items alternatifs (tous les liens place):', altItems);
  }
  
  for (let i = 0; i < Math.min(count, MAX_RESULTS_PER_QUERY); i++) {
    try {
      const item = items.nth(i);
      const itemHref = await item.getAttribute('href');
      debug(`\n--- Item ${i+1}/${count} ---`);
      debug('Href:', itemHref?.substring(0, 100));
      
      // Cliquer pour ouvrir le panneau latéral
      await item.click();
      await sleep(DELAY_BETWEEN_ACTIONS);
      
      // Attendre que le panneau se charge
      await page.waitForSelector('h1', { timeout: 5000 });
      await sleep(500);
      
      debug('URL après clic:', page.url());
      
      // Nom - plusieurs stratégies
      let name = '';
      
      // 1. Essayer depuis le H1 du panneau de détails (pas celui de la recherche)
      const h1Elements = await page.locator('h1').all();
      debug('Nombre de H1 trouvés:', h1Elements.length);
      
      for (const h1 of h1Elements) {
        const text = await h1.textContent({ timeout: 1000 }).catch(() => '');
        debug('H1 text:', text);
        // Ignorer "Résultats" ou textes trop courts
        if (text && text.length > 2 && !text.toLowerCase().includes('résultat')) {
          name = text.trim();
          break;
        }
      }
      
      // 2. Fallback: extraire depuis l'URL
      if (!name || name.toLowerCase().includes('résultat')) {
        name = extractNameFromUrl(page.url());
        debug('Nom extrait de URL:', name);
      }
      
      // 3. Fallback: aria-label du lien cliqué
      if (!name) {
        const ariaLabel = await item.getAttribute('aria-label').catch(() => '');
        debug('aria-label:', ariaLabel);
        if (ariaLabel) name = ariaLabel;
      }
      
      debug('Nom final:', name);
      
      // Valider le nom
      if (!name || !isValidName(name)) {
        console.log(`  ⏭ Skip (nom invalide): "${name}"`);
        continue;
      }
      
      // Téléphone - chercher le bouton avec l'icône téléphone
      let phone = '';
      debug('Recherche du téléphone...');
      
      const phoneSelectors = [
        'button[data-tooltip*="téléphone"]',
        'button[data-item-id*="phone"]',
        'a[data-item-id*="phone"]',
        'button[aria-label*="Numéro de téléphone"]',
        'button[aria-label*="Appeler le"]',
      ];
      
      for (const selector of phoneSelectors) {
        const btns = await page.locator(selector).all();
        debug(`Sélecteur "${selector}": ${btns.length} éléments`);
        
        for (const btn of btns) {
          const label = await btn.getAttribute('aria-label') || await btn.getAttribute('data-item-id') || '';
          
          // Exclure les faux positifs
          if (label.toLowerCase().includes('envoyer vers') || 
              label.toLowerCase().includes('send to') ||
              label.toLowerCase().includes('partager')) {
            debug('  Faux positif ignoré:', label);
            continue;
          }
          
          debug('  Label trouvé:', label);
          const match = label.match(/(\+?33[\s.-]?\d[\s.-]?\d{2}[\s.-]?\d{2}[\s.-]?\d{2}[\s.-]?\d{2}|0\d[\s.-]?\d{2}[\s.-]?\d{2}[\s.-]?\d{2}[\s.-]?\d{2})/);
          if (match) {
            phone = normalizePhone(match[1]);
            debug('  Téléphone extrait:', phone);
            break;
          }
        }
        if (phone) break;
      }
      
      // Alternative: chercher dans le texte de la page
      if (!phone) {
        debug('Téléphone non trouvé via boutons, recherche dans le texte...');
        const allText = await page.locator('div[role="region"], div[class*="fontBodyMedium"]').allTextContents();
        debug('Nombre de blocs texte:', allText.length);
        
        for (const text of allText) {
          const match = text.match(/(0[1-9][\s.-]?\d{2}[\s.-]?\d{2}[\s.-]?\d{2}[\s.-]?\d{2})/);
          if (match) {
            phone = normalizePhone(match[1]);
            debug('Téléphone trouvé dans texte:', phone);
            break;
          }
        }
      }
      
      // Skip si pas de téléphone
      if (!phone) {
        console.log(`  ⏭ Skip (pas de tel): "${name.substring(0, 30)}"`);
        debug('Aucun téléphone trouvé pour cet établissement');
        continue;
      }
      
      debug('Téléphone validé:', phone);
      
      // Adresse
      let address = '';
      const addressBtn = page.locator('button[data-item-id="address"]').first();
      if (await addressBtn.count() > 0) {
        address = await addressBtn.textContent({ timeout: 1000 }) || '';
        debug('Adresse trouvée:', address);
      } else {
        debug('Bouton adresse non trouvé');
      }
      
      // Website
      let website: string | undefined;
      let website_type: 'own' | 'booking' | 'social' | 'none' = 'none';
      const websiteLink = page.locator('a[data-item-id="authority"]').first();
      if (await websiteLink.count() > 0) {
        website = await websiteLink.getAttribute('href') || undefined;
        
        if (website) {
          // Classifier le type de site
          const lowerUrl = website.toLowerCase();
          const bookingPlatforms = ['planity.com', 'doctolib.', 'reservationcoiffeur.', 'treatwell.', 'kiute.', 'balinea.'];
          const socialPlatforms = ['instagram.com', 'facebook.com', 'fb.com', 'twitter.com', 'tiktok.com', 'linkedin.com'];
          
          if (bookingPlatforms.some(p => lowerUrl.includes(p))) {
            website_type = 'booking';
            debug('Site web (plateforme résa):', website);
          } else if (socialPlatforms.some(p => lowerUrl.includes(p))) {
            website_type = 'social';
            debug('Site web (réseau social):', website);
          } else {
            website_type = 'own';
            debug('Site web (propre):', website);
          }
        }
      } else {
        debug('Pas de site web');
      }
      
      // Rating
      let rating: number | undefined;
      const ratingSpan = page.locator('span[role="img"]').first();
      if (await ratingSpan.count() > 0) {
        const ariaLabel = await ratingSpan.getAttribute('aria-label') || '';
        const match = ariaLabel.match(/([\d,\.]+)/);
        if (match) {
          rating = parseFloat(match[1].replace(',', '.'));
          debug('Note:', rating);
        }
      }
      
      // Reviews
      let reviews_count: number | undefined;
      const reviewsText = await page.locator('button[jsaction*="review"]').first().textContent({ timeout: 1000 }).catch(() => '') || '';
      const reviewMatch = reviewsText.match(/\(?([\d\s]+)\)?/);
      if (reviewMatch) {
        reviews_count = parseInt(reviewMatch[1].replace(/\s/g, ''));
        debug('Nombre avis:', reviews_count);
      }
      
      // Horaires d'ouverture - extraction complète
      let opening_hours: string | undefined;
      try {
        // Méthode 1: Cliquer sur le dropdown pour déplier les horaires
        const hoursDropdown = page.locator('.OMl5r[role="button"], div[data-hide-tooltip-on-mouse-move="true"][role="button"]').first();
        if (await hoursDropdown.count() > 0) {
          // Cliquer pour ouvrir le dropdown
          await hoursDropdown.click();
          await sleep(300);
          debug('Dropdown horaires cliqué');
        }
        
        // Méthode 2: Extraire depuis le tableau des horaires
        const hoursTable = page.locator('table.eK4R0e');
        if (await hoursTable.count() > 0) {
          const rows = await page.locator('table.eK4R0e tr.y0skZc').all();
          const hoursData: string[] = [];
          
          for (const row of rows) {
            const day = await row.locator('td.ylH6lf div').textContent({ timeout: 500 }).catch(() => '');
            const hours = await row.locator('td.mxowUb').getAttribute('aria-label').catch(() => '') || 
                          await row.locator('td.mxowUb li.G8aQO').textContent({ timeout: 500 }).catch(() => '');
            
            if (day && hours) {
              // Nettoyer les heures (enlever "de" et "à")
              const cleanHours = hours
                .replace(/^de\s+/i, '')
                .replace(/\s+à\s+/g, '-')
                .trim();
              hoursData.push(`${day}: ${cleanHours}`);
            }
          }
          
          if (hoursData.length > 0) {
            opening_hours = hoursData.join(' | ');
            debug('Horaires complets:', opening_hours);
          }
        }
        
        // Fallback: texte simple du bouton
        if (!opening_hours) {
          const hoursBtn = page.locator('button[data-item-id="oh"]').first();
          if (await hoursBtn.count() > 0) {
            let hoursText = await hoursBtn.textContent({ timeout: 1000 });
            if (hoursText) {
              hoursText = hoursText
                .replace(/Voir plus d'horaires/gi, '')
                .replace(/See more hours/gi, '')
                .replace(/Afficher les horaires.*/gi, '')
                .replace(/Masquer les horaires/gi, '')
                .trim();
              
              if (hoursText.length > 0) {
                opening_hours = hoursText;
                debug('Horaires (fallback):', opening_hours);
              }
            }
          }
        }
      } catch (e) {
        debug('Erreur extraction horaires:', e);
      }
      
      // Réservation en ligne
      let has_booking = false;
      try {
        const bookingLinks = await page.locator('a[href*="book"], a[href*="reservation"], a[href*="rdv"], button:has-text("Réserver")').count();
        has_booking = bookingLinks > 0;
        debug('Réservation en ligne:', has_booking);
      } catch { /* ignore */ }
      
      const niche = query.split(' ')[0];
      const lead: RawLead & { niche: string; website_type?: string } = {
        name: cleanName(name, niche),
        phone,
        address: address.replace(/^[^a-zA-Z0-9]+/, '').trim(),
        city: extractCity(address) || query.split(' ').pop() || '',
        postal_code: extractPostalCode(address),
        website,
        maps_url: page.url(),
        rating,
        reviews_count,
        niche,
        opening_hours,
        has_booking,
        website_type: website_type !== 'none' ? website_type : undefined,
      };
      
      debugData('Lead complet', lead);
      leads.push(lead);
      
      const hasWebsite = website ? '🌐' : '📞';
      process.stdout.write(`\r  ✓ ${leads.length}: ${cleanName(name, niche).substring(0, 30).padEnd(30)} ${hasWebsite}   `);
      
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
  
  if (DEBUG) {
    console.log('\n' + '='.repeat(60));
    console.log('🔧 MODE DEBUG ACTIVÉ');
    console.log('='.repeat(60));
    console.log('Config complète:', JSON.stringify(config, null, 2));
    console.log('Constantes:');
    console.log(`  - DELAY_BETWEEN_ACTIONS: ${DELAY_BETWEEN_ACTIONS}ms`);
    console.log(`  - SCROLL_PAUSE: ${SCROLL_PAUSE}ms`);
    console.log(`  - MAX_RESULTS_PER_QUERY: ${MAX_RESULTS_PER_QUERY}`);
    console.log('='.repeat(60) + '\n');
  }
  
  debug('Lancement du navigateur Chromium (headless)...');
  const browser: Browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  debug('✓ Navigateur lancé');
  
  debug('Création du contexte avec locale fr-FR...');
  const context = await browser.newContext({
    locale: 'fr-FR',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  });
  debug('✓ Contexte créé');
  
  const page = await context.newPage();
  debug('✓ Page créée');
  
  try {
    for (const niche of config.niches) {
      for (const city of config.cities) {
        const query = `${niche} ${city}`;
        debug(`\n${'─'.repeat(50)}`);
        debug(`▶ Traitement requête: "${query}"`);
        debug(`${'─'.repeat(50)}`);
        
        const leads = await scrapeQuery(page, query);
        
        debug(`✓ Requête terminée: ${leads.length} leads trouvés`);
        debugData('Leads de cette requête', leads.map(l => ({ name: l.name, phone: l.phone, hasWebsite: !!l.website })));
        
        allLeads.push(...leads);
        debug(`Total cumulé: ${allLeads.length} leads`);
        
        // Pause entre les recherches
        debug(`Pause de ${DELAY_BETWEEN_ACTIONS * 2}ms avant la prochaine requête...`);
        await sleep(DELAY_BETWEEN_ACTIONS * 2);
      }
    }
  } finally {
    debug('Fermeture du navigateur...');
    await browser.close();
    debug('✓ Navigateur fermé');
  }
  
  // Déduplication par téléphone
  debug('\nDéduplication par téléphone...');
  debug(`Avant dédup: ${allLeads.length} leads`);
  const seen = new Set<string>();
  const uniqueLeads = allLeads.filter(lead => {
    if (seen.has(lead.phone)) {
      debug(`  ⊖ Doublon supprimé: ${lead.phone} (${lead.name})`);
      return false;
    }
    seen.add(lead.phone);
    return true;
  });
  debug(`Après dédup: ${uniqueLeads.length} leads (${allLeads.length - uniqueLeads.length} doublons)`);
  
  console.log(`\n✓ Total brut: ${allLeads.length}`);
  console.log(`✓ Après dédup: ${uniqueLeads.length}`);
  
  // Sauvegarder en DB si demandé
  if (config.saveToDb) {
    debug('\nSauvegarde en base de données...');
    let inserted = 0;
    let skipped = 0;
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
      debug(`  Insertion: ${lead.name} (${lead.phone})`);
      const result = upsertLead(dbLead);
      if (result) {
        inserted++;
        debug(`    ✓ Inséré/Mis à jour`);
      } else {
        skipped++;
        debug(`    ⊖ Ignoré (déjà existant ou erreur)`);
      }
    }
    debug(`\nRésumé DB: ${inserted} insérés, ${skipped} ignorés`);
    console.log(`✓ Insérés en DB: ${inserted}`);
  }
  
  if (DEBUG) {
    console.log('\n' + '='.repeat(60));
    console.log('📊 RÉSUMÉ DEBUG');
    console.log('='.repeat(60));
    console.log(`Requêtes exécutées: ${config.niches.length * config.cities.length}`);
    console.log(`Leads bruts collectés: ${allLeads.length}`);
    console.log(`Leads après dédup: ${uniqueLeads.length}`);
    console.log(`Taux de doublons: ${((allLeads.length - uniqueLeads.length) / allLeads.length * 100).toFixed(1)}%`);
    console.log('='.repeat(60) + '\n');
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
