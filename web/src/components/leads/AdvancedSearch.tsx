'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Input, Button, Badge } from '@/components/ui';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Search, 
  SlidersHorizontal, 
  X, 
  ChevronDown, 
  ChevronUp,
  Star,
  Phone,
  Globe,
  Building2,
  MapPin,
  Tag,
  Clock,
  TrendingUp,
  Filter,
  Sparkles,
  RotateCcw
} from 'lucide-react';
import { 
  STATUS_LABELS, 
  CALL_STATUS_LABELS, 
  PRIORITY_LABELS,
  PRIORITY_BADGE_COLORS,
  STATUS_COLORS
} from '@/lib/constants';
import type { LeadStatus, CallStatus, Priority } from '@/types';
import { cn } from '@/lib/utils';

// Types pour les filtres avancés
export interface AdvancedFilters {
  // Filtres de base
  search: string;
  status: LeadStatus | '';
  call_status: CallStatus | '';
  priority: Priority | '';
  city: string;
  niche: string;
  
  // Filtres avancés
  hasWebsite: 'all' | 'yes' | 'no';
  hasDirigeant: 'all' | 'yes' | 'no';
  hasSiren: 'all' | 'yes' | 'no';
  hasPhone: 'all' | 'yes' | 'no';
  
  // Score
  scoreMin: number | null;
  scoreMax: number | null;
  
  // Notes Google
  ratingMin: number | null;
  ratingMax: number | null;
  
  // Dates
  createdAfter: string;
  createdBefore: string;
  
  // Tri
  orderBy: string;
  orderDir: 'asc' | 'desc';
}

// Filtres rapides prédéfinis
interface QuickFilter {
  id: string;
  label: string;
  icon: React.ReactNode;
  color: string;
  filters: Partial<AdvancedFilters>;
}

const QUICK_FILTERS: QuickFilter[] = [
  {
    id: 'hot_leads',
    label: 'Leads chauds',
    icon: <TrendingUp className="w-3 h-3" />,
    color: 'bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400',
    filters: { priority: 'high', call_status: 'non_appele' }
  },
  {
    id: 'to_call',
    label: 'À appeler',
    icon: <Phone className="w-3 h-3" />,
    color: 'bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-400',
    filters: { call_status: 'non_appele' }
  },
  {
    id: 'callback',
    label: 'Rappels',
    icon: <Clock className="w-3 h-3" />,
    color: 'bg-orange-100 text-orange-700 hover:bg-orange-200 dark:bg-orange-900/30 dark:text-orange-400',
    filters: { call_status: 'rappeler' }
  },
  {
    id: 'no_website',
    label: 'Sans site web',
    icon: <Globe className="w-3 h-3" />,
    color: 'bg-purple-100 text-purple-700 hover:bg-purple-200 dark:bg-purple-900/30 dark:text-purple-400',
    filters: { hasWebsite: 'no' }
  },
  {
    id: 'with_dirigeant',
    label: 'Avec dirigeant',
    icon: <Building2 className="w-3 h-3" />,
    color: 'bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400',
    filters: { hasDirigeant: 'yes' }
  },
  {
    id: 'high_score',
    label: 'Score élevé',
    icon: <Sparkles className="w-3 h-3" />,
    color: 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400',
    filters: { scoreMin: 70 }
  },
  {
    id: 'good_rating',
    label: '4+ étoiles',
    icon: <Star className="w-3 h-3" />,
    color: 'bg-amber-100 text-amber-700 hover:bg-amber-200 dark:bg-amber-900/30 dark:text-amber-400',
    filters: { ratingMin: 4 }
  },
  {
    id: 'nouveaux',
    label: 'Nouveaux',
    icon: <Tag className="w-3 h-3" />,
    color: 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-400',
    filters: { status: 'nouveau' }
  },
];

