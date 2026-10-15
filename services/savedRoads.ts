import { supabase } from '@/lib/supabase';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SavedRoad {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  isPublic: boolean;
  lengthMeters: number;
  distanceMeters?: number; // only present on nearby query results
  routeWkt?: string; // WKT LineString
  elevationGainM?: number;
  curvinessScore?: number;
  bestAvgSpeedKmh?: number;
  savedCount?: number;
  surfaceType?: string;
  tags?: string[];
}

export interface SaveRoadInput {
  name: string;
  description?: string;
  /** WKT LineString built from the trip's GPS trace, e.g. "LINESTRING(lon lat, lon lat, ...)" */
  routeWkt: string;
  isPublic?: boolean;
  surfaceType?: string;
  tags?: string[];
  elevationGainM?: number;
  curvinessScore?: number;
  bestAvgSpeedKmh?: number;
}

// ─── CRUD ────────────────────────────────────────────────────────────────────

export async function saveRoad(input: SaveRoadInput): Promise<SavedRoad> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Authentication required');

  const name = input.name.trim();
  if (name.length < 2 || name.length > 100) {
    throw new Error('Road name must be between 2 and 100 characters');
  }
  const desc = input.description?.trim() ?? null;
  if (desc && desc.length > 500) {
    throw new Error('Description must be 500 characters or fewer');
  }
  if (!input.routeWkt || !input.routeWkt.startsWith('LINESTRING')) {
    throw new Error('A valid GPS route is required to save a road');
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('saved_roads') as any)
    .insert({
      user_id: user.id,
      name,
      description: desc,
      route: input.routeWkt,
      is_public: input.isPublic ?? false, // Default private per Phase 4 requirement
      surface_type: input.surfaceType ?? 'tarmac',
      tags: input.tags ?? ['twisty', 'scenic'],
      elevation_gain_m: input.elevationGainM ?? 0,
      curviness_score: input.curvinessScore ?? 7.5,
      best_avg_speed_kmh: input.bestAvgSpeedKmh ?? 0,
    })
    .select()
    .single();

  if (error || !data) {
    console.error('[roads] Save error:', error?.message);
    throw new Error(`Failed to save road: ${error?.message ?? 'Unknown error'}`);
  }

  return rowToRoad(data);
}

export async function fetchMyRoads(): Promise<SavedRoad[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Authentication required');

  const { data, error } = await supabase
    .from('saved_roads')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) throw new Error(`Failed to load your roads: ${error.message}`);
  return (data ?? []).map(rowToRoad);
}

export async function fetchNearbyRoads(
  lon: number,
  lat: number,
  radiusMeters: number = 100_000,
  tag?: string,
): Promise<SavedRoad[]> {
  const { data, error } = await supabase.rpc('get_nearby_roads', {
    p_lon: lon,
    p_lat: lat,
    p_radius: radiusMeters,
    p_tag: tag && tag !== 'all' ? tag : null,
  });

  if (error) {
    console.error('[roads] Nearby fetch error:', error.message);
    throw new Error(`Failed to load nearby roads: ${error.message}`);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((row: any) => ({
    id: row.id,
    userId: row.user_id,
    name: row.name,
    description: row.description ?? null,
    isPublic: row.is_public ?? false,
    lengthMeters: Number(row.length_meters) || 0,
    distanceMeters: Number(row.distance_meters) || 0,
    routeWkt: row.route_wkt ?? undefined,
    elevationGainM: Number(row.elevation_gain_m) || 0,
    curvinessScore: Number(row.curviness_score) || 7.5,
    bestAvgSpeedKmh: Number(row.best_avg_speed_kmh) || 0,
    savedCount: Number(row.saved_count) || 1,
    surfaceType: row.surface_type ?? 'tarmac',
    tags: Array.isArray(row.tags) ? row.tags : ['twisty', 'scenic'],
  }));
}

export async function deleteRoad(roadId: string): Promise<void> {
  const { error } = await supabase.from('saved_roads').delete().eq('id', roadId);
  if (error) throw new Error(`Failed to delete road: ${error.message}`);
}

export async function toggleRoadVisibility(roadId: string, isPublic: boolean): Promise<void> {
  const { error } = await supabase
    .from('saved_roads')
    .update({ is_public: isPublic })
    .eq('id', roadId);
  if (error) throw new Error(`Failed to update road visibility: ${error.message}`);
}

export async function reportRoad(roadId: string, reason: string, details?: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Authentication required');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from('saved_road_reports' as any) as any)
    .insert({
      road_id: roadId,
      reporter_id: user.id,
      reason,
      details: details?.trim() || null,
    });

  if (error) throw new Error(`Failed to submit report: ${error.message}`);
}

export async function bookmarkRoad(roadId: string): Promise<number> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.rpc as any)('toggle_saved_road_bookmark', {
    p_road_id: roadId,
  });

  if (error) {
    console.warn('[roads] Bookmark RPC error:', error.message);
    return 1;
  }

  return Number(data) || 1;
}

// ─── Utilities ────────────────────────────────────────────────────────────────

/**
 * Converts an array of GPS [lat, lon] pairs into a WKT LineString.
 * Requires at least 2 points.
 */
export function buildLineStringWkt(points: [number, number][]): string | null {
  if (points.length < 2) return null;
  const coords = points.map(([lat, lon]) => `${lon} ${lat}`).join(', ');
  return `LINESTRING(${coords})`;
}

/** Format road length for display */
export function formatRoadLength(meters: number): string {
  if (meters >= 1000) return `${(meters / 1000).toFixed(1)} km`;
  return `${Math.round(meters)} m`;
}

/** Format distance from the user to a road */
export function formatProximity(meters: number): string {
  if (meters >= 1000) return `${(meters / 1000).toFixed(1)} km away`;
  return `${Math.round(meters)} m away`;
}

// ─── Row mapper ───────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToRoad(row: any): SavedRoad {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    description: row.description ?? null,
    isPublic: row.is_public ?? false,
    lengthMeters: Number(row.length_meters) || 0,
    elevationGainM: Number(row.elevation_gain_m) || 0,
    curvinessScore: Number(row.curviness_score) || 7.5,
    bestAvgSpeedKmh: Number(row.best_avg_speed_kmh) || 0,
    savedCount: Number(row.saved_count) || 1,
    surfaceType: row.surface_type ?? 'tarmac',
    tags: Array.isArray(row.tags) ? row.tags : ['twisty', 'scenic'],
  };
}
