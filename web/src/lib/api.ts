import type {
  Lead,
  LeadsResponse,
  Stats,
  GamifiedStats,
  Session,
  SessionResponse,
  FollowupsData,
  HistoryEntry,
  Config,
  LeadStatus,
  CallStatus,
  CallOutcome,
  NextStep,
  LostReason,
} from '@/types';

// ===== BASE FETCH =====

async function fetchApi<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
  });
  
  if (!res.ok) {
    throw new Error(`API Error: ${res.status} ${res.statusText}`);
  }
  
  return res.json();
}

// ===== LEADS =====

export interface LeadFilters {
  // Basic filters
  status?: LeadStatus;
  call_status?: CallStatus;
  city?: string;
  niche?: string;
  priority?: 'high' | 'medium' | 'low';
  search?: string;
  
  // Boolean filters
  hasWebsite?: 'all' | 'yes' | 'no';
  hasDirigeant?: 'all' | 'yes' | 'no';
  hasSiren?: 'all' | 'yes' | 'no';
  hasPhone?: 'all' | 'yes' | 'no';
  
  // Range filters
  scoreMin?: number | null;
  scoreMax?: number | null;
  ratingMin?: number | null;
  ratingMax?: number | null;
  
  // Date filters
  createdAfter?: string;
  createdBefore?: string;
  
  // Pagination & sorting
  page?: number;
  limit?: number;
  orderBy?: string;
  orderDir?: 'asc' | 'desc';
}

export async function fetchLeads(filters: LeadFilters = {}): Promise<LeadsResponse> {
  const params = new URLSearchParams();
  
  // Basic filters
  if (filters.status) params.set('status', filters.status);
  if (filters.call_status) params.set('call_status', filters.call_status);
  if (filters.city) params.set('city', filters.city);
  if (filters.niche) params.set('niche', filters.niche);
  if (filters.priority) params.set('priority', filters.priority);
  if (filters.search) params.set('search', filters.search);
  
  // Boolean filters
  if (filters.hasWebsite && filters.hasWebsite !== 'all') params.set('hasWebsite', filters.hasWebsite);
  if (filters.hasDirigeant && filters.hasDirigeant !== 'all') params.set('hasDirigeant', filters.hasDirigeant);
  if (filters.hasSiren && filters.hasSiren !== 'all') params.set('hasSiren', filters.hasSiren);
  if (filters.hasPhone && filters.hasPhone !== 'all') params.set('hasPhone', filters.hasPhone);
  
  // Range filters
  if (filters.scoreMin !== null && filters.scoreMin !== undefined) params.set('scoreMin', filters.scoreMin.toString());
  if (filters.scoreMax !== null && filters.scoreMax !== undefined) params.set('scoreMax', filters.scoreMax.toString());
  if (filters.ratingMin !== null && filters.ratingMin !== undefined) params.set('ratingMin', filters.ratingMin.toString());
  if (filters.ratingMax !== null && filters.ratingMax !== undefined) params.set('ratingMax', filters.ratingMax.toString());
  
  // Date filters
  if (filters.createdAfter) params.set('createdAfter', filters.createdAfter);
  if (filters.createdBefore) params.set('createdBefore', filters.createdBefore);
  
  // Pagination & sorting
  if (filters.page) params.set('page', filters.page.toString());
  if (filters.limit) params.set('limit', filters.limit.toString());
  if (filters.orderBy) params.set('orderBy', filters.orderBy);
  if (filters.orderDir) params.set('orderDir', filters.orderDir);
  
  return fetchApi<LeadsResponse>(`/api/leads?${params}`);
}

export async function fetchLead(id: number | string): Promise<Lead> {
  return fetchApi<Lead>(`/api/leads/${id}`);
}

export interface FetchNextLeadOptions {
  excludeIds?: number[];
  recentNiches?: string[];
}

