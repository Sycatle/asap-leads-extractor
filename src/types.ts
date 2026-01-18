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
}

export interface EnrichedLead extends RawLead {
  siren?: string;
  siret?: string;
  legal_name?: string;
  dirigeant?: string;
  priority: 'high' | 'medium' | 'low';
}

export interface Config {
  input_csv: string;
  target: number;
  allowed_departments: string[];
  exclude_keywords: string[];
  scrape?: {
    niches: string[];
    cities: string[];
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

// ===== LEAD EN BASE =====

export interface DbLead {
  id: number;
  phone: string;
  name: string;
  address: string;
  city: string;
  postal_code: string;
  website: string | null;
  maps_url: string;
  rating: number | null;
  reviews_count: number | null;
  niche: string | null;
  source: string;
  
  // Enrichissement Pappers
  siren: string | null;
  siret: string | null;
  legal_name: string | null;
  dirigeant: string | null;
  
  // Scoring
  priority: 'high' | 'medium' | 'low';
  
  // Suivi commercial
  status: LeadStatus;
  call_status: CallStatus;
  email_status: EmailStatus;
  notes: string | null;
  
  // Dates
  last_contact_at: string | null;
  next_followup_at: string | null;
  created_at: string;
  updated_at: string;
}
