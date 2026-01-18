'use client';

import { useState } from 'react';
import { Phone, Mail, MessageSquare, FileText, Calendar, ChevronRight } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui';
import { HISTORY_TYPE_LABELS, HISTORY_TYPE_COLORS } from '@/lib/constants';
import type { HistoryEntry } from '@/types';

interface LeadHistoryCompactProps {
  history: HistoryEntry[];
  maxItems?: number;
}

const HISTORY_ICONS: Record<string, typeof Phone> = {
  call: Phone,
  email: Mail,
  note: MessageSquare,
  status_change: FileText,
  followup_set: Calendar,
};

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));

  if (diffDays === 0) {
    return `Aujourd'hui ${date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
  } else if (diffDays === 1) {
    return 'Hier';
  } else if (diffDays < 7) {
    return `Il y a ${diffDays} jours`;
  } else {
    return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  }
}

function HistoryItem({ entry, compact = false }: { entry: HistoryEntry; compact?: boolean }) {
  const Icon = HISTORY_ICONS[entry.type] || MessageSquare;
  const colorClass = HISTORY_TYPE_COLORS[entry.type] || HISTORY_TYPE_COLORS.note;

  return (
    <div className={`flex items-start gap-3 ${compact ? 'py-2' : 'py-3'}`}>
      <div className={`p-1.5 rounded-lg ${colorClass}`}>
        <Icon className="w-3.5 h-3.5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
            {HISTORY_TYPE_LABELS[entry.type] || entry.type}
          </span>
          <span className="text-xs text-zinc-500 shrink-0">
            {formatDate(entry.created_at)}
          </span>
        </div>
        {entry.new_value && (
          <p className="text-xs text-zinc-500 mt-0.5 truncate">
            {entry.new_value}
          </p>
        )}
        {entry.note && (
          <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-0.5 line-clamp-2">
            {entry.note}
          </p>
        )}
      </div>
    </div>
  );
}

export function LeadHistoryCompact({ history, maxItems = 3 }: LeadHistoryCompactProps) {
  const [showFullHistory, setShowFullHistory] = useState(false);
  
  const displayHistory = history.slice(0, maxItems);
  const hasMore = history.length > maxItems;

  if (history.length === 0) {
    return (
      <div className="text-center py-4 text-sm text-zinc-500">
        Aucun historique
      </div>
    );
  }

  return (
    <>
      <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
        {displayHistory.map((entry) => (
          <HistoryItem key={entry.id} entry={entry} compact />
        ))}
      </div>

      {hasMore && (
        <button
          onClick={() => setShowFullHistory(true)}
          className="w-full flex items-center justify-center gap-1 py-2 text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 transition-colors"
        >
          Voir tout ({history.length})
          <ChevronRight className="w-4 h-4" />
        </button>
      )}

      {/* Full history modal */}
      <Dialog open={showFullHistory} onOpenChange={setShowFullHistory}>
        <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Historique complet</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto divide-y divide-zinc-100 dark:divide-zinc-800">
            {history.map((entry) => (
              <HistoryItem key={entry.id} entry={entry} />
            ))}
          </div>
          <div className="pt-4 flex justify-end">
            <Button variant="outline" onClick={() => setShowFullHistory(false)}>
              Fermer
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
