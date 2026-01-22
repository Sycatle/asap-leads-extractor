import { useState, useEffect, useCallback } from 'react';
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
  PhoneCall,
  Timer,
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
  zinc: 'bg-muted hover:bg-accent text-muted-foreground',
  purple: 'bg-purple-100 hover:bg-purple-200 text-purple-700 dark:bg-purple-900 dark:hover:bg-purple-800 dark:text-purple-300',
  orange: 'bg-orange-100 hover:bg-orange-200 text-orange-700 dark:bg-orange-900 dark:hover:bg-orange-800 dark:text-orange-300',
};

// Format call duration
function formatCallDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

interface CallOutcomesCardProps {
  onOutcome: (outcome: CallOutcome) => void;
  loading: boolean;
  leadId?: number; // Used as key in parent to reset state
}

export function CallOutcomesCard({ onOutcome, loading }: CallOutcomesCardProps) {
  const [callStarted, setCallStarted] = useState(false);
  const [callDuration, setCallDuration] = useState(0);

  // Call timer
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    
    if (callStarted) {
      interval = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [callStarted]);

  // Handle outcome selection (stops timer)
  const handleOutcome = useCallback((outcome: CallOutcome) => {
    onOutcome(outcome);
  }, [onOutcome]);

  // Start call handler
  const handleStartCall = useCallback(() => {
    setCallStarted(true);
    setCallDuration(0);
  }, []);

  // Keyboard shortcut for starting call
  useEffect(() => {
    if (callStarted) return; // Only listen when not yet started
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }
      
      if (e.key === 'Enter') {
        e.preventDefault();
        handleStartCall();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [callStarted, handleStartCall]);

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
        onClick={() => handleOutcome(outcome.id)}
        disabled={loading}
        className={`flex flex-col items-center gap-1 p-2.5 rounded-xl font-medium transition-all disabled:opacity-50 ${
          OUTCOME_COLORS[outcome.color]
        }`}
      >
        {loading ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : (
          <Icon className="w-5 h-5" />
        )}
        <span className="text-xs">{outcome.label}</span>
        <kbd className="text-xs font-mono font-bold bg-white/60 dark:bg-black/30 px-2 py-0.5 rounded uppercase">
          {outcome.key}
        </kbd>
      </button>
    );
  };

  // Pre-call state: Show "Start Call" button
  if (!callStarted) {
    return (
      <Card className="p-6">
        <div className="flex flex-col items-center justify-center gap-4 py-8">
          <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/50 flex items-center justify-center">
            <PhoneCall className="w-8 h-8 text-green-600 dark:text-green-400" />
          </div>
          <div className="text-center">
            <p className="text-sm text-muted-foreground mb-1">Prêt à appeler ?</p>
            <p className="text-xs text-zinc-400">Le timer démarrera au lancement</p>
          </div>
          <button
            onClick={handleStartCall}
            className="flex items-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-medium rounded-xl transition-colors shadow-lg shadow-green-600/25"
          >
            <Phone className="w-5 h-5" />
            Lancer l&apos;appel
          </button>
          <kbd className="text-xs text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded">
            Entrée pour lancer
          </kbd>
        </div>
      </Card>
    );
  }

  // Active call state: Show timer + outcomes
  return (
    <Card className="p-4">
      {/* Call Timer */}
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-border">
        <p className="text-xs text-muted-foreground uppercase tracking-wider">
          Appel en cours
        </p>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-green-100 dark:bg-green-900/50 rounded-full">
          <Timer className="w-4 h-4 text-green-600 dark:text-green-400 animate-pulse" />
          <span className="font-mono font-bold text-green-700 dark:text-green-300">
            {formatCallDuration(callDuration)}
          </span>
        </div>
      </div>

      <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3">
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
