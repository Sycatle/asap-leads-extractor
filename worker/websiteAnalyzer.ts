/**
 * Website Technology Analyzer
 * 
 * Analyzes websites to detect:
 * - CMS type (WordPress, Wix, Shopify, etc.)
 * - Website quality indicators (mobile-friendly, SSL, performance)
 * - Website age (old vs modern)
 * - Pain points for sales conversations
 */

import { type BrowserContext, type Response } from 'playwright';
import { acquireBrowser, releaseBrowser } from './browserPool';
import type { CMSType } from '../shared/types';
import { websiteLogger as log } from './logger';

export interface WebsiteAnalysis {
  cms_type: CMSType;
  has_mobile_friendly: boolean;
  has_ssl: boolean;
  page_load_time: number; // milliseconds
  pain_points: string[];
  website_age?: 'old' | 'modern' | null; // New field for age detection
}

// Configuration constants
const PERFORMANCE_THRESHOLDS = {
  FAST: 2000,        // < 2s = fast
  ACCEPTABLE: 3000,  // 2-3s = acceptable
  SLOW: 3000,        // > 3s = slow (pain point)
} as const;

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

// Niche-specific pain point recommendations
const NICHE_RECOMMENDATIONS: Record<string, string> = {
  'coiffeur|barbier|esthét': "💇 Clients cherchent horaires/prix en ligne - besoin site + réservation",
  'restaurant|café': "🍽️ 80% des clients consultent menu en ligne avant de venir",
  'boulang|pâtiss': "🥖 Site web = +40% de visibilité locale sur Google",
  'garage|mécanicien': "🔧 Clients comparent prix/services en ligne - besoin vitrine digitale",
  'avocat|comptable': "⚖️ Clients recherchent crédibilité - site professionnel essentiel",
};

// CMS detection signatures
const CMS_SIGNATURES = {
  // Plateformes métier (coiffure, beauté, santé) - en premier car prioritaires
  planity: [
    'planity.com',
    'widget.planity.com',
    'booking.planity.com',
    'cdn.planity.com',
    'planity-widget',
  ],
  treatwell: [
    'treatwell.fr',
    'treatwell.com',
    'wahanda.com',
    'treatwell-widget',
  ],
  doctolib: [
    'doctolib.fr',
    'doctolib.com',
    'doctolib-widget',
    'cdn.doctolib',
  ],
  kiute: [
    'kiute.com',
    'kiute-pro',
    'kiutepro.com',
  ],
  flexy: [
    'flexy.com',
    'flexybeauty.com',
  ],
  wavy: [
    'wavy.co',
    'getwav.com',
  ],
  // Plateformes restaurant
  thefork: [
    'thefork.com',
    'lafourchette.com',
    'thefork-widget',
  ],
  zenchef: [
    'zenchef.com',
    'module.zenchef',
  ],
  eatbu: [
    'eatbu.com',
    '.eatbu.com',
  ],
  foxorders: [
    'foxorders.fr',
    'foxorders.com',
  ],
  // Google Sites
  googlesites: [
    'sites.google.com',
  ],
  // Réseaux sociaux comme site principal
  facebook: [
    'facebook.com/pages',
    'facebook.com/pg/',
    'facebook.com/profile',
    'www.facebook.com/',
    'fb.com/',
  ],
  instagram: [
    'instagram.com/',
    'www.instagram.com/',
  ],
  linktree: [
    'linktr.ee',
    'linktree.com',
  ],
  // Annuaires
  pagesjaunes: [
    'pagesjaunes.fr',
    'solocal.com',
  ],
  // CMS classiques
  wordpress: [
    '/wp-content/',
    '/wp-includes/',
    'wp-json',
    'wordpress',
    'X-Powered-By: WordPress',
  ],
  wix: [
    'wix.com',
    '_wix_',
    'parastorage.com',
    'wixsite.com',
    'X-Wix-',
  ],
  shopify: [
    'shopify.com',
    'cdn.shopify.com',
    'Shopify.theme',
    'shopify-section',
  ],
  prestashop: [
    '/modules/ps_',
    'prestashop',
    'PrestaShop',
    '/themes/classic/',
  ],
  squarespace: [
    'squarespace.com',
    'sqsp.com',
    'squarespace-cdn',
  ],
  webflow: [
    'webflow.com',
    'webflow.io',
    'data-wf-',
  ],
  weebly: [
    'weebly.com',
    'editmysite.com',
  ],
  jimdo: [
    'jimdo.com',
    'jimdofree.com',
  ],
  blogger: [
    'blogger.com',
    'blogspot.com',
  ],
  // E-commerce
  magento: [
    'magento',
    'mage-',
    '/skin/frontend/',
  ],
  woocommerce: [
    'woocommerce',
    'wc-ajax',
    '/wc-api/',
  ],
  opencart: [
    'opencart',
    '/catalog/view/',
  ],
};

