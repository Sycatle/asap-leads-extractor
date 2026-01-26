'use client';

import { BarChart3, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { WeeklyPerformance } from '@/types';

interface WeeklyChartCardProps {
  data: WeeklyPerformance;
  conversionRate: number;
}

export function WeeklyChartCard({ data, conversionRate }: WeeklyChartCardProps) {
  const { calls, contacts, labels } = data;
  
  // Calculate max for scaling
  const maxCalls = Math.max(...calls, 1);
  const maxContacts = Math.max(...contacts, 1);
  const maxValue = Math.max(maxCalls, maxContacts);

  // Calculate trend (compare last 2 days with previous 2 days)
  const recentCalls = calls.slice(-2).reduce((sum, c) => sum + c, 0);
  const previousCalls = calls.slice(-4, -2).reduce((sum, c) => sum + c, 0);
  const trend = previousCalls > 0 ? ((recentCalls - previousCalls) / previousCalls) * 100 : 0;

  // Total stats
  const totalCalls = calls.reduce((sum, c) => sum + c, 0);
  const totalContacts = contacts.reduce((sum, c) => sum + c, 0);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <div className="p-2 rounded-lg bg-blue-500/10">
              <BarChart3 className="h-4 w-4 text-blue-500" />
            </div>
            Performance Hebdomadaire
          </CardTitle>
          
          {/* Trend indicator */}
          <div className={`flex items-center gap-1 px-2 py-1 rounded-md text-sm font-medium ${
            trend > 0 
              ? 'bg-emerald-500/10 text-emerald-600' 
              : trend < 0 
                ? 'bg-red-500/10 text-red-600' 
                : 'bg-muted text-muted-foreground'
          }`}>
            {trend > 0 ? (
              <TrendingUp className="h-4 w-4" />
            ) : trend < 0 ? (
              <TrendingDown className="h-4 w-4" />
            ) : (
              <Minus className="h-4 w-4" />
            )}
            <span>{trend > 0 ? '+' : ''}{Math.round(trend)}%</span>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {/* Legend */}
        <div className="flex items-center gap-4 mb-4">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-sm bg-primary" />
            <span className="text-sm text-muted-foreground">Appels ({totalCalls})</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-sm bg-emerald-500" />
            <span className="text-sm text-muted-foreground">Contacts ({totalContacts})</span>
          </div>
        </div>

        {/* Chart */}
        <div className="flex items-end justify-between gap-2 h-32 mb-2">
          {labels.map((label, index) => {
            const callsHeight = (calls[index] / maxValue) * 100;
            const contactsHeight = (contacts[index] / maxValue) * 100;
            const isToday = index === labels.length - 1;

            return (
              <div key={index} className="flex-1 flex flex-col items-center gap-1">
                {/* Bars container */}
                <div className="relative w-full h-full flex items-end justify-center gap-1">
                  {/* Calls bar */}
                  <div
                    className={`w-3 rounded-t transition-all duration-500 ${
                      isToday ? 'bg-primary' : 'bg-primary/60'
                    }`}
                    style={{ height: `${Math.max(callsHeight, 4)}%` }}
                    title={`${calls[index]} appels`}
                  />
                  {/* Contacts bar */}
                  <div
                    className={`w-3 rounded-t transition-all duration-500 ${
                      isToday ? 'bg-emerald-500' : 'bg-emerald-500/60'
                    }`}
                    style={{ height: `${Math.max(contactsHeight, 4)}%` }}
                    title={`${contacts[index]} contacts`}
                  />
                </div>
                
                {/* Day label */}
                <span className={`text-xs ${
                  isToday 
                    ? 'font-semibold text-primary' 
                    : 'text-muted-foreground'
                }`}>
                  {isToday ? "Auj" : label}
                </span>
              </div>
            );
          })}
        </div>

        {/* Conversion rate */}
        <div className="flex items-center justify-between pt-3 mt-3 border-t border-border/50">
          <span className="text-sm text-muted-foreground">Taux de conversion global</span>
          <span className="text-lg font-bold text-primary">{conversionRate}%</span>
        </div>
      </CardContent>
    </Card>
  );
}
