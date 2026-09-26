/**
 * Rankings Service
 *
 * Thin wrappers around the Supabase RPC calls for the three leaderboards.
 * All result types are explicit; no `any`.
 */

import { supabase } from '@/lib/supabase';

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

export type ScopeType = 'global' | 'same_car';

export interface SameCarFilter {
  make: string;
  model: string;
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
  sameCarFilter?: SameCarFilter,
  limit = 50,
): Promise<TopSpeedEntry[]> {
  const { data, error } = await supabase.rpc('get_top_speed_leaderboard', {
    scope_type: scope,
    filter_make: sameCarFilter?.make ?? null,
    filter_model: sameCarFilter?.model ?? null,
    limit_count: limit,
  });

  if (error) throw new Error(`top_speed_leaderboard: ${error.message}`);

  // RPC returns numeric rank as bigint string in some Postgres drivers
  return (data ?? []).map((row: Record<string, unknown>) => ({
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
}

// ---------------------------------------------------------------------------
// Drag Race Leaderboard
// ---------------------------------------------------------------------------

export type DragDistanceType = 'quarter_mile' | 'half_mile' | 'mile';

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
  sameCarFilter?: SameCarFilter,
  limit = 50,
): Promise<DragEntry[]> {
  const { data, error } = await supabase.rpc('get_drag_leaderboard', {
    target_distance_type: distanceType,
    scope_type: scope,
    filter_make: sameCarFilter?.make ?? null,
    filter_model: sameCarFilter?.model ?? null,
    limit_count: limit,
  });

  if (error) throw new Error(`drag_leaderboard: ${error.message}`);

  return (data ?? []).map((row: Record<string, unknown>) => ({
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
  sameCarFilter?: SameCarFilter,
  limit = 50,
): Promise<DistanceEntry[]> {
  const { data, error } = await supabase.rpc('get_distance_leaderboard', {
    scope_type: scope,
    filter_make: sameCarFilter?.make ?? null,
    filter_model: sameCarFilter?.model ?? null,
    limit_count: limit,
  });

  if (error) throw new Error(`distance_leaderboard: ${error.message}`);

  return (data ?? []).map((row: Record<string, unknown>) => ({
    rank: Number(row.rank),
    user_id: row.user_id as string,
    display_name: (row.display_name as string | null) ?? 'Driver',
    avatar_url: row.avatar_url as string | null,
    make: row.make as string | null,
    model: row.model as string | null,
    total_distance_m: Number(row.total_distance_m),
    total_trips: Number(row.total_trips),
  }));
}
