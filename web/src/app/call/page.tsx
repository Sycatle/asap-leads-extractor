'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useCallSession } from '@/hooks';
import { CALL_OUTCOMES } from '@/lib/constants';
import { LoadingState } from '@/components/ui';
import {
  SessionHeader,
  CurrentLeadCard,
  CallOutcomesCard,
  SessionCompleteCard,
  QuickNoteInput,
  CallActions,
  NextStepDrawer,
} from '@/components/call';
import type { CallOutcome, NextStep, LostReason } from '@/types';

export default function CallSessionPage() {
  const router = useRouter();
  const [note, setNote] = useState('');

  const {
    session,
    currentLead,
    loading,
    actionLoading,
    isPaused,
    elapsedTime,
    pendingOutcome,
    selectOutcome,
    confirmOutcome,
    cancelOutcome,
    skipLead,
    endSession,
    togglePause,
  } = useCallSession();

  // Handle outcome selection
  const handleOutcome = useCallback((outcome: CallOutcome) => {
    if (!currentLead || actionLoading) return;
    selectOutcome(outcome);
  }, [currentLead, actionLoading, selectOutcome]);

  // Handle next step confirmation from drawer
  const handleNextStepConfirm = useCallback(async (
    nextStep: NextStep,
    lostReason?: LostReason,
    lostNote?: string
  ) => {
    await confirmOutcome(nextStep, lostReason, lostNote);
    setNote('');
  }, [confirmOutcome]);

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
      // Don't handle shortcuts when typing in inputs or when drawer is open
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        pendingOutcome
      ) {
        return;
      }

      const outcome = CALL_OUTCOMES.find((o) => o.key === e.key);
      if (outcome && currentLead) {
        handleOutcome(outcome.id);
      } else if (e.key === ' ' && !actionLoading) {
        e.preventDefault();
        handleSkip();
      } else if (e.key === 'Escape') {
        if (pendingOutcome) {
          cancelOutcome();
        } else {
          togglePause();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentLead, actionLoading, pendingOutcome, handleOutcome, handleSkip, togglePause, cancelOutcome]);

  // Loading session
  if (!session) {
    return <LoadingState message="Démarrage de la session..." />;
  }

  // Check if NextStepDrawer should be shown
  const showNextStepDrawer = pendingOutcome !== null && 
    pendingOutcome !== 'opt_out' && 
    pendingOutcome !== 'mauvais_numero';

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

      {/* Next Step Drawer */}
      <NextStepDrawer
        isOpen={showNextStepDrawer}
        outcome={pendingOutcome}
        leadName={currentLead?.name || ''}
        onConfirm={handleNextStepConfirm}
        onClose={cancelOutcome}
        loading={actionLoading}
      />
    </div>
  );
}
