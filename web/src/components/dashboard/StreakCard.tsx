'use client';

import { TrendingUp, Calendar } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

interface StreakInfo {
  current_streak: number;
  best_streak: number;
  last_activity_date: string | null;
}

interface StreakCardProps {
  streak: StreakInfo;
}

export function StreakCard({ streak }: StreakCardProps) {
  const { current_streak, best_streak, last_activity_date } = streak;
  const isActive = current_streak > 0;

  // Format last activity
  const formatLastActivity = () => {
    if (!last_activity_date) return 'Aucune activité';
    const date = new Date(last_activity_date);
    const today = new Date();
    const diffDays = Math.floor((today.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return "Aujourd'hui";
    if (diffDays === 1) return 'Hier';
    return `Il y a ${diffDays} jours`;
  };

  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className={`p-3 rounded-xl ${isActive ? 'bg-primary/10' : 'bg-muted'}`}>
              <TrendingUp className={`h-5 w-5 ${isActive ? 'text-primary' : 'text-muted-foreground'}`} />
            </div>

            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-semibold">{current_streak}</span>
                <span className="text-sm text-muted-foreground">jours consécutifs</span>
              </div>
              <p className="text-sm text-muted-foreground mt-0.5">
                Record : {best_streak} jours
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar className="h-4 w-4" />
            <span>{formatLastActivity()}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
