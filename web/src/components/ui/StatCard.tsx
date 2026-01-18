import Link from 'next/link';
import { cn } from '@/lib/utils';
import { ArrowUpRight } from 'lucide-react';

type StatColor = 'blue' | 'green' | 'orange' | 'purple' | 'red';

const colorStyles: Record<StatColor, { icon: string; glow: string }> = {
  blue: {
    icon: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
    glow: 'stat-card-blue',
  },
  green: {
    icon: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    glow: 'stat-card-green',
  },
  orange: {
    icon: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    glow: 'stat-card-orange',
  },
  purple: {
    icon: 'bg-violet-500/10 text-violet-600 dark:text-violet-400',
    glow: 'stat-card-purple',
  },
  red: {
    icon: 'bg-red-500/10 text-red-600 dark:text-red-400',
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
      'card group relative overflow-hidden transition-all duration-300',
      href && 'cursor-pointer hover:scale-[1.02]',
      styles.glow
    )}>
      {/* Subtle gradient background on hover */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-linear-to-br from-transparent via-transparent to-current pointer-events-none" style={{ color: 'rgba(var(--primary-rgb), 0.03)' }} />
      
      <div className="flex items-start justify-between relative">
        <div className="flex items-center gap-4">
          <div className={cn(
            'p-3 rounded-xl relative transition-transform duration-300 group-hover:scale-110',
            styles.icon
          )}>
            <Icon className="w-5 h-5" />
            {alert && (
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-white dark:border-zinc-900 animate-pulse" />
            )}
          </div>
          
          <div>
            <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-1">
              {label}
            </p>
            <div className="flex items-baseline gap-2">
              <p className="text-3xl font-bold text-zinc-900 dark:text-zinc-50 tracking-tight">
                {value}
              </p>
              {subValue && (
                <span className="text-sm font-medium text-zinc-400 dark:text-zinc-500">
                  {subValue}
                </span>
              )}
            </div>
            {trend && (
              <p className={cn(
                'text-xs font-medium mt-1',
                trend.positive ? 'text-emerald-600' : 'text-red-500'
              )}>
                {trend.positive ? '↑' : '↓'} {Math.abs(trend.value)}% vs last week
              </p>
            )}
          </div>
        </div>
        
        {href && (
          <ArrowUpRight className="w-5 h-5 text-zinc-300 dark:text-zinc-600 group-hover:text-zinc-500 dark:group-hover:text-zinc-400 transition-colors" />
        )}
      </div>
    </div>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }

  return content;
}

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
    <div className="text-center p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 transition-all hover:bg-zinc-100 dark:hover:bg-zinc-800">
      <div className={cn(
        'inline-flex items-center justify-center w-10 h-10 rounded-lg mb-2',
        styles.icon
      )}>
        <span className="text-lg font-bold">{percentage}%</span>
      </div>
      <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{value}</p>
      <p className="text-sm text-zinc-500 dark:text-zinc-400">{label}</p>
    </div>
  );
}