export async function fetchNextLead(options: FetchNextLeadOptions = {}): Promise<{ lead: Lead | null; reason?: string }> {
  const params = new URLSearchParams();
  
  if (options.excludeIds?.length) {
    params.set('exclude', options.excludeIds.join(','));
  }
  
  if (options.recentNiches?.length) {
    params.set('recentNiches', options.recentNiches.join(','));
  }
  
  const queryString = params.toString();
  return fetchApi(`/api/leads/next${queryString ? `?${queryString}` : ''}`);
}

export async function fetchLeadHistory(id: number | string): Promise<{ history: HistoryEntry[] }> {
  return fetchApi(`/api/leads/${id}/history`);
}

// ===== LEAD ACTIONS =====

export async function logLeadCall(
  id: number | string,
  callStatus: CallStatus,
  options?: { note?: string; auto_schedule?: boolean }
): Promise<void> {
  await fetchApi(`/api/leads/${id}/call`, {
    method: 'POST',
    body: JSON.stringify({
      call_status: callStatus,
      ...options,
    }),
  });
}

export async function updateLeadStatus(
  id: number | string,
  status: LeadStatus,
  note?: string
): Promise<void> {
  await fetchApi(`/api/leads/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status, note }),
  });
}

export async function scheduleLeadFollowup(
  id: number | string,
  date: string | null
): Promise<void> {
  await fetchApi(`/api/leads/${id}/followup`, {
    method: 'PATCH',
    body: JSON.stringify({ date }),
  });
}

export async function processLeadOutcome(
  id: number | string,
  outcome: CallOutcome,
  nextStep?: NextStep,
  lostReason?: LostReason,
  lostNote?: string
): Promise<void> {
  await fetchApi(`/api/leads/${id}/outcome`, {
    method: 'POST',
    body: JSON.stringify({
      outcome,
      nextStep,
      lostReason,
      lostNote,
    }),
  });
}

export async function markLeadOptOut(id: number | string): Promise<void> {
  await fetchApi(`/api/leads/${id}/optout`, {
    method: 'POST',
  });
}

export async function addLeadNote(id: number | string, note: string): Promise<void> {
  await fetchApi(`/api/leads/${id}`, {
    method: 'POST',
    body: JSON.stringify({ note }),
  });
}

// ===== STATS =====

export async function fetchStats(): Promise<Stats> {
  return fetchApi<Stats>('/api/stats');
}

export async function fetchGamifiedStats(period: string = '24h'): Promise<GamifiedStats> {
  return fetchApi<GamifiedStats>(`/api/stats/gamified?period=${period}`);
}

// ===== SESSION =====

export async function fetchSession(): Promise<SessionResponse> {
  return fetchApi<SessionResponse>('/api/session');
}

export async function startSession(): Promise<Session> {
  return fetchApi<Session>('/api/session', { method: 'POST' });
}

export async function updateSession(
  id: number,
  data: { stats?: Partial<Session>; action?: 'end' }
): Promise<Session> {
  return fetchApi<Session>('/api/session', {
    method: 'PATCH',
    body: JSON.stringify({ id, ...data }),
  });
}

export async function endSession(id: number): Promise<void> {
  await updateSession(id, { action: 'end' });
}

// ===== FOLLOWUPS =====

export async function fetchFollowups(): Promise<FollowupsData> {
  return fetchApi<FollowupsData>('/api/followups');
}

// ===== CONFIG =====

export async function fetchConfig(): Promise<Config> {
  return fetchApi<Config>('/api/config');
}

export async function updateConfig(config: Config): Promise<Config> {
  return fetchApi<Config>('/api/config', {
    method: 'PUT',
    body: JSON.stringify(config),
  });
}

// ===== SCRAPE =====

export interface ScrapeResult {
  success: boolean;
  results?: {
    total_raw: number;
    after_dedup: number;
    inserted_db: number;
  };
  error?: string;
}

export async function runScrape(
  niches: string[],
  cities: string[]
): Promise<ScrapeResult> {
  return fetchApi<ScrapeResult>('/api/scrape', {
    method: 'POST',
    body: JSON.stringify({ niches, cities }),
  });
}
