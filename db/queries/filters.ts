/**
 * Lead filter types + ORDER BY whitelist (anti-injection).
 * Pure module — pas de DB.
 */

import type { Lead } from '../schema';

// Columns autorisées pour ORDER BY (clé snake_case = nom DB ; mappées dans queries/leads.ts)
export const VALID_ORDER_COLUMNS = [
  'created_at',
  'updated_at',
  'score',
  'rating',
  'name',
  'city',
  'next_followup_at',
  'priority',
  'status',
  'call_status',
  'niche',
  'reviews_count',
] as const;

export type ValidOrderColumn = (typeof VALID_ORDER_COLUMNS)[number];

export function sanitizeOrderBy(column: string | undefined, fallback: ValidOrderColumn = 'created_at'): ValidOrderColumn {
  if (!column) return fallback;
  return VALID_ORDER_COLUMNS.includes(column as ValidOrderColumn) ? (column as ValidOrderColumn) : fallback;
}

export function sanitizeOrderDir(dir: string | undefined): 'ASC' | 'DESC' {
  return dir?.toLowerCase() === 'asc' ? 'ASC' : 'DESC';
}

export interface LeadFilters {
  status?: Lead['status'];
  call_status?: Lead['callStatus'];
  city?: string;
  niche?: string;
  priority?: Lead['priority'];
  search?: string;
  limit?: number;
  offset?: number;
  orderBy?: string;
  orderDir?: 'asc' | 'desc';
  includeDeleted?: boolean;
}

export interface AdvancedLeadFilters extends LeadFilters {
  hasWebsite?: 'all' | 'yes' | 'no';
  hasDirigeant?: 'all' | 'yes' | 'no';
  hasSiren?: 'all' | 'yes' | 'no';
  hasPhone?: 'all' | 'yes' | 'no';
  hasLegalExtracted?: 'all' | 'yes' | 'no';
  scoreMin?: number;
  scoreMax?: number;
  ratingMin?: number;
  ratingMax?: number;
  createdAfter?: string;
  createdBefore?: string;
}