/**
 * Detect CMS type from page content, URL and network requests
 */
function detectCMS(html: string, headers: Record<string, string>, requestUrls: string[], pageUrl: string = ''): CMSType {
  const lowerHtml = html.toLowerCase();
  const lowerUrl = pageUrl.toLowerCase();
  const allContent = [lowerHtml, lowerUrl, ...requestUrls.map(u => u.toLowerCase())];
  const headerString = JSON.stringify(headers).toLowerCase();
  
  // Check each CMS signature
  for (const [cms, signatures] of Object.entries(CMS_SIGNATURES)) {
    for (const signature of signatures) {
      const lowerSig = signature.toLowerCase();
      if (allContent.some(c => c.includes(lowerSig)) || headerString.includes(lowerSig)) {
        return cms as CMSType;
      }
    }
  }
  
  // Check if it's a custom built site (has typical patterns)
  if (lowerHtml.includes('<!doctype html') && 
      (lowerHtml.includes('<script') || lowerHtml.includes('<link'))) {
    return 'custom';
  }
  
  return 'unknown';
}

/**
 * Check if website is mobile-friendly
 */
function isMobileFriendly(html: string): boolean {
  const lowerHtml = html.toLowerCase();
  
  // Check for viewport meta tag
  const hasViewport = lowerHtml.includes('viewport') && 
                      lowerHtml.includes('width=device-width');
  
  // Check for responsive meta tags
  const hasResponsive = lowerHtml.includes('responsive') ||
                        lowerHtml.includes('mobile-friendly');
  
  return hasViewport || hasResponsive;
}

/**
 * Generate pain points based on analysis
 */
function generatePainPoints(analysis: Partial<WebsiteAnalysis>, url: string, cms_type: CMSType): string[] {
  const painPoints: string[] = [];
  
  // SSL issues
  if (!analysis.has_ssl) {
    painPoints.push("❌ Site non sécurisé (pas de HTTPS) - perte de confiance client");
  }
  
  // Mobile issues
  if (!analysis.has_mobile_friendly) {
    painPoints.push("📱 Site non optimisé mobile - 60%+ des visiteurs sur mobile");
  }
  
  // Performance issues
  if (analysis.page_load_time && analysis.page_load_time > PERFORMANCE_THRESHOLDS.SLOW) {
    painPoints.push(`⏱️ Site trop lent (${(analysis.page_load_time / 1000).toFixed(1)}s) - perte de clients`);
  } else if (analysis.page_load_time && analysis.page_load_time > PERFORMANCE_THRESHOLDS.ACCEPTABLE) {
    painPoints.push("⏱️ Temps de chargement à améliorer pour meilleure conversion");
  }
  
  // Old website detected
  if (analysis.website_age === 'old') {
    painPoints.push("🕰️ Site obsolète (design/technologies dépassés) - mauvaise image de marque");
  }
  
  // Plateformes métier - pain points spécifiques
  if (cms_type === 'planity') {
    painPoints.push("📅 Page Planity uniquement - pas de site propre, dépendant de la plateforme");
    painPoints.push("🔍 Pas de référencement Google - les clients ne vous trouvent pas naturellement");
    painPoints.push("💡 Un site vitrine permettrait de se différencier et capter plus de clients");
  } else if (cms_type === 'treatwell') {
    painPoints.push("📅 Présence limitée à Treatwell - dépendant des commissions de la plateforme");
    painPoints.push("💡 Site propre = image professionnelle + indépendance");
  } else if (cms_type === 'doctolib') {
    painPoints.push("📅 Page Doctolib uniquement - pas de vitrine digitale complète");
    painPoints.push("💡 Un site web renforcerait la crédibilité professionnelle");
  } else if (cms_type === 'thefork' || cms_type === 'zenchef') {
    painPoints.push("🍽️ Dépendant de la plateforme de réservation - commissions élevées");
    painPoints.push("💡 Site propre avec menu + réservation directe = économies + image");
  } else if (cms_type === 'eatbu') {
    painPoints.push("🍽️ Page Eatbu uniquement - menu en ligne sans site propre");
    painPoints.push("🔍 Invisible sur Google - les clients ne trouvent pas le restaurant");
    painPoints.push("💡 Un site vitrine améliorerait la visibilité et l'image");
  } else if (cms_type === 'foxorders') {
    painPoints.push("🍽️ Page FoxOrders - dépendant d'une plateforme de commande");
    painPoints.push("💡 Site propre = image pro + commandes directes sans commission");
  } else if (cms_type === 'googlesites') {
    painPoints.push("📄 Google Sites - très limité, aspect amateur et daté");
    painPoints.push("🔍 SEO minimal - difficile de ressortir sur Google");
    painPoints.push("💡 Site professionnel = crédibilité + référencement optimal");
  } else if (cms_type === 'facebook' || cms_type === 'instagram') {
    painPoints.push("📱 Uniquement présent sur les réseaux sociaux - pas de vitrine pro");
    painPoints.push("🔍 Invisible sur Google - perte de nombreux clients potentiels");
    painPoints.push("💡 Un site web capte les 80% de clients qui cherchent sur Google");
  } else if (cms_type === 'linktree') {
    painPoints.push("🔗 Linktree n'est pas un site web - image amateur");
    painPoints.push("💡 Un vrai site renforce la crédibilité et le référencement");
  } else if (cms_type === 'pagesjaunes') {
    painPoints.push("📒 Présence limitée aux Pages Jaunes - pas de contrôle sur l'image");
    painPoints.push("💡 Site propre = meilleur référencement + image maîtrisée");
  // CMS classiques - pain points
  } else if (cms_type === 'wix') {
    painPoints.push("⚠️ Site Wix - limité pour le SEO, performances moyennes");
    painPoints.push("💡 Migration vers site professionnel = +30% visibilité Google");
  } else if (cms_type === 'squarespace' || cms_type === 'weebly' || cms_type === 'jimdo') {
    painPoints.push("⚠️ Plateforme DIY limitante - difficile de se démarquer");
    painPoints.push("💡 Site sur-mesure = meilleur SEO + design unique");
  } else if (cms_type === 'wordpress' && analysis.page_load_time && analysis.page_load_time > 3000) {
    painPoints.push("🔧 WordPress mal optimisé - besoin de refonte technique");
  } else if (cms_type === 'blogger') {
    painPoints.push("📝 Blog Blogger - aspect daté, pas pro pour une entreprise");
    painPoints.push("💡 Site vitrine moderne = crédibilité + clients");
  } else if (cms_type === 'shopify') {
    painPoints.push("🛍️ Shopify = coûts mensuels élevés, envisager alternative");
  } else if (cms_type === 'unknown' || cms_type === 'custom') {
    painPoints.push("🎨 Site custom/vieillot - modernisation pour meilleure image");
  }
  
  // Platform-based website URL
  if (url.includes('wixsite.com') || url.includes('blogspot.') || 
      url.includes('weebly.') || url.includes('wordpress.com') ||
      url.includes('jimdofree.') || url.includes('my.canva.site')) {
    painPoints.push("🏷️ URL non professionnelle - impact sur crédibilité");
  }
  
  return painPoints;
}

