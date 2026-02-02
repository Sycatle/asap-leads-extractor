import { chromium, Browser, Page } from 'playwright';
import { RawLead } from '../shared/types';
import { upsertLead, closeDb, enrichLead, type InsertLead, getExistingPhones } from './db';
import { enrichSingleLead } from './enrich';
import { sleep, normalizePhone, extractPostalCode, extractCity } from './utils';
import { classifyWebsiteStatus, computeBestCallTime } from './scoring';
import { scrapeLogger as log, ProgressBar } from './logger';

// ===== DEBUG MODE =====
const DEBUG = process.env.DEBUG === '1' || process.env.DEBUG === 'true';

function debug(...args: unknown[]): void {
  log.debug(...args);
}

function debugData(label: string, data: unknown): void {
  log.debugData(label, data);
}

const DELAY_BETWEEN_ACTIONS = 600;  // Optimisé: 1000 → 600
const SCROLL_PAUSE = 500;           // Optimisé: 800 → 500  
const MAX_RESULTS_PER_QUERY = 50;   // Compromis: assez pour trouver les mal référencés
const MAX_SCROLL_ATTEMPTS = 12;     // Ajusté pour 50 résultats



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



interface ScrapeQueryOptions {
  saveImmediately?: boolean;
  enrichImmediately?: boolean;
  existingPhones?: Set<string>; // Pré-chargé pour skip doublons
  searchNiche?: string;  // Niche de recherche (pour normalisation)
  searchCity?: string;   // Ville de recherche (pour normalisation)
}

