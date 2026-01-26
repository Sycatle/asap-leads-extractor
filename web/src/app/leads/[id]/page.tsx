'use client';

import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';

import { useLead } from '@/hooks';
import { FollowupModal, StatusBadge, LoadingState } from '@/components/ui';
import { Button } from '@/components/ui/button';
import { CurrentLeadCard } from '@/components/call';
import {
  LeadActionsCard,
  LeadNotesCard,
} from '@/components/leads';
import type { CallStatus, LeadStatus } from '@/types';

export default function LeadDetailPage() {
  const params = useParams();
  const router = useRouter();
  const leadId = params.id as string;
  const [showFollowupModal, setShowFollowupModal] = useState(false);

  const {
    lead,
    loading,
    actionLoading,
    logCall,
    updateStatus,
    scheduleFollowup,
    addNote,
  } = useLead(leadId);

  // Handle followup scheduling
  const handleScheduleFollowup = async (datetime: string) => {
    setShowFollowupModal(false);
    await scheduleFollowup(datetime);
  };

  // Loading state
  if (loading) {
    return <LoadingState message="Chargement du lead..." />;
  }

  // Not found state
  if (!lead) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <p className="text-muted-foreground">Lead non trouvé</p>
        <Button variant="outline" onClick={() => router.push('/leads')}>
          Retour à la liste
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-fade-in">
      {/* Header with back button and status */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.back()}
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-foreground">
            {lead.name}
          </h1>
          <p className="text-muted-foreground">{lead.niche} • {lead.city}</p>
        </div>
        <StatusBadge status={lead.status} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column - Lead info card (same as call page) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Current Lead Card - Same rich info as /call page */}
          <CurrentLeadCard lead={lead} hideViewButton />

          {/* Notes */}
          <LeadNotesCard
            notes={lead.notes}
            onAddNote={addNote}
            loading={actionLoading === 'note'}
          />
        </div>

        {/* Right column - Actions */}
        <div className="lg:sticky lg:top-4 lg:self-start space-y-6">
          {/* Quick Actions */}
          <LeadActionsCard
            lead={lead}
            actionLoading={actionLoading}
            onLogCall={(status) => logCall(status as CallStatus)}
            onUpdateStatus={(status) => updateStatus(status as LeadStatus)}
            onScheduleFollowup={() => setShowFollowupModal(true)}
          />
        </div>
      </div>

      {/* Followup Modal */}
      <FollowupModal
        isOpen={showFollowupModal}
        onClose={() => setShowFollowupModal(false)}
        onConfirm={handleScheduleFollowup}
        loading={actionLoading === 'followup'}
      />
    </div>
  );
}
