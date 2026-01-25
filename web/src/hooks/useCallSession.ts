'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { Session, Lead, CallStatus, LeadStatus, CallOutcome, NextStep, LostReason } from '@/types';
import { CALL_OUTCOMES } from '@/lib/constants';
import {
  fetchSession,
  startSession,
  updateSession,
  endSession as endSessionApi,
  fetchNextLead,
  logLeadCall,
  updateLeadStatus,
  scheduleLeadFollowup,
  processLeadOutcome,
  markLeadOptOut,
} from '@/lib/api';

interface UseCallSessionResult {
  session: Session | null;
  currentLead: Lead | null;
  loading: boolean;
  actionLoading: boolean;
  isPaused: boolean;
  elapsedTime: number;
  skippedCount: number;
  pendingOutcome: CallOutcome | null;
  // Actions
  selectOutcome: (outcome: CallOutcome) => void;
  confirmOutcome: (nextStep: NextStep, lostReason?: LostReason, lostNote?: string) => Promise<void>;
  cancelOutcome: () => void;
  skipLead: () => void;
  endSession: () => Promise<void>;
  togglePause: () => void;
  refreshNextLead: () => Promise<void>;
}

export function useCallSession(): UseCallSessionResult {
  const [session, setSession] = useState<Session | null>(null);
  const [currentLead, setCurrentLead] = useState<Lead | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [skippedIds, setSkippedIds] = useState<number[]>([]);
  const [pendingOutcome, setPendingOutcome] = useState<CallOutcome | null>(null);
  
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const recentNichesRef = useRef<string[]>([]); // Tracking pour rotation niches (ref pour éviter boucle)
  const [needsLeadRefresh, setNeedsLeadRefresh] = useState(0);

  // Initialize session and fetch first lead
  useEffect(() => {
    async function init() {
      try {
        setLoading(true);
        const data = await fetchSession();
        
        let activeSession: Session;
        if (data.active && data.session) {
          activeSession = data.session;
        } else {
          activeSession = await startSession();
        }
        setSession(activeSession);
        
        // Fetch first lead immediately after getting session
        const leadData = await fetchNextLead({ excludeIds: [] });
        setCurrentLead(leadData.lead);
        
        // Track niche for rotation
        if (leadData.lead?.niche) {
          recentNichesRef.current = [leadData.lead.niche];
        }
      } catch (error) {
        console.error('Failed to init session:', error);
      } finally {
        setLoading(false);
      }
    }
    init();
  }, []);

  // Fetch next lead (manual refresh)
  const refreshNextLead = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchNextLead({ excludeIds: skippedIds, recentNiches: recentNichesRef.current });
      setCurrentLead(data.lead);
      
      // Update recent niches for rotation (keep last 5)
      if (data.lead?.niche) {
        recentNichesRef.current = [data.lead.niche, ...recentNichesRef.current].slice(0, 5);
      }
    } catch (error) {
      console.error('Failed to fetch next lead:', error);
    }
    setLoading(false);
  }, [skippedIds]);

  // Trigger refresh when needsLeadRefresh changes (avoids direct setState in effect)
  useEffect(() => {
    if (needsLeadRefresh > 0 && session) {
      refreshNextLead();
    }
  }, [needsLeadRefresh, session, refreshNextLead]);

  // Timer
  useEffect(() => {
    if (session && !isPaused) {
      timerRef.current = setInterval(() => {
        const start = new Date(session.started_at).getTime();
        const now = Date.now();
        setElapsedTime(Math.floor((now - start) / 1000));
      }, 1000);
    }
    
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [session, isPaused]);

  // Select outcome (step 1 of workflow)
  const selectOutcome = useCallback((outcome: CallOutcome) => {
    if (!currentLead) return;
    
    const outcomeConfig = CALL_OUTCOMES.find((o) => o.id === outcome);
    
    // For outcomes that don't require next step, process immediately
    if (outcome === 'opt_out' || outcome === 'mauvais_numero' || !outcomeConfig?.requiresNextStep) {
      // Process directly
      setPendingOutcome(outcome);
      // Auto-confirm for these
      if (outcome === 'opt_out') {
        confirmOutcomeInternal(outcome, { type: 'aucun' });
      } else if (outcome === 'mauvais_numero') {
        confirmOutcomeInternal(outcome, { type: 'aucun' });
      }
      return;
    }
    
    // Show next step drawer
    setPendingOutcome(outcome);
  }, [currentLead]);

  // Internal confirm (used by auto-confirm and external confirm)
  const confirmOutcomeInternal = useCallback(async (
    outcome: CallOutcome,
    nextStep: NextStep,
    lostReason?: LostReason,
    lostNote?: string
  ) => {
    if (!currentLead || !session) return;
    
    setActionLoading(true);
    
    try {
      // Handle opt-out specially
      if (outcome === 'opt_out') {
        await markLeadOptOut(currentLead.id);
      } else {
        // Map outcome to call status for logging
        const callStatusMap: Record<CallOutcome, CallStatus> = {
          injoignable: 'injoignable',
          mauvais_numero: 'appele',
          accueil: 'appele',
          decideur_absent: 'rappeler',
          rappeler: 'rappeler',
          interesse: 'appele',
          rdv_pris: 'appele',
          devis_envoye: 'appele',
          perdu: 'appele',
          opt_out: 'appele',
        };
        
        const callStatus = callStatusMap[outcome];
        await logLeadCall(currentLead.id, callStatus);
        
        // Handle specific outcomes
        if (outcome === 'perdu') {
          await updateLeadStatus(currentLead.id, 'perdu', lostNote || lostReason);
        } else if (outcome === 'rdv_pris') {
          await updateLeadStatus(currentLead.id, 'qualifie', 'RDV pris');
        } else if (outcome === 'devis_envoye') {
          await updateLeadStatus(currentLead.id, 'proposition', 'Devis envoyé');
        } else if (outcome === 'interesse') {
          await updateLeadStatus(currentLead.id, 'contacte', 'Intéressé');
        }
        
        // Schedule followup if next step has datetime
        if (nextStep.datetime) {
          await scheduleLeadFollowup(currentLead.id, nextStep.datetime);
        }
      }

      // Update session stats
      const stats: Partial<Session> = { total_calls: session.total_calls + 1 };
      if (['interesse', 'rdv_pris', 'devis_envoye', 'accueil'].includes(outcome)) {
        stats.total_reached = session.total_reached + 1;
      }
      if (nextStep.datetime || outcome === 'rdv_pris') {
        stats.total_scheduled = session.total_scheduled + 1;
      }

      const updatedSession = await updateSession(session.id, { stats });
      setSession(updatedSession);
      
      // Reset and fetch next lead
      setPendingOutcome(null);
      setSkippedIds([]);
      setNeedsLeadRefresh(n => n + 1);
    } catch (error) {
      console.error('Failed to process outcome:', error);
    }
    
    setActionLoading(false);
  }, [currentLead, session]);

  // Confirm outcome (step 2 of workflow - from NextStepDrawer)
  const confirmOutcome = useCallback(async (
    nextStep: NextStep,
    lostReason?: LostReason,
    lostNote?: string
  ) => {
    if (!pendingOutcome) return;
    await confirmOutcomeInternal(pendingOutcome, nextStep, lostReason, lostNote);
  }, [pendingOutcome, confirmOutcomeInternal]);

  // Cancel outcome selection
  const cancelOutcome = useCallback(() => {
    setPendingOutcome(null);
  }, []);

  const skipLead = useCallback(() => {
    if (!currentLead) return;
    setSkippedIds(prev => [...prev, currentLead.id]);
    setNeedsLeadRefresh(n => n + 1);
  }, [currentLead]);

  const endSession = useCallback(async () => {
    if (!session) return;
    await endSessionApi(session.id);
  }, [session]);

  const togglePause = useCallback(() => {
    setIsPaused(p => !p);
  }, []);

  return {
    session,
    currentLead,
    loading,
    actionLoading,
    isPaused,
    elapsedTime,
    skippedCount: skippedIds.length,
    pendingOutcome,
    selectOutcome,
    confirmOutcome,
    cancelOutcome,
    skipLead,
    endSession,
    togglePause,
    refreshNextLead,
  };
}
