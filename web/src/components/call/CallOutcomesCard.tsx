import { Loader2, PhoneOff, PhoneMissed, Calendar, CheckCircle2, XCircle } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { CALL_OUTCOMES } from '@/lib/constants';
import type { CallOutcome } from '@/types';

const OUTCOME_ICONS = {
  injoignable: PhoneOff,
  messagerie: PhoneMissed,
  rappeler: Calendar,
  appele: CheckCircle2,
  pas_interesse: XCircle,
};

const OUTCOME_COLORS = {
  red: 'bg-red-100 hover:bg-red-200 text-red-700 dark:bg-red-900 dark:hover:bg-red-800 dark:text-red-300',
  yellow: 'bg-yellow-100 hover:bg-yellow-200 text-yellow-700 dark:bg-yellow-900 dark:hover:bg-yellow-800 dark:text-yellow-300',
  blue: 'bg-blue-100 hover:bg-blue-200 text-blue-700 dark:bg-blue-900 dark:hover:bg-blue-800 dark:text-blue-300',
  green: 'bg-green-100 hover:bg-green-200 text-green-700 dark:bg-green-900 dark:hover:bg-green-800 dark:text-green-300',
  zinc: 'bg-zinc-100 hover:bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-zinc-300',
};

interface CallOutcomesCardProps {
  onOutcome: (outcome: CallOutcome) => void;
  loading: boolean;
}

export function CallOutcomesCard({ onOutcome, loading }: CallOutcomesCardProps) {
  return (
    <Card>
      <p className="text-xs text-zinc-500 uppercase tracking-wider mb-4">
        Résultat de l&apos;appel
      </p>
      <div className="grid grid-cols-5 gap-3">
        {CALL_OUTCOMES.map((outcome) => {
          const Icon = OUTCOME_ICONS[outcome.id];

          return (
            <button
              key={outcome.id}
              onClick={() => onOutcome(outcome.id)}
              disabled={loading}
              className={`flex flex-col items-center gap-2 p-4 rounded-xl font-medium transition-colors disabled:opacity-50 ${
                OUTCOME_COLORS[outcome.color]
              }`}
            >
              {loading ? (
                <Loader2 className="w-6 h-6 animate-spin" />
              ) : (
                <Icon className="w-6 h-6" />
              )}
              <span className="text-sm">{outcome.label}</span>
              <kbd className="text-xs opacity-50 bg-white/50 dark:bg-black/20 px-1.5 py-0.5 rounded">
                {outcome.key}
              </kbd>
            </button>
          );
        })}
      </div>
    </Card>
  );
}
