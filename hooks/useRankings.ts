/**
 * useRankings
 *
 * Manages the three leaderboard fetches with loading / error / data states.
 * Scope + drag distance type are controlled externally (passed from the screen).
 * The hook re-fetches whenever scope or distanceType changes.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  fetchTopSpeedLeaderboard,
  fetchDragLeaderboard,
  fetchDistanceLeaderboard,
  type ScopeType,
  type SameCarFilter,
  type DragDistanceType,
  type TopSpeedEntry,
  type DragEntry,
  type DistanceEntry,
} from '@/services/rankings';

// ---------------------------------------------------------------------------
// Individual board hooks (used internally — exported for targeted use too)
// ---------------------------------------------------------------------------

interface BoardState<T> {
  data: T[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

function useTopSpeed(scope: ScopeType, filter?: SameCarFilter): BoardState<TopSpeedEntry> {
  const [data, setData] = useState<TopSpeedEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Abort controller prevents stale responses from overwriting fresh ones.
  const abortRef = useRef(false);

  const load = useCallback(() => {
    abortRef.current = false;
    setLoading(true);
    setError(null);

    fetchTopSpeedLeaderboard(scope, filter)
      .then((rows) => {
        if (!abortRef.current) setData(rows);
      })
      .catch((err: unknown) => {
        if (!abortRef.current)
          setError(err instanceof Error ? err.message : 'Failed to load leaderboard');
      })
      .finally(() => {
        if (!abortRef.current) setLoading(false);
      });
  }, [scope, filter?.make, filter?.model]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    load();
    return () => {
      abortRef.current = true;
    };
  }, [load]);

  return { data, loading, error, refresh: load };
}

function useDrag(
  distanceType: DragDistanceType,
  scope: ScopeType,
  filter?: SameCarFilter,
): BoardState<DragEntry> {
  const [data, setData] = useState<DragEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef(false);

  const load = useCallback(() => {
    abortRef.current = false;
    setLoading(true);
    setError(null);

    fetchDragLeaderboard(distanceType, scope, filter)
      .then((rows) => {
        if (!abortRef.current) setData(rows);
      })
      .catch((err: unknown) => {
        if (!abortRef.current)
          setError(err instanceof Error ? err.message : 'Failed to load leaderboard');
      })
      .finally(() => {
        if (!abortRef.current) setLoading(false);
      });
  }, [distanceType, scope, filter?.make, filter?.model]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    load();
    return () => {
      abortRef.current = true;
    };
  }, [load]);

  return { data, loading, error, refresh: load };
}

function useDistance(scope: ScopeType, filter?: SameCarFilter): BoardState<DistanceEntry> {
  const [data, setData] = useState<DistanceEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef(false);

  const load = useCallback(() => {
    abortRef.current = false;
    setLoading(true);
    setError(null);

    fetchDistanceLeaderboard(scope, filter)
      .then((rows) => {
        if (!abortRef.current) setData(rows);
      })
      .catch((err: unknown) => {
        if (!abortRef.current)
          setError(err instanceof Error ? err.message : 'Failed to load leaderboard');
      })
      .finally(() => {
        if (!abortRef.current) setLoading(false);
      });
  }, [scope, filter?.make, filter?.model]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    load();
    return () => {
      abortRef.current = true;
    };
  }, [load]);

  return { data, loading, error, refresh: load };
}

// ---------------------------------------------------------------------------
// Composite hook — used by RankingsScreen
// ---------------------------------------------------------------------------

export interface UseRankingsParams {
  scope: ScopeType;
  sameCarFilter?: SameCarFilter;
  dragDistanceType: DragDistanceType;
}

export function useRankings({ scope, sameCarFilter, dragDistanceType }: UseRankingsParams) {
  const topSpeed = useTopSpeed(scope, sameCarFilter);
  const drag = useDrag(dragDistanceType, scope, sameCarFilter);
  const distance = useDistance(scope, sameCarFilter);

  return { topSpeed, drag, distance };
}
