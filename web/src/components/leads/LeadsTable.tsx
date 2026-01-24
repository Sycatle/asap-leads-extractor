'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Users, Phone, ExternalLink, Eye, ChevronLeft, ChevronRight, Loader2, Building2, Star } from 'lucide-react';
import type { LeadSummary } from '@/types';
import { StatusBadge, PriorityBadge } from '@/components/ui';
import { cn } from '@/lib/utils';

// ===== LEAD AVATAR =====

function LeadAvatar({ lead }: { lead: LeadSummary }) {
  if (lead.image_url) {
    return (
      <div className="relative w-9 h-9 rounded-lg overflow-hidden shrink-0 bg-muted">
        <Image
          src={lead.image_url}
          alt={lead.name}
          fill
          className="object-cover"
          sizes="36px"
          unoptimized
        />
      </div>
    );
  }

  return (
    <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
      <Building2 className="w-4 h-4 text-muted-foreground" />
    </div>
  );
}

// ===== TABLE HEADER =====

const TABLE_HEADERS = [
  { key: 'name', label: 'Établissement', className: 'min-w-[200px]' },
  { key: 'city', label: 'Ville' },
  { key: 'niche', label: 'Secteur' },
  { key: 'phone', label: 'Téléphone' },
  { key: 'rating', label: 'Note' },
  { key: 'status', label: 'Statut' },
  { key: 'actions', label: '', className: 'w-[100px]' },
] as const;

function TableHeader() {
  return (
    <thead>
      <tr className="border-b border-border bg-muted/50">
        {TABLE_HEADERS.map((header) => (
          <th
            key={header.key}
            className={cn(
              'px-4 py-3.5 text-left text-xs font-semibold text-foreground/70 uppercase tracking-wider',
              header.className
            )}
          >
            {header.label}
          </th>
        ))}
      </tr>
    </thead>
  );
}

// ===== LEAD ROW =====

interface LeadRowProps {
  lead: LeadSummary;
}

function LeadRow({ lead }: LeadRowProps) {
  return (
    <tr className="border-b border-border last:border-0 group hover:bg-accent/50 transition-colors">
      {/* Name & Priority with Avatar */}
      <td className="px-4 py-3.5">
        <div className="flex items-center gap-3">
          <LeadAvatar lead={lead} />
          <div className="min-w-0">
            <Link 
              href={`/leads/${lead.id}`}
              className="text-sm font-medium text-foreground hover:text-primary transition-colors truncate block max-w-[200px]"
            >
              {lead.name}
            </Link>
            {lead.priority && (
              <div className="mt-0.5">
                <PriorityBadge priority={lead.priority} />
              </div>
            )}
          </div>
        </div>
      </td>

      {/* City */}
      <td className="px-4 py-3.5 text-sm text-muted-foreground">
        {lead.city || <span className="text-muted-foreground/50">-</span>}
      </td>

      {/* Niche */}
      <td className="px-4 py-3.5">
        {lead.niche ? (
          <span className="text-sm text-foreground/80">
            {lead.niche}
          </span>
        ) : (
          <span className="text-sm text-muted-foreground/50">-</span>
        )}
      </td>

      {/* Phone */}
      <td className="px-4 py-3.5">
        {lead.phone ? (
          <a
            href={`tel:${lead.phone}`}
            className="text-sm font-mono text-primary hover:text-primary/80 transition-colors font-medium"
          >
            {lead.phone}
          </a>
        ) : (
          <span className="text-sm text-muted-foreground/50">-</span>
        )}
      </td>

      {/* Rating */}
      <td className="px-4 py-3.5">
        {lead.rating ? (
          <div className="flex items-center gap-1.5">
            <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
            <span className="text-sm font-semibold text-foreground">{lead.rating}</span>
            {lead.reviews_count && (
              <span className="text-xs text-muted-foreground">({lead.reviews_count})</span>
            )}
          </div>
        ) : (
          <span className="text-sm text-muted-foreground/50">-</span>
        )}
      </td>

      {/* Status */}
      <td className="px-4 py-3.5">
        <StatusBadge status={lead.status} />
      </td>

      {/* Actions */}
      <td className="px-4 py-3.5">
        <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
          {lead.website && (
            <a
              href={lead.website}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-all"
              title="Voir le site"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
          )}
          {lead.phone && (
            <a
              href={`tel:${lead.phone}`}
              className="p-2 rounded-lg hover:bg-success/15 text-muted-foreground hover:text-success transition-all"
              title="Appeler"
            >
              <Phone className="w-4 h-4" />
            </a>
          )}
          <Link
            href={`/leads/${lead.id}`}
            className="p-2 rounded-lg hover:bg-primary/15 text-muted-foreground hover:text-primary transition-all"
            title="Voir la fiche"
          >
            <Eye className="w-4 h-4" />
          </Link>
        </div>
      </td>
    </tr>
  );
}

// ===== LOADING STATE =====

function TableLoading() {
  return (
    <tr>
      <td colSpan={7} className="px-4 py-12 text-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground mx-auto" />
      </td>
    </tr>
  );
}

// ===== EMPTY STATE =====

function TableEmpty() {
  return (
    <tr>
      <td colSpan={7} className="px-4 py-16 text-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center">
            <Users className="w-6 h-6 text-muted-foreground" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">Aucun lead trouvé</p>
            <p className="text-xs text-muted-foreground mt-0.5">Lancez un scrape depuis Configuration</p>
          </div>
        </div>
      </td>
    </tr>
  );
}

// ===== PAGINATION =====

interface PaginationProps {
  page: number;
  totalPages: number;
  total: number;
  limit: number;
  onPageChange: (page: number) => void;
}

function Pagination({ page, totalPages, total, limit, onPageChange }: PaginationProps) {
  if (totalPages <= 1) return null;

  const start = (page - 1) * limit + 1;
  const end = Math.min(page * limit, total);

  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-muted/30">
      <p className="text-sm text-muted-foreground">
        <span className="font-medium text-foreground">{start}-{end}</span> sur {total}
      </p>
      <div className="flex items-center gap-2">
        <button
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page === 1}
          className="p-2 rounded-lg hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-muted-foreground hover:text-foreground"
          aria-label="Page précédente"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-sm text-foreground font-medium px-2 min-w-[60px] text-center">
          {page} / {totalPages}
        </span>
        <button
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          disabled={page === totalPages}
          className="p-2 rounded-lg hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-muted-foreground hover:text-foreground"
          aria-label="Page suivante"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// ===== MAIN TABLE COMPONENT =====

interface LeadsTableProps {
  leads: LeadSummary[];
  loading: boolean;
  page: number;
  totalPages: number;
  total: number;
  limit?: number;
  onPageChange: (page: number) => void;
}

export function LeadsTable({
  leads,
  loading,
  page,
  totalPages,
  total,
  limit = 20,
  onPageChange,
}: LeadsTableProps) {
  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full">
          <TableHeader />
          <tbody className="divide-y divide-border">
            {loading ? (
              <TableLoading />
            ) : leads.length === 0 ? (
              <TableEmpty />
            ) : (
              leads.map((lead) => <LeadRow key={lead.id} lead={lead} />)
            )}
          </tbody>
        </table>
      </div>

      <Pagination
        page={page}
        totalPages={totalPages}
        total={total}
        limit={limit}
        onPageChange={onPageChange}
      />
    </div>
  );
}
