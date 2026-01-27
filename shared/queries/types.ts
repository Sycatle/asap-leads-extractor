/**
 * Shared Query Types
 * Types utilisés par les fonctions de requête centralisées
 */

import type { DbLead, LeadStatus, CallStatus } from '../types.js';

// ===== TRANSFORMATION =====

/**
 * Lead transformé pour le frontend
 * Différences avec DbLead:
 * - has_booking, has_seo, etc. sont des boolean (pas des 0/1)
 * - pain_points est un array parsé (pas JSON string)
 */
export interface Lead extends Omit<DbLead, 'has_booking' | 'has_seo' | 'has_mobile_friendly' | 'has_ssl' | 'pain_points' | 'opt_out'> {
  has_booking: boolean;
  has_seo: boolean;
  has_mobile_friendly: boolean | null;
  has_ssl: boolean | null;
  pain_points: string[] | null;
  opt_out: boolean;
}

/**
 * Transforme un DbLead (SQLite) en Lead (frontend-friendly)
 */
export function transformDbLead(dbLead: DbLead): Lead {
  return {
    ...dbLead,
    has_booking: Boolean(dbLead.has_booking),
    has_seo: Boolean(dbLead.has_seo),
    has_mobile_friendly: dbLead.has_mobile_friendly !== null ? Boolean(dbLead.has_mobile_friendly) : null,
    has_ssl: dbLead.has_ssl !== null ? Boolean(dbLead.has_ssl) : null,
    opt_out: Boolean(dbLead.opt_out),
    pain_points: dbLead.pain_points ? JSON.parse(dbLead.pain_points) : null,
  };
}

// ===== FILTERS =====

export interface LeadFilters {
  status?: LeadStatus;
  call_status?: CallStatus;
  city?: string;
  niche?: string;
  priority?: 'high' | 'medium' | 'low';
  search?: string;
  limit?: number;
  offset?: number;
  orderBy?: string;
  orderDir?: 'asc' | 'desc';
  includeDeleted?: boolean;
}

export interface AdvancedLeadFilters extends LeadFilters {
  // Boolean filters
  hasWebsite?: 'all' | 'yes' | 'no';
  hasDirigeant?: 'all' | 'yes' | 'no';
  hasSiren?: 'all' | 'yes' | 'no';
  hasPhone?: 'all' | 'yes' | 'no';
  
  // Range filters
  scoreMin?: number;
  scoreMax?: number;
  ratingMin?: number;
  ratingMax?: number;
  
  // Date filters
  createdAfter?: string;
  createdBefore?: string;
}

// ===== HISTORY =====

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

// ===== SESSIONS =====

export interface CallSession {
  id: number;
  started_at: string;
  ended_at: string | null;
  total_calls: number;
  total_reached: number;
  total_voicemail: number;
  total_scheduled: number;
  notes: string | null;
}

// ===== STATS =====

export interface LeadStats {
  total: number;
  by_status: Record<LeadStatus, number>;
  by_call_status: Record<CallStatus, number>;
  by_priority: Record<string, number>;
  by_city: Record<string, number>;
  followups_today: number;
  to_call: number;
}

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
  priority: string;
  website: string | null;
  website_status: string | null;
  pain_points: string[] | null;
  reason: string;
  image_url: string | null;
  rating: number | null;
  reviews_count: number | null;
}

export interface GamifiedStats {
  today: TodayStats;
  streak: StreakInfo;
  top_leads: TopLead[];
  weekly_performance: {
    calls: number[];
    contacts: number[];
    labels: string[];
  };
  conversion_rate: number;
}

export type StatsPeriod = '24h' | '7d' | '30d' | 'all';

// ===== FOLLOWUPS =====

export type FollowupUrgency = 'overdue' | 'today' | 'tomorrow' | 'week';

export interface FollowupLead extends DbLead {
  urgency: FollowupUrgency;
}
