'use client';

import { useFollowups } from '@/hooks';
import { FollowupSection, FollowupsHeader, FollowupsEmpty } from '@/components/followups';
import { PageHeader } from '@/components/layout';
import { LoadingState } from '@/components/ui';
import type { FollowupUrgency } from '@/types';

const URGENCY_ORDER: FollowupUrgency[] = ['overdue', 'today', 'tomorrow', 'week'];

export default function FollowupsPage() {
  const { grouped, counts, loading, actionLoading, markDone } = useFollowups();

  if (loading) {
    return <LoadingState message="Chargement des relances..." />;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <PageHeader 
        title="Relances"
        description="Gérez vos suivis et ne manquez aucune opportunité"
      />

      {/* Stats Header */}
      <FollowupsHeader counts={counts} />

      {/* No followups */}
      {counts.total === 0 ? (
        <FollowupsEmpty />
      ) : (
        <div className="space-y-6">
          {URGENCY_ORDER.map((urgency) => {
            const leads = grouped[urgency];
            if (leads.length === 0) return null;
            
            return (
              <FollowupSection
                key={urgency}
                urgency={urgency}
                leads={leads}
                onMarkDone={markDone}
                actionLoading={actionLoading}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
