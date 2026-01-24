'use client';

import { Users, Phone, Calendar, TrendingUp } from 'lucide-react';
import { useState, useEffect } from 'react';

import { LoadingState, StatCard } from '@/components/ui';
import { PipelineCard, UrgentFollowupsCard, SessionBanner, CallCTA } from '@/components/dashboard';
import { PageHeader } from '@/components/layout';
import { fetchStats, fetchSession, fetchFollowups } from '@/lib/api';
import type { Stats, Session, FollowupLead } from '@/types';

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [followups, setFollowups] = useState<FollowupLead[]>([]);
  const [followupCounts, setFollowupCounts] = useState<{ overdue: number; today: number; total: number } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const [statsData, sessionData, followupsData] = await Promise.all([
          fetchStats(),
          fetchSession(),
          fetchFollowups(),
        ]);

        setStats(statsData);
        
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
  }, []);

  if (loading) {
    return <LoadingState />;
  }

  const contactRate =
    stats && stats.total > 0
      ? Math.round(
          (((stats.by_status.contacte || 0) +
            (stats.by_status.qualifie || 0) +
            (stats.by_status.proposition || 0) +
            (stats.by_status.converti || 0)) /
            stats.total) *
            100
        )
      : 0;

  // Get current hour for greeting
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Bonjour' : hour < 18 ? 'Bon après-midi' : 'Bonsoir';

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <PageHeader 
        title={`${greeting} 👋`}
        description="Voici un aperçu de votre activité"
      />

      {/* Active session banner */}
      {session && <SessionBanner session={session} />}

      {/* Stats cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Users}
          label="Total leads"
          value={stats?.total ?? 0}
          color="primary"
        />
        <StatCard
          icon={Phone}
          label="À appeler"
          value={stats?.to_call ?? 0}
          color="warning"
          href="/call"
        />
        <StatCard
          icon={Calendar}
          label="Relances"
          value={followupCounts?.overdue ?? 0}
          subValue={followupCounts?.today ? `+${followupCounts.today} auj.` : undefined}
          color="info"
          href="/followups"
          alert={followupCounts?.overdue ? followupCounts.overdue > 0 : false}
        />
        <StatCard
          icon={TrendingUp}
          label="Taux contact"
          value={`${contactRate}%`}
          color="success"
        />
      </div>

      {/* CTA */}
      {!session && (stats?.to_call ?? 0) > 0 && (
        <CallCTA
          toCall={stats?.to_call ?? 0}
          overdueFollowups={followupCounts?.overdue ?? 0}
        />
      )}

      {/* Main content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Pipeline */}
        {stats && <PipelineCard stats={stats} />}

        {/* Urgent followups */}
        <UrgentFollowupsCard followups={followups} />
      </div>
    </div>
  );
}
