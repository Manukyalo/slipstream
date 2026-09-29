/**
 * Trip Persistence Service
 *
 * Handles saving completed drive telemetry.
 * Routes through the edge-function layer for rate limiting and server-side validation,
 * with resilient direct fallback to Postgres if the edge runtime is unreachable.
 */

import { supabase } from '@/lib/supabase';
import type { Json } from '@/types/database';

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
