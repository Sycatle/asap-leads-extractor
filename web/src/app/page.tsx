'use client';

import { Phone, Calendar, AlertCircle, Zap, Rocket, ChevronDown } from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

import { LoadingState, StatCard } from '@/components/ui';
import { 
  PipelineCard, 
  UrgentFollowupsCard, 
  SessionBanner, 
  DailyGoalCard,
  StreakCard,
  TopLeadsCard,
  WeeklyChartCard
} from '@/components/dashboard';
import { PageHeader } from '@/components/layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { fetchStats, fetchSession, fetchFollowups, fetchGamifiedStats } from '@/lib/api';
import type { Stats, Session, FollowupLead } from '@/types';

// Type for gamified stats from API (matches backend return structure)
interface GamifiedStatsAPI {
  today: {
    calls_today: number;
    calls_goal: number;
    contacts_today: number;
    rdv_today: number;
    avg_call_duration: number;
  };
  streak: {
    current_streak: number;
    best_streak: number;
    last_activity_date: string | null;
  };
  top_leads: Array<{
    id: number;
    name: string;
    city: string;
    niche: string | null;
    phone: string;
    score: number;
    priority: 'high' | 'medium' | 'low';
    website: string | null;
    website_status: string | null;
    pain_points: string[] | null;
    reason: string;
  }>;
  weekly_performance: {
    calls: number[];
    contacts: number[];
    labels: string[];
  };
  conversion_rate: number;
}

type Period = '24h' | '7d' | '30d' | 'all';

const PERIOD_LABELS: Record<Period, string> = {
  '24h': '24 heures',
  '7d': '7 jours',
  '30d': '30 jours',
  'all': 'Tout',
};

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [gamifiedStats, setGamifiedStats] = useState<GamifiedStatsAPI | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [followups, setFollowups] = useState<FollowupLead[]>([]);
  const [followupCounts, setFollowupCounts] = useState<{ overdue: number; today: number; total: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<Period>('24h');

  const loadGamifiedStats = useCallback(async (selectedPeriod: Period) => {
    try {
      const gamifiedData = await fetchGamifiedStats(selectedPeriod);
      setGamifiedStats(gamifiedData as GamifiedStatsAPI);
    } catch (error) {
      console.error('Failed to fetch gamified stats:', error);
    }
  }, []);

  useEffect(() => {
    async function loadData() {
      try {
        const [statsData, sessionData, followupsData, gamifiedData] = await Promise.all([
          fetchStats(),
          fetchSession(),
          fetchFollowups(),
          fetchGamifiedStats(period),
        ]);

        setStats(statsData);
        setGamifiedStats(gamifiedData as GamifiedStatsAPI);
        
        if (sessionData.active && sessionData.session) {
          setSession(sessionData.session);
        }

        // Get first 5 urgent followups
        const urgent = [
          ...(followupsData.grouped?.overdue || []),
          ...(followupsData.grouped?.today || []),
        ].slice(0, 5);
        setFollowups(urgent);
        setFollowupCounts({
          overdue: followupsData.counts.overdue,
          today: followupsData.counts.today,
          total: followupsData.counts.total,
        });
      } catch (error) {
        console.error('Failed to fetch dashboard data:', error);
      }
      setLoading(false);
    }

    loadData();
  }, [period]);

  const handlePeriodChange = (newPeriod: Period) => {
    setPeriod(newPeriod);
    loadGamifiedStats(newPeriod);
  };

  if (loading) {
    return <LoadingState />;
  }

  // Get current hour for greeting
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Bonjour' : hour < 18 ? 'Bon après-midi' : 'Bonsoir';

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header with period selector */}
      <div className="flex items-center justify-between">
        <PageHeader 
          title={`${greeting} 👋`}
          description="Voici un aperçu de votre activité"
        />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="gap-2">
              {PERIOD_LABELS[period]}
              <ChevronDown className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {(Object.keys(PERIOD_LABELS) as Period[]).map((p) => (
              <DropdownMenuItem 
                key={p} 
                onClick={() => handlePeriodChange(p)}
                className={period === p ? 'bg-accent' : ''}
              >
                {PERIOD_LABELS[p]}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Active session banner */}
      {session && <SessionBanner session={session} />}

      {/* Quick Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Phone}
          label={`Appels (${PERIOD_LABELS[period]})`}
          value={gamifiedStats?.today.calls_today ?? 0}
          subValue={`/ ${gamifiedStats?.today.calls_goal ?? 25}`}
          color="primary"
        />
        <StatCard
          icon={Zap}
          label="Contacts établis"
          value={gamifiedStats?.today.contacts_today ?? 0}
          color="success"
        />
        <StatCard
          icon={Calendar}
          label="RDV décrochés"
          value={gamifiedStats?.today.rdv_today ?? 0}
          color="info"
        />
        <StatCard
          icon={AlertCircle}
          label="Relances urgentes"
          value={(followupCounts?.overdue ?? 0) + (followupCounts?.today ?? 0)}
          color="warning"
          href="/followups"
          alert={followupCounts?.overdue ? followupCounts.overdue > 0 : false}
        />
      </div>

      {/* Streak + Daily Goal Row */}
      {gamifiedStats && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-1">
            <StreakCard streak={gamifiedStats.streak} />
          </div>
          <div className="lg:col-span-2">
            <DailyGoalCard today={gamifiedStats.today} />
          </div>
        </div>
      )}

      {/* CTA Session */}
      {!session && (stats?.to_call ?? 0) > 0 && (
        <Card className="relative overflow-hidden bg-gradient-to-br from-primary/5 via-primary/10 to-transparent border-primary/20">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-primary/10">
                  <Rocket className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold">Prêt à prospecter?</h3>
                  <p className="text-muted-foreground">
                    {stats?.to_call} leads à appeler
                    {followupCounts?.overdue ? ` • ${followupCounts.overdue} relances en retard` : ''}
                  </p>
                </div>
              </div>
              <Link href="/call">
                <Button size="lg" className="w-full md:w-auto gap-2">
                  <Phone className="h-4 w-4" />
                  Démarrer une session
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Top Leads */}
      {gamifiedStats && (
        <TopLeadsCard leads={gamifiedStats.top_leads} />
      )}

      {/* Main content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Weekly Chart */}
        {gamifiedStats && (
          <WeeklyChartCard 
            data={gamifiedStats.weekly_performance} 
            conversionRate={gamifiedStats.conversion_rate} 
          />
        )}

        {/* Pipeline */}
        {stats && <PipelineCard stats={stats} />}
      </div>

      {/* Urgent followups */}
      <UrgentFollowupsCard followups={followups} />
    </div>
  );
}