/**
 * Analyze a website
 * @param url Website URL to analyze
 * @param timeout Max time to wait for page load (default: 15s)
 * @returns Analysis results or null on error
 */
export async function analyzeWebsite(url: string, timeout: number = 15000): Promise<WebsiteAnalysis | null> {
  const context: BrowserContext | null = null;
  const browserAcquired = false;
  const startTime = Date.now();
  
  try {
    // Validate URL format
    if (!url || url.trim() === '') {
      throw new Error('URL vide ou invalide');
    }
    
    // Normalize URL
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      // Try HTTPS first, fallback to HTTP
      url = 'https://' + url;
    }
    
    const hasSSL = url.startsWith('https://');
    const requestUrls: string[] = [];
    
    // Acquire shared browser instance from pool
    const browser = await acquireBrowser();
    browserAcquired = true;

    context = await browser.newContext({
      userAgent: USER_AGENT,
      viewport: { width: 1920, height: 1080 },
    });

    const page = await context.newPage();
    
    let response: Response | null = null;
    
    // Track network requests for CMS detection
    page.on('request', request => {
      requestUrls.push(request.url());
    });
    
    // Navigate to page with retry logic
    try {
      response = await page.goto(url, { 
        waitUntil: 'domcontentloaded',
        timeout,
      });
    } catch (error) {
      // If HTTPS fails, try HTTP
      if (hasSSL && url.startsWith('https://')) {
        const httpUrl = url.replace('https://', 'http://');
        try {
          response = await page.goto(httpUrl, { 
            waitUntil: 'domcontentloaded',
            timeout,
          });
          url = httpUrl;
        } catch (httpError) {
          // Both HTTPS and HTTP failed
          throw new Error(`Navigation échouée (HTTPS et HTTP): ${httpError instanceof Error ? httpError.message : String(httpError)}`);
        }
      } else {
        throw error;
      }
    }
    
    const pageLoadTime = Date.now() - startTime;
    
    // Get page content and headers with timeout protection
    const html = await Promise.race([
      page.content(),
      new Promise<string>((_, reject) => 
        setTimeout(() => reject(new Error('Timeout lors de la récupération du contenu')), 5000)
      )
    ]);
    
    const headers: Record<string, string> = response ? Object.fromEntries(
      Object.entries(response.headers())
    ) : {};
    
    // Get final URL (after redirects)
    const finalUrl = page.url();
    
    // Import analyzeWebsiteAge from scoring
    const { analyzeWebsiteAge } = await import('./scoring.js');
    const website_age = analyzeWebsiteAge(html, headers);
    
    // Detect CMS - pass both content and URL
    const cms_type = detectCMS(html, headers, requestUrls, finalUrl);
    
    // Check mobile-friendly
    const has_mobile_friendly = isMobileFriendly(html);
    
    // Check SSL (from final URL)
    const has_ssl = finalUrl.startsWith('https://');
    
    // Generate pain points
    const partial: Partial<WebsiteAnalysis> = {
      has_ssl,
      has_mobile_friendly,
      page_load_time: pageLoadTime,
      website_age,
    };
    const pain_points = generatePainPoints(partial, finalUrl, cms_type);

    // Close context only — browser stays alive in pool
    await context.close();
    context = null;
    if (browserAcquired) {
      await releaseBrowser();
      browserAcquired = false;
    }

    return {
      cms_type,
      has_mobile_friendly,
      has_ssl,
      page_load_time: pageLoadTime,
      pain_points,
      website_age,
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log.debug(`Erreur analyse ${url}: ${errorMessage.slice(0, 80)}`);

    if (context) {
      try {
        await context.close();
      } catch {
        // Ignore close errors silently
      }
    }
    if (browserAcquired) {
      await releaseBrowser();
    }

    return null;
  }
}

