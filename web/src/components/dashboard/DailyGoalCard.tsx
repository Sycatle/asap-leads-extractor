'use client';

import { Target } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface TodayStats {
  calls_today: number;
  calls_goal: number;
  contacts_today: number;
  rdv_today: number;
  avg_call_duration: number;
}

interface DailyGoalCardProps {
  today: TodayStats;
}

export function DailyGoalCard({ today }: DailyGoalCardProps) {
  const { calls_today, calls_goal, contacts_today, rdv_today } = today;
  const progress = Math.min((calls_today / calls_goal) * 100, 100);
  const isComplete = calls_today >= calls_goal;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base font-medium">
          <Target className="h-4 w-4 text-muted-foreground" />
          Objectif du jour
          {isComplete && (
            <span className="ml-auto text-xs font-normal text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
              Atteint
            </span>
          )}
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Progress bar */}
        <div>
          <div className="flex items-baseline justify-between mb-2">
            <span className="text-2xl font-semibold">{calls_today}</span>
            <span className="text-sm text-muted-foreground">/ {calls_goal} appels</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                isComplete ? 'bg-emerald-500' : 'bg-primary'
              }`}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center p-3 rounded-lg bg-muted/50">
            <div className="text-lg font-semibold">{contacts_today}</div>
            <div className="text-xs text-muted-foreground">Contacts</div>
          </div>
          <div className="text-center p-3 rounded-lg bg-muted/50">
            <div className="text-lg font-semibold">{rdv_today}</div>
            <div className="text-xs text-muted-foreground">RDV</div>
          </div>
          <div className="text-center p-3 rounded-lg bg-muted/50">
            <div className="text-lg font-semibold">
              {calls_today > 0 ? Math.round((contacts_today / calls_today) * 100) : 0}%
            </div>
            <div className="text-xs text-muted-foreground">Taux contact</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
