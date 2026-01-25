'use client';

import Link from 'next/link';
import { cn } from '@/lib/utils';
import { ArrowUpRight, Loader2, TrendingUp, TrendingDown } from 'lucide-react';

// ===== STAT CARD - GAMIFIED =====

type StatColor = 'primary' | 'success' | 'warning' | 'danger' | 'info';

const colorStyles: Record<StatColor, { 
  icon: string; 
  accent: string;
  glow: string;
  progress: string;
}> = {
  primary: {
    icon: 'bg-primary/10 text-primary',
    accent: 'text-primary',
    glow: 'stat-card-primary',
    progress: 'bg-primary',
  },
  success: {
    icon: 'bg-success/10 text-success',
    accent: 'text-success',
    glow: 'stat-card-success',
    progress: 'bg-success',
  },
  warning: {
    icon: 'bg-warning/10 text-warning',
    accent: 'text-warning',
    glow: 'stat-card-warning',
    progress: 'bg-warning',
  },
  danger: {
    icon: 'bg-danger/10 text-danger',
    accent: 'text-danger',
    glow: 'stat-card-danger',
    progress: 'bg-danger',
  },
  info: {
    icon: 'bg-info/10 text-info',
    accent: 'text-info',
    glow: 'stat-card-info',
    progress: 'bg-info',
  },
};

interface StatCardProps {
  icon: React.ElementType;
  label: string;
  value: number | string;
  subValue?: string;
  color: StatColor;
  href?: string;
  alert?: boolean;
  trend?: { value: number; positive: boolean };
}

export function StatCard({
  icon: Icon,
  label,
  value,
  subValue,
  color,
  href,
  alert,
  trend,
}: StatCardProps) {
  const styles = colorStyles[color];
  
  const content = (
    <div className={cn(
      'stat-card bg-card rounded-xl border border-border p-5 group relative overflow-hidden transition-all duration-200',
      href && 'cursor-pointer hover:border-border-hover',
      styles.glow
    )}>
      <div className="relative flex items-start justify-between">
        <div className="space-y-3">
          <div className={cn(
            'inline-flex items-center justify-center w-10 h-10 rounded-lg transition-transform duration-200 group-hover:scale-105',
            styles.icon
          )}>
            <Icon className="w-5 h-5" />
            {alert && (
              <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-danger opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-danger" />
              </span>
            )}
          </div>
          
          <div>
            <p className="text-[13px] font-medium text-muted-foreground">
              {label}
            </p>
            <div className="flex items-baseline gap-2 mt-1">
              <p className="text-2xl font-semibold text-foreground tracking-tight">
                {value}
              </p>
              {subValue && (
                <span className={cn('text-sm font-medium', styles.accent)}>
                  {subValue}
                </span>
              )}
            </div>
          </div>
        </div>
        
        <div className="flex flex-col items-end gap-2">
          {href && (
            <div className="p-1.5 rounded-md bg-accent opacity-0 group-hover:opacity-100 transition-opacity">
              <ArrowUpRight className="w-4 h-4 text-muted-foreground" />
            </div>
          )}
          
          {trend && (
            <div className={cn(
              'flex items-center gap-1 text-xs font-medium px-1.5 py-0.5 rounded',
              trend.positive 
                ? 'text-success bg-success/10' 
                : 'text-danger bg-danger/10'
            )}>
              {trend.positive ? (
                <TrendingUp className="w-3 h-3" />
              ) : (
                <TrendingDown className="w-3 h-3" />
              )}
              {Math.abs(trend.value)}%
            </div>
          )}
        </div>
      </div>
    </div>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }

  return content;
}

// ===== MINI STAT =====

interface MiniStatProps {
  label: string;
  value: number;
  total: number;
  color?: StatColor;
}

export function MiniStat({ label, value, total, color = 'primary' }: MiniStatProps) {
  const percentage = total > 0 ? Math.round((value / total) * 100) : 0;
  const styles = colorStyles[color];

  return (
    <div className="text-center p-4 rounded-xl bg-accent/50 hover:bg-accent transition-colors">
      <div className={cn(
        'inline-flex items-center justify-center w-10 h-10 rounded-lg mb-2',
        styles.icon
      )}>
        <span className="text-sm font-bold">{percentage}%</span>
      </div>
      <p className="text-xl font-semibold text-foreground">{value}</p>
      <p className="text-xs text-muted-foreground mt-1">{label}</p>
    </div>
  );
}

// ===== LOADING SPINNER =====

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizes = {
  sm: 'w-4 h-4',
  md: 'w-6 h-6',
  lg: 'w-8 h-8',
};

export function LoadingSpinner({ size = 'md', className }: LoadingSpinnerProps) {
  return (
    <Loader2 className={cn('animate-spin text-primary', sizes[size], className)} />
  );
}

// ===== LOADING STATE =====

interface LoadingStateProps {
  message?: string;
  className?: string;
}

export function LoadingState({ message = 'Chargement...', className }: LoadingStateProps) {
  return (
    <div className={cn(
      'flex flex-col items-center justify-center min-h-[400px] gap-4',
      className
    )}>
      <div className="relative">
        <div className="w-12 h-12 rounded-full border-2 border-border" />
        <div className="absolute inset-0 w-12 h-12 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

// ===== SKELETON CARD =====

export function SkeletonCard() {
  return (
    <div className="bg-card rounded-xl border border-border p-5 space-y-3">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg skeleton" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-1/3 skeleton rounded" />
          <div className="h-6 w-1/2 skeleton rounded" />
        </div>
      </div>
    </div>
  );
}

// ===== SKELETON TABLE ROW =====

export function SkeletonTableRow() {
  return (
    <tr className="animate-pulse">
      <td className="p-4"><div className="h-4 w-32 skeleton rounded" /></td>
      <td className="p-4"><div className="h-4 w-24 skeleton rounded" /></td>
      <td className="p-4"><div className="h-5 w-20 skeleton rounded-full" /></td>
      <td className="p-4"><div className="h-4 w-28 skeleton rounded" /></td>
      <td className="p-4"><div className="h-8 w-8 skeleton rounded-lg" /></td>
    </tr>
  );
}