/**
 * Generate pain points for a lead with no website
 */
export function generateNoWebsitePainPoints(niche: string | null): string[] {
  const painPoints: string[] = [
    "❌ Aucun site web - invisible sur Google",
    "📉 Perte de clients potentiels au profit de concurrents en ligne",
  ];
  
  // Niche-specific pain points using configuration
  const lowerNiche = (niche || '').toLowerCase();
  
  for (const [pattern, recommendation] of Object.entries(NICHE_RECOMMENDATIONS)) {
    const keywords = pattern.split('|');
    if (keywords.some(keyword => lowerNiche.includes(keyword))) {
      painPoints.push(recommendation);
      break; // Only add one niche-specific recommendation
    }
  }
  
  // Generic fallback if no niche match
  if (painPoints.length === 2) {
    painPoints.push("💼 Site web professionnel = +50% de crédibilité auprès clients");
  }
  
  painPoints.push("🎯 Opportunité : site moderne avec réservation en ligne");
  
  return painPoints;
}

/**
 * Generate pain points for platform-based websites (Planity, etc.)
 * 
 * Note: Uses substring matching for URL patterns. This is intentional for 
 * pain point generation and not a security check. We're matching common 
 * patterns in URLs from our database to provide helpful sales guidance.
 */
export function generatePlatformPainPoints(url: string, _niche: string | null): string[] {
  const painPoints: string[] = [];
  const lowerUrl = url.toLowerCase();
  
  // Note: URL substring checks are for classification only, not security
  if (lowerUrl.includes('planity') || lowerUrl.includes('doctolib')) {
    painPoints.push("📱 Plateforme de réservation ≠ vrai site web");
    painPoints.push("❌ Pas de contrôle sur votre image/contenu");
    painPoints.push("💰 Frais mensuels élevés + commissions");
    painPoints.push("🎯 Solution : site pro + système réservation intégré = économies");
  } else if (lowerUrl.includes('facebook') || lowerUrl.includes('instagram')) {
    painPoints.push("📱 Réseaux sociaux ≠ site professionnel");
    painPoints.push("❌ Non visible sur Google (recherche locale)");
    painPoints.push("⚠️ Dépendance algorithme Facebook/Instagram");
    painPoints.push("🎯 Site web propre = meilleure visibilité + crédibilité");
  } else if (lowerUrl.includes('pagesjaunes') || lowerUrl.includes('yelp')) {
    painPoints.push("📒 Simple annuaire ≠ site vitrine");
    painPoints.push("❌ Pas de personnalisation de votre offre");
    painPoints.push("🎯 Site dédié = mise en valeur services + meilleur SEO");
  } else {
    painPoints.push("⚠️ Plateforme tierce - contrôle limité");
    painPoints.push("🎯 Site web propre = indépendance + meilleure image");
  }
  
  return painPoints;
}
