import {
  Loader2,
  PhoneOff,
  PhoneMissed,
  Calendar,
  CheckCircle2,
  XCircle,
  Phone,
  CalendarPlus,
  FileText,
  Ban,
  Building2,
} from 'lucide-react';
import { Card } from '@/components/ui';
import { CALL_OUTCOMES } from '@/lib/constants';
import type { CallOutcome } from '@/types';

const OUTCOME_ICONS: Record<CallOutcome, typeof PhoneOff> = {
  injoignable: PhoneOff,
  messagerie: PhoneMissed,
  mauvais_numero: Phone,
  accueil: Building2,
  rappeler: Calendar,
  interesse: CheckCircle2,
  rdv_pris: CalendarPlus,
  devis_envoye: FileText,
  perdu: XCircle,
  opt_out: Ban,
};

const OUTCOME_COLORS = {
  red: 'bg-red-100 hover:bg-red-200 text-red-700 dark:bg-red-900 dark:hover:bg-red-800 dark:text-red-300',
  yellow: 'bg-yellow-100 hover:bg-yellow-200 text-yellow-700 dark:bg-yellow-900 dark:hover:bg-yellow-800 dark:text-yellow-300',
  blue: 'bg-blue-100 hover:bg-blue-200 text-blue-700 dark:bg-blue-900 dark:hover:bg-blue-800 dark:text-blue-300',
  green: 'bg-green-100 hover:bg-green-200 text-green-700 dark:bg-green-900 dark:hover:bg-green-800 dark:text-green-300',
  zinc: 'bg-zinc-100 hover:bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-zinc-300',
  purple: 'bg-purple-100 hover:bg-purple-200 text-purple-700 dark:bg-purple-900 dark:hover:bg-purple-800 dark:text-purple-300',
  orange: 'bg-orange-100 hover:bg-orange-200 text-orange-700 dark:bg-orange-900 dark:hover:bg-orange-800 dark:text-orange-300',
};

interface CallOutcomesCardProps {
  onOutcome: (outcome: CallOutcome) => void;
  loading: boolean;
}

export function CallOutcomesCard({ onOutcome, loading }: CallOutcomesCardProps) {
  // Group outcomes by category
  const noContact = CALL_OUTCOMES.filter((o) =>
    ['injoignable', 'messagerie', 'mauvais_numero'].includes(o.id)
  );
  const partialContact = CALL_OUTCOMES.filter((o) =>
    ['accueil', 'rappeler'].includes(o.id)
  );
  const positiveContact = CALL_OUTCOMES.filter((o) =>
    ['interesse', 'rdv_pris', 'devis_envoye'].includes(o.id)
  );
  const closure = CALL_OUTCOMES.filter((o) =>
    ['perdu', 'opt_out'].includes(o.id)
  );

  const renderOutcomeButton = (outcome: (typeof CALL_OUTCOMES)[0]) => {
    const Icon = OUTCOME_ICONS[outcome.id];
    return (
      <button
        key={outcome.id}
        onClick={() => onOutcome(outcome.id)}
        disabled={loading}
        className={`flex flex-col items-center gap-1.5 p-3 rounded-xl font-medium transition-all disabled:opacity-50 ${
          OUTCOME_COLORS[outcome.color]
        }`}
      >
        {loading ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : (
          <Icon className="w-5 h-5" />
        )}
        <span className="text-xs">{outcome.label}</span>
        <kbd className="text-[10px] opacity-50 bg-white/50 dark:bg-black/20 px-1.5 py-0.5 rounded">
          {outcome.key}
        </kbd>
      </button>
    );
  };

  return (
    <Card className="p-4">
      <p className="text-xs text-zinc-500 uppercase tracking-wider mb-3">
        Résultat de l&apos;appel
      </p>
      
      <div className="space-y-3">
        {/* Pas de contact */}
        <div>
          <p className="text-[10px] text-zinc-400 uppercase mb-1.5">Pas de contact</p>
          <div className="grid grid-cols-3 gap-2">
            {noContact.map(renderOutcomeButton)}
          </div>
        </div>

        {/* Contact partiel */}
        <div>
          <p className="text-[10px] text-zinc-400 uppercase mb-1.5">Contact partiel</p>
          <div className="grid grid-cols-2 gap-2">
            {partialContact.map(renderOutcomeButton)}
          </div>
        </div>

        {/* Contact positif */}
        <div>
          <p className="text-[10px] text-zinc-400 uppercase mb-1.5">Contact positif</p>
          <div className="grid grid-cols-3 gap-2">
            {positiveContact.map(renderOutcomeButton)}
          </div>
        </div>

        {/* Clôture */}
        <div>
          <p className="text-[10px] text-zinc-400 uppercase mb-1.5">Clôture</p>
          <div className="grid grid-cols-2 gap-2">
            {closure.map(renderOutcomeButton)}
          </div>
        </div>
      </div>
    </Card>
  );
}
