'use client';

import { STATUS_LABELS } from '@/lib/constants';
import { NativeSelect, Input } from '@/components/ui';

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
    <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-4">
      <div className="flex flex-wrap items-center gap-4">
        <span className="text-sm text-zinc-500">Filtres:</span>

        {/* Status filter */}
        <NativeSelect
          value={status}
          onChange={(e) => onStatusChange(e.target.value)}
          className="w-auto"
        >
          <option value="">Tous les status</option>
          {Object.entries(STATUS_LABELS).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </NativeSelect>

        {/* City filter */}
        <NativeSelect
          value={city}
          onChange={(e) => onCityChange(e.target.value)}
          className="w-auto"
        >
          <option value="">Toutes les villes</option>
          {cities.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </NativeSelect>

        {/* Niche filter */}
        <NativeSelect
          value={niche}
          onChange={(e) => onNicheChange(e.target.value)}
          className="w-auto"
        >
          <option value="">Toutes les niches</option>
          {niches.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </NativeSelect>

        {/* Search */}
        <Input
          type="text"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Rechercher..."
          className="flex-1 min-w-[150px]"
        />
      </div>
    </div>
  );
}
