// ===== TYPES DE BASE =====

export type PhoneType = 'pro' | 'perso' | 'unknown';
export type LeadSource = 'gmb' | 'annuaire' | 'scraping' | 'import' | 'manual';
export type WebsiteStatus = 'none' | 'old' | 'platform' | 'modern';
export type CMSType = 'wordpress' | 'wix' | 'shopify' | 'prestashop' | 'squarespace' | 'webflow' | 'custom' | 'unknown';

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
  | 'messagerie'   // Tombé sur messagerie
  | 'rappeler'     // Demande de rappel
  | 'injoignable'; // Numéro invalide/plus attribué

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

// ===== LEAD ENRICHI =====

export interface EnrichedLead extends RawLead {
  siren?: string;
  siret?: string;
  legal_name?: string;
  dirigeant?: string;
  priority: 'high' | 'medium' | 'low';
  score: number;
  phone_type: PhoneType;
  website_status?: WebsiteStatus;
  best_call_time?: string;
  has_seo?: boolean;
  // Website technology analysis
  cms_type?: CMSType;
  has_mobile_friendly?: boolean;
  has_ssl?: boolean;
  page_load_time?: number; // in milliseconds
  pain_points?: string[]; // Identified issues for sales talking points
}

// ===== LEAD EN BASE =====

export interface DbLead {
  id: number;
  phone: string;
  phone_type: PhoneType;
  name: string;
  address: string;
  city: string;
  postal_code: string;
  website: string | null;
  website_status: WebsiteStatus | null;
  maps_url: string;
  rating: number | null;
  reviews_count: number | null;
  niche: string | null;
  image_url: string | null;
  source: LeadSource;
  
  // Enrichissement Pappers
  siren: string | null;
  siret: string | null;
  legal_name: string | null;
  dirigeant: string | null;
  
  // Scoring & Enrichissement
  priority: 'high' | 'medium' | 'low';
  score: number;
  
  // Données GMB enrichies
  opening_hours: string | null;
  best_call_time: string | null;
  has_booking: number; // SQLite: 0 ou 1
  has_seo: number;     // SQLite: 0 ou 1
  last_gmb_update: string | null;
  
  // Website analysis enrichment
  cms_type: string | null; // CMSType
  has_mobile_friendly: number | null; // SQLite: 0 ou 1
  has_ssl: number | null; // SQLite: 0 ou 1
  page_load_time: number | null; // in milliseconds
  pain_points: string | null; // JSON array of identified issues
  
  // Suivi commercial
  status: LeadStatus;
  call_status: CallStatus;
  email_status: EmailStatus;
  notes: string | null;
  attempts_count: number;
  opt_out: number;     // SQLite: 0 ou 1
  
  // Dates
  last_contact_at: string | null;
  next_followup_at: string | null;
  created_at: string;
  updated_at: string;
}

// ===== CONFIG =====

export interface Config {
  input_csv: string;
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
}

export interface PappersResult {
  siren: string;
  siret: string;
  nom_entreprise: string;
  representants?: Array<{
    nom: string;
    prenom: string;
    qualite: string;
  }>;
}
