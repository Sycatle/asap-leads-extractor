'use client';

import { useState, useEffect, useCallback } from 'react';
import type { LeadsResponse, LeadStatus, CallStatus, Priority } from '@/types';
import { fetchLeads, type LeadFilters } from '@/lib/api';

export interface UseLeadsFilters {
  // Basic filters
  status?: LeadStatus | '';
  call_status?: CallStatus | '';
  city?: string;
  niche?: string;
  priority?: Priority | '';
  search?: string;
  
  // Boolean filters
  hasWebsite?: 'all' | 'yes' | 'no';
  hasDirigeant?: 'all' | 'yes' | 'no';
  hasSiren?: 'all' | 'yes' | 'no';
  hasPhone?: 'all' | 'yes' | 'no';
  hasLegalExtracted?: 'all' | 'yes' | 'no';

  // Range filters
  scoreMin?: number | null;
  scoreMax?: number | null;
  ratingMin?: number | null;
  ratingMax?: number | null;
  
  // Date filters
  createdAfter?: string;
  createdBefore?: string;
  
  // Sorting
  orderBy?: string;
  orderDir?: 'asc' | 'desc';
}

interface UseLeadsResult {
  leads: LeadsResponse['leads'];
  total: number;
  page: number;
  totalPages: number;
  cities: string[];
  niches: string[];
  loading: boolean;
  error: Error | null;
  // Actions
  setPage: (page: number) => void;
  setFilters: (filters: UseLeadsFilters) => void;
  updateFilter: <K extends keyof UseLeadsFilters>(key: K, value: UseLeadsFilters[K]) => void;
  refresh: () => Promise<void>;
}

export function useLeads(initialFilters: UseLeadsFilters = {}, limit = 20): UseLeadsResult {
  const [leads, setLeads] = useState<LeadsResponse['leads']>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [cities, setCities] = useState<string[]>([]);
  const [niches, setNiches] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [filters, setFiltersState] = useState<UseLeadsFilters>(initialFilters);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Convert UseLeadsFilters to LeadFilters for API
      const apiFilters: LeadFilters = {
        status: filters.status || undefined,
        call_status: filters.call_status || undefined,
        city: filters.city || undefined,
        niche: filters.niche || undefined,
        priority: filters.priority || undefined,
        search: filters.search || undefined,
        hasWebsite: filters.hasWebsite,
        hasDirigeant: filters.hasDirigeant,
        hasSiren: filters.hasSiren,
        hasPhone: filters.hasPhone,
        hasLegalExtracted: filters.hasLegalExtracted,
        scoreMin: filters.scoreMin,
        scoreMax: filters.scoreMax,
        ratingMin: filters.ratingMin,
        ratingMax: filters.ratingMax,
        createdAfter: filters.createdAfter,
        createdBefore: filters.createdBefore,
        orderBy: filters.orderBy,
        orderDir: filters.orderDir,
        page,
        limit,
      };
      
      const data = await fetchLeads(apiFilters);
      setLeads(data.leads);
      setTotal(data.total);
      setTotalPages(data.totalPages);
      
      if (data.cities.length > 0) setCities(data.cities);
      if (data.niches.length > 0) setNiches(data.niches);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch leads'));
    } finally {
      setLoading(false);
    }
  }, [filters, page, limit]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Reset page when filters change
  const setFilters = useCallback((newFilters: UseLeadsFilters) => {
    setFiltersState(newFilters);
    setPage(1);
  }, []);

  const updateFilter = useCallback(<K extends keyof UseLeadsFilters>(
    key: K,
    value: UseLeadsFilters[K]
  ) => {
    setFiltersState(prev => ({ ...prev, [key]: value }));
    setPage(1);
  }, []);

  return {
    leads,
    total,
    page,
    totalPages,
    cities,
    niches,
    loading,
    error,
    setPage,
    setFilters,
    updateFilter,
    refresh,
  };
}
