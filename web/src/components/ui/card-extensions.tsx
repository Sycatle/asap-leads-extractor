'use client';

import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';

// ===== EMPTY STATE =====

interface EmptyStateProps {
  icon: React.ElementType;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="text-center py-12 px-4">
      <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-muted mb-5">
        <Icon className="w-7 h-7 text-muted-foreground" />
      </div>
      <h2 className="text-base font-semibold text-foreground mb-1.5">
        {title}
      </h2>
      {description && (
        <p className="text-sm text-muted-foreground max-w-xs mx-auto mb-6">
          {description}
        </p>
      )}
      {action}
    </div>
  );
}

// ===== SECTION HEADER =====

interface SectionHeaderProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function SectionHeader({ title, description, action }: SectionHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-5">
      <div>
        <h2 className="text-lg font-semibold text-foreground tracking-tight">
          {title}
        </h2>
        {description && (
          <p className="text-sm text-muted-foreground mt-0.5">
            {description}
          </p>
        )}
      </div>
      {action}
    </div>
  );
}

// ===== CUSTOM CARD HEADER =====
// This is a custom CardHeader with title/emoji props, different from shadcn's CardHeader

interface CustomCardHeaderProps {
  title: string;
  emoji?: string;
  icon?: LucideIcon;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function CardHeader({ title, emoji, icon: Icon, description, action, className }: CustomCardHeaderProps) {
  return (
    <div className={cn("flex items-start justify-between mb-5", className)}>
      <div className="flex items-center gap-2.5">
        {Icon && (
          <div className="p-2 rounded-lg bg-muted">
            <Icon className="w-4 h-4 text-muted-foreground" />
          </div>
        )}
        <div>
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
            {emoji && <span>{emoji}</span>}
            {title}
          </h3>
          {description && (
            <p className="text-xs text-muted-foreground mt-0.5">
              {description}
            </p>
          )}
        </div>
      </div>
      {action}
    </div>
  );
}
