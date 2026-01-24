import type { LeadStatus, CallStatus, Priority, FollowupUrgency, CallOutcomeOption, CallOutcome } from '@/types';

// ===== STATUS LABELS =====

export const STATUS_LABELS: Record<LeadStatus, string> = {
  nouveau: 'Nouveau',
  contacte: 'Contacté',
  qualifie: 'Qualifié',
  proposition: 'Proposition',
  converti: 'Converti',
  perdu: 'Perdu',
};

export const CALL_STATUS_LABELS: Record<CallStatus, string> = {
  non_appele: 'Non appelé',
  appele: 'Appelé',
  rappeler: 'À rappeler',
  injoignable: 'Injoignable',
};

// ===== STATUS COLORS =====

export const STATUS_COLORS: Record<LeadStatus, string> = {
  nouveau: 'bg-primary/10 text-primary',
  contacte: 'bg-warning/10 text-warning',
  qualifie: 'bg-info/10 text-info',
  proposition: 'bg-warning/10 text-warning',
  converti: 'bg-success/10 text-success',
  perdu: 'bg-muted text-muted-foreground',
};

export const STATUS_BAR_COLORS: Record<LeadStatus, string> = {
  nouveau: 'bg-primary',
  contacte: 'bg-warning',
  qualifie: 'bg-info',
  proposition: 'bg-warning',
  converti: 'bg-success',
  perdu: 'bg-muted-foreground',
};

export const PRIORITY_COLORS: Record<Priority, string> = {
  high: 'text-danger',
  medium: 'text-warning',
  low: 'text-muted-foreground',
};

export const PRIORITY_BADGE_COLORS: Record<Priority, string> = {
  high: 'bg-danger/10 text-danger',
  medium: 'bg-warning/10 text-warning',
  low: 'bg-muted text-muted-foreground',
};

export const PRIORITY_LABELS: Record<Priority, string> = {
  high: 'Urgent',
  medium: 'Normal',
  low: 'Basse',
};

export const PRIORITY_STYLES: Record<Priority, string> = {
  high: 'border-danger/50 text-danger',
  medium: 'border-warning/50 text-warning',
  low: 'border-muted text-muted-foreground',
};

// ===== URGENCY CONFIG =====

export const URGENCY_CONFIG: Record<FollowupUrgency, {
  label: string;
  color: string;
  bg: string;
  border: string;
}> = {
  overdue: {
    label: 'En retard',
    color: 'text-danger',
    bg: 'bg-danger/5',
    border: 'border-danger/20',
  },
  today: {
    label: "Aujourd'hui",
    color: 'text-warning',
    bg: 'bg-warning/5',
    border: 'border-warning/20',
  },
  tomorrow: {
    label: 'Demain',
    color: 'text-primary',
    bg: 'bg-primary/5',
    border: 'border-primary/20',
  },
  week: {
    label: 'Cette semaine',
    color: 'text-muted-foreground',
    bg: 'bg-muted/50',
    border: 'border-border',
  },
};

// ===== CALL OUTCOMES =====

export const CALL_OUTCOMES: CallOutcomeOption[] = [
  // Pas de contact
  { id: 'injoignable', label: 'Pas décroché', color: 'red', key: 'i', requiresNextStep: true },
  { id: 'mauvais_numero', label: 'Faux numéro', color: 'zinc', key: 'n', requiresNextStep: false },
  // Contact partiel
  { id: 'accueil', label: 'Standard', color: 'orange', key: 'a', requiresNextStep: true },
  { id: 'decideur_absent', label: 'Décideur absent', color: 'orange', key: 'z', requiresNextStep: true },
  { id: 'rappeler', label: 'Rappeler', color: 'blue', key: 'r', requiresNextStep: true },
  // Contact positif
  { id: 'interesse', label: 'Intéressé', color: 'green', key: 't', requiresNextStep: true },
  { id: 'rdv_pris', label: 'RDV obtenu', color: 'green', key: 'v', requiresNextStep: true },
  { id: 'devis_envoye', label: 'Devis envoyé', color: 'purple', key: 'd', requiresNextStep: true },
  // Clôture
  { id: 'perdu', label: 'Pas intéressé', color: 'zinc', key: 'p', requiresNextStep: false },
  { id: 'opt_out', label: 'Ne plus appeler', color: 'red', key: 'o', requiresNextStep: false },
];

