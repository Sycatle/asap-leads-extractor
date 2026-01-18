import { AlertCircle, Clock, Calendar, ChevronRight, Check, Phone, Eye, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { cn, formatRelativeTime } from '@/lib/utils';
import { URGENCY_CONFIG, PRIORITY_COLORS } from '@/lib/constants';
import type { FollowupLead, FollowupUrgency } from '@/types';

const URGENCY_ICONS = {
  overdue: AlertCircle,
  today: Clock,
  tomorrow: Calendar,
  week: ChevronRight,
};

interface FollowupSectionProps {
  urgency: FollowupUrgency;
  leads: FollowupLead[];
  onMarkDone: (id: number) => void;
  actionLoading: number | null;
}

export function FollowupSection({
  urgency,
  leads,
  onMarkDone,
  actionLoading,
}: FollowupSectionProps) {
  const config = URGENCY_CONFIG[urgency];
  const Icon = URGENCY_ICONS[urgency];

  return (
    <div className={cn('rounded-xl border overflow-hidden', config.border)}>
      {/* Section header */}
      <div className={cn('px-4 py-3 flex items-center gap-2', config.bg)}>
        <Icon className={cn('w-5 h-5', config.color)} />
        <span className={cn('font-medium', config.color)}>{config.label}</span>
        <span className="text-sm text-zinc-500">({leads.length})</span>
      </div>

      {/* Items */}
      <div className="bg-white dark:bg-zinc-900 divide-y divide-zinc-100 dark:divide-zinc-800">
        {leads.map((lead) => (
          <FollowupSectionItem
            key={lead.id}
            lead={lead}
            urgency={urgency}
            onMarkDone={onMarkDone}
            loading={actionLoading === lead.id}
          />
        ))}
      </div>
    </div>
  );
}

interface FollowupSectionItemProps {
  lead: FollowupLead;
  urgency: FollowupUrgency;
  onMarkDone: (id: number) => void;
  loading: boolean;
}

function FollowupSectionItem({
  lead,
  urgency,
  onMarkDone,
  loading,
}: FollowupSectionItemProps) {
  const isOverdue = urgency === 'overdue';
  const followupDate = new Date(lead.next_followup_at);

  return (
    <div className="px-4 py-3 flex items-center gap-4 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
      {/* Time */}
      <div
        className={cn(
          'w-20 text-sm font-medium',
          isOverdue ? 'text-red-600 dark:text-red-400' : 'text-zinc-500'
        )}
      >
        {formatRelativeTime(followupDate, isOverdue)}
      </div>

      {/* Lead info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-zinc-900 dark:text-zinc-100 truncate">
            {lead.name}
          </span>
          <span className={cn('text-xs', PRIORITY_COLORS[lead.priority])}>
            {lead.priority.toUpperCase()}
          </span>
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
        <button
          onClick={() => onMarkDone(lead.id)}
          disabled={loading}
          className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors disabled:opacity-50"
          title="Marquer fait"
        >
          {loading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Check className="w-5 h-5" />
          )}
        </button>
      </div>
    </div>
  );
}
