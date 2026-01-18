'use client';

import { Users, Phone, Calendar, TrendingUp } from 'lucide-react';
import type { Stats } from '@/types';
import { StatCard } from '@/components/ui';

interface LeadsStatsProps {
  stats: Stats | null;
}

export function LeadsStats({ stats }: LeadsStatsProps) {
  const conversionRate =
    stats && stats.total > 0
      ? Math.round(((stats.by_status.converti || 0) / stats.total) * 100)
      : 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      <StatCard
        icon={Users}
        label="Total leads"
        value={stats?.total ?? 0}
        color="blue"
      />
      <StatCard
        icon={Phone}
        label="À appeler"
        value={stats?.to_call ?? 0}
        color="orange"
      />
      <StatCard
        icon={Calendar}
        label="Relances"
        value={stats?.followups_today ?? 0}
        color="purple"
      />
      <StatCard
        icon={TrendingUp}
        label="Conversion"
        value={`${conversionRate}%`}
        color="green"
      />
    </div>
  );
}
