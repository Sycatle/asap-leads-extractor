'use client';

import { STATUS_LABELS } from '@/lib/constants';
import { Input } from '@/components/ui';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Filter } from 'lucide-react';

interface LeadsFiltersProps {
  status: string;
  city: string;
  niche: string;
  search: string;
  cities: string[];
  niches: string[];
  onStatusChange: (value: string) => void;
  onCityChange: (value: string) => void;
  onNicheChange: (value: string) => void;
  onSearchChange: (value: string) => void;
}

export function LeadsFilters({
  status,
  city,
  niche,
  search,
  cities,
  niches,
  onStatusChange,
  onCityChange,
  onNicheChange,
  onSearchChange,
}: LeadsFiltersProps) {
  return (
    <div className="bg-card rounded-xl border border-border p-4 shadow-sm">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {/* Filter label - mobile only */}
        <div className="flex items-center gap-2 text-muted-foreground sm:hidden col-span-full">
          <Filter className="w-4 h-4" />
          <span className="text-xs font-medium">Filtres</span>
        </div>

        {/* Status filter */}
        <Select value={status || 'all'} onValueChange={(v) => onStatusChange(v === 'all' ? '' : v)}>
          <SelectTrigger className="w-full h-10 text-[13px] bg-background">
            <SelectValue placeholder="Statut" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            {Object.entries(STATUS_LABELS).map(([key, label]) => (
              <SelectItem key={key} value={key}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* City filter */}
        <Select value={city || 'all'} onValueChange={(v) => onCityChange(v === 'all' ? '' : v)}>
          <SelectTrigger className="w-full h-10 text-[13px] bg-background">
            <SelectValue placeholder="Ville" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes les villes</SelectItem>
            {cities.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Niche filter */}
        <Select value={niche || 'all'} onValueChange={(v) => onNicheChange(v === 'all' ? '' : v)}>
          <SelectTrigger className="w-full h-10 text-[13px] bg-background">
            <SelectValue placeholder="Secteur" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les secteurs</SelectItem>
            {niches.map((n) => (
              <SelectItem key={n} value={n}>
                {n}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Search - spans 2 cols on lg */}
        <div className="relative lg:col-span-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            type="text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Rechercher un lead..."
            className="pl-9 h-10 text-[13px] bg-background"
          />
        </div>
      </div>
    </div>
  );
}
