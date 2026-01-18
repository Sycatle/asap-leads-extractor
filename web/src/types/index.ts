// ===== LEAD TYPES =====

export type LeadStatus = 'nouveau' | 'contacte' | 'qualifie' | 'proposition' | 'converti' | 'perdu';
export type CallStatus = 'non_appele' | 'appele' | 'messagerie' | 'rappeler' | 'injoignable';
export type EmailStatus = 'non_envoye' | 'envoye' | 'ouvert' | 'repondu' | 'bounce';
export type Priority = 'high' | 'medium' | 'low';

export interface Lead {
  id: number;
  name: string;
  phone: string;
  address: string;
  city: string;
  postal_code: string;
  website: string | null;
  maps_url: string;
  rating: number | null;
  reviews_count: number | null;
  niche: string | null;
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

export type CallOutcome = 'injoignable' | 'messagerie' | 'rappeler' | 'appele' | 'pas_interesse';

export interface CallOutcomeOption {
  id: CallOutcome;
  label: string;
  color: 'red' | 'yellow' | 'blue' | 'green' | 'zinc';
  key: string;
}