// Options de tri
const SORT_OPTIONS = [
  { value: 'created_at', label: 'Date de création' },
  { value: 'updated_at', label: 'Dernière mise à jour' },
  { value: 'score', label: 'Score' },
  { value: 'rating', label: 'Note Google' },
  { value: 'name', label: 'Nom' },
  { value: 'city', label: 'Ville' },
  { value: 'next_followup_at', label: 'Prochain rappel' },
];

// Valeurs par défaut
export const DEFAULT_FILTERS: AdvancedFilters = {
  search: '',
  status: '',
  call_status: '',
  priority: '',
  city: '',
  niche: '',
  hasWebsite: 'all',
  hasDirigeant: 'all',
  hasSiren: 'all',
  hasPhone: 'all',
  scoreMin: null,
  scoreMax: null,
  ratingMin: null,
  ratingMax: null,
  createdAfter: '',
  createdBefore: '',
  orderBy: 'created_at',
  orderDir: 'desc',
};

interface AdvancedSearchProps {
  filters: AdvancedFilters;
  onFiltersChange: (filters: AdvancedFilters) => void;
  cities: string[];
  niches: string[];
  total: number;
  loading?: boolean;
}

export function AdvancedSearch({
  filters,
  onFiltersChange,
  cities,
  niches,
  total,
  loading = false,
}: AdvancedSearchProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [activeQuickFilters, setActiveQuickFilters] = useState<Set<string>>(new Set());
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Debounce pour la recherche texte
  // On utilise un state local qui se synchronise avec props lors du reset uniquement
  const [searchValue, setSearchValue] = useState(filters.search);
  const debounceTimeout = useRef<NodeJS.Timeout | null>(null);
  const isInternalChange = useRef(false);

  useEffect(() => {
    if (debounceTimeout.current) {
      clearTimeout(debounceTimeout.current);
    }
    
    // Ne pas déclencher le callback si c'est une sync externe
    if (!isInternalChange.current) {
      return;
    }
    
    debounceTimeout.current = setTimeout(() => {
      if (searchValue !== filters.search) {
        onFiltersChange({ ...filters, search: searchValue });
      }
      isInternalChange.current = false;
    }, 300);
    
    return () => {
      if (debounceTimeout.current) {
        clearTimeout(debounceTimeout.current);
      }
    };
  }, [searchValue, filters, onFiltersChange]);

  // Handler pour le changement interne
  const handleSearchChange = useCallback((value: string) => {
    isInternalChange.current = true;
    setSearchValue(value);
  }, []);

  // Compte les filtres actifs
  const activeFiltersCount = [
    filters.status,
    filters.call_status,
    filters.priority,
    filters.city,
    filters.niche,
    filters.hasWebsite !== 'all',
    filters.hasDirigeant !== 'all',
    filters.hasSiren !== 'all',
    filters.hasPhone !== 'all',
    filters.scoreMin !== null,
    filters.scoreMax !== null,
    filters.ratingMin !== null,
    filters.ratingMax !== null,
    filters.createdAfter,
    filters.createdBefore,
  ].filter(Boolean).length;

  // Toggle quick filter
  const toggleQuickFilter = useCallback((quickFilter: QuickFilter) => {
    const newActive = new Set(activeQuickFilters);
    
    if (newActive.has(quickFilter.id)) {
      newActive.delete(quickFilter.id);
      // Reset les filtres associés
      const resetFilters = { ...filters };
      Object.keys(quickFilter.filters).forEach(key => {
        const k = key as keyof AdvancedFilters;
        (resetFilters as Record<string, unknown>)[k] = DEFAULT_FILTERS[k];
      });
      onFiltersChange(resetFilters);
    } else {
      newActive.add(quickFilter.id);
      onFiltersChange({ ...filters, ...quickFilter.filters });
    }
    
    setActiveQuickFilters(newActive);
  }, [filters, activeQuickFilters, onFiltersChange]);

  // Reset tous les filtres
  const resetFilters = useCallback(() => {
    onFiltersChange(DEFAULT_FILTERS);
    setActiveQuickFilters(new Set());
    isInternalChange.current = false;
    setSearchValue('');
  }, [onFiltersChange]);

  // Update un seul filtre
  const updateFilter = useCallback(<K extends keyof AdvancedFilters>(
    key: K,
    value: AdvancedFilters[K]
  ) => {
    onFiltersChange({ ...filters, [key]: value });
  }, [filters, onFiltersChange]);

  // Keyboard shortcut pour focus la recherche
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="space-y-4">
      {/* Barre de recherche principale */}
      <div className="bg-card rounded-xl border border-border p-4 shadow-sm space-y-4">
        {/* Recherche + bouton filtres */}
        <div className="flex items-center gap-3">
          {/* Input de recherche */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              ref={searchInputRef}
              type="text"
              value={searchValue}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Rechercher par nom, téléphone, ville, SIREN..."
              className="pl-10 pr-20 h-11 text-sm bg-background"
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
              {searchValue && (
                <button
                  onClick={() => {
                    isInternalChange.current = false;
                    setSearchValue('');
                    onFiltersChange({ ...filters, search: '' });
                  }}
                  className="p-1 hover:bg-muted rounded transition-colors"
                >
                  <X className="w-3.5 h-3.5 text-muted-foreground" />
                </button>
              )}
              <kbd className="hidden sm:inline-flex h-5 px-1.5 items-center gap-1 rounded border bg-muted text-[10px] font-medium text-muted-foreground">
                ⌘K
              </kbd>
            </div>
          </div>

          {/* Bouton filtres avancés */}
          <Button
            variant={showAdvanced ? 'default' : 'outline'}
            size="default"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="relative"
          >
            <SlidersHorizontal className="w-4 h-4" />
            <span className="hidden sm:inline">Filtres</span>
            {activeFiltersCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">
                {activeFiltersCount}
              </span>
            )}
            {showAdvanced ? (
              <ChevronUp className="w-4 h-4 hidden sm:block" />
            ) : (
              <ChevronDown className="w-4 h-4 hidden sm:block" />
            )}
          </Button>
        </div>

        {/* Quick filters (toujours visibles) */}
        <div className="flex flex-wrap gap-2">
          {QUICK_FILTERS.map((qf) => (
            <button
              key={qf.id}
              onClick={() => toggleQuickFilter(qf)}
              className={cn(
                'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all',
                activeQuickFilters.has(qf.id)
                  ? 'ring-2 ring-primary ring-offset-1 ring-offset-background'
                  : '',
                qf.color
              )}
            >
              {qf.icon}
              {qf.label}
            </button>
          ))}
        </div>

        {/* Filtres avancés (panneau extensible) */}
        {showAdvanced && (
          <div className="pt-4 border-t border-border space-y-4 animate-in slide-in-from-top-2 duration-200">
            {/* Ligne 1: Status, Call Status, Priority */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Statut lead</label>
                <Select 
                  value={filters.status || 'all'} 
                  onValueChange={(v) => updateFilter('status', v === 'all' ? '' : v as LeadStatus)}
                >
                  <SelectTrigger className="h-9 text-sm bg-background">
                    <SelectValue placeholder="Tous les statuts" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous les statuts</SelectItem>
                    {Object.entries(STATUS_LABELS).map(([key, label]) => (
                      <SelectItem key={key} value={key}>
                        <span className="flex items-center gap-2">
                          <span className={cn('w-2 h-2 rounded-full', STATUS_COLORS[key as LeadStatus].replace('text-', 'bg-').split(' ')[0])} />
                          {label}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Statut appel</label>
                <Select 
                  value={filters.call_status || 'all'} 
                  onValueChange={(v) => updateFilter('call_status', v === 'all' ? '' : v as CallStatus)}
                >
                  <SelectTrigger className="h-9 text-sm bg-background">
                    <SelectValue placeholder="Tous" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous</SelectItem>
                    {Object.entries(CALL_STATUS_LABELS).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Priorité</label>
                <Select 
                  value={filters.priority || 'all'} 
                  onValueChange={(v) => updateFilter('priority', v === 'all' ? '' : v as Priority)}
                >
                  <SelectTrigger className="h-9 text-sm bg-background">
                    <SelectValue placeholder="Toutes" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Toutes les priorités</SelectItem>
                    {Object.entries(PRIORITY_LABELS).map(([key, label]) => (
                      <SelectItem key={key} value={key}>
                        <span className={cn('font-medium', PRIORITY_BADGE_COLORS[key as Priority].split(' ')[1])}>
                          {label}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Ligne 2: Ville, Secteur */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <MapPin className="w-3 h-3" />
                  Ville
                </label>
                <Select 
                  value={filters.city || 'all'} 
                  onValueChange={(v) => updateFilter('city', v === 'all' ? '' : v)}
                >
                  <SelectTrigger className="h-9 text-sm bg-background">
                    <SelectValue placeholder="Toutes les villes" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Toutes les villes</SelectItem>
                    {cities.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <Tag className="w-3 h-3" />
                  Secteur
                </label>
                <Select 
                  value={filters.niche || 'all'} 
                  onValueChange={(v) => updateFilter('niche', v === 'all' ? '' : v)}
                >
                  <SelectTrigger className="h-9 text-sm bg-background">
                    <SelectValue placeholder="Tous les secteurs" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous les secteurs</SelectItem>
                    {niches.map((n) => (
                      <SelectItem key={n} value={n}>{n}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Ligne 3: Filtres booléens */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Site web</label>
                <Select 
                  value={filters.hasWebsite} 
                  onValueChange={(v) => updateFilter('hasWebsite', v as 'all' | 'yes' | 'no')}
                >
                  <SelectTrigger className="h-9 text-sm bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous</SelectItem>
                    <SelectItem value="yes">Avec site</SelectItem>
                    <SelectItem value="no">Sans site</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Dirigeant</label>
                <Select 
                  value={filters.hasDirigeant} 
                  onValueChange={(v) => updateFilter('hasDirigeant', v as 'all' | 'yes' | 'no')}
                >
                  <SelectTrigger className="h-9 text-sm bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous</SelectItem>
                    <SelectItem value="yes">Connu</SelectItem>
                    <SelectItem value="no">Inconnu</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">SIREN</label>
                <Select 
                  value={filters.hasSiren} 
                  onValueChange={(v) => updateFilter('hasSiren', v as 'all' | 'yes' | 'no')}
                >
                  <SelectTrigger className="h-9 text-sm bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous</SelectItem>
                    <SelectItem value="yes">Avec SIREN</SelectItem>
                    <SelectItem value="no">Sans SIREN</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Téléphone</label>
                <Select 
                  value={filters.hasPhone} 
                  onValueChange={(v) => updateFilter('hasPhone', v as 'all' | 'yes' | 'no')}
                >
                  <SelectTrigger className="h-9 text-sm bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous</SelectItem>
                    <SelectItem value="yes">Avec tél.</SelectItem>
                    <SelectItem value="no">Sans tél.</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Ligne 4: Score et Rating */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <Sparkles className="w-3 h-3" />
                  Score (0-100)
                </label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={filters.scoreMin ?? ''}
                    onChange={(e) => updateFilter('scoreMin', e.target.value ? parseInt(e.target.value) : null)}
                    placeholder="Min"
                    className="h-9 text-sm bg-background"
                  />
                  <span className="text-muted-foreground">—</span>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={filters.scoreMax ?? ''}
                    onChange={(e) => updateFilter('scoreMax', e.target.value ? parseInt(e.target.value) : null)}
                    placeholder="Max"
                    className="h-9 text-sm bg-background"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <Star className="w-3 h-3" />
                  Note Google (1-5)
                </label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={1}
                    max={5}
                    step={0.1}
                    value={filters.ratingMin ?? ''}
                    onChange={(e) => updateFilter('ratingMin', e.target.value ? parseFloat(e.target.value) : null)}
                    placeholder="Min"
                    className="h-9 text-sm bg-background"
                  />
                  <span className="text-muted-foreground">—</span>
                  <Input
                    type="number"
                    min={1}
                    max={5}
                    step={0.1}
                    value={filters.ratingMax ?? ''}
                    onChange={(e) => updateFilter('ratingMax', e.target.value ? parseFloat(e.target.value) : null)}
                    placeholder="Max"
                    className="h-9 text-sm bg-background"
                  />
                </div>
              </div>
            </div>

            {/* Ligne 5: Dates */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Créé après</label>
                <Input
                  type="date"
                  value={filters.createdAfter}
                  onChange={(e) => updateFilter('createdAfter', e.target.value)}
                  className="h-9 text-sm bg-background"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Créé avant</label>
                <Input
                  type="date"
                  value={filters.createdBefore}
                  onChange={(e) => updateFilter('createdBefore', e.target.value)}
                  className="h-9 text-sm bg-background"
                />
              </div>
            </div>

            {/* Ligne 6: Tri */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Trier par</label>
                <Select 
                  value={filters.orderBy} 
                  onValueChange={(v) => updateFilter('orderBy', v)}
                >
                  <SelectTrigger className="h-9 text-sm bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SORT_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Ordre</label>
                <Select 
                  value={filters.orderDir} 
                  onValueChange={(v) => updateFilter('orderDir', v as 'asc' | 'desc')}
                >
                  <SelectTrigger className="h-9 text-sm bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="desc">Décroissant</SelectItem>
                    <SelectItem value="asc">Croissant</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Résumé des filtres actifs + Reset */}
      {(activeFiltersCount > 0 || filters.search) && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-muted-foreground">
              <Filter className="w-4 h-4 inline mr-1" />
              {loading ? (
                <span className="animate-pulse">Recherche...</span>
              ) : (
                <span>
                  <strong>{total.toLocaleString('fr-FR')}</strong> résultat{total !== 1 ? 's' : ''}
                </span>
              )}
            </span>
            
            {/* Tags des filtres actifs */}
            <div className="flex flex-wrap gap-1.5">
              {filters.search && (
                <Badge variant="secondary" className="gap-1 text-xs">
                  &quot;{filters.search}&quot;
                  <X 
                    className="w-3 h-3 cursor-pointer hover:text-foreground" 
                    onClick={() => {
                      isInternalChange.current = false;
                      setSearchValue('');
                      updateFilter('search', '');
                    }}
                  />
                </Badge>
              )}
              {filters.status && (
                <Badge variant="secondary" className="gap-1 text-xs">
                  {STATUS_LABELS[filters.status]}
                  <X className="w-3 h-3 cursor-pointer hover:text-foreground" onClick={() => updateFilter('status', '')} />
                </Badge>
              )}
              {filters.call_status && (
                <Badge variant="secondary" className="gap-1 text-xs">
                  {CALL_STATUS_LABELS[filters.call_status]}
                  <X className="w-3 h-3 cursor-pointer hover:text-foreground" onClick={() => updateFilter('call_status', '')} />
                </Badge>
              )}
              {filters.priority && (
                <Badge variant="secondary" className="gap-1 text-xs">
                  {PRIORITY_LABELS[filters.priority]}
                  <X className="w-3 h-3 cursor-pointer hover:text-foreground" onClick={() => updateFilter('priority', '')} />
                </Badge>
              )}
              {filters.city && (
                <Badge variant="secondary" className="gap-1 text-xs">
                  {filters.city}
                  <X className="w-3 h-3 cursor-pointer hover:text-foreground" onClick={() => updateFilter('city', '')} />
                </Badge>
              )}
              {filters.niche && (
                <Badge variant="secondary" className="gap-1 text-xs">
                  {filters.niche}
                  <X className="w-3 h-3 cursor-pointer hover:text-foreground" onClick={() => updateFilter('niche', '')} />
                </Badge>
              )}
            </div>
          </div>
          
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={resetFilters}
            className="text-muted-foreground hover:text-foreground"
          >
            <RotateCcw className="w-3.5 h-3.5 mr-1" />
            Réinitialiser
          </Button>
        </div>
      )}
    </div>
  );
}
