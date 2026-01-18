import { PhoneCall, Send, MessageSquare, CheckCircle2, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardHeader } from '@/components/ui';
import { HISTORY_TYPE_LABELS, HISTORY_TYPE_COLORS } from '@/lib/constants';
import type { HistoryEntry, HistoryType } from '@/types';

const HISTORY_ICONS: Record<HistoryType, React.ReactNode> = {
  call: <PhoneCall className="w-4 h-4" />,
  email: <Send className="w-4 h-4" />,
  note: <MessageSquare className="w-4 h-4" />,
  status_change: <CheckCircle2 className="w-4 h-4" />,
  followup_set: <Calendar className="w-4 h-4" />,
};

interface LeadHistoryProps {
  history: HistoryEntry[];
}

export function LeadHistory({ history }: LeadHistoryProps) {
  return (
    <Card>
      <CardHeader title="Historique" />

      {history.length > 0 ? (
        <div className="space-y-4">
          {history.map((entry) => (
            <HistoryItem key={entry.id} entry={entry} />
          ))}
        </div>
      ) : (
        <p className="text-sm text-zinc-400 italic">Aucun historique</p>
      )}
    </Card>
  );
}

interface HistoryItemProps {
  entry: HistoryEntry;
}

function HistoryItem({ entry }: HistoryItemProps) {
  return (
    <div className="flex gap-3">
      <div className={cn('p-2 rounded-lg', HISTORY_TYPE_COLORS[entry.type])}>
        {HISTORY_ICONS[entry.type]}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
            {HISTORY_TYPE_LABELS[entry.type]}
          </span>
          {entry.old_value && entry.new_value && (
            <span className="text-xs text-zinc-500">
              {entry.old_value} → {entry.new_value}
            </span>
          )}
        </div>
        {entry.note && (
          <p className="text-sm text-zinc-600 dark:text-zinc-400 truncate">
            {entry.note}
          </p>
        )}
        <p className="text-xs text-zinc-400">
          {new Date(entry.created_at).toLocaleString('fr-FR')}
        </p>
      </div>
    </div>
  );
}
