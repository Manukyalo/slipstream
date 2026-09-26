import { supabase } from '@/lib/supabase';
import { withCache } from '@/services/cache';

export type HazardType = 'speed_trap' | 'camera' | 'police';

export interface NearbyHazard {
  id: string;
  user_id: string;
  type: HazardType;
  longitude: number;
  latitude: number;
  distance_meters: number;
  confirmations: number;
  reported_at: string;
  expires_at: string;
}

export const HAZARD_CONFIG: Record<
  HazardType,
  { label: string; icon: string; color: string; description: string }
> = {
  speed_trap: {
    label: 'Speed Trap',
    icon: '⚡',
    color: '#FF6B35',
    description: 'Radar speed trap spotted',
  },
  camera: {
    label: 'Speed Camera',
    icon: '📷',
    color: '#00D4FF',
    description: 'Automated enforcement camera',
  },
  police: {
    label: 'Police Presence',
    icon: '🚓',
    color: '#EF4444',
    description: 'Active highway patrol vehicle',
  },
};

/**
 * Report a new hazard at the user's current GPS location.
 * Routes through the rate-limited Edge Function, falling back to direct RPC.
 */
export async function reportHazard(
  type: HazardType,
  lon: number,
  lat: number,
): Promise<void> {
  try {
    const { data, error } = await supabase.functions.invoke('report-hazard', {
      body: { hazard_type: type, lon, lat },
    });

    if (error) {
      // Check if it's an explicit 429 rate-limit response from Edge function
      if (error.message?.includes('Rate limit') || error.message?.includes('429')) {
        throw new Error('Rate limit exceeded: Max 5 hazard reports per 10 minutes. Please slow down.');
      }
      throw error;
    }

    if (data?.error) {
      throw new Error(data.error);
    }
    return;
  } catch (edgeErr) {
    // If rate limit error, propagate it
    const msg = edgeErr instanceof Error ? edgeErr.message : String(edgeErr);
    if (msg.includes('Rate limit')) {
      throw edgeErr;
    }

    // Edge function unavailable or failed: fallback to direct RPC with database rate limiting
    const { error: rpcErr } = await supabase.rpc('report_hazard', {
      hazard_type: type,
      lon,
      lat,
    });

    if (rpcErr) {
      console.error('[HazardService] Direct RPC fallback also failed:', rpcErr.message);
      throw new Error(`Failed to report hazard: ${rpcErr.message}`);
    }
  }
}

/**
 * Query active nearby hazards within specified radius using PostGIS ST_DWithin.
 * Caches hot reads in Redis/memory with a 30s TTL across a ~200m spatial grid tile.
 */
export async function fetchNearbyHazards(
  lon: number,
  lat: number,
  radiusMeters = 2500,
): Promise<NearbyHazard[]> {
  // Quantize coordinates to ~200m grid cells (0.002 deg) for distributed tile caching
  const latTile = (Math.round(lat * 500) / 500).toFixed(3);
  const lonTile = (Math.round(lon * 500) / 500).toFixed(3);
  const cacheKey = `hazards:tile:${latTile}:${lonTile}:${radiusMeters}`;

  return withCache(cacheKey, 30, async () => {
    const { data, error } = await supabase.rpc('get_nearby_hazards', {
      user_lon: lon,
      user_lat: lat,
      radius_meters: radiusMeters,
    });

    if (error) {
      console.error('[HazardService] Failed to query nearby hazards:', error.message);
      return [];
    }

    return (data as NearbyHazard[]) ?? [];
  });
}

/**
 * Confirm a hazard spotted by another driver to increment confirmation tally.
 */
export async function confirmHazard(hazardId: string): Promise<number> {
  const { data, error } = await supabase.rpc('confirm_hazard', {
    target_hazard_id: hazardId,
  });

  if (error) {
    console.error('[HazardService] Failed to confirm hazard:', error.message);
    throw new Error(`Failed to confirm hazard: ${error.message}`);
  }

  return (data as number) ?? 1;
}
