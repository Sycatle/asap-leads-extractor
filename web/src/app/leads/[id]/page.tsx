'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

import { useLead } from '@/hooks';
import { FollowupModal } from '@/components/ui';
import {
  LeadDetailHeader,
  LeadInfoCard,
  LeadActionsCard,
  LeadNotesCard,
  LeadHistory,
} from '@/components/leads';
import type { CallStatus, LeadStatus } from '@/types';

export default function LeadDetailPage() {
  const params = useParams();
  const leadId = params.id as string;
  const [showFollowupModal, setShowFollowupModal] = useState(false);

  const {
    lead,
    history,
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
    <div className="space-y-6">
      {/* Header */}
      <LeadDetailHeader lead={lead} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column - Info & Actions */}
        <div className="lg:col-span-2 space-y-6">
          {/* Contact & Business Info */}
          <LeadInfoCard lead={lead} />

          {/* Quick Actions */}
          <LeadActionsCard
            lead={lead}
            actionLoading={actionLoading}
            onLogCall={(status) => logCall(status as CallStatus)}
            onUpdateStatus={(status) => updateStatus(status as LeadStatus)}
            onScheduleFollowup={() => setShowFollowupModal(true)}
          />

          {/* Notes */}
          <LeadNotesCard
            notes={lead.notes}
            onAddNote={addNote}
            loading={actionLoading === 'note'}
          />
        </div>

        {/* Right column - History */}
        <div className="space-y-6">
          <LeadHistory history={history} />
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
