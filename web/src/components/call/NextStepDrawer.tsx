'use client';

import { useState, useCallback, useEffect } from 'react';
import {
  Calendar,
  Mail,
  MessageSquare,
  Clock,
  CalendarPlus,
  CheckCircle2,
  X,
  AlertTriangle,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button, Card, Input, Textarea } from '@/components/ui';
import { Label } from '@/components/ui/form-extensions';
import { OUTCOME_WORKFLOWS, LOST_REASONS } from '@/lib/constants';
import type { CallOutcome, NextStep, NextStepType, LostReason } from '@/types';

interface NextStepDrawerProps {
  isOpen: boolean;
  outcome: CallOutcome | null;
  leadName: string;
  onConfirm: (nextStep: NextStep, lostReason?: LostReason, lostNote?: string) => void;
  onClose: () => void;
  loading?: boolean;
}

const NEXT_STEP_OPTIONS: { id: NextStepType; label: string; icon: typeof Calendar; color: string }[] = [
  { id: 'rappel', label: 'Rappeler', icon: Clock, color: 'bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900 dark:text-blue-300' },
  { id: 'email', label: 'Email', icon: Mail, color: 'bg-purple-100 text-purple-700 hover:bg-purple-200 dark:bg-purple-900 dark:text-purple-300' },
  { id: 'sms', label: 'SMS', icon: MessageSquare, color: 'bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900 dark:text-green-300' },
  { id: 'rdv', label: 'RDV', icon: CalendarPlus, color: 'bg-orange-100 text-orange-700 hover:bg-orange-200 dark:bg-orange-900 dark:text-orange-300' },
  { id: 'tache', label: 'Tâche', icon: CheckCircle2, color: 'bg-muted text-muted-foreground hover:bg-accent' },
];

const QUICK_DELAYS: Record<string, { label: string; value: number | 'tomorrow' | 'in2days' | 'nextweek' }[]> = {
  injoignable: [
    { label: '+1h', value: 1 },
    { label: '+2h', value: 2 },
    { label: 'Demain 10h', value: 'tomorrow' },
    { label: '+2j', value: 'in2days' },
  ],
  accueil: [
    { label: 'Demain 10h', value: 'tomorrow' },
    { label: '+2j', value: 'in2days' },
    { label: '+1 sem', value: 'nextweek' },
  ],
  decideur_absent: [
    { label: 'Demain 10h', value: 'tomorrow' },
    { label: '+2j', value: 'in2days' },
    { label: '+1 sem', value: 'nextweek' },
  ],
  default: [
    { label: '+1h', value: 1 },
    { label: '+2h', value: 2 },
    { label: 'Demain 10h', value: 'tomorrow' },
    { label: '+2j', value: 'in2days' },
    { label: '+1 sem', value: 'nextweek' },
  ],
};

// Skip weekends: if date falls on Saturday, move to Monday; if Sunday, move to Monday
function skipWeekend(date: Date): Date {
  const day = date.getDay();
  if (day === 6) { // Saturday -> Monday
    date.setDate(date.getDate() + 2);
  } else if (day === 0) { // Sunday -> Monday
    date.setDate(date.getDate() + 1);
  }
  return date;
}

function getDefaultDate(delayHours: number | 'tomorrow' | 'in2days' | 'nextweek'): string {
  const now = new Date();
  
  if (delayHours === 'tomorrow') {
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(10, 0, 0, 0);
    return skipWeekend(tomorrow).toISOString().slice(0, 16);
  }
  
  if (delayHours === 'in2days') {
    const target = new Date(now);
    target.setDate(target.getDate() + 2);
    target.setHours(10, 0, 0, 0);
    return skipWeekend(target).toISOString().slice(0, 16);
  }
  
  if (delayHours === 'nextweek') {
    const target = new Date(now);
    target.setDate(target.getDate() + 7);
    target.setHours(10, 0, 0, 0);
    return skipWeekend(target).toISOString().slice(0, 16);
  }
  
  // For hour-based delays, add hours then skip weekend if needed
  now.setHours(now.getHours() + delayHours);
  return skipWeekend(now).toISOString().slice(0, 16);
}

