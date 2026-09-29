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
  routeWkt?: string; // WKT LineString — only on nearby query
}

export interface SaveRoadInput {
  name: string;
  description?: string;
  /** WKT LineString built from the trip's GPS trace, e.g. "LINESTRING(lon lat, lon lat, ...)" */
  routeWkt: string;
  isPublic?: boolean;
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

  const { data, error } = await supabase
    .from('saved_roads')
    .insert({
      user_id: user.id,
      name,
      description: desc,
      route: input.routeWkt,
      is_public: input.isPublic ?? true,
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
    .select('id, user_id, name, description, is_public, length_meters, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) throw new Error(`Failed to load your roads: ${error.message}`);
  return (data ?? []).map(rowToRoad);
}

export async function fetchNearbyRoads(
  lon: number,
  lat: number,
  radiusMeters: number = 100_000,
): Promise<SavedRoad[]> {
  const { data, error } = await supabase.rpc('get_nearby_roads', {
    p_lon: lon,
    p_lat: lat,
    p_radius: radiusMeters,
  });

  if (error) {
    console.error('[roads] Nearby fetch error:', error.message);
    throw new Error(`Failed to load nearby roads: ${error.message}`);
  }

  return (data ?? []).map((row: any) => ({  // eslint-disable-line @typescript-eslint/no-explicit-any
    id: row.id,
    userId: row.user_id,
    name: row.name,
    description: row.description ?? null,
    isPublic: row.is_public ?? true,
    lengthMeters: Number(row.length_meters) || 0,
    distanceMeters: Number(row.distance_meters) || 0,
    routeWkt: row.route_wkt ?? undefined,
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

// ─── Utilities ────────────────────────────────────────────────────────────────

/**
 * Converts an array of GPS [lat, lon] pairs into a WKT LineString.
 * Requires at least 2 points.
 */
export function buildLineStringWkt(points: Array<[number, number]>): string | null {
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
    isPublic: row.is_public ?? true,
    lengthMeters: Number(row.length_meters) || 0,
  };
}
