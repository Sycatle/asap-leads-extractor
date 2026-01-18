'use client';

import { cn } from '@/lib/utils';
import type { LeadStatus, Priority, FollowupUrgency } from '@/types';
import { STATUS_LABELS } from '@/lib/constants';
import { CheckCircle, XCircle, AlertCircle, Sparkles, Star } from 'lucide-react';

// Modern status colors with subtle backgrounds
const statusStyles: Record<LeadStatus, { bg: string; text: string; icon: typeof CheckCircle }> = {
  nouveau: { bg: 'bg-blue-50 dark:bg-blue-950', text: 'text-blue-600 dark:text-blue-400', icon: Sparkles },
  contacte: { bg: 'bg-cyan-50 dark:bg-cyan-950', text: 'text-cyan-600 dark:text-cyan-400', icon: CheckCircle },
  qualifie: { bg: 'bg-violet-50 dark:bg-violet-950', text: 'text-violet-600 dark:text-violet-400', icon: Star },
  proposition: { bg: 'bg-indigo-50 dark:bg-indigo-950', text: 'text-indigo-600 dark:text-indigo-400', icon: AlertCircle },
  converti: { bg: 'bg-emerald-50 dark:bg-emerald-950', text: 'text-emerald-600 dark:text-emerald-400', icon: CheckCircle },
  perdu: { bg: 'bg-zinc-100 dark:bg-zinc-800', text: 'text-zinc-500 dark:text-zinc-400', icon: XCircle },
};

// ===== STATUS BADGE =====

interface StatusBadgeProps {
  status: LeadStatus;
  size?: 'sm' | 'md';
  showIcon?: boolean;
}

export function StatusBadge({ status, size = 'md', showIcon = false }: StatusBadgeProps) {
  const sizes = {
    sm: 'px-2 py-0.5 text-xs gap-1',
    md: 'px-3 py-1.5 text-sm gap-1.5',
  };
  
  const style = statusStyles[status] || statusStyles.nouveau;
  const IconComponent = style.icon;

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full font-medium transition-colors',
        sizes[size],
        style.bg,
        style.text
      )}
    >
      {showIcon && <IconComponent className={size === 'sm' ? 'w-3 h-3' : 'w-4 h-4'} />}
      {STATUS_LABELS[status] || status}
    </span>
  );
}

// ===== PRIORITY BADGE =====

const priorityStyles: Record<Priority, { dot: string; text: string; bg: string }> = {
  high: { dot: 'bg-red-500', text: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-950' },
  medium: { dot: 'bg-amber-500', text: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-950' },
  low: { dot: 'bg-zinc-400', text: 'text-zinc-500 dark:text-zinc-400', bg: 'bg-zinc-100 dark:bg-zinc-800' },
};

const priorityLabels: Record<Priority, string> = {
  high: 'Haute',
  medium: 'Moyenne',
  low: 'Basse',
};

interface PriorityBadgeProps {
  priority: Priority;
  variant?: 'dot' | 'badge' | 'text';
}

export function PriorityBadge({ priority, variant = 'dot' }: PriorityBadgeProps) {
  const style = priorityStyles[priority];
  const label = priorityLabels[priority];

  if (variant === 'badge') {
    return (
      <span
        className={cn(
          'px-2.5 py-1 rounded-full text-xs font-medium',
          style.bg,
          style.text
        )}
      >
        {label}
      </span>
    );
  }

  if (variant === 'dot') {
    return (
      <span className="flex items-center gap-1.5">
        <span className={cn('w-2 h-2 rounded-full', style.dot)} />
        <span className={cn('text-xs font-medium', style.text)}>
          {label}
        </span>
      </span>
    );
  }

  return (
    <span className={cn('text-xs font-medium', style.text)}>
      {label.toUpperCase()}
    </span>
  );
}

// ===== URGENCY BADGE =====

interface UrgencyBadgeProps {
  urgency: FollowupUrgency;
  count?: number;
  icon?: React.ReactNode;
}

const urgencyStyles: Record<FollowupUrgency, { bg: string; text: string; pulse?: boolean }> = {
  overdue: { bg: 'bg-red-100 dark:bg-red-900/50', text: 'text-red-700 dark:text-red-300', pulse: true },
  today: { bg: 'bg-orange-100 dark:bg-orange-900/50', text: 'text-orange-700 dark:text-orange-300' },
  tomorrow: { bg: 'bg-blue-100 dark:bg-blue-900/50', text: 'text-blue-700 dark:text-blue-300' },
  week: { bg: 'bg-zinc-100 dark:bg-zinc-800', text: 'text-zinc-700 dark:text-zinc-300' },
};

const urgencyLabels: Record<FollowupUrgency, string> = {
  overdue: 'en retard',
  today: "aujourd'hui",
  tomorrow: 'demain',
  week: 'cette semaine',
};

export function UrgencyBadge({ urgency, count, icon }: UrgencyBadgeProps) {
  const style = urgencyStyles[urgency];
  
  return (
    <span
      className={cn(
        'inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-all',
        style.bg,
        style.text,
        style.pulse && 'animate-pulse'
      )}
    >
      {icon}
      {count !== undefined && <span className="font-bold">{count}</span>}
      {urgencyLabels[urgency]}
    </span>
  );
}

// ===== RATING BADGE =====

interface RatingBadgeProps {
  rating: number;
  reviewsCount?: number | null;
  size?: 'sm' | 'md';
}

export function RatingBadge({ rating, reviewsCount, size = 'md' }: RatingBadgeProps) {
  const sizeClasses = {
    sm: 'text-xs gap-1',
    md: 'text-sm gap-1.5',
  };
  
  return (
    <span className={cn(
      'inline-flex items-center font-medium text-amber-600 dark:text-amber-400',
      sizeClasses[size]
    )}>
      <Star className={cn('fill-current', size === 'sm' ? 'w-3 h-3' : 'w-4 h-4')} />
      <span>{rating.toFixed(1)}</span>
      {reviewsCount !== undefined && reviewsCount !== null && (
        <span className="text-zinc-400 dark:text-zinc-500 font-normal">
          ({reviewsCount})
        </span>
      )}
    </span>
  );
}
