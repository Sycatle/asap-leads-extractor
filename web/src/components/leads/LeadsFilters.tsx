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
    <div className="bg-card rounded-xl border border-border p-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Filter className="w-4 h-4" />
          <span className="text-xs font-medium">Filtres</span>
        </div>

        {/* Status filter */}
        <Select value={status || 'all'} onValueChange={(v) => onStatusChange(v === 'all' ? '' : v)}>
          <SelectTrigger className="w-[140px] h-9 text-[13px]">
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
          <SelectTrigger className="w-[140px] h-9 text-[13px]">
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
          <SelectTrigger className="w-[160px] h-9 text-[13px]">
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

        {/* Search */}
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            type="text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Rechercher..."
            className="pl-9 h-9 text-[13px]"
          />
        </div>
      </div>
    </div>
  );
}
