'use client';

import Link from 'next/link';
import { cn } from '@/lib/utils';
import { ArrowUpRight, Loader2 } from 'lucide-react';

// ===== STAT CARD =====

type StatColor = 'blue' | 'green' | 'orange' | 'purple' | 'red';

const colorStyles: Record<StatColor, { icon: string; glow: string }> = {
  blue: {
    icon: 'bg-primary/10 text-primary',
    glow: 'stat-card-blue',
  },
  green: {
    icon: 'bg-success/10 text-success',
    glow: 'stat-card-green',
  },
  orange: {
    icon: 'bg-warning/10 text-warning',
    glow: 'stat-card-orange',
  },
  purple: {
    icon: 'bg-info/10 text-info',
    glow: 'stat-card-purple',
  },
  red: {
    icon: 'bg-danger/10 text-danger',
    glow: 'stat-card-red',
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
      'bg-card rounded-xl border border-border p-6 group relative overflow-hidden transition-all duration-300',
      href && 'cursor-pointer hover:scale-[1.02] hover:shadow-lg',
      styles.glow
    )}>
      <div className="flex items-start justify-between relative">
        <div className="flex items-center gap-4">
          <div className={cn(
            'p-3 rounded-xl relative transition-transform duration-300 group-hover:scale-110',
            styles.icon
          )}>
            <Icon className="w-5 h-5" />
            {alert && (
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-destructive rounded-full border-2 border-card animate-pulse" />
            )}
          </div>
          
          <div>
            <p className="text-sm font-medium text-muted-foreground mb-1">
              {label}
            </p>
            <div className="flex items-baseline gap-2">
              <p className="text-3xl font-bold text-foreground tracking-tight">
                {value}
              </p>
              {subValue && (
                <span className="text-sm font-medium text-muted-foreground">
                  {subValue}
                </span>
              )}
            </div>
            {trend && (
              <p className={cn(
                'text-xs font-medium mt-1',
                trend.positive ? 'text-success' : 'text-danger'
              )}>
                {trend.positive ? '↑' : '↓'} {Math.abs(trend.value)}% vs last week
              </p>
            )}
          </div>
        </div>
        
        {href && (
          <ArrowUpRight className="w-5 h-5 text-muted-foreground/50 group-hover:text-muted-foreground transition-colors" />
        )}
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

export function MiniStat({ label, value, total, color = 'blue' }: MiniStatProps) {
  const percentage = total > 0 ? Math.round((value / total) * 100) : 0;
  const styles = colorStyles[color];

  return (
    <div className="text-center p-4 rounded-xl bg-accent transition-all hover:bg-accent/80">
      <div className={cn(
        'inline-flex items-center justify-center w-10 h-10 rounded-lg mb-2',
        styles.icon
      )}>
        <span className="text-lg font-bold">{percentage}%</span>
      </div>
      <p className="text-2xl font-bold text-foreground">{value}</p>
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}

// ===== LOADING SPINNER =====

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizes = {
  sm: 'w-4 h-4 border-2',
  md: 'w-8 h-8 border-[3px]',
  lg: 'w-12 h-12 border-4',
};

export function LoadingSpinner({ size = 'md', className }: LoadingSpinnerProps) {
  return (
    <div
      className={cn(
        'rounded-full border-blue-500 border-t-transparent animate-spin',
        sizes[size],
        className
      )}
    />
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
        <div className="w-16 h-16 rounded-full border-4 border-border" />
        <div className="absolute inset-0 w-16 h-16 rounded-full border-4 border-primary border-t-transparent animate-spin" />
      </div>
      <p className="text-sm font-medium text-muted-foreground">{message}</p>
    </div>
  );
}

// ===== SKELETON CARD =====

export function SkeletonCard() {
  return (
    <div className="bg-card rounded-xl border border-border p-6 space-y-4">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-muted animate-pulse" />
        <div className="flex-1 space-y-2">
          <div className="h-5 w-1/3 bg-muted rounded animate-pulse" />
          <div className="h-4 w-1/2 bg-muted rounded animate-pulse" />
        </div>
      </div>
      <div className="h-4 w-full bg-muted rounded animate-pulse" />
      <div className="h-4 w-3/4 bg-muted rounded animate-pulse" />
    </div>
  );
}

// ===== SKELETON TABLE ROW =====

export function SkeletonTableRow() {
  return (
    <tr className="animate-pulse">
      <td className="p-4"><div className="h-5 w-32 bg-muted rounded" /></td>
      <td className="p-4"><div className="h-5 w-24 bg-muted rounded" /></td>
      <td className="p-4"><div className="h-6 w-20 bg-muted rounded-full" /></td>
      <td className="p-4"><div className="h-5 w-28 bg-muted rounded" /></td>
      <td className="p-4"><div className="h-8 w-8 bg-muted rounded-lg" /></td>
    </tr>
  );
}
