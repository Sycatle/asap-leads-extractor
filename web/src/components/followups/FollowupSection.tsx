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
      <div className={cn('px-4 py-2.5 flex items-center gap-2', config.bg)}>
        <Icon className={cn('w-4 h-4', config.color)} />
        <span className={cn('text-sm font-medium', config.color)}>{config.label}</span>
        <span className="text-xs text-muted-foreground">({leads.length})</span>
      </div>

      {/* Items */}
      <div className="bg-card divide-y divide-border">
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
    <div className="px-4 py-2.5 flex items-center gap-3 hover:bg-accent/50 transition-colors group">
      {/* Time */}
      <div
        className={cn(
          'w-16 text-xs font-medium',
          isOverdue ? 'text-danger' : 'text-muted-foreground'
        )}
      >
        {formatRelativeTime(followupDate, isOverdue)}
      </div>

      {/* Lead info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground truncate">
            {lead.name}
          </span>
          <span className={cn('text-[10px] font-medium', PRIORITY_COLORS[lead.priority])}>
            {lead.priority.toUpperCase()}
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span>{lead.city}</span>
          {lead.niche && (
            <>
              <span className="opacity-40">•</span>
              <span>{lead.niche}</span>
            </>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <a
          href={`tel:${lead.phone}`}
          className="p-1.5 rounded-lg hover:bg-success/10 text-muted-foreground hover:text-success transition-colors"
          title="Appeler"
        >
          <Phone className="w-4 h-4" />
        </a>
        <Link
          href={`/leads/${lead.id}`}
          className="p-1.5 rounded-lg hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"
          title="Voir la fiche"
        >
          <Eye className="w-4 h-4" />
        </Link>
        <button
          onClick={() => onMarkDone(lead.id)}
          disabled={loading}
          className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
          title="Marquer fait"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Check className="w-4 h-4" />
          )}
        </button>
      </div>
    </div>
  );
}
