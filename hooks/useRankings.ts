/**
 * useRankings — Phase 7
 *
 * Manages leaderboard data fetching, local cache fallback, period/scope filtering,
 * user rank resolution, and error sanitization via toUserMessage().
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  fetchTopSpeedLeaderboard,
  fetchDragLeaderboard,
  fetchDistanceLeaderboard,
  fetchUserRank,
  type ScopeType,
  type PeriodType,
  type SameCarFilter,
  type DragDistanceType,
  type TopSpeedEntry,
  type DragEntry,
  type DistanceEntry,
  type UserRankResult,
} from '@/services/rankings';
import { toUserMessage } from '@/utils/toUserMessage';

// ---------------------------------------------------------------------------
// Board State Interface
// ---------------------------------------------------------------------------

export interface BoardState<T> {
  data: T[];
  loading: boolean;
  error: string | null;
  fromCache: boolean;
  cachedAt?: number;
  refresh: () => void;
}

export interface UseRankingsParams {
  scope: ScopeType;
  period: PeriodType;
  sameCarFilter?: SameCarFilter;
  dragDistanceType: DragDistanceType;
  currentUserId?: string;
}

export function useRankings({
  scope,
  period,
  sameCarFilter,
  dragDistanceType,
  currentUserId,
}: UseRankingsParams) {
  // ── Top Speed ────────────────────────────────────────────────────────────
  const [topSpeedData, setTopSpeedData] = useState<TopSpeedEntry[]>([]);
  const [topSpeedLoading, setTopSpeedLoading] = useState(true);
  const [topSpeedError, setTopSpeedError] = useState<string | null>(null);
  const [topSpeedFromCache, setTopSpeedFromCache] = useState(false);
  const [topSpeedCachedAt, setTopSpeedCachedAt] = useState<number | undefined>(undefined);

  // ── Drag ─────────────────────────────────────────────────────────────────
  const [dragData, setDragData] = useState<DragEntry[]>([]);
  const [dragLoading, setDragLoading] = useState(true);
  const [dragError, setDragError] = useState<string | null>(null);
  const [dragFromCache, setDragFromCache] = useState(false);
  const [dragCachedAt, setDragCachedAt] = useState<number | undefined>(undefined);

  // ── Distance ─────────────────────────────────────────────────────────────
  const [distanceData, setDistanceData] = useState<DistanceEntry[]>([]);
  const [distanceLoading, setDistanceLoading] = useState(true);
  const [distanceError, setDistanceError] = useState<string | null>(null);
  const [distanceFromCache, setDistanceFromCache] = useState(false);
  const [distanceCachedAt, setDistanceCachedAt] = useState<number | undefined>(undefined);

  // ── Own user rank ────────────────────────────────────────────────────────
  const [userRank, setUserRank] = useState<UserRankResult | null>(null);
  const [userRankLoading, setUserRankLoading] = useState(false);

  const abortRef = useRef(false);

  // Fetch top speed
  const loadTopSpeed = useCallback(() => {
    setTopSpeedLoading(true);
    setTopSpeedError(null);

    fetchTopSpeedLeaderboard(scope, period, sameCarFilter)
      .then((res) => {
        if (!abortRef.current) {
          setTopSpeedData(res.data);
          setTopSpeedFromCache(res.fromCache);
          setTopSpeedCachedAt(res.cachedAt);
        }
      })
      .catch((err: unknown) => {
        if (!abortRef.current) {
          setTopSpeedError(toUserMessage(err));
        }
      })
      .finally(() => {
        if (!abortRef.current) setTopSpeedLoading(false);
      });
  }, [scope, period, sameCarFilter?.make, sameCarFilter?.model]);

  // Fetch drag
  const loadDrag = useCallback(() => {
    setDragLoading(true);
    setDragError(null);

    fetchDragLeaderboard(dragDistanceType, scope, period, sameCarFilter)
      .then((res) => {
        if (!abortRef.current) {
          setDragData(res.data);
          setDragFromCache(res.fromCache);
          setDragCachedAt(res.cachedAt);
        }
      })
      .catch((err: unknown) => {
        if (!abortRef.current) {
          setDragError(toUserMessage(err));
        }
      })
      .finally(() => {
        if (!abortRef.current) setDragLoading(false);
      });
  }, [dragDistanceType, scope, period, sameCarFilter?.make, sameCarFilter?.model]);

  // Fetch distance
  const loadDistance = useCallback(() => {
    setDistanceLoading(true);
    setDistanceError(null);

    fetchDistanceLeaderboard(scope, period, sameCarFilter)
      .then((res) => {
        if (!abortRef.current) {
          setDistanceData(res.data);
          setDistanceFromCache(res.fromCache);
          setDistanceCachedAt(res.cachedAt);
        }
      })
      .catch((err: unknown) => {
        if (!abortRef.current) {
          setDistanceError(toUserMessage(err));
        }
      })
      .finally(() => {
        if (!abortRef.current) setDistanceLoading(false);
      });
  }, [scope, period, sameCarFilter?.make, sameCarFilter?.model]);

  // Fetch user's own rank
  const loadUserRank = useCallback((boardType: 'top_speed' | 'drag' | 'distance') => {
    if (!currentUserId) {
      setUserRank(null);
      return;
    }
    setUserRankLoading(true);
    fetchUserRank(currentUserId, boardType, period, scope, sameCarFilter, dragDistanceType)
      .then((res) => {
        if (!abortRef.current) setUserRank(res);
      })
      .catch(() => {
        if (!abortRef.current) setUserRank(null);
      })
      .finally(() => {
        if (!abortRef.current) setUserRankLoading(false);
      });
  }, [currentUserId, period, scope, sameCarFilter?.make, sameCarFilter?.model, dragDistanceType]);

  useEffect(() => {
    abortRef.current = false;
    loadTopSpeed();
    loadDrag();
    loadDistance();

    return () => {
      abortRef.current = true;
    };
  }, [loadTopSpeed, loadDrag, loadDistance]);

  const topSpeed: BoardState<TopSpeedEntry> = {
    data: topSpeedData,
    loading: topSpeedLoading,
    error: topSpeedError,
    fromCache: topSpeedFromCache,
    cachedAt: topSpeedCachedAt,
    refresh: loadTopSpeed,
  };

  const drag: BoardState<DragEntry> = {
    data: dragData,
    loading: dragLoading,
    error: dragError,
    fromCache: dragFromCache,
    cachedAt: dragCachedAt,
    refresh: loadDrag,
  };

  const distance: BoardState<DistanceEntry> = {
    data: distanceData,
    loading: distanceLoading,
    error: distanceError,
    fromCache: distanceFromCache,
    cachedAt: distanceCachedAt,
    refresh: loadDistance,
  };

  return {
    topSpeed,
    drag,
    distance,
    userRank,
    userRankLoading,
    loadUserRank,
  };
}