// Workflows par statut (next steps suggérés)
export const OUTCOME_WORKFLOWS: Record<CallOutcome, { suggestedNextSteps: string[]; defaultDelay?: string }> = {
  injoignable: { suggestedNextSteps: ['rappel'], defaultDelay: '+2h' },
  mauvais_numero: { suggestedNextSteps: [] },
  accueil: { suggestedNextSteps: ['rappel', 'email'], defaultDelay: '+1d' },
  decideur_absent: { suggestedNextSteps: ['rappel'], defaultDelay: '+1d' },
  rappeler: { suggestedNextSteps: ['rappel'], defaultDelay: '+2d' },
  interesse: { suggestedNextSteps: ['rdv', 'email'], defaultDelay: '+2d' },
  rdv_pris: { suggestedNextSteps: ['email'], defaultDelay: undefined },
  devis_envoye: { suggestedNextSteps: ['rappel', 'email'], defaultDelay: '+2d' },
  perdu: { suggestedNextSteps: ['rappel'], defaultDelay: '+90d' },
  opt_out: { suggestedNextSteps: [] },
};

// Stratégie de rappel dynamique selon le nombre de tentatives
export const RETRY_STRATEGY: Record<number, { delay: string; tip: string }> = {
  1: { delay: '+4h', tip: 'Rappeler à une heure différente' },
  2: { delay: '+1d', tip: 'Changer de créneau (matin/après-midi)' },
  3: { delay: '+2d', tip: 'Essayer un autre jour de la semaine' },
  4: { delay: '+1w', tip: 'Dernière tentative téléphonique' },
  5: { delay: 'archive', tip: 'Passer en nurturing email uniquement' },
};

// Raisons de perte
export const LOST_REASONS = [
  { id: 'pas_interesse', label: 'Pas intéressé' },
  { id: 'budget', label: 'Budget insuffisant' },
  { id: 'timing', label: 'Mauvais timing' },
  { id: 'concurrent', label: 'Déjà un prestataire' },
  { id: 'autre', label: 'Autre raison' },
] as const;

// ===== HISTORY =====

export const HISTORY_TYPE_LABELS: Record<string, string> = {
  call: 'Appel',
  email: 'Email',
  note: 'Note',
  status_change: 'Statut',
  followup_set: 'Relance',
};

export const HISTORY_TYPE_COLORS: Record<string, string> = {
  call: 'bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-400',
  email: 'bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-400',
  note: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400',
  status_change: 'bg-purple-100 text-purple-600 dark:bg-purple-900 dark:text-purple-400',
  followup_set: 'bg-orange-100 text-orange-600 dark:bg-orange-900 dark:text-orange-400',
};

// ===== ICON COLORS =====

export const ICON_COLORS = {
  blue: 'bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400',
  orange: 'bg-orange-50 text-orange-600 dark:bg-orange-950 dark:text-orange-400',
  purple: 'bg-purple-50 text-purple-600 dark:bg-purple-950 dark:text-purple-400',
  green: 'bg-green-50 text-green-600 dark:bg-green-950 dark:text-green-400',
  red: 'bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-400',
  yellow: 'bg-yellow-50 text-yellow-600 dark:bg-yellow-950 dark:text-yellow-400',
  zinc: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400',
} as const;

export type IconColor = keyof typeof ICON_COLORS;

// ===== LEAD SELECTION ALGORITHM CONFIG =====

export const LEAD_SELECTION_CONFIG = {
  // Filtres globaux
  maxAttempts: 5,                    // Max tentatives avant abandon
  coolingOffHours: 4,                // Délai minimum entre 2 appels (heures)
  
  // Score dynamique - bonus
  bonusBestCallTime: 20,             // Si l'heure actuelle match best_call_time
  bonusNoWebsite: 15,                // Pas de site web = plus besoin
  bonusPriorityHigh: 30,             // Priorité haute
  bonusPriorityMedium: 15,           // Priorité moyenne
  
  // Score dynamique - malus
  malusPerAttempt: 5,                // Pénalité par tentative
  malusPhonePerso: 20,               // Numéro personnel
  
  // Rotation des niches
  maxConsecutiveSameNiche: 3,        // Max leads consécutifs de la même niche
  
  // Heures de travail (pour matcher best_call_time)
  workHours: {
    start: 9,  // 9h
    end: 19,   // 19h
  },
} as const;

export type LeadSelectionConfig = typeof LEAD_SELECTION_CONFIG;
