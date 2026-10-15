/**
 * Rankings Service — Phase 7
 *
 * Provides typed access to Top Speed, Drag, and Distance leaderboards,
 * supporting Period filters (Week/Month/All), pagination, same-car filtering,
 * and user rank resolution with automatic offline caching.
 */

import { supabase } from '@/lib/supabase';
import {
  saveLeaderboardToCache,
  getLeaderboardFromCache,
  type CachedLeaderboard,
} from './rankingsCache';

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

export type ScopeType = 'global' | 'same_car';
export type PeriodType = 'week' | 'month' | 'all';
export type DragDistanceType = 'quarter_mile' | 'half_mile' | 'mile';

export interface SameCarFilter {
  make: string;
  model: string;
}

export interface UserRankResult {
  rank: number;
  value: number;
  subValue: number | null;
  make: string | null;
  model: string | null;
  year: number | null;
}

export interface LeaderboardResult<T> {
  data: T[];
  fromCache: boolean;
  cachedAt?: number;
}

// ---------------------------------------------------------------------------
// Top Speed Leaderboard
// ---------------------------------------------------------------------------

export interface TopSpeedEntry {
  rank: number;
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  make: string | null;
  model: string | null;
  year: number | null;
  top_speed: number; // km/h
  recorded_at: string;
}

