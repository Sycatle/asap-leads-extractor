// ===== TYPES DE BASE =====

export type PhoneType = 'pro' | 'perso' | 'unknown';
export type LeadSource = 'gmb' | 'annuaire' | 'scraping' | 'import' | 'manual';
export type WebsiteStatus = 'none' | 'old' | 'platform' | 'modern';
export type CMSType = 
  // CMS classiques
  | 'wordpress' | 'wix' | 'shopify' | 'prestashop' | 'squarespace' | 'webflow'
  | 'weebly' | 'jimdo' | 'blogger' | 'ghost'
  // E-commerce
  | 'woocommerce' | 'magento' | 'opencart'
  // Plateformes métier (coiffure, beauté, santé)
  | 'planity' | 'treatwell' | 'doctolib' | 'kiute' | 'flexy' | 'wavy'
  // Plateformes restaurant
  | 'thefork' | 'zenchef' | 'eatbu' | 'foxorders'
  // Réseaux sociaux / annuaires
  | 'facebook' | 'instagram' | 'linktree' | 'pagesjaunes'
  // Google Sites
  | 'googlesites'
  // Autres
  | 'custom' | 'unknown';

// ===== STATUTS DE SUIVI =====

export type LeadStatus = 
  | 'nouveau'      // Jamais contacté
  | 'contacte'     // Premier contact effectué
  | 'qualifie'     // Intéressé, besoin identifié
  | 'proposition'  // Devis/offre envoyée
  | 'converti'     // Client gagné
  | 'perdu';       // Refus ou injoignable

export type CallStatus = 
  | 'non_appele'   // Jamais appelé
  | 'appele'       // Appelé, conversation OK
  | 'rappeler'     // Demande de rappel
  | 'injoignable'; // Pas décroché / non joignable

export type EmailStatus = 
  | 'non_envoye'   // Pas d'email envoyé
  | 'envoye'       // Email envoyé
  | 'ouvert'       // Email ouvert (si tracking)
  | 'repondu'      // Réponse reçue
  | 'bounce';      // Email invalide

// ===== LEAD BRUT (SCRAPING) =====

export interface RawLead {
  name: string;
  phone: string;
  address: string;
  city: string;
  postal_code: string;
  website?: string;
  maps_url: string;
  rating?: number;
  reviews_count?: number;
  niche?: string;
  // Données enrichies GMB
  opening_hours?: string;
  has_booking?: boolean;
  last_gmb_update?: string;
  image_url?: string;
}

// ===== CONFIG =====
// La représentation DB du lead (DbLead) est désormais inférée depuis Drizzle :
// `import type { Lead } from '../db/schema'`. Plus de duplication ici.

export interface Config {
  target: number;
  allowed_departments: string[];
  exclude_keywords: string[];
  scrape?: {
    niches: string[];
    cities: string[];
  };
  worker?: {
    enabled: boolean;
    interval_minutes: number;
    max_leads_per_run: number;
  };
  orchestrator?: {
    // Intervalles entre cycles (en minutes)
    scrape_interval?: number;
    enrich_interval?: number;
    website_interval?: number;
    legal_interval?: number;
    // Limites par cycle
    max_scrape_per_cycle?: number;   // Nombre de requêtes GMaps par cycle (pas total leads)
    max_enrich_per_cycle?: number;
    max_website_per_cycle?: number;
    max_legal_per_cycle?: number;
    // Comportement
    parallel_pipelines?: boolean;
    auto_throttle?: boolean;
    metrics_interval?: number;
    enrich_priority_threshold?: number;  // Si > N leads à enrichir, prioriser enrich
  };
}

// Les modèles de tables normalisées (lead_calls, lead_notes, lead_status_log,
// lead_pain_points, stats_daily, llm_usage, call_sessions, scraper_*) sont
// désormais définis et inférés depuis db/schema.ts :
//   import type { LeadCall, LeadNote } from '../db/schema'
//
// PappersResult était un type d'enrichissement externe inutilisé (le worker
// passe par Societe.com via Playwright, pas Pappers).
