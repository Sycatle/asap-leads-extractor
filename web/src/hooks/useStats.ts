'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Stats } from '@/types';
import { fetchStats } from '@/lib/api';

interface UseStatsResult {
  stats: Stats | null;
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

export function useStats(): UseStatsResult {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchStats();
      setStats(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch stats'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { stats, loading, error, refresh };
}
