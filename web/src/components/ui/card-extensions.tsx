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
    <div className="text-center py-16">
      <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-zinc-100 dark:bg-zinc-800 mb-6">
        <Icon className="w-10 h-10 text-zinc-400 dark:text-zinc-500" />
      </div>
      <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 mb-2">
        {title}
      </h2>
      {description && (
        <p className="text-zinc-500 dark:text-zinc-400 max-w-sm mx-auto mb-8">
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
    <div className="flex items-center justify-between mb-6">
      <div>
        <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
          {title}
        </h2>
        {description && (
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
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
}

export function CardHeader({ title, emoji, icon: Icon, description, action }: CustomCardHeaderProps) {
  return (
    <div className="flex items-start justify-between mb-6">
      <div className="flex items-center gap-3">
        {Icon && (
          <div className="p-2 rounded-lg bg-zinc-100 dark:bg-zinc-800">
            <Icon className="w-5 h-5 text-zinc-600 dark:text-zinc-400" />
          </div>
        )}
        <div>
          <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            {emoji && <span>{emoji}</span>}
            {title}
          </h3>
          {description && (
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
              {description}
            </p>
          )}
        </div>
      </div>
      {action}
    </div>
  );
}
