import { supabase } from '@/lib/supabase';
import type { DragRun, DragRunInsert } from '@/types/database';

export type DragDistanceType = 'quarter_mile' | 'half_mile' | 'one_mile';

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

export interface SaveDragRunInput {
  userId: string;
  vehicleId?: string | null;
  distanceType: DragDistanceType;
  elapsedMs: number;
  topSpeed: number; // km/h
}

/**
 * Save a completed drag run to Supabase.
 */
export async function saveDragRun(input: SaveDragRunInput): Promise<DragRun> {
  const payload: DragRunInsert = {
    user_id: input.userId,
    vehicle_id: input.vehicleId ?? null,
    distance_type: input.distanceType,
    elapsed_ms: Math.round(input.elapsedMs),
    top_speed: Number(input.topSpeed.toFixed(2)),
  };

  const { data, error } = await supabase
    .from('drag_runs')
    .insert(payload)
    .select()
    .single();

  if (error || !data) {
    console.error('[DragRunService] Failed to save drag run:', error?.message);
    throw new Error(`Failed to save drag run: ${error?.message ?? 'Unknown error'}`);
  }

  return data;
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
