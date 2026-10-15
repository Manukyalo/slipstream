import { supabase } from '@/lib/supabase';
import type { DragRun, DragRunInsert } from '@/types/database';
import { enqueueOrExec, generateClientId } from '@/services/offlineQueue';

export type DragDistanceType = 'quarter_mile' | 'half_mile' | 'one_mile';
export type SprintType = 'zero_to_60' | 'zero_to_100';
export type RunType = DragDistanceType | SprintType;

export const DRAG_DISTANCE_METERS: Record<DragDistanceType, number> = {
  quarter_mile: 402.336, // 1/4 mile in meters
  half_mile: 804.672,   // 1/2 mile in meters
  one_mile: 1609.344,   // 1 mile in meters
};

export const DRAG_DISTANCE_LABELS: Record<DragDistanceType, string> = {
  quarter_mile: '1/4 MILE',
  half_mile: '1/2 MILE',
  one_mile: '1 MILE',
};

export const SPRINT_TARGET_SPEED_KMH: Record<SprintType, number> = {
  zero_to_60: 96.5606, // 60 mph in km/h (~26.82 m/s)
  zero_to_100: 100.0,   // 100 km/h (~27.78 m/s)
};

export const SPRINT_LABELS: Record<SprintType, string> = {
  zero_to_60: '0–60 MPH',
  zero_to_100: '0–100 KM/H',
};

export interface SaveDragRunInput {
  userId: string;
  vehicleId?: string | null;
  distanceType: DragDistanceType;
  elapsedMs: number;
  topSpeed: number; // km/h
}

export interface SaveSprintRunInput {
  userId: string;
  vehicleId?: string | null;
  sprintType: SprintType;
  elapsedMs: number;
  topSpeed: number; // km/h
}

/**
 * Save a completed drag run to Supabase.
 */
export async function saveDragRun(input: SaveDragRunInput): Promise<DragRun> {
  const clientId = generateClientId();
  const payload: DragRunInsert = {
    client_id: clientId,
    user_id: input.userId,
    vehicle_id: input.vehicleId ?? null,
    distance_type: input.distanceType,
    elapsed_ms: Math.round(input.elapsedMs),
    top_speed: Number(input.topSpeed.toFixed(2)),
  };

  let savedRecord: DragRun | null = null;

  await enqueueOrExec('drag_run', payload, async () => {
    const { data, error } = await supabase
      .from('drag_runs')
      .insert(payload)
      .select()
      .single();

    if (error || !data) {
      console.error('[DragRunService] Failed to save drag run:', error?.message);
      throw new Error(`Failed to save drag run: ${error?.message ?? 'Unknown error'}`);
    }
    savedRecord = data;
  });

  return (
    savedRecord ?? {
      id: clientId,
      user_id: payload.user_id,
      vehicle_id: payload.vehicle_id ?? null,
      distance_type: payload.distance_type,
      elapsed_ms: payload.elapsed_ms,
      top_speed: payload.top_speed ?? 0,
      recorded_at: new Date().toISOString(),
      client_id: clientId,
      run_type: payload.run_type ?? 'quarter_mile',
    }
  );
}

/**
 * Fetch recent drag runs for a user, ordered by most recent first.
 */
export async function fetchUserDragRuns(userId: string, limit = 20): Promise<DragRun[]> {
  const { data, error } = await supabase
    .from('drag_runs')
    .select('*')
    .eq('user_id', userId)
    .order('recorded_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[DragRunService] Failed to fetch drag runs:', error.message);
    throw new Error(`Failed to load drag runs: ${error.message}`);
  }

  return data ?? [];
}

/**
 * Fetch personal bests for a vehicle or user across all three distance categories.
 */