// Scraper avec extraction depuis le panneau latéral (plus rapide)
// Insère chaque lead en DB dès qu'il est extrait pour éviter les pertes
async function scrapeQuery(page: Page, query: string, options: ScrapeQueryOptions = {}): Promise<RawLead[]> {
  const leads: RawLead[] = [];
  const { 
    saveImmediately = true, 
    enrichImmediately = false, 
    existingPhones = new Set(),
    searchNiche,
    searchCity,
  } = options;
  let skippedDuplicates = 0;
  
  log.info(`Recherche: "${query}"`);
  
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
  } catch (err) {
    debug('Erreur lors de l\'acceptation des cookies:', err);
  }
  
  // Attendre les résultats
  try {
    await page.waitForSelector('div[role="feed"]', { timeout: 10000 });
    debug('Feed de résultats trouvé');
  } catch {
    log.warn(`Pas de résultats pour "${query}"`);
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
  
  // Scroll pour charger plus de résultats - on va plus loin pour trouver les business moins bien référencés
  const feed = page.locator('div[role="feed"]').first();
  debug('Scroll pour charger plus de résultats...');
  let lastCount = 0;
  let noNewResultsCount = 0;
  
  for (let i = 0; i < MAX_SCROLL_ATTEMPTS; i++) {
    await feed.evaluate(el => el.scrollBy(0, 1500)); // Scroll plus grand
    await sleep(SCROLL_PAUSE);
    
    // Vérifier si de nouveaux éléments sont apparus
    const currentCount = await page.locator('div[role="feed"] > div > div > a[href*="/maps/place/"]').count();
    debug(`Scroll ${i+1}: ${currentCount} items`);
    
    // Arrêter si on a atteint la limite
    if (currentCount >= MAX_RESULTS_PER_QUERY) {
      debug('Limite de résultats atteinte');
      break;
    }
    
    // Arrêter après 3 scrolls sans nouveaux résultats
    if (currentCount === lastCount) {
      noNewResultsCount++;
      if (noNewResultsCount >= 3) {
        debug('Fin de la liste atteinte (plus de nouveaux résultats)');
        break;
      }
    } else {
      noNewResultsCount = 0;
    }
    lastCount = currentCount;
  }
  
  // Récupérer tous les éléments de la liste
  const items = page.locator('div[role="feed"] > div > div > a[href*="/maps/place/"]');
  const count = await items.count();
  log.info(`${count} établissements trouvés`);
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
      const ariaLabel = await item.getAttribute('aria-label') || '';
      debug(`\n--- Item ${i+1}/${count} ---`);
      debug('Href:', itemHref?.substring(0, 100));
      debug('aria-label:', ariaLabel);
      
      // Ignorer les résultats sponsorisés directement
      if (ariaLabel.toLowerCase().includes('sponsorisé') || 
          ariaLabel.toLowerCase().includes('sponsored') ||
          ariaLabel.toLowerCase().includes('annonce')) {
        debug('⏭ Résultat sponsorisé ignoré');
        continue;
      }
      
      // Scroll le feed pour rendre l'élément visible
      // Google Maps virtualise le feed - les éléments hors écran sont supprimés du DOM
      // On doit scroller progressivement pour forcer le rendu
      const targetScrollPosition = i * 120; // ~120px par item
      
      // Scroll progressif pour forcer Google Maps à rendre l'élément
      let isVisible = false;
      for (let scrollAttempt = 0; scrollAttempt < 3; scrollAttempt++) {
        await feed.evaluate((el, pos) => el.scrollTo({ top: pos, behavior: 'instant' }), targetScrollPosition);
        await sleep(400);
        
        // Vérifier si l'élément est maintenant dans le DOM et visible
        const isInDom = await item.count() > 0;
        if (isInDom) {
          await item.evaluate((el) => {
            el.scrollIntoView({ behavior: 'instant', block: 'center' });
          }).catch(() => {});
          await sleep(300);
          
          isVisible = await item.isVisible().catch(() => false);
          if (isVisible) break;
        }
        
        // Si pas dans le DOM ou pas visible, scroller un peu plus haut puis revenir
        if (scrollAttempt < 2) {
          debug(`Scroll attempt ${scrollAttempt + 1} failed, retrying...`);
          await feed.evaluate((el, pos) => el.scrollTo({ top: Math.max(0, pos - 500), behavior: 'instant' }), targetScrollPosition);
          await sleep(200);
        }
      }
      
      if (!isVisible) {
        // Dernier essai: scroll plus agressif
        debug('Élément non visible, scroll agressif...');
        await feed.evaluate((el, pos) => el.scrollTo({ top: Math.max(0, pos - 300), behavior: 'instant' }), targetScrollPosition);
        await sleep(300);
        await feed.evaluate((el, pos) => el.scrollTo({ top: pos, behavior: 'instant' }), targetScrollPosition);
        await sleep(400);
        
        await item.evaluate((el) => {
          el.scrollIntoView({ behavior: 'instant', block: 'center' });
        }).catch(() => {});
        await sleep(300);
        
        isVisible = await item.isVisible().catch(() => false);
      }

      if (!isVisible) {
        debug('⏭ Élément non visible après retries, skip');
        continue;
      }
      
      // Cliquer pour ouvrir le panneau latéral
      await item.click({ timeout: 10000 });
      await sleep(DELAY_BETWEEN_ACTIONS);
      
      // Attendre que le panneau se charge
      await page.waitForSelector('h1', { timeout: 5000 });
      await sleep(500);
      
      debug('URL après clic:', page.url());
      
      // Nom - plusieurs stratégies (privilégier aria-label qui est plus fiable)
      let name = '';
      
      // 1. D'abord essayer l'aria-label du lien (le plus fiable)
      if (ariaLabel && ariaLabel.length > 2) {
        name = ariaLabel.trim();
        debug('Nom depuis aria-label:', name);
      }
      
      // 2. Fallback: H1 du panneau de détails
      if (!name || !isValidName(name)) {
        const h1Elements = await page.locator('h1').all();
        debug('Nombre de H1 trouvés:', h1Elements.length);
        
        for (const h1 of h1Elements) {
          const text = await h1.textContent({ timeout: 1000 }).catch(() => '');
          debug('H1 text:', text);
          // Ignorer "Résultats", "Sponsorisé" ou textes trop courts
          if (text && text.length > 2 && isValidName(text)) {
            name = text.trim();
            break;
          }
        }
      }
      
      // 3. Fallback: extraire depuis l'URL
      if (!name || !isValidName(name)) {
        name = extractNameFromUrl(page.url());
        debug('Nom extrait de URL:', name);
      }
      
      debug('Nom final:', name);
      
      // Valider le nom
      if (!name || !isValidName(name)) {
        log.debug(`Skip (nom invalide): "${name}"`);
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
        log.debug(`Skip (pas de tel): "${name.substring(0, 30)}"`);
        debug('Aucun téléphone trouvé pour cet établissement');
        continue;
      }
      
      // Skip si téléphone déjà en base (doublon)
      if (existingPhones.has(phone)) {
        skippedDuplicates++;
        debug(`⏭ Doublon skip: ${phone} (déjà en DB)`);
        continue;
      }
      // Ajouter au Set pour éviter doublons dans cette session
      existingPhones.add(phone);
      
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
      
      // Website - use scoring module for classification
      let website: string | undefined;
      let website_status: 'none' | 'platform' | 'modern' | 'old' = 'none';
      const websiteLink = page.locator('a[data-item-id="authority"]').first();
      if (await websiteLink.count() > 0) {
        website = await websiteLink.getAttribute('href') || undefined;
        
        if (website) {
          // Use centralized classification
          website_status = classifyWebsiteStatus(website);
          debug(`Site web (${website_status}):`, website);
        }
      } else {
        website_status = 'none';
        debug('Pas de site web - EXCELLENT PROSPECT!');
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
      } catch (err) {
        debug('Erreur extraction réservation:', err);
      }
      
      // ===== EXTRACTION IMAGE =====
      let image_url: string | undefined;
      try {
        // Méthode 1: Image principale dans le header du panneau (bouton avec background-image)
        const heroImage = page.locator('button[jsaction*="heroHeaderImage"] img, button.aoRNLd img').first();
        if (await heroImage.count() > 0) {
          const src = await heroImage.getAttribute('src');
          if (src && src.startsWith('http') && !src.includes('data:')) {
            // Nettoyer l'URL pour avoir une bonne résolution (remplacer =w... par une taille standard)
            image_url = src.replace(/=w\d+-h\d+.*$/, '=w400-h300-k-no');
            debug('Image hero:', image_url);
          }
        }
        
        // Méthode 2: Image de couverture dans la galerie
        if (!image_url) {
          const coverImg = page.locator('img[decoding="async"][src*="googleusercontent.com"]').first();
          if (await coverImg.count() > 0) {
            const src = await coverImg.getAttribute('src');
            if (src && src.startsWith('http')) {
              image_url = src.replace(/=w\d+-h\d+.*$/, '=w400-h300-k-no');
              debug('Image couverture:', image_url);
            }
          }
        }
        
        // Méthode 3: Première image de la galerie
        if (!image_url) {
          const galleryImg = page.locator('div[role="img"] img, .m6QErb img[src*="googleusercontent"]').first();
          if (await galleryImg.count() > 0) {
            const src = await galleryImg.getAttribute('src');
            if (src && src.startsWith('http') && !src.includes('data:')) {
              image_url = src.replace(/=w\d+-h\d+.*$/, '=w400-h300-k-no');
              debug('Image galerie:', image_url);
            }
          }
        }
        
        if (!image_url) {
          debug('Aucune image trouvée pour cet établissement');
        }
      } catch (e) {
        debug('Erreur extraction image:', e);
      }
      
      // NORMALISATION: utiliser la niche et ville de recherche
      // au lieu d'extraire des données fragmentées
      const niche = searchNiche || query.split(' ')[0];
      const city = searchCity || extractCity(address) || query.split(' ').pop() || '';
      
      const lead: RawLead & { niche: string; website_status?: string } = {
        name: cleanName(name, niche),
        phone,
        address: address.replace(/^[^a-zA-Z0-9]+/, '').trim(),
        city,  // Ville normalisée
        postal_code: extractPostalCode(address),
        website,
        maps_url: page.url(),
        rating,
        reviews_count,
        niche,  // Niche normalisée
        opening_hours,
        has_booking,
        website_status,
        image_url,
      };
      
      debugData('Lead complet', lead);
      
      // Sauvegarde immédiate en DB si demandé (par défaut: oui)
      if (saveImmediately) {
        const dbLead: InsertLead = {
          phone: lead.phone,
          name: lead.name,
          address: lead.address,
          city: lead.city,
          postal_code: lead.postal_code,
          website: lead.website,
          website_status: (lead.website_status as 'none' | 'platform' | 'modern' | 'old') || (lead.website ? undefined : 'none'),
          maps_url: lead.maps_url,
          rating: lead.rating,
          reviews_count: lead.reviews_count,
          niche: lead.niche || null,
          source: 'gmb',
          opening_hours: lead.opening_hours,
          has_booking: lead.has_booking,
          best_call_time: computeBestCallTime(lead.opening_hours),
          image_url: lead.image_url,
        };
        
        const result = upsertLead(dbLead);
        if (result) {
          debug(`  💾 Sauvegardé en DB (id: ${result.id}, score: ${result.score})`);
          
          // Enrichissement immédiat si demandé
          if (enrichImmediately && result.siren === null) {
            try {
              await enrichSingleLead(result);
              debug(`  🔍 Enrichi SIREN`);
            } catch (e) {
              debug(`  ⚠ Enrichissement échoué`);
            }
          }
        }
      }
      
      leads.push(lead);
      
      const hasWebsite = website ? '🌐' : '📞';
      log.progress(`${leads.length}/${count} │ ${cleanName(name, niche).substring(0, 35).padEnd(35)} ${hasWebsite}`);
      
    } catch (err) {
      // Continuer sur erreur mais logger pour debugging
      debug('Erreur traitement item:', err);
      log.debug('Erreur extraction pour un établissement, skip...');
      continue;
    }
  }
  
  log.progressEnd();
  if (skippedDuplicates > 0) {
    log.info(`${skippedDuplicates} doublons évités (déjà en DB)`);
  }
  log.success(`${leads.length} leads extraits pour "${query}"`);
  return leads;
}

