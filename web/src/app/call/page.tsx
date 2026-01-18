'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useCallSession } from '@/hooks';
import { CALL_OUTCOMES } from '@/lib/constants';
import { FollowupModal, LoadingState } from '@/components/ui';
import {
  SessionHeader,
  CurrentLeadCard,
  CallOutcomesCard,
  SessionCompleteCard,
  QuickNoteInput,
  CallActions,
} from '@/components/call';
import type { CallOutcome } from '@/types';

export default function CallSessionPage() {
  const router = useRouter();
  const [note, setNote] = useState('');
  const [showFollowupModal, setShowFollowupModal] = useState(false);
  const [pendingOutcome, setPendingOutcome] = useState<CallOutcome | null>(null);

  const {
    session,
    currentLead,
    loading,
    actionLoading,
    isPaused,
    elapsedTime,
    processOutcome,
    skipLead,
    endSession,
    togglePause,
  } = useCallSession();

  // Handle outcome
  const handleOutcome = useCallback(async (outcome: CallOutcome) => {
    if (!currentLead || actionLoading) return;

    // For "rappeler", show the modal first
    if (outcome === 'rappeler') {
      setPendingOutcome(outcome);
      setShowFollowupModal(true);
      return;
    }

    await processOutcome(outcome);
    setNote('');
  }, [currentLead, actionLoading, processOutcome]);

  // Handle followup confirmation
  const handleFollowupConfirm = useCallback(async (datetime: string) => {
    setShowFollowupModal(false);
    await processOutcome(pendingOutcome || 'rappeler', datetime);
    setPendingOutcome(null);
    setNote('');
  }, [pendingOutcome, processOutcome]);

  // Handle skip
  const handleSkip = useCallback(() => {
    skipLead();
    setNote('');
  }, [skipLead]);

  // Handle end session
  const handleEnd = useCallback(async () => {
    await endSession();
    router.push('/leads');
  }, [endSession, router]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      const outcome = CALL_OUTCOMES.find((o) => o.key === e.key);
      if (outcome && currentLead) {
        handleOutcome(outcome.id);
      } else if (e.key === ' ' && !actionLoading) {
        e.preventDefault();
        handleSkip();
      } else if (e.key === 'Escape') {
        togglePause();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentLead, actionLoading, handleOutcome, handleSkip, togglePause]);

  // Loading session
  if (!session) {
    return <LoadingState message="Démarrage de la session..." />;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <SessionHeader
        session={session}
        elapsedTime={elapsedTime}
        isPaused={isPaused}
        onTogglePause={togglePause}
        onEnd={handleEnd}
      />

      {/* Main content */}
      {loading ? (
        <LoadingState message="Chargement du prochain lead..." />
      ) : !currentLead ? (
        <SessionCompleteCard session={session} onEnd={handleEnd} />
      ) : (
        <>
          {/* Current lead card */}
          <CurrentLeadCard lead={currentLead} />

          {/* Call outcomes */}
          <CallOutcomesCard
            onOutcome={handleOutcome}
            loading={actionLoading}
          />

          {/* Quick note */}
          <QuickNoteInput value={note} onChange={setNote} />

          {/* Actions */}
          <CallActions
            onSkip={handleSkip}
            onEnd={handleEnd}
            disabled={actionLoading}
          />
        </>
      )}

      {/* Followup Modal */}
      <FollowupModal
        isOpen={showFollowupModal}
        onClose={() => {
          setShowFollowupModal(false);
          setPendingOutcome(null);
        }}
        onConfirm={handleFollowupConfirm}
        loading={actionLoading}
      />
    </div>
  );
}
