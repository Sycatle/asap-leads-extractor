/**
 * Website Technology Analyzer
 * 
 * Analyzes websites to detect:
 * - CMS type (WordPress, Wix, Shopify, etc.)
 * - Website quality indicators (mobile-friendly, SSL, performance)
 * - Pain points for sales conversations
 */

import { chromium, Browser, Page } from 'playwright';
import type { CMSType } from '../shared/types.js';

export interface WebsiteAnalysis {
  cms_type: CMSType;
  has_mobile_friendly: boolean;
  has_ssl: boolean;
  page_load_time: number; // milliseconds
  pain_points: string[];
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
};

/**
 * Detect CMS type from page content and network requests
 */
function detectCMS(html: string, headers: Record<string, string>, requestUrls: string[]): CMSType {
  const lowerHtml = html.toLowerCase();
  const allContent = [lowerHtml, ...requestUrls.map(u => u.toLowerCase())];
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
  
  // CMS-specific pain points
  if (cms_type === 'wix') {
    painPoints.push("⚠️ Site Wix - limité pour le SEO, performances moyennes");
    painPoints.push("💡 Migration vers site professionnel = +30% visibilité Google");
  } else if (cms_type === 'wordpress' && analysis.page_load_time && analysis.page_load_time > 3000) {
    painPoints.push("🔧 WordPress mal optimisé - besoin de refonte technique");
  } else if (cms_type === 'shopify') {
    painPoints.push("🛍️ Shopify = coûts mensuels élevés, envisager alternative");
  } else if (cms_type === 'unknown' || cms_type === 'custom') {
    painPoints.push("🎨 Site custom/vieillot - modernisation pour meilleure image");
  }
  
  // Platform-based website
  if (url.includes('wixsite.com') || url.includes('blogspot.') || 
      url.includes('weebly.') || url.includes('wordpress.com')) {
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
  let browser: Browser | null = null;
  
  try {
    // Normalize URL
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      // Try HTTPS first, fallback to HTTP
      url = 'https://' + url;
    }
    
    const hasSSL = url.startsWith('https://');
    const startTime = Date.now();
    const requestUrls: string[] = [];
    
    browser = await chromium.launch({ 
      headless: true,
      timeout: 30000,
    });
    
    const context = await browser.newContext({
      userAgent: USER_AGENT,
      viewport: { width: 1920, height: 1080 },
    });
    
    const page = await context.newPage();
    
    // Track network requests for CMS detection
    page.on('request', request => {
      requestUrls.push(request.url());
    });
    
    // Navigate to page
    try {
      await page.goto(url, { 
        waitUntil: 'domcontentloaded',
        timeout,
      });
    } catch (error) {
      // If HTTPS fails, try HTTP
      if (hasSSL && url.startsWith('https://')) {
        const httpUrl = url.replace('https://', 'http://');
        await page.goto(httpUrl, { 
          waitUntil: 'domcontentloaded',
          timeout,
        });
        url = httpUrl;
      } else {
        throw error;
      }
    }
    
    const pageLoadTime = Date.now() - startTime;
    
    // Get page content - no need to navigate again, we already have the page loaded
    const html = await page.content();
    const headers = {}; // Headers from initial navigation
    
    // Detect CMS
    const cms_type = detectCMS(html, headers, requestUrls);
    
    // Check mobile-friendly
    const has_mobile_friendly = isMobileFriendly(html);
    
    // Check SSL (from final URL)
    const finalUrl = page.url();
    const has_ssl = finalUrl.startsWith('https://');
    
    // Generate pain points
    const partial = {
      has_ssl,
      has_mobile_friendly,
      page_load_time: pageLoadTime,
    };
    const pain_points = generatePainPoints(partial, finalUrl, cms_type);
    
    await browser.close();
    
    return {
      cms_type,
      has_mobile_friendly,
      has_ssl,
      page_load_time: pageLoadTime,
      pain_points,
    };
    
  } catch (error) {
    console.error(`  ✗ Erreur analyse site ${url}:`, (error as Error).message);
    if (browser) {
      await browser.close().catch(() => {});
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
 */
export function generatePlatformPainPoints(url: string, niche: string | null): string[] {
  const painPoints: string[] = [];
  const lowerUrl = url.toLowerCase();
  
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
