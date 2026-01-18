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
  messagerie: 'Messagerie',
  rappeler: 'À rappeler',
  injoignable: 'Injoignable',
};

// ===== STATUS COLORS =====

export const STATUS_COLORS: Record<LeadStatus, string> = {
  nouveau: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  contacte: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300',
  qualifie: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300',
  proposition: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300',
  converti: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  perdu: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400',
};

export const STATUS_BAR_COLORS: Record<LeadStatus, string> = {
  nouveau: 'bg-blue-500',
  contacte: 'bg-yellow-500',
  qualifie: 'bg-purple-500',
  proposition: 'bg-orange-500',
  converti: 'bg-green-500',
  perdu: 'bg-zinc-400',
};

export const PRIORITY_COLORS: Record<Priority, string> = {
  high: 'text-red-600 dark:text-red-400',
  medium: 'text-yellow-600 dark:text-yellow-400',
  low: 'text-zinc-500',
};

export const PRIORITY_BADGE_COLORS: Record<Priority, string> = {
  high: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
  medium: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300',
  low: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
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
    color: 'text-red-600 dark:text-red-400',
    bg: 'bg-red-50 dark:bg-red-950',
    border: 'border-red-200 dark:border-red-800',
  },
  today: {
    label: "Aujourd'hui",
    color: 'text-orange-600 dark:text-orange-400',
    bg: 'bg-orange-50 dark:bg-orange-950',
    border: 'border-orange-200 dark:border-orange-800',
  },
  tomorrow: {
    label: 'Demain',
    color: 'text-blue-600 dark:text-blue-400',
    bg: 'bg-blue-50 dark:bg-blue-950',
    border: 'border-blue-200 dark:border-blue-800',
  },
  week: {
    label: 'Cette semaine',
    color: 'text-zinc-600 dark:text-zinc-400',
    bg: 'bg-zinc-50 dark:bg-zinc-900',
    border: 'border-zinc-200 dark:border-zinc-800',
  },
};

// ===== CALL OUTCOMES =====

export const CALL_OUTCOMES: CallOutcomeOption[] = [
  // Pas de contact
  { id: 'injoignable', label: 'Injoignable', color: 'red', key: '1', requiresNextStep: true },
  { id: 'messagerie', label: 'Messagerie', color: 'yellow', key: '2', requiresNextStep: true },
  { id: 'mauvais_numero', label: 'Mauvais n°', color: 'zinc', key: '3', requiresNextStep: false },
  // Contact partiel
  { id: 'accueil', label: 'Accueil/Standard', color: 'orange', key: '4', requiresNextStep: true },
  { id: 'rappeler', label: 'À rappeler', color: 'blue', key: '5', requiresNextStep: true },
  // Contact positif
  { id: 'interesse', label: 'Intéressé', color: 'green', key: '6', requiresNextStep: true },
  { id: 'rdv_pris', label: 'RDV pris', color: 'green', key: '7', requiresNextStep: true },
  { id: 'devis_envoye', label: 'Devis envoyé', color: 'purple', key: '8', requiresNextStep: true },
  // Clôture
  { id: 'perdu', label: 'Perdu', color: 'zinc', key: '9', requiresNextStep: false },
  { id: 'opt_out', label: 'Opt-out', color: 'red', key: '0', requiresNextStep: false },
];

// Workflows par statut (next steps suggérés)
export const OUTCOME_WORKFLOWS: Record<CallOutcome, { suggestedNextSteps: string[]; defaultDelay?: string }> = {
  injoignable: { suggestedNextSteps: ['rappel'], defaultDelay: '+2d' },
  messagerie: { suggestedNextSteps: ['rappel', 'sms'], defaultDelay: '+1d' },
  mauvais_numero: { suggestedNextSteps: [] },
  accueil: { suggestedNextSteps: ['rappel', 'email'], defaultDelay: '+1d' },
  rappeler: { suggestedNextSteps: ['rappel'], defaultDelay: '+2d' },
  interesse: { suggestedNextSteps: ['rdv', 'email'], defaultDelay: '+2d' },
  rdv_pris: { suggestedNextSteps: ['email'], defaultDelay: undefined },
  devis_envoye: { suggestedNextSteps: ['rappel', 'email'], defaultDelay: '+2d' },
  perdu: { suggestedNextSteps: ['rappel'], defaultDelay: '+90d' },
  opt_out: { suggestedNextSteps: [] },
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
