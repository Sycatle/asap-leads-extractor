/**
 * Web Types - Imports from shared + UI-specific types
 * 
 * IMPORTANT: Les types de base sont définis dans shared/types.ts
 * Ce fichier ne contient que les types spécifiques au frontend (transformés, UI, API responses)
 */

// ===== RE-EXPORT FROM SHARED =====
// Types de base partagés avec le worker
export type {
  LeadStatus,
  CallStatus,
  EmailStatus,
  PhoneType,
  LeadSource,
  WebsiteStatus,
  CMSType,
} from '../../../shared/types';

// Import pour usage interne
import type {
  LeadStatus,
  CallStatus,
  EmailStatus,
  PhoneType,
  LeadSource,
  WebsiteStatus,
  CMSType,
} from '../../../shared/types';

// ===== ADDITIONAL TYPES =====
// Priority type for lead prioritization
export type Priority = 'high' | 'medium' | 'low';

// ===== LEAD TYPES (TRANSFORMED FOR FRONTEND) =====

/**
 * Lead transformé pour le frontend
 * Différences avec DbLead:
 * - has_booking, has_seo, etc. sont des boolean (pas des 0/1)
 * - pain_points est un array parsé (pas JSON string)
 */
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
  website_status?: WebsiteStatus | null;
  has_booking?: boolean;  // boolean (transformed from SQLite 0/1)
  has_seo?: boolean;      // boolean (transformed from SQLite 0/1)
  last_gmb_update?: string | null;
  // Website analysis fields
  cms_type?: CMSType | null;
  has_mobile_friendly?: boolean | null;  // boolean (transformed from SQLite 0/1)
  has_ssl?: boolean | null;              // boolean (transformed from SQLite 0/1)
  page_load_time?: number | null;
  pain_points?: string[] | null;         // parsed JSON array
}

/**
 * Version résumée d'un lead pour les listes
 */
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

// ===== GAMIFIED STATS =====

export interface TodayStats {
  calls_today: number;
  calls_goal: number;
  contacts_today: number;
  rdv_today: number;
  avg_call_duration: number;
}

export interface StreakInfo {
  current_streak: number;
  best_streak: number;
  last_activity_date: string | null;
}

export interface TopLead {
  id: number;
  name: string;
  city: string;
  niche: string | null;
  phone: string;
  score: number;
  priority: Priority;
  website: string | null;
  website_status: string | null;
  pain_points: string[] | null;
  reason: string;
  image_url: string | null;
  rating: number | null;
  reviews_count: number | null;
}

export interface WeeklyPerformance {
  calls: number[];
  contacts: number[];
  labels: string[];
}

export interface GamifiedStats {
  today: TodayStats;
  streak: StreakInfo;
  top_leads: TopLead[];
  weekly_performance: WeeklyPerformance;
  conversion_rate: number;
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
