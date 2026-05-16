/**
 * Stub types for not-yet-ported features.
 * Migrés depuis l'ancien shared/queries/types.ts pour garder les routes
 * compilables. À supprimer au fil de la migration progressive.
 */

export type HistoryType = 'call' | 'email' | 'note' | 'status_change' | 'followup_set';

export interface LeadHistoryEntry {
  id: number;
  lead_id: number;
  type: HistoryType;
  old_value: string | null;
  new_value: string | null;
  note: string | null;
  duration_seconds: number | null;
  created_at: string;
}

export interface CallSession {
  id: number;
  started_at: string;
  ended_at: string | null;
  total_calls: number;
  total_reached: number;
  total_voicemail: number;
  total_scheduled: number;
}

export type StatsPeriod = '24h' | '7d' | '30d' | 'all';
export type FollowupUrgency = 'overdue' | 'today' | 'tomorrow' | 'this_week' | 'later';

export interface FollowupLead {
  id: number;
  name: string;
  phone: string;
  city: string | null;
  next_followup_at: string | null;
  call_status: string;
  status: string;
  urgency: FollowupUrgency;
}

export interface TopLead {
  id: number;
  name: string;
  score: number;
  city: string | null;
}

export interface TodayStats {
  calls_made: number;
  leads_qualified: number;
  followups_due: number;
}

export interface StreakInfo {
  current_streak: number;
  longest_streak: number;
  last_call_date: string | null;
}

export interface GamifiedStats {
  today: TodayStats;
  streak: StreakInfo;
  top_leads: TopLead[];
}

export interface ScraperNiche { id: number; name: string; enabled: boolean; priority: number }
export interface ScraperCity { id: number; name: string; enabled: boolean; department: string | null; priority: number }
export interface ScraperSettings { [key: string]: unknown }
export interface ScraperConfigFromDb {
  niches: string[];
  cities: string[];
  allowed_departments: string[];
  exclude_keywords: string[];
  settings: Record<string, unknown>;
}
