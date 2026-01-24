'use client';

import { cn } from '@/lib/utils';
import type { LeadStatus, Priority, FollowupUrgency } from '@/types';
import { STATUS_LABELS } from '@/lib/constants';
import { CheckCircle, XCircle, AlertCircle, Sparkles, Star } from 'lucide-react';

// Modern status colors using CSS variables
const statusStyles: Record<LeadStatus, { bg: string; text: string; icon: typeof CheckCircle }> = {
  nouveau: { bg: 'bg-primary/10', text: 'text-primary', icon: Sparkles },
  contacte: { bg: 'bg-info/10', text: 'text-info', icon: CheckCircle },
  qualifie: { bg: 'bg-info/10', text: 'text-info', icon: Star },
  proposition: { bg: 'bg-primary/10', text: 'text-primary', icon: AlertCircle },
  converti: { bg: 'bg-success/10', text: 'text-success', icon: CheckCircle },
  perdu: { bg: 'bg-muted', text: 'text-muted-foreground', icon: XCircle },
};

// ===== STATUS BADGE =====

interface StatusBadgeProps {
  status: LeadStatus;
  size?: 'sm' | 'md';
  showIcon?: boolean;
}

export function StatusBadge({ status, size = 'md', showIcon = false }: StatusBadgeProps) {
  const sizes = {
    sm: 'px-2 py-0.5 text-[10px] gap-1',
    md: 'px-2.5 py-1 text-xs gap-1.5',
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
      {showIcon && <IconComponent className={size === 'sm' ? 'w-2.5 h-2.5' : 'w-3.5 h-3.5'} />}
      {STATUS_LABELS[status] || status}
    </span>
  );
}

// ===== PRIORITY BADGE =====

const priorityStyles: Record<Priority, { dot: string; text: string; bg: string }> = {
  high: { dot: 'bg-danger', text: 'text-danger', bg: 'bg-danger/10' },
  medium: { dot: 'bg-warning', text: 'text-warning', bg: 'bg-warning/10' },
  low: { dot: 'bg-muted-foreground', text: 'text-muted-foreground', bg: 'bg-muted' },
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
          'px-2 py-0.5 rounded-full text-[10px] font-medium',
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
        <span className={cn('w-1.5 h-1.5 rounded-full', style.dot)} />
        <span className={cn('text-[10px] font-medium', style.text)}>
          {label}
        </span>
      </span>
    );
  }

  return (
    <span className={cn('text-[10px] font-medium', style.text)}>
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
  overdue: { bg: 'bg-danger/10', text: 'text-danger', pulse: true },
  today: { bg: 'bg-warning/10', text: 'text-warning' },
  tomorrow: { bg: 'bg-primary/10', text: 'text-primary' },
  week: { bg: 'bg-muted', text: 'text-muted-foreground' },
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
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all',
        style.bg,
        style.text,
        style.pulse && 'animate-pulse-soft'
      )}
    >
      {icon}
      {count !== undefined && <span className="font-semibold">{count}</span>}
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
    sm: 'text-[10px] gap-0.5',
    md: 'text-xs gap-1',
  };
  
  return (
    <span className={cn(
      'inline-flex items-center font-medium text-warning',
      sizeClasses[size]
    )}>
      <Star className={cn('fill-current', size === 'sm' ? 'w-2.5 h-2.5' : 'w-3 h-3')} />
      <span>{rating.toFixed(1)}</span>
      {reviewsCount !== undefined && reviewsCount !== null && (
        <span className="text-muted-foreground font-normal">
          ({reviewsCount})
        </span>
      )}
    </span>
  );
}
