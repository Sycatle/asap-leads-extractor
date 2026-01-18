'use client';

import { useState } from 'react';
import { useLeads, useStats } from '@/hooks';
import { LeadsStats, LeadsFilters, LeadsTable } from '@/components/leads';
import { PageHeader } from '@/components/layout';
import { LinkButton } from '@/components/ui';
import { Download, Plus } from 'lucide-react';
import type { LeadStatus } from '@/types';

export default function LeadsPage() {
  // Local filter state for controlled inputs
  const [status, setStatus] = useState('');
  const [city, setCity] = useState('');
  const [niche, setNiche] = useState('');
  const [search, setSearch] = useState('');

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
    updateFilter,
  } = useLeads({
    status: status as LeadStatus | undefined,
    city: city || undefined,
    niche: niche || undefined,
    search: search || undefined,
  });

  // Filter change handlers that also update the hook
  const handleStatusChange = (value: string) => {
    setStatus(value);
    updateFilter('status', value as LeadStatus | undefined);
  };

  const handleCityChange = (value: string) => {
    setCity(value);
    updateFilter('city', value || undefined);
  };

  const handleNicheChange = (value: string) => {
    setNiche(value);
    updateFilter('niche', value || undefined);
  };

  const handleSearchChange = (value: string) => {
    setSearch(value);
    updateFilter('search', value || undefined);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <PageHeader 
        title="Leads"
        description={`${total} leads dans votre base de données`}
        action={
          <div className="flex items-center gap-3">
            <LinkButton href="/config" variant="secondary" size="sm" icon={<Plus className="w-4 h-4" />}>
              Scraper
            </LinkButton>
            <LinkButton href="/api/leads/export" variant="secondary" size="sm" icon={<Download className="w-4 h-4" />}>
              Exporter
            </LinkButton>
          </div>
        }
      />

      {/* Stats cards */}
      <LeadsStats stats={stats} />

      {/* Filters */}
      <LeadsFilters
        status={status}
        city={city}
        niche={niche}
        search={search}
        cities={cities}
        niches={niches}
        onStatusChange={handleStatusChange}
        onCityChange={handleCityChange}
        onNicheChange={handleNicheChange}
        onSearchChange={handleSearchChange}
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
