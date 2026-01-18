import { Card, CardHeader, MiniStat } from '@/components/ui';
import type { Stats } from '@/types';

interface PerformanceCardProps {
  stats: Stats;
}

export function PerformanceCard({ stats }: PerformanceCardProps) {
  return (
    <Card>
      <CardHeader title="Statistiques" emoji="📈" />
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
        <MiniStat
          label="Jamais appelés"
          value={stats.by_call_status.non_appele ?? 0}
          total={stats.total}
        />
        <MiniStat
          label="Conversations"
          value={stats.by_call_status.appele ?? 0}
          total={stats.total}
        />
        <MiniStat
          label="Messageries"
          value={stats.by_call_status.messagerie ?? 0}
          total={stats.total}
        />
        <MiniStat
          label="À rappeler"
          value={stats.by_call_status.rappeler ?? 0}
          total={stats.total}
        />
      </div>
    </Card>
  );
}
