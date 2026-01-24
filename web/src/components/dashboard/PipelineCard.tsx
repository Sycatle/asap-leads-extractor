import { Card, CardHeader } from '@/components/ui';
import { STATUS_LABELS } from '@/lib/constants';
import type { LeadStatus, Stats } from '@/types';
import { TrendingUp, Target } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PipelineCardProps {
  stats: Stats;
}

const PIPELINE_STATUSES: LeadStatus[] = ['nouveau', 'contacte', 'qualifie', 'proposition', 'converti'];

const pipelineColors: Record<LeadStatus, { bar: string; bg: string; text: string }> = {
  nouveau: { bar: 'bg-primary', bg: 'bg-primary/10', text: 'text-primary' },
  contacte: { bar: 'bg-sky-500', bg: 'bg-sky-500/10', text: 'text-sky-500' },
  qualifie: { bar: 'bg-violet-500', bg: 'bg-violet-500/10', text: 'text-violet-500' },
  proposition: { bar: 'bg-amber-500', bg: 'bg-amber-500/10', text: 'text-amber-500' },
  converti: { bar: 'bg-success', bg: 'bg-success/10', text: 'text-success' },
  perdu: { bar: 'bg-muted-foreground', bg: 'bg-muted', text: 'text-muted-foreground' },
};

export function PipelineCard({ stats }: PipelineCardProps) {
  const conversionRate =
    stats.total > 0
      ? Math.round(((stats.by_status.converti || 0) / stats.total) * 100)
      : 0;

  return (
    <Card className="p-5">
      <CardHeader 
        title="Pipeline" 
        icon={Target}
        description="Progression de vos leads"
      />
      
      <div className="space-y-3">
        {PIPELINE_STATUSES.map((status, index) => {
          const count = stats.by_status[status] ?? 0;
          const percentage =
            stats.total > 0 ? Math.round((count / stats.total) * 100) : 0;
          const colors = pipelineColors[status];

          return (
            <div key={status} className="group">
              <div className="flex items-center justify-between text-sm mb-1.5">
                <div className="flex items-center gap-2">
                  <span className={cn(
                    'w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-semibold',
                    colors.bg, colors.text
                  )}>
                    {index + 1}
                  </span>
                  <span className="text-[13px] font-medium text-foreground">
                    {STATUS_LABELS[status]}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-muted-foreground">{percentage}%</span>
                  <span className={cn('text-sm font-semibold tabular-nums', colors.text)}>
                    {count}
                  </span>
                </div>
              </div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className={cn(
                    'h-full rounded-full transition-all duration-500 ease-out',
                    colors.bar
                  )}
                  style={{ width: `${Math.max(percentage, 2)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Conversion funnel */}
      <div className="mt-5 pt-4 border-t border-border">
        <div className="flex items-center justify-between p-3 rounded-lg bg-success/5 border border-success/10">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-md bg-success/10">
              <TrendingUp className="w-4 h-4 text-success" />
            </div>
            <div>
              <p className="text-xs font-medium text-foreground">Taux de conversion</p>
              <p className="text-[10px] text-muted-foreground">Nouveau → Converti</p>
            </div>
          </div>
          <span className="text-2xl font-semibold text-success tabular-nums">
            {conversionRate}%
          </span>
        </div>
      </div>
    </Card>
  );
}