export async function fetchPersonalBests(
  userId: string,
  vehicleId?: string | null,
): Promise<Record<DragDistanceType, DragRun | null>> {
  let query = supabase
    .from('drag_runs')
    .select('*')
    .eq('user_id', userId)
    .order('elapsed_ms', { ascending: true });

  if (vehicleId) {
    query = query.eq('vehicle_id', vehicleId);
  }

  const { data, error } = await query;
  if (error) {
    console.error('[DragRunService] Failed to fetch personal bests:', error.message);
    return {
      quarter_mile: null,
      half_mile: null,
      one_mile: null,
    };
  }

  const bests: Record<DragDistanceType, DragRun | null> = {
    quarter_mile: null,
    half_mile: null,
    one_mile: null,
  };

  for (const run of data ?? []) {
    const dist = run.distance_type as DragDistanceType;
    if (dist in bests && (!bests[dist] || run.elapsed_ms < bests[dist]!.elapsed_ms)) {
      bests[dist] = run;
    }
  }

  return bests;
}

/**
 * Save a completed sprint run (0-60 or 0-100) to Supabase.
 */
export async function saveSprintRun(input: SaveSprintRunInput): Promise<DragRun> {
  const payload: DragRunInsert = {
    user_id: input.userId,
    vehicle_id: input.vehicleId ?? null,
    distance_type: input.sprintType,
    run_type: input.sprintType,
    elapsed_ms: Math.round(input.elapsedMs),
    top_speed: Number(input.topSpeed.toFixed(2)),
  };

  const { data, error } = await supabase
    .from('drag_runs')
    .insert(payload)
    .select()
    .single();

  if (error || !data) {
    console.error('[DragRunService] Failed to save sprint run:', error?.message);
    throw new Error(`Failed to save sprint run: ${error?.message ?? 'Unknown error'}`);
  }

  return data;
}

/**
 * Fetch sprint personal bests (0-60 and 0-100) for a user/vehicle.
 */
export async function fetchSprintPersonalBests(
  userId: string,
  vehicleId?: string | null,
): Promise<Record<SprintType, DragRun | null>> {
  let query = supabase
    .from('drag_runs')
    .select('*')
    .eq('user_id', userId)
    .in('run_type', ['zero_to_60', 'zero_to_100'])
    .order('elapsed_ms', { ascending: true });

  if (vehicleId) {
    query = query.eq('vehicle_id', vehicleId);
  }

  const { data, error } = await query;
  if (error) {
    console.error('[DragRunService] Failed to fetch sprint bests:', error.message);
    return {
      zero_to_60: null,
      zero_to_100: null,
    };
  }

  const bests: Record<SprintType, DragRun | null> = {
    zero_to_60: null,
    zero_to_100: null,
  };

  for (const run of data ?? []) {
    const type = run.run_type as SprintType;
    if (type in bests && (!bests[type] || run.elapsed_ms < bests[type]!.elapsed_ms)) {
      bests[type] = run;
    }
  }

  return bests;
}

export interface SprintLeaderboardEntry {
  rank: number;
  user_id: string;
  display_name: string;
  elapsed_ms: number;
  top_speed: number;
  vehicle_make: string;
  vehicle_model: string;
  vehicle_year: number;
  recorded_at: string;
}

/**
 * Fetch sprint leaderboard entries from get_sprint_leaderboard RPC.
 */
export async function fetchSprintLeaderboard(
  sprintType: SprintType = 'zero_to_60',
  scopeType: 'global' | 'friends' = 'global',
  filterMake?: string | null,
  filterModel?: string | null,
  limitCount: number = 50,
): Promise<SprintLeaderboardEntry[]> {
  const { data, error } = await supabase.rpc('get_sprint_leaderboard', {
    sprint_type: sprintType,
    scope_type: scopeType,
    filter_make: filterMake ?? null,
    filter_model: filterModel ?? null,
    limit_count: limitCount,
  });

  if (error) {
    console.error('[DragRunService] Sprint leaderboard error:', error.message);
    return [];
  }

  return (data as SprintLeaderboardEntry[]) ?? [];
}

