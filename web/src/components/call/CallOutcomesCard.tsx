import { useState, useEffect, useCallback } from 'react';
import {
  Loader2,
  PhoneOff,
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
  Play,
} from 'lucide-react';
import { Card } from '@/components/ui';
import { CALL_OUTCOMES } from '@/lib/constants';
import { cn } from '@/lib/utils';
import type { CallOutcome } from '@/types';

const OUTCOME_ICONS: Record<CallOutcome, typeof PhoneOff> = {
  injoignable: PhoneOff,
  mauvais_numero: Phone,
  accueil: Building2,
  decideur_absent: PhoneCall,
  rappeler: Calendar,
  interesse: CheckCircle2,
  rdv_pris: CalendarPlus,
  devis_envoye: FileText,
  perdu: XCircle,
  opt_out: Ban,
};

const OUTCOME_COLORS: Record<string, string> = {
  red: 'bg-danger/15 hover:bg-danger/25 text-danger border-danger/30 hover:border-danger/50',
  yellow: 'bg-warning/15 hover:bg-warning/25 text-warning border-warning/30 hover:border-warning/50',
  blue: 'bg-primary/15 hover:bg-primary/25 text-primary border-primary/30 hover:border-primary/50',
  green: 'bg-success/15 hover:bg-success/25 text-success border-success/30 hover:border-success/50',
  zinc: 'bg-muted hover:bg-muted/80 text-foreground border-border hover:border-border',
  purple: 'bg-info/15 hover:bg-info/25 text-info border-info/30 hover:border-info/50',
  orange: 'bg-warning/15 hover:bg-warning/25 text-warning border-warning/30 hover:border-warning/50',
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
  leadId?: number;
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

  // Handle outcome selection
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
    if (callStarted) return;
    
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
    ['injoignable', 'mauvais_numero'].includes(o.id)
  );
  const partialContact = CALL_OUTCOMES.filter((o) =>
    ['accueil', 'decideur_absent', 'rappeler'].includes(o.id)
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
        className={cn(
          'flex flex-col items-center gap-2 p-3 rounded-xl border-2 font-medium transition-all disabled:opacity-50 hover:scale-[1.02] active:scale-[0.98]',
          OUTCOME_COLORS[outcome.color]
        )}
      >
        {loading ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : (
          <Icon className="w-5 h-5" />
        )}
        <span className="text-xs leading-tight text-center font-semibold">{outcome.label}</span>
        <kbd className="text-[10px] font-mono font-bold bg-background/60 px-2 py-0.5 rounded-md uppercase border border-current/20">
          {outcome.key}
        </kbd>
      </button>
    );
  };

  // Pre-call state
  if (!callStarted) {
    return (
      <Card className="p-6">
        <div className="flex flex-col items-center justify-center gap-5 py-8">
          <div className="w-16 h-16 rounded-2xl bg-success/15 flex items-center justify-center">
            <Play className="w-8 h-8 text-success ml-0.5" />
          </div>
          <div className="text-center space-y-1">
            <p className="text-base font-semibold text-foreground">Prêt à appeler ?</p>
            <p className="text-sm text-muted-foreground">Le timer démarrera automatiquement</p>
          </div>
          <button
            onClick={handleStartCall}
            className="flex items-center gap-2.5 px-6 py-3 bg-success hover:bg-success/90 text-white text-sm font-semibold rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-success/25"
          >
            <Phone className="w-5 h-5" />
            Lancer l&apos;appel
          </button>
          <p className="text-xs text-muted-foreground">
            ou appuyez sur <kbd className="px-1.5 py-0.5 bg-muted rounded-md text-xs font-mono font-semibold border border-border">Entrée</kbd>
          </p>
        </div>
      </Card>
    );
  }

  // Active call state
  return (
    <Card className="p-5">
      {/* Call Timer */}
      <div className="flex items-center justify-between mb-5 pb-4 border-b border-border">
        <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
          Appel en cours
        </p>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-success/15 rounded-full border border-success/30">
          <Timer className="w-4 h-4 text-success animate-pulse-soft" />
          <span className="font-mono text-sm font-bold text-success tabular-nums">
            {formatCallDuration(callDuration)}
          </span>
        </div>
      </div>

      <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-4">
        Résultat de l&apos;appel
      </p>
      
      <div className="space-y-4">
        {/* Pas de contact */}
        <div>
          <p className="text-[11px] text-muted-foreground uppercase mb-2 font-semibold tracking-wide">Pas de contact</p>
          <div className="grid grid-cols-2 gap-2">
            {noContact.map(renderOutcomeButton)}
          </div>
        </div>

        {/* Contact partiel */}
        <div>
          <p className="text-[11px] text-muted-foreground uppercase mb-2 font-semibold tracking-wide">Contact partiel</p>
          <div className="grid grid-cols-3 gap-2">
            {partialContact.map(renderOutcomeButton)}
          </div>
        </div>

        {/* Contact positif */}
        <div>
          <p className="text-[11px] text-muted-foreground uppercase mb-2 font-semibold tracking-wide">Contact positif</p>
          <div className="grid grid-cols-3 gap-2">
            {positiveContact.map(renderOutcomeButton)}
          </div>
        </div>

        {/* Clôture */}
        <div>
          <p className="text-[11px] text-muted-foreground uppercase mb-2 font-semibold tracking-wide">Clôture</p>
          <div className="grid grid-cols-2 gap-2">
            {closure.map(renderOutcomeButton)}
          </div>
        </div>
      </div>
    </Card>
  );
}