export async function fetchTopSpeedLeaderboard(
  scope: ScopeType,
  period: PeriodType = 'all',
  sameCarFilter?: SameCarFilter,
  limit = 50,
  offset = 0,
): Promise<LeaderboardResult<TopSpeedEntry>> {
  const extraKey = `${sameCarFilter?.make ?? 'all'}_${sameCarFilter?.model ?? 'all'}_${limit}_${offset}`;

  try {
    const { data, error } = await supabase.rpc('get_top_speed_leaderboard', {
      scope_type: scope,
      period_type: period,
      filter_make: sameCarFilter?.make ?? null,
      filter_model: sameCarFilter?.model ?? null,
      limit_count: limit,
      offset_count: offset,
    });

    if (error) throw error;

    const rows: TopSpeedEntry[] = (data ?? []).map((row: Record<string, unknown>) => ({
      rank: Number(row.rank),
      user_id: row.user_id as string,
      display_name: (row.display_name as string | null) ?? 'Driver',
      avatar_url: row.avatar_url as string | null,
      make: row.make as string | null,
      model: row.model as string | null,
      year: row.year != null ? Number(row.year) : null,
      top_speed: Number(row.top_speed),
      recorded_at: row.recorded_at as string,
    }));

    // Cache to disk asynchronously
    saveLeaderboardToCache('top_speed', period, scope, extraKey, rows).catch(() => {});

    return { data: rows, fromCache: false };
  } catch (err) {
    // Attempt fallback from local cache
    const cached = await getLeaderboardFromCache<TopSpeedEntry>('top_speed', period, scope, extraKey);
    if (cached) {
      return { data: cached.data, fromCache: true, cachedAt: cached.cachedAt };
    }
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Drag Race Leaderboard
// ---------------------------------------------------------------------------

export interface DragEntry {
  rank: number;
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  make: string | null;
  model: string | null;
  year: number | null;
  elapsed_ms: number;
  top_speed: number;
  recorded_at: string;
}

export async function fetchDragLeaderboard(
  distanceType: DragDistanceType,
  scope: ScopeType,
  period: PeriodType = 'all',
  sameCarFilter?: SameCarFilter,
  limit = 50,
  offset = 0,
): Promise<LeaderboardResult<DragEntry>> {
  const extraKey = `${distanceType}_${sameCarFilter?.make ?? 'all'}_${sameCarFilter?.model ?? 'all'}_${limit}_${offset}`;

  try {
    const { data, error } = await supabase.rpc('get_drag_leaderboard', {
      target_distance_type: distanceType,
      scope_type: scope,
      period_type: period,
      filter_make: sameCarFilter?.make ?? null,
      filter_model: sameCarFilter?.model ?? null,
      limit_count: limit,
      offset_count: offset,
    });

    if (error) throw error;

    const rows: DragEntry[] = (data ?? []).map((row: Record<string, unknown>) => ({
      rank: Number(row.rank),
      user_id: row.user_id as string,
      display_name: (row.display_name as string | null) ?? 'Driver',
      avatar_url: row.avatar_url as string | null,
      make: row.make as string | null,
      model: row.model as string | null,
      year: row.year != null ? Number(row.year) : null,
      elapsed_ms: Number(row.elapsed_ms),
      top_speed: Number(row.top_speed),
      recorded_at: row.recorded_at as string,
    }));

    saveLeaderboardToCache('drag', period, scope, extraKey, rows).catch(() => {});

    return { data: rows, fromCache: false };
  } catch (err) {
    const cached = await getLeaderboardFromCache<DragEntry>('drag', period, scope, extraKey);
    if (cached) {
      return { data: cached.data, fromCache: true, cachedAt: cached.cachedAt };
    }
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Distance Leaderboard
// ---------------------------------------------------------------------------

export interface DistanceEntry {
  rank: number;
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  make: string | null;
  model: string | null;
  total_distance_m: number;
  total_trips: number;
}

export async function fetchDistanceLeaderboard(
  scope: ScopeType,
  period: PeriodType = 'all',
  sameCarFilter?: SameCarFilter,
  limit = 50,
  offset = 0,
): Promise<LeaderboardResult<DistanceEntry>> {
  const extraKey = `${sameCarFilter?.make ?? 'all'}_${sameCarFilter?.model ?? 'all'}_${limit}_${offset}`;

  try {
    const { data, error } = await supabase.rpc('get_distance_leaderboard', {
      scope_type: scope,
      period_type: period,
      filter_make: sameCarFilter?.make ?? null,
      filter_model: sameCarFilter?.model ?? null,
      limit_count: limit,
      offset_count: offset,
    });

    if (error) throw error;

    const rows: DistanceEntry[] = (data ?? []).map((row: Record<string, unknown>) => ({
      rank: Number(row.rank),
      user_id: row.user_id as string,
      display_name: (row.display_name as string | null) ?? 'Driver',
      avatar_url: row.avatar_url as string | null,
      make: row.make as string | null,
      model: row.model as string | null,
      total_distance_m: Number(row.total_distance_m),
      total_trips: Number(row.total_trips),
    }));

    saveLeaderboardToCache('distance', period, scope, extraKey, rows).catch(() => {});

    return { data: rows, fromCache: false };
  } catch (err) {
    const cached = await getLeaderboardFromCache<DistanceEntry>('distance', period, scope, extraKey);
    if (cached) {
      return { data: cached.data, fromCache: true, cachedAt: cached.cachedAt };
    }
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Single-user rank resolution (for pinned 'You, #N' bar)
// ---------------------------------------------------------------------------

export type BoardTab = 'top_speed' | 'drag' | 'distance';

export async function fetchUserRank(
  userId: string,
  boardType: 'top_speed' | 'drag' | 'distance',
  period: PeriodType = 'all',
  scope: ScopeType = 'global',
  sameCarFilter?: SameCarFilter,
  distanceType: DragDistanceType = 'quarter_mile',
): Promise<UserRankResult | null> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.rpc as any)('get_my_leaderboard_rank', {
      target_user_id: userId,
      board_type: boardType,
      period_type: period,
      scope_type: scope,
      filter_make: sameCarFilter?.make ?? null,
      filter_model: sameCarFilter?.model ?? null,
      target_distance_type: distanceType,
    });

    if (error || !data || (data as unknown[]).length === 0) return null;

    const row = (data as Record<string, unknown>[])[0];
    if (!row) return null;

    return {
      rank: Number(row.rank),
      value: Number(row.value),
      subValue: row.sub_value != null ? Number(row.sub_value) : null,
      make: (row.make as string | null) ?? null,
      model: (row.model as string | null) ?? null,
      year: row.year != null ? Number(row.year) : null,
    };
  } catch (err) {
    if (__DEV__) {
      console.warn('[Rankings] fetchUserRank error:', err);
    }
    return null;
  }
}
