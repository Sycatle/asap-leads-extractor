import Link from 'next/link';
import { Phone, Eye, ExternalLink, Calendar, AlertCircle } from 'lucide-react';
import { cn, formatRelativeTime } from '@/lib/utils';
import { StatusBadge, PriorityBadge, RatingBadge } from '@/components/ui';
import type { LeadSummary, FollowupLead } from '@/types';

// ===== LEAD TABLE ROW =====

interface LeadTableRowProps {
  lead: LeadSummary;
}

export function LeadTableRow({ lead }: LeadTableRowProps) {
  return (
    <tr className="hover:bg-accent transition-colors">
      <td className="px-4 py-3">
        <div>
          <p className="font-medium text-foreground">{lead.name}</p>
          {lead.priority && (
            <PriorityBadge priority={lead.priority} />
          )}
        </div>
      </td>
      <td className="px-4 py-3 text-sm text-muted-foreground">
        {lead.city || '-'}
      </td>
      <td className="px-4 py-3 text-sm text-muted-foreground">
        {lead.niche || '-'}
      </td>
      <td className="px-4 py-3">
        {lead.phone ? (
          <a
            href={`tel:${lead.phone}`}
            className="text-sm font-mono text-primary hover:underline"
          >
            {lead.phone}
          </a>
        ) : (
          <span className="text-sm text-zinc-400">-</span>
        )}
      </td>
      <td className="px-4 py-3 text-sm">
        {lead.rating ? (
          <RatingBadge rating={lead.rating} reviewsCount={lead.reviews_count} />
        ) : (
          <span className="text-zinc-400">-</span>
        )}
      </td>
      <td className="px-4 py-3">
        <StatusBadge status={lead.status} size="sm" />
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          {lead.website && (
            <a
              href={lead.website}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground"
              title="Voir le site"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
          )}
          {lead.phone && (
            <a
              href={`tel:${lead.phone}`}
              className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-green-600"
              title="Appeler"
            >
              <Phone className="w-4 h-4" />
            </a>
          )}
          <Link
            href={`/leads/${lead.id}`}
            className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-primary"
            title="Voir la fiche"
          >
            <Eye className="w-4 h-4" />
          </Link>
        </div>
      </td>
    </tr>
  );
}

// ===== LEAD CARD (Compact view) =====

interface LeadCardProps {
  lead: LeadSummary;
  showActions?: boolean;
}

export function LeadCard({ lead, showActions = true }: LeadCardProps) {
  return (
    <div className="bg-card rounded-lg border border-border p-4 hover:border-border/80 transition-colors">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Link
              href={`/leads/${lead.id}`}
              className="font-medium text-foreground hover:text-primary truncate"
            >
              {lead.name}
            </Link>
            <StatusBadge status={lead.status} size="sm" />
          </div>
          <div className="flex items-center gap-2 text-sm text-zinc-500">
            <span>{lead.city}</span>
            {lead.niche && (
              <>
                <span>•</span>
                <span>{lead.niche}</span>
              </>
            )}
          </div>
          {lead.rating && (
            <div className="mt-1">
              <RatingBadge rating={lead.rating} reviewsCount={lead.reviews_count} />
            </div>
          )}
        </div>

        {showActions && (
          <div className="flex items-center gap-1 ml-2">
            {lead.phone && (
              <a
                href={`tel:${lead.phone}`}
                className="p-2 rounded-lg hover:bg-green-100 dark:hover:bg-green-900 text-zinc-500 hover:text-green-600"
                title="Appeler"
              >
                <Phone className="w-4 h-4" />
              </a>
            )}
            <Link
              href={`/leads/${lead.id}`}
              className="p-2 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900 text-zinc-500 hover:text-blue-600"
              title="Voir"
            >
              <Eye className="w-4 h-4" />
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

// ===== FOLLOWUP ITEM =====

interface FollowupItemProps {
  lead: FollowupLead;
}

export function FollowupItem({ lead }: FollowupItemProps) {
  const isOverdue = lead.urgency === 'overdue';
  const followupDate = new Date(lead.next_followup_at);

  return (
    <Link
      href={`/leads/${lead.id}`}
      className="flex items-center gap-3 p-2 -mx-2 rounded-lg hover:bg-accent transition-colors"
    >
      {isOverdue ? (
        <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
      ) : (
        <Calendar className="w-5 h-5 text-orange-500 flex-shrink-0" />
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-medium text-foreground truncate">
            {lead.name}
          </p>
          <PriorityBadge priority={lead.priority} />
        </div>
        <p className="text-sm text-muted-foreground truncate">
          {lead.city} {lead.niche && `• ${lead.niche}`}
        </p>
      </div>
      <span
        className={cn(
          'text-sm font-medium',
          isOverdue ? 'text-red-600 dark:text-red-400' : 'text-zinc-500'
        )}
      >
        {formatRelativeTime(followupDate, isOverdue)}
      </span>
    </Link>
  );
}

// ===== FOLLOWUP LIST ITEM (Extended) =====

interface FollowupListItemProps {
  lead: FollowupLead;
}

export function FollowupListItem({ lead }: FollowupListItemProps) {
  const isOverdue = lead.urgency === 'overdue';
  const followupDate = new Date(lead.next_followup_at);

  return (
    <div className="px-4 py-3 flex items-center gap-4 hover:bg-accent transition-colors">
      {/* Time */}
      <div className={cn('w-20 text-sm font-medium', isOverdue ? 'text-red-600 dark:text-red-400' : 'text-zinc-500')}>
        {formatRelativeTime(followupDate, isOverdue)}
      </div>

      {/* Lead info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-foreground truncate">
            {lead.name}
          </span>
          <PriorityBadge priority={lead.priority} />
        </div>
        <div className="flex items-center gap-2 text-sm text-zinc-500">
          <span>{lead.city}</span>
          {lead.niche && (
            <>
              <span>•</span>
              <span>{lead.niche}</span>
            </>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <a
          href={`tel:${lead.phone}`}
          className="p-2 rounded-lg hover:bg-green-100 dark:hover:bg-green-900 text-zinc-500 hover:text-green-600 dark:hover:text-green-400 transition-colors"
          title="Appeler"
        >
          <Phone className="w-5 h-5" />
        </a>
        <Link
          href={`/leads/${lead.id}`}
          className="p-2 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900 text-zinc-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
          title="Voir la fiche"
        >
          <Eye className="w-5 h-5" />
        </Link>
      </div>
    </div>
  );
}
