/**
 * Trip Persistence Service
 *
 * Handles saving completed drive telemetry.
 * Routes through the edge-function layer for rate limiting and server-side validation,
 * with resilient direct fallback to Postgres if the edge runtime is unreachable.
 */

import { supabase } from '@/lib/supabase';
import type { Json, Trip } from '@/types/database';

export async function fetchRecentTrips(limit = 50, vehicleId?: string | null): Promise<Trip[]> {
  let query = supabase
    .from('trips')
    .select('*')
    .order('started_at', { ascending: false })
    .limit(limit);

  if (vehicleId) {
    query = query.eq('vehicle_id', vehicleId);
  }

  const { data, error } = await query;

  if (error) {
    console.warn('[TripsService] Failed to fetch trips:', error.message);
    throw new Error(`Failed to load trips: ${error.message}`);
  }
  return data ?? [];
}

export interface InsertTripPayload {
  client_id?: string | null;
  user_id: string;
  vehicle_id: string | null;
  route: unknown;
  distance_m: number;
  duration_s: number;
  top_speed: number;
  avg_speed: number;
  speed_samples: Json;
  started_at: string;
  ended_at: string;
  moving_time_s?: number;
  pit_stop_count?: number;
  pit_stop_total_s?: number;
  pit_stops?: Json;
  start_latlng?: Json;
  end_latlng?: Json;
  snapshot_url?: string | null;
  route_points?: Json;
}

export async function saveTrip(payload: InsertTripPayload): Promise<void> {
  try {
    // 1. Attempt edge-function insert with rate limiting
    const { data, error } = await supabase.functions.invoke('insert-trip', {
      body: payload,
    });

    if (error) {
      if (error.message?.includes('Rate limit') || error.message?.includes('429')) {
        throw new Error('Rate limit exceeded: Max 10 trips per 5 minutes.');
      }
      throw error;
    }

    if (data?.error) {
      throw new Error(data.error);
    }
  } catch (edgeErr) {
    const msg = edgeErr instanceof Error ? edgeErr.message : String(edgeErr);
    if (msg.includes('Rate limit')) {
      throw edgeErr;
    }

    // 2. Resilient fallback: direct Supabase insert
    const { error: directErr } = await supabase.from('trips').insert(payload as unknown as import('@/types/database').Database['public']['Tables']['trips']['Insert']);

    if (directErr) {
      console.error('[TripsService] Direct insert fallback failed:', directErr.message);
      throw new Error(`Failed to save trip: ${directErr.message}`);
    }
  }
}

export async function updateTripSnapshot(tripIdOrClientId: string, snapshotUrl: string): Promise<void> {
  const { error } = await supabase
    .from('trips')
    .update({ snapshot_url: snapshotUrl })
    .or(`id.eq.${tripIdOrClientId},client_id.eq.${tripIdOrClientId}`);

  if (error) {
    console.warn('[TripsService] Failed to update snapshot URL:', error.message);
    throw new Error(`Failed to update snapshot: ${error.message}`);
  }
}

export async function uploadTripSnapshotImage(
  userId: string,
  tripIdOrClientId: string,
  localUri: string,
): Promise<string> {
  const res = await fetch(localUri);
  const buffer = await res.arrayBuffer();
  const filePath = `${userId}/${tripIdOrClientId}.jpg`;

  const { error } = await supabase.storage
    .from('trip-snapshots')
    .upload(filePath, buffer, {
      contentType: 'image/jpeg',
      upsert: true,
    });

  if (error) {
    console.warn('[TripsService] Snapshot upload error:', error.message);
    throw new Error(`Snapshot upload failed: ${error.message}`);
  }

  const { data: urlData } = supabase.storage
    .from('trip-snapshots')
    .getPublicUrl(filePath);

  const publicUrl = `${urlData.publicUrl}?t=${Date.now()}`;
  await updateTripSnapshot(tripIdOrClientId, publicUrl);
  return publicUrl;
}

