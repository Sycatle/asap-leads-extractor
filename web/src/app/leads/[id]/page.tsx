'use client';

import { useState } from 'react';
import { Loader2, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';

import { useLead } from '@/hooks';
import { FollowupModal, StatusBadge } from '@/components/ui';
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
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-zinc-400" />
      </div>
    );
  }

  // Not found state
  if (!lead) {
    return (
      <div className="text-center py-12">
        <p className="text-zinc-500">Lead non trouvé</p>
        <Link href="/leads" className="text-blue-600 hover:underline mt-2 inline-block">
          Retour à la liste
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header with back button and status */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.back()}
          className="p-2 rounded-lg hover:bg-accent"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
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