export interface ScrapeConfig {
  niches: string[];
  cities: string[];
  queries?: Array<{ niche: string; city: string }>; // Requêtes explicites (override niches×cities)
  maxPerQuery?: number;
  saveToDb?: boolean; // Déprécié: la sauvegarde est maintenant immédiate par défaut
  enrichImmediately?: boolean; // Enrichir chaque lead immédiatement (Pappers API)
}

export async function scrapeGoogleMaps(config: ScrapeConfig): Promise<RawLead[]> {
  const allLeads: RawLead[] = [];
  
  // Options de sauvegarde: immédiate par défaut (sauf si saveToDb === false explicitement)
  const saveImmediately = config.saveToDb !== false;
  const enrichImmediately = config.enrichImmediately ?? false;
  
  // Construire la liste des requêtes
  let queries: Array<{ niche: string; city: string }>;
  if (config.queries && config.queries.length > 0) {
    // Mode requêtes explicites
    queries = config.queries;
  } else {
    // Mode produit cartésien (legacy)
    queries = [];
    for (const niche of config.niches) {
      for (const city of config.cities) {
        queries.push({ niche, city });
      }
    }
  }
  
  // Pré-charger les téléphones existants pour skip doublons
  log.info('Chargement des leads existants...');
  const existingPhones = saveImmediately ? getExistingPhones() : new Set<string>();
  log.success(`${existingPhones.size} leads déjà en base`);
  
  log.header('SCRAPING GOOGLE MAPS');
  log.kv('Niches', config.niches.join(', '));
  log.kv('Villes', config.cities.join(', '));
  log.kv('Requêtes', queries.length.toString());
  log.kv('Mode', `${saveImmediately ? 'Sauvegarde immédiate' : 'Collecte seule'}${enrichImmediately ? ' + Enrichissement' : ''}`);
  log.blank();
  
  if (DEBUG) {
    log.section('MODE DEBUG ACTIVÉ');
    log.debugData('Config', config);
    log.debug(`DELAY_BETWEEN_ACTIONS: ${DELAY_BETWEEN_ACTIONS}ms`);
    log.debug(`SCROLL_PAUSE: ${SCROLL_PAUSE}ms`);
    log.debug(`MAX_RESULTS_PER_QUERY: ${MAX_RESULTS_PER_QUERY}`);
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
    // Utiliser la liste de requêtes pré-construite
    for (const { niche, city } of queries) {
      const query = `${niche} ${city}`;
      debug(`\n${'─'.repeat(50)}`);
      debug(`▶ Traitement requête: "${query}"`);
      debug(`${'─'.repeat(50)}`);
      
      const leads = await scrapeQuery(page, query, { 
        saveImmediately, 
        enrichImmediately, 
        existingPhones,
        searchNiche: niche,   // Passer la niche exacte
        searchCity: city,     // Passer la ville exacte
      });
      
      debug(`✓ Requête terminée: ${leads.length} leads trouvés`);
      debugData('Leads de cette requête', leads.map(l => ({ name: l.name, phone: l.phone, hasWebsite: !!l.website })));
      
      allLeads.push(...leads);
      debug(`Total cumulé: ${allLeads.length} leads`);
      
      // Pause entre les recherches (optimisée)
      debug(`Pause de ${DELAY_BETWEEN_ACTIONS}ms avant la prochaine requête...`);
      await sleep(DELAY_BETWEEN_ACTIONS);
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
  
  log.blank();
  log.success(`Total: ${uniqueLeads.length} leads uniques (${allLeads.length} bruts)`);
  
  if (saveImmediately) {
    log.info('Tous les leads ont été sauvegardés en temps réel');
  }
  
  if (DEBUG) {
    log.section('RÉSUMÉ DEBUG');
    log.kv('Requêtes exécutées', queries.length);
    log.kv('Leads bruts', allLeads.length);
    log.kv('Leads uniques', uniqueLeads.length);
    log.kv('Taux doublons', `${((allLeads.length - uniqueLeads.length) / Math.max(allLeads.length, 1) * 100).toFixed(1)}%`);
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
