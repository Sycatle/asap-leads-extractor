import type {
  Lead,
  LeadsResponse,
  Stats,
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
  status?: LeadStatus;
  call_status?: CallStatus;
  city?: string;
  niche?: string;
  priority?: 'high' | 'medium' | 'low';
  search?: string;
  page?: number;
  limit?: number;
  orderBy?: string;
  orderDir?: 'asc' | 'desc';
}

export async function fetchLeads(filters: LeadFilters = {}): Promise<LeadsResponse> {
  const params = new URLSearchParams();
  
  if (filters.status) params.set('status', filters.status);
  if (filters.call_status) params.set('call_status', filters.call_status);
  if (filters.city) params.set('city', filters.city);
  if (filters.niche) params.set('niche', filters.niche);
  if (filters.priority) params.set('priority', filters.priority);
  if (filters.search) params.set('search', filters.search);
  if (filters.page) params.set('page', filters.page.toString());
  if (filters.limit) params.set('limit', filters.limit.toString());
  if (filters.orderBy) params.set('orderBy', filters.orderBy);
  if (filters.orderDir) params.set('orderDir', filters.orderDir);
  
  return fetchApi<LeadsResponse>(`/api/leads?${params}`);
}

export async function fetchLead(id: number | string): Promise<Lead> {
  return fetchApi<Lead>(`/api/leads/${id}`);
}

export async function fetchNextLead(excludeIds?: number[]): Promise<{ lead: Lead | null }> {
  const param = excludeIds?.length ? `?exclude=${excludeIds.join(',')}` : '';
  return fetchApi(`/api/leads/next${param}`);
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
