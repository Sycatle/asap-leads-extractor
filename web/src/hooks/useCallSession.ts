'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { Session, Lead, CallStatus, LeadStatus } from '@/types';
import {
  fetchSession,
  startSession,
  updateSession,
  endSession as endSessionApi,
  fetchNextLead,
  logLeadCall,
  updateLeadStatus,
  scheduleLeadFollowup,
} from '@/lib/api';

interface UseCallSessionResult {
  session: Session | null;
  currentLead: Lead | null;
  loading: boolean;
  actionLoading: boolean;
  isPaused: boolean;
  elapsedTime: number;
  skippedCount: number;
  // Actions
  processOutcome: (outcome: string, followupDatetime?: string) => Promise<void>;
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
  
  const timerRef = useRef<NodeJS.Timeout | null>(null);
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
        const leadData = await fetchNextLead([]);
        setCurrentLead(leadData.lead);
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
      const data = await fetchNextLead(skippedIds);
      setCurrentLead(data.lead);
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

  // Process call outcome
  const processOutcome = useCallback(async (outcome: string, followupDatetime?: string) => {
    if (!currentLead || !session) return;
    
    setActionLoading(true);
    
    try {
      // Log the call
      const callStatus = (outcome === 'pas_interesse' ? 'appele' : outcome) as CallStatus;
      await logLeadCall(currentLead.id, callStatus, {
        auto_schedule: outcome === 'messagerie',
      });

      // If "pas_interesse", mark as lost
      if (outcome === 'pas_interesse') {
        await updateLeadStatus(currentLead.id, 'perdu' as LeadStatus, 'Pas intéressé');
      }

      // If followup date provided
      if (followupDatetime) {
        await scheduleLeadFollowup(currentLead.id, followupDatetime);
      }

      // Update session stats
      const stats: Partial<Session> = { total_calls: session.total_calls + 1 };
      if (outcome === 'appele') stats.total_reached = session.total_reached + 1;
      if (outcome === 'messagerie') stats.total_voicemail = session.total_voicemail + 1;
      if (outcome === 'rappeler' || followupDatetime) stats.total_scheduled = session.total_scheduled + 1;

      const updatedSession = await updateSession(session.id, { stats });
      setSession(updatedSession);
      
      // Reset skipped and trigger next lead fetch
      setSkippedIds([]);
      setNeedsLeadRefresh(n => n + 1);
    } catch (error) {
      console.error('Failed to process outcome:', error);
    }
    
    setActionLoading(false);
  }, [currentLead, session]);

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
    processOutcome,
    skipLead,
    endSession,
    togglePause,
    refreshNextLead,
  };
}
