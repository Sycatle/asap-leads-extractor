'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Lead, HistoryEntry, LeadStatus, CallStatus } from '@/types';
import {
  fetchLead,
  fetchLeadHistory,
  logLeadCall,
  updateLeadStatus,
  scheduleLeadFollowup,
  addLeadNote,
} from '@/lib/api';

interface UseLeadResult {
  lead: Lead | null;
  history: HistoryEntry[];
  loading: boolean;
  error: Error | null;
  actionLoading: string | null;
  // Actions
  refresh: () => Promise<void>;
  logCall: (callStatus: CallStatus, options?: { note?: string; auto_schedule?: boolean }) => Promise<void>;
  updateStatus: (status: LeadStatus, note?: string) => Promise<void>;
  scheduleFollowup: (date: string | null) => Promise<void>;
  addNote: (note: string) => Promise<void>;
}

export function useLead(id: number | string): UseLeadResult {
  const [lead, setLead] = useState<Lead | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const [leadData, historyData] = await Promise.all([
        fetchLead(id),
        fetchLeadHistory(id),
      ]);
      
      setLead(leadData);
      setHistory(historyData.history || []);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch lead'));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const logCall = useCallback(async (
    callStatus: CallStatus,
    options?: { note?: string; auto_schedule?: boolean }
  ) => {
    setActionLoading(callStatus);
    try {
      await logLeadCall(id, callStatus, options);
      await refresh();
    } finally {
      setActionLoading(null);
    }
  }, [id, refresh]);

  const updateStatus = useCallback(async (status: LeadStatus, note?: string) => {
    setActionLoading(status);
    try {
      await updateLeadStatus(id, status, note);
      await refresh();
    } finally {
      setActionLoading(null);
    }
  }, [id, refresh]);

  const scheduleFollowup = useCallback(async (date: string | null) => {
    setActionLoading('followup');
    try {
      await scheduleLeadFollowup(id, date);
      await refresh();
    } finally {
      setActionLoading(null);
    }
  }, [id, refresh]);

  const addNote = useCallback(async (note: string) => {
    setActionLoading('note');
    try {
      await addLeadNote(id, note);
      await refresh();
    } finally {
      setActionLoading(null);
    }
  }, [id, refresh]);

  return {
    lead,
    history,
    loading,
    error,
    actionLoading,
    refresh,
    logCall,
    updateStatus,
    scheduleFollowup,
    addNote,
  };
}
