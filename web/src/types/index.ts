// ===== LEAD TYPES =====

export type LeadStatus = 'nouveau' | 'contacte' | 'qualifie' | 'proposition' | 'converti' | 'perdu';
export type CallStatus = 'non_appele' | 'appele' | 'rappeler' | 'injoignable';
export type EmailStatus = 'non_envoye' | 'envoye' | 'ouvert' | 'repondu' | 'bounce';
export type Priority = 'high' | 'medium' | 'low';
export type PhoneType = 'pro' | 'perso' | 'unknown';
export type LeadSource = 'gmb' | 'annuaire' | 'scraping' | 'import' | 'manual';
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

export interface Lead {
  id: number;
  name: string;
  phone: string;
  phone_type?: PhoneType;
  address: string;
  city: string;
  postal_code: string;
  website: string | null;
  maps_url: string;
  rating: number | null;
  reviews_count: number | null;
  niche: string | null;
  image_url: string | null;
  siren: string | null;
  siret: string | null;
  legal_name: string | null;
  dirigeant: string | null;
  priority: Priority;
  status: LeadStatus;
  call_status: CallStatus;
  email_status: EmailStatus;
  notes: string | null;
  last_contact_at: string | null;
  next_followup_at: string | null;
  created_at: string;
  updated_at: string;
  // Enriched fields for call session
  source?: LeadSource;
  attempts_count?: number;
  attempts_30d?: number;
  score?: number;
  opening_hours?: string | null;
  best_call_time?: string | null;
  website_status?: 'none' | 'old' | 'platform' | 'modern' | null;
  has_booking?: boolean;
  has_seo?: boolean;
  last_gmb_update?: string | null;
  // Website analysis fields
  cms_type?: CMSType | null;
  has_mobile_friendly?: boolean | null;
  has_ssl?: boolean | null;
  page_load_time?: number | null;
  pain_points?: string[] | null;
}

export interface LeadSummary {
  id: number;
  name: string;
  phone: string;
  city: string;
  niche: string | null;
  priority: Priority;
  status: LeadStatus;
  call_status: CallStatus;
  rating: number | null;
  reviews_count: number | null;
  website: string | null;
  image_url: string | null;
  next_followup_at: string | null;
  created_at: string;
}

// ===== SESSION TYPES =====

export interface Session {
  id: number;
  started_at: string;
  ended_at: string | null;
  total_calls: number;
  total_reached: number;
  total_voicemail: number;
  total_scheduled: number;
  notes?: string | null;
}

// ===== STATS TYPES =====

export interface Stats {
  total: number;
  by_status: Record<LeadStatus, number>;
  by_call_status: Record<CallStatus, number>;
  by_priority: Record<Priority, number>;
  by_city?: Record<string, number>;
  followups_today: number;
  to_call: number;
}

// ===== GAMIFIED STATS TYPES =====

export interface TodayStats {
  calls: number;
  contacts: number;
  rdv: number;
  avg_duration: number;
  objective_calls: number;
}

export interface StreakInfo {
  current: number;
  best: number;
  last_activity_date: string | null;
}

export interface TopLead {
  id: number;
  name: string;
  city: string;
  niche: string | null;
  score: number;
  priority: Priority;
  has_website: boolean;
  pain_points: string[];
  phone: string;
  reason?: string;
}

export interface WeeklyPerformance {
  calls: number[];
  contacts: number[];
  labels: string[];
}

export interface LevelInfo {
  name: string;
  current_xp: number;
  next_level_xp: number;
  progress_percent: number;
}

export interface DailyPerformance {
  date: string;
  calls: number;
  contacts: number;
}

export interface GamifiedStats {
  today: TodayStats;
  streak: StreakInfo;
  top_leads: TopLead[];
  weekly_performance: WeeklyPerformance;
  conversion_rate: number;
  level: LevelInfo;
}

// ===== FOLLOWUP TYPES =====

export type FollowupUrgency = 'overdue' | 'today' | 'tomorrow' | 'week';

export interface FollowupLead extends LeadSummary {
  urgency: FollowupUrgency;
  next_followup_at: string; // Override to ensure non-null for followup leads
}

export interface FollowupsData {
  grouped: Record<FollowupUrgency, FollowupLead[]>;
  counts: {
    overdue: number;
    today: number;
    tomorrow: number;
    week: number;
    total: number;
  };
}

// ===== HISTORY TYPES =====

export type HistoryType = 'call' | 'email' | 'note' | 'status_change' | 'followup_set';

export interface HistoryEntry {
  id: number;
  lead_id: number;
  type: HistoryType;
  old_value: string | null;
  new_value: string | null;
  note: string | null;
  duration_seconds: number | null;
  created_at: string;
}

// ===== API RESPONSE TYPES =====

export interface LeadsResponse {
  leads: LeadSummary[];
  total: number;
  page: number;
  totalPages: number;
  cities: string[];
  niches: string[];
}

export interface SessionResponse {
  active: boolean;
  session: Session | null;
}

// ===== CONFIG TYPES =====

export interface ScrapeConfig {
  niches: string[];
  cities: string[];
}

export interface Config {
  input_csv: string;
  target: number;
  allowed_departments: string[];
  exclude_keywords: string[];
  scrape?: ScrapeConfig;
}

// ===== CALL OUTCOME =====

export type CallOutcome = 
  | 'injoignable'
  | 'mauvais_numero'
  | 'accueil'
  | 'decideur_absent'
  | 'rappeler'
  | 'interesse'
  | 'rdv_pris'
  | 'devis_envoye'
  | 'perdu'
  | 'opt_out';

export type OutcomeColor = 'red' | 'yellow' | 'blue' | 'green' | 'zinc' | 'purple' | 'orange';

export interface CallOutcomeOption {
  id: CallOutcome;
  label: string;
  color: OutcomeColor;
  key: string;
  icon?: string;
  requiresNextStep: boolean;
}

// ===== NEXT STEP TYPES =====

export type NextStepType = 
  | 'rappel'
  | 'email'
  | 'sms'
  | 'rdv'
  | 'tache'
  | 'aucun';

export interface NextStep {
  type: NextStepType;
  datetime?: string;
  note?: string;
  templateId?: string;
}

export type LostReason = 
  | 'pas_interesse'
  | 'budget'
  | 'timing'
  | 'concurrent'
  | 'autre';

export interface OutcomeWorkflow {
  outcome: CallOutcome;
  nextStep?: NextStep;
  lostReason?: LostReason;
  lostNote?: string;
}
