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
