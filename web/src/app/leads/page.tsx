'use client';

import { useState, useCallback } from 'react';
import { useLeads, useStats } from '@/hooks';
import { LeadsStats, LeadsTable, AdvancedSearch, DEFAULT_FILTERS, type AdvancedFilters } from '@/components/leads';
import { PageHeader } from '@/components/layout';
import { LinkButton } from '@/components/ui';
import { Download, Settings } from 'lucide-react';

export default function LeadsPage() {
  // State for advanced filters
  const [filters, setFilters] = useState<AdvancedFilters>(DEFAULT_FILTERS);

  // Fetch stats
  const { stats } = useStats();

  // Fetch leads with filters
  const {
    leads,
    total,
    page,
    totalPages,
    cities,
    niches,
    loading,
    setPage,
    setFilters: setHookFilters,
  } = useLeads({
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
    scoreMin: filters.scoreMin,
    scoreMax: filters.scoreMax,
    ratingMin: filters.ratingMin,
    ratingMax: filters.ratingMax,
    createdAfter: filters.createdAfter,
    createdBefore: filters.createdBefore,
    orderBy: filters.orderBy,
    orderDir: filters.orderDir,
  });

  // Handle filter changes
  const handleFiltersChange = useCallback((newFilters: AdvancedFilters) => {
    setFilters(newFilters);
    // Trigger a refresh via the hook
    setHookFilters({
      status: newFilters.status || undefined,
      call_status: newFilters.call_status || undefined,
      city: newFilters.city || undefined,
      niche: newFilters.niche || undefined,
      priority: newFilters.priority || undefined,
      search: newFilters.search || undefined,
      hasWebsite: newFilters.hasWebsite,
      hasDirigeant: newFilters.hasDirigeant,
      hasSiren: newFilters.hasSiren,
      hasPhone: newFilters.hasPhone,
      scoreMin: newFilters.scoreMin,
      scoreMax: newFilters.scoreMax,
      ratingMin: newFilters.ratingMin,
      ratingMax: newFilters.ratingMax,
      createdAfter: newFilters.createdAfter,
      createdBefore: newFilters.createdBefore,
      orderBy: newFilters.orderBy,
      orderDir: newFilters.orderDir,
    });
  }, [setHookFilters]);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <PageHeader 
        title="Leads"
        description={`${total.toLocaleString('fr-FR')} leads dans votre base`}
        action={
          <div className="flex items-center gap-2">
            <LinkButton href="/config" variant="outline" size="sm" icon={<Settings className="w-4 h-4" />}>
              Scraper
            </LinkButton>
            <LinkButton href="/api/leads/export" variant="outline" size="sm" icon={<Download className="w-4 h-4" />}>
              Exporter
            </LinkButton>
          </div>
        }
      />

      {/* Stats cards */}
      <LeadsStats stats={stats} />

      {/* Advanced Search */}
      <AdvancedSearch
        filters={filters}
        onFiltersChange={handleFiltersChange}
        cities={cities}
        niches={niches}
        total={total}
        loading={loading}
      />

      {/* Table */}
      <LeadsTable
        leads={leads}
        loading={loading}
        page={page}
        totalPages={totalPages}
        total={total}
        onPageChange={setPage}
      />
    </div>
  );
}
