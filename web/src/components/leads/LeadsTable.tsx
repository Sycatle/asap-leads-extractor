'use client';

import Link from 'next/link';
import { Users, Phone, ExternalLink, Eye, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import type { LeadSummary } from '@/types';
import { StatusBadge, PriorityBadge, RatingBadge } from '@/components/ui';

// ===== TABLE HEADER =====

const TABLE_HEADERS = [
  { key: 'name', label: 'Nom' },
  { key: 'city', label: 'Ville' },
  { key: 'niche', label: 'Niche' },
  { key: 'phone', label: 'Téléphone' },
  { key: 'rating', label: 'Note' },
  { key: 'status', label: 'Status' },
  { key: 'actions', label: 'Actions' },
] as const;

function TableHeader() {
  return (
    <thead className="bg-zinc-50 dark:bg-zinc-800">
      <tr>
        {TABLE_HEADERS.map((header) => (
          <th
            key={header.key}
            className="px-4 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider"
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
    <tr className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
      {/* Name & Priority */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <p className="font-medium text-zinc-900 dark:text-zinc-100">{lead.name}</p>
          {lead.priority && <PriorityBadge priority={lead.priority} />}
        </div>
      </td>

      {/* City */}
      <td className="px-4 py-3 text-sm text-zinc-600 dark:text-zinc-400">
        {lead.city || '-'}
      </td>

      {/* Niche */}
      <td className="px-4 py-3 text-sm text-zinc-600 dark:text-zinc-400">
        {lead.niche || '-'}
      </td>

      {/* Phone */}
      <td className="px-4 py-3">
        {lead.phone ? (
          <a
            href={`tel:${lead.phone}`}
            className="text-sm font-mono text-blue-600 dark:text-blue-400 hover:underline"
          >
            {lead.phone}
          </a>
        ) : (
          <span className="text-sm text-zinc-400">-</span>
        )}
      </td>

      {/* Rating */}
      <td className="px-4 py-3 text-sm">
        {lead.rating ? (
          <RatingBadge rating={lead.rating} reviewsCount={lead.reviews_count ?? undefined} />
        ) : (
          <span className="text-zinc-400">-</span>
        )}
      </td>

      {/* Status */}
      <td className="px-4 py-3">
        <StatusBadge status={lead.status} />
      </td>

      {/* Actions */}
      <td className="px-4 py-3">
        <LeadRowActions lead={lead} />
      </td>
    </tr>
  );
}

// ===== LEAD ROW ACTIONS =====

function LeadRowActions({ lead }: { lead: LeadSummary }) {
  return (
    <div className="flex items-center gap-2">
      {lead.website && (
        <a
          href={lead.website}
          target="_blank"
          rel="noopener noreferrer"
          className="p-1.5 rounded hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
          title="Voir le site"
        >
          <ExternalLink className="w-4 h-4" />
        </a>
      )}
      {lead.phone && (
        <a
          href={`tel:${lead.phone}`}
          className="p-1.5 rounded hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-500 hover:text-green-600 dark:hover:text-green-400"
          title="Appeler"
        >
          <Phone className="w-4 h-4" />
        </a>
      )}
      <Link
        href={`/leads/${lead.id}`}
        className="p-1.5 rounded hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-500 hover:text-blue-600 dark:hover:text-blue-400"
        title="Voir la fiche"
      >
        <Eye className="w-4 h-4" />
      </Link>
    </div>
  );
}

// ===== LOADING STATE =====

function TableLoading() {
  return (
    <tr>
      <td colSpan={7} className="px-4 py-12 text-center">
        <Loader2 className="w-8 h-8 animate-spin text-zinc-400 mx-auto" />
      </td>
    </tr>
  );
}

// ===== EMPTY STATE =====

function TableEmpty() {
  return (
    <tr>
      <td colSpan={7} className="px-4 py-12 text-center text-zinc-500">
        <div className="flex flex-col items-center gap-2">
          <Users className="w-12 h-12 text-zinc-300 dark:text-zinc-700" />
          <p>Aucun lead trouvé</p>
          <p className="text-sm">Lancez un scrape depuis l&apos;onglet Config</p>
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
    <div className="flex items-center justify-between px-4 py-3 border-t border-zinc-200 dark:border-zinc-800">
      <p className="text-sm text-zinc-500">
        {start} - {end} sur {total}
      </p>
      <div className="flex items-center gap-2">
        <button
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page === 1}
          className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <span className="text-sm text-zinc-600 dark:text-zinc-400">
          Page {page} / {totalPages}
        </span>
        <button
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          disabled={page === totalPages}
          className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ChevronRight className="w-5 h-5" />
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
    <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <TableHeader />
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
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
