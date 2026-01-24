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
  red: 'bg-danger/10 hover:bg-danger/20 text-danger border-danger/20',
  yellow: 'bg-warning/10 hover:bg-warning/20 text-warning border-warning/20',
  blue: 'bg-primary/10 hover:bg-primary/20 text-primary border-primary/20',
  green: 'bg-success/10 hover:bg-success/20 text-success border-success/20',
  zinc: 'bg-muted hover:bg-muted/80 text-muted-foreground border-border',
  purple: 'bg-info/10 hover:bg-info/20 text-info border-info/20',
  orange: 'bg-warning/10 hover:bg-warning/20 text-warning border-warning/20',
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
          'flex flex-col items-center gap-1.5 p-2.5 rounded-lg border font-medium transition-all disabled:opacity-50',
          OUTCOME_COLORS[outcome.color]
        )}
      >
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Icon className="w-4 h-4" />
        )}
        <span className="text-[11px] leading-tight text-center">{outcome.label}</span>
        <kbd className="text-[10px] font-mono font-semibold bg-background/50 px-1.5 py-0.5 rounded uppercase">
          {outcome.key}
        </kbd>
      </button>
    );
  };

  // Pre-call state
  if (!callStarted) {
    return (
      <Card className="p-5">
        <div className="flex flex-col items-center justify-center gap-4 py-6">
          <div className="w-14 h-14 rounded-2xl bg-success/10 flex items-center justify-center">
            <Play className="w-7 h-7 text-success ml-0.5" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-foreground">Prêt à appeler ?</p>
            <p className="text-xs text-muted-foreground mt-0.5">Le timer démarrera au clic</p>
          </div>
          <button
            onClick={handleStartCall}
            className="flex items-center gap-2 px-5 py-2.5 bg-success hover:bg-success/90 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <Phone className="w-4 h-4" />
            Lancer l&apos;appel
          </button>
          <p className="text-[10px] text-muted-foreground">
            Appuyez sur <kbd className="px-1 py-0.5 bg-muted rounded text-[10px]">Entrée</kbd>
          </p>
        </div>
      </Card>
    );
  }

  // Active call state
  return (
    <Card className="p-4">
      {/* Call Timer */}
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-border">
        <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">
          Appel en cours
        </p>
        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-success/10 rounded-full">
          <Timer className="w-3.5 h-3.5 text-success animate-pulse-soft" />
          <span className="font-mono text-sm font-semibold text-success tabular-nums">
            {formatCallDuration(callDuration)}
          </span>
        </div>
      </div>

      <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium mb-3">
        Résultat
      </p>
      
      <div className="space-y-3">
        {/* Pas de contact */}
        <div>
          <p className="text-[10px] text-muted-foreground uppercase mb-1.5 font-medium">Pas de contact</p>
          <div className="grid grid-cols-2 gap-1.5">
            {noContact.map(renderOutcomeButton)}
          </div>
        </div>

        {/* Contact partiel */}
        <div>
          <p className="text-[10px] text-muted-foreground uppercase mb-1.5 font-medium">Contact partiel</p>
          <div className="grid grid-cols-3 gap-1.5">
            {partialContact.map(renderOutcomeButton)}
          </div>
        </div>

        {/* Contact positif */}
        <div>
          <p className="text-[10px] text-muted-foreground uppercase mb-1.5 font-medium">Contact positif</p>
          <div className="grid grid-cols-3 gap-1.5">
            {positiveContact.map(renderOutcomeButton)}
          </div>
        </div>

        {/* Clôture */}
        <div>
          <p className="text-[10px] text-muted-foreground uppercase mb-1.5 font-medium">Clôture</p>
          <div className="grid grid-cols-2 gap-1.5">
            {closure.map(renderOutcomeButton)}
          </div>
        </div>
      </div>
    </Card>
  );
}