export function NextStepDrawer({
  isOpen,
  outcome,
  leadName,
  onConfirm,
  onClose,
  loading,
}: NextStepDrawerProps) {
  const [selectedType, setSelectedType] = useState<NextStepType | null>(null);
  const [datetime, setDatetime] = useState('');
  const [note, setNote] = useState('');
  const [lostReason, setLostReason] = useState<LostReason | null>(null);
  const [lostNote, setLostNote] = useState('');

  // Reset state when opening
  useEffect(() => {
    if (isOpen && outcome) {
      setSelectedType(null);
      setDatetime('');
      setNote('');
      setLostReason(null);
      setLostNote('');

      // Auto-select suggested next step if only one
      const workflow = OUTCOME_WORKFLOWS[outcome];
      if (workflow?.suggestedNextSteps.length === 1) {
        setSelectedType(workflow.suggestedNextSteps[0] as NextStepType);
        // Set default datetime
        if (workflow.defaultDelay === '+1d') {
          setDatetime(getDefaultDate('tomorrow'));
        } else if (workflow.defaultDelay === '+2d') {
          setDatetime(getDefaultDate('in2days'));
        }
      }
    }
  }, [isOpen, outcome]);

  const handleQuickDelay = useCallback((delay: number | 'tomorrow' | 'in2days' | 'nextweek') => {
    setDatetime(getDefaultDate(delay));
  }, []);

  const handleConfirm = useCallback(() => {
    // For "perdu", we need a lost reason
    if (outcome === 'perdu') {
      if (!lostReason) return;
      onConfirm({ type: 'aucun' }, lostReason, lostNote);
      return;
    }

    // For outcomes that don't require next step
    if (outcome && !OUTCOME_WORKFLOWS[outcome]?.suggestedNextSteps.length) {
      onConfirm({ type: 'aucun' });
      return;
    }

    // For outcomes that require next step
    if (!selectedType) return;
    onConfirm({
      type: selectedType,
      datetime: datetime || undefined,
      note: note || undefined,
    });
  }, [outcome, selectedType, datetime, note, lostReason, lostNote, onConfirm]);

  const getTitle = () => {
    switch (outcome) {
      case 'injoignable':
        return 'Planifier le rappel';
      case 'accueil':
        return 'Action suite accueil';
      case 'decideur_absent':
        return 'Décideur absent';
      case 'rappeler':
        return 'Quand rappeler ?';
      case 'interesse':
        return 'Prochaine étape commerciale';
      case 'rdv_pris':
        return 'Confirmer le RDV';
      case 'devis_envoye':
        return 'Planifier le suivi devis';
      case 'perdu':
        return 'Raison de la perte';
      default:
        return 'Prochaine étape';
    }
  };

  const getDescription = () => {
    switch (outcome) {
      case 'injoignable':
        return `${leadName} n'a pas décroché. Planifiez une nouvelle tentative.`;
      case 'accueil':
        return `Vous avez eu l'accueil. Quelle action pour joindre le décideur ?`;
      case 'decideur_absent':
        return `Le décideur n'est pas disponible. Quand le rappeler ?`;
      case 'interesse':
        return `${leadName} est intéressé ! Quelle est la prochaine étape ?`;
      case 'rdv_pris':
        return `Super ! Configurez le RDV avec ${leadName}.`;
      case 'devis_envoye':
        return `Devis envoyé à ${leadName}. Planifiez les relances.`;
      case 'perdu':
        return `Pourquoi ${leadName} n'est plus une opportunité ?`;
      default:
        return '';
    }
  };

  // For "perdu" outcome, show lost reason selector
  if (outcome === 'perdu') {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-zinc-500" />
              {getTitle()}
            </DialogTitle>
            <DialogDescription>{getDescription()}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-2">
              {LOST_REASONS.map((reason) => (
                <button
                  key={reason.id}
                  onClick={() => setLostReason(reason.id as LostReason)}
                  className={`p-3 rounded-lg text-sm font-medium transition-all ${
                    lostReason === reason.id
                      ? 'bg-foreground text-background'
                      : 'bg-muted text-foreground hover:bg-accent'
                  }`}
                >
                  {reason.label}
                </button>
              ))}
            </div>

            <div>
              <Label>Note (optionnel)</Label>
              <Textarea
                value={lostNote}
                onChange={(e) => setLostNote(e.target.value)}
                placeholder="Détails supplémentaires..."
                rows={2}
              />
            </div>

            {/* Option rappel long terme */}
            <Card className="p-3 bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  className="rounded"
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedType('rappel');
                      // 90 jours, mais on évite le weekend
                      const target = new Date();
                      target.setDate(target.getDate() + 90);
                      target.setHours(10, 0, 0, 0);
                      setDatetime(skipWeekend(target).toISOString().slice(0, 16));
                    } else {
                      setSelectedType(null);
                      setDatetime('');
                    }
                  }}
                />
                <span className="text-blue-700 dark:text-blue-300">
                  Rappeler dans 3 mois (opportunité future)
                </span>
              </label>
            </Card>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>
              Annuler
            </Button>
            <Button onClick={handleConfirm} disabled={!lostReason || loading}>
              {loading ? 'En cours...' : 'Confirmer'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // For opt_out or mauvais_numero, auto-confirm
  if (outcome === 'opt_out' || outcome === 'mauvais_numero') {
    return null;
  }

  const workflow = outcome ? OUTCOME_WORKFLOWS[outcome] : null;
  const suggestedSteps = workflow?.suggestedNextSteps || [];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{getTitle()}</DialogTitle>
          <DialogDescription>{getDescription()}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Next step type selection */}
          <div>
            <Label className="mb-2 block">Type d&apos;action</Label>
            <div className="flex flex-wrap gap-2">
              {NEXT_STEP_OPTIONS.filter(
                (opt) => suggestedSteps.includes(opt.id) || suggestedSteps.length === 0
              ).map((option) => {
                const Icon = option.icon;
                const isSelected = selectedType === option.id;
                return (
                  <button
                    key={option.id}
                    onClick={() => setSelectedType(option.id)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
                      isSelected
                        ? 'ring-2 ring-offset-2 ring-blue-500 ' + option.color
                        : option.color
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* DateTime selection */}
          {selectedType && selectedType !== 'aucun' && (
            <div className="space-y-2">
              <Label>Quand ?</Label>
              
              {/* Quick delays */}
              <div className="flex flex-wrap gap-2">
                {(QUICK_DELAYS[outcome || ''] || QUICK_DELAYS.default).map((delay) => (
                  <button
                    key={delay.label}
                    onClick={() => handleQuickDelay(delay.value)}
                    className="px-3 py-1.5 text-sm bg-muted hover:bg-accent rounded-md transition-colors"
                  >
                    {delay.label}
                  </button>
                ))}
              </div>

              {/* Custom datetime */}
              <Input
                type="datetime-local"
                value={datetime}
                onChange={(e) => setDatetime(e.target.value)}
                min={new Date().toISOString().slice(0, 16)}
              />
            </div>
          )}

          {/* Note */}
          <div>
            <Label>Note (optionnel)</Label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Contexte, objectif de l'action..."
              rows={2}
            />
          </div>

          {/* RDV specific fields */}
          {selectedType === 'rdv' && (
            <Card className="p-3 bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800">
              <p className="text-sm text-green-700 dark:text-green-300 flex items-center gap-2">
                <CalendarPlus className="w-4 h-4" />
                Un événement sera créé dans votre calendrier
              </p>
            </Card>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            <X className="w-4 h-4 mr-1" />
            Annuler
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!selectedType || (selectedType !== 'aucun' && !datetime) || loading}
          >
            {loading ? 'En cours...' : 'Valider'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
