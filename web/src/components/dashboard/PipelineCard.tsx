import { Card, CardHeader } from '@/components/ui';
import { STATUS_LABELS } from '@/lib/constants';
import type { LeadStatus, Stats } from '@/types';
import { TrendingUp, BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PipelineCardProps {
  stats: Stats;
}

const PIPELINE_STATUSES: LeadStatus[] = ['nouveau', 'contacte', 'qualifie', 'proposition', 'converti'];

const pipelineColors: Record<LeadStatus, { bar: string; text: string }> = {
  nouveau: { bar: 'bg-blue-500', text: 'text-blue-600 dark:text-blue-400' },
  contacte: { bar: 'bg-cyan-500', text: 'text-cyan-600 dark:text-cyan-400' },
  qualifie: { bar: 'bg-violet-500', text: 'text-violet-600 dark:text-violet-400' },
  proposition: { bar: 'bg-indigo-500', text: 'text-indigo-600 dark:text-indigo-400' },
  converti: { bar: 'bg-emerald-500', text: 'text-emerald-600 dark:text-emerald-400' },
  perdu: { bar: 'bg-zinc-400', text: 'text-zinc-500' },
};

export function PipelineCard({ stats }: PipelineCardProps) {
  const conversionRate =
    stats.total > 0
      ? Math.round(((stats.by_status.converti || 0) / stats.total) * 100)
      : 0;

  return (
    <Card>
      <CardHeader 
        title="Pipeline Commercial" 
        icon={BarChart3}
        description="Répartition de vos leads par étape"
      />
      
      <div className="space-y-4">
        {PIPELINE_STATUSES.map((status, index) => {
          const count = stats.by_status[status] ?? 0;
          const percentage =
            stats.total > 0 ? Math.round((count / stats.total) * 100) : 0;
          const colors = pipelineColors[status];

          return (
            <div key={status} className="group">
              <div className="flex items-center justify-between text-sm mb-2">
                <div className="flex items-center gap-2">
                  <span className={cn(
                    'w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold text-white',
                    colors.bar
                  )}>
                    {index + 1}
                  </span>
                  <span className="font-medium text-zinc-700 dark:text-zinc-300">
                    {STATUS_LABELS[status]}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-zinc-400">{percentage}%</span>
                  <span className={cn('font-bold tabular-nums', colors.text)}>
                    {count}
                  </span>
                </div>
              </div>
              <div className="h-2 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className={cn(
                    'h-full rounded-full transition-all duration-500',
                    colors.bar,
                    'group-hover:opacity-80'
                  )}
                  style={{ width: `${percentage}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Conversion funnel */}
      <div className="mt-6 pt-5 border-t border-zinc-100 dark:border-zinc-800">
        <div className="flex items-center justify-between p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900">
              <TrendingUp className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">Taux de conversion</p>
              <p className="text-xs text-zinc-400 dark:text-zinc-500">Nouveau → Converti</p>
            </div>
          </div>
          <span className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">
            {conversionRate}%
          </span>
        </div>
      </div>
    </Card>
  );
}
