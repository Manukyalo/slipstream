import { supabase } from '@/lib/supabase';

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
 */
export async function reportHazard(
  type: HazardType,
  lon: number,
  lat: number,
): Promise<void> {
  const { error } = await supabase.rpc('report_hazard', {
    hazard_type: type,
    lon,
    lat,
  });

  if (error) {
    console.error('[HazardService] Failed to report hazard:', error.message);
    throw new Error(`Failed to report hazard: ${error.message}`);
  }
}

/**
 * Query active nearby hazards within specified radius using PostGIS ST_DWithin.
 */
export async function fetchNearbyHazards(
  lon: number,
  lat: number,
  radiusMeters = 2500,
): Promise<NearbyHazard[]> {
  const { data, error } = await supabase.rpc('get_nearby_hazards', {
    user_lon: lon,
    user_lat: lat,
    radius_meters: radiusMeters,
  });

  if (error) {
    console.error('[HazardService] Failed to query nearby hazards:', error.message);
    return [];
  }

  // Map to strongly-typed array
  return (data as NearbyHazard[]) ?? [];
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
