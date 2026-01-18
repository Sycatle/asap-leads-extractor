'use client';

import { useState, useEffect, useCallback } from 'react';
import type { FollowupsData } from '@/types';
import { fetchFollowups, scheduleLeadFollowup } from '@/lib/api';

interface UseFollowupsResult {
  grouped: FollowupsData['grouped'];
  counts: FollowupsData['counts'];
  loading: boolean;
  error: Error | null;
  actionLoading: number | null;
  // Actions
  refresh: () => Promise<void>;
  markDone: (leadId: number) => Promise<void>;
}

export function useFollowups(): UseFollowupsResult {
  const [data, setData] = useState<FollowupsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await fetchFollowups();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch followups'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const markDone = useCallback(async (leadId: number) => {
    setActionLoading(leadId);
    try {
      await scheduleLeadFollowup(leadId, null);
      await refresh();
    } catch (error) {
      console.error('Failed to mark done:', error);
    }
    setActionLoading(null);
  }, [refresh]);

  const defaultGrouped: FollowupsData['grouped'] = {
    overdue: [],
    today: [],
    tomorrow: [],
    week: [],
  };

  const defaultCounts: FollowupsData['counts'] = {
    overdue: 0,
    today: 0,
    tomorrow: 0,
    week: 0,
    total: 0,
  };

  return {
    grouped: data?.grouped ?? defaultGrouped,
    counts: data?.counts ?? defaultCounts,
    loading,
    error,
    actionLoading,
    refresh,
    markDone,
  };
}
