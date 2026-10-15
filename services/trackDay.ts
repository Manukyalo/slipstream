import { supabase } from '@/lib/supabase';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface TrackPoint {
  lon: number;
  lat: number;
  heading?: number | null;
}

export interface SectorPoint extends TrackPoint {
  sectorIndex: number;
}

export interface Track {
  id: string;
  creatorId: string;
  name: string;
  locationName: string | null;
  startFinishPoint: TrackPoint;
  startFinishHeading: number | null;
  sectorPoints: SectorPoint[];
  isPublic: boolean;
  lengthMeters?: number;
  outlinePoints?: TrackPoint[];
  bestLapMs?: number | null;
  lapCount?: number;
  distanceMeters?: number;
}

export interface Lap {
  id: string;
  userId: string;
  vehicleId: string | null;
  trackId: string;
  lapTimeMs: number;
  sectorTimes: SectorSplit[];
  pathPoints: TrackPoint[];
  recordedAt: string;
}

export interface SectorSplit {
  sectorIndex: number;
  splitMs: number;
}

export interface TrackPersonalBests {
  totalLaps: number;
  bestLapMs: number | null;
  avgLapMs: number | null;
  lastSession: string | null;
}

// ─── Track CRUD ──────────────────────────────────────────────────────────────

export async function createTrack(input: {
  name: string;
  locationName?: string;
  startFinishPoint: TrackPoint;
  startFinishHeading?: number | null;
  sectorPoints?: SectorPoint[];
  lengthMeters?: number;
  outlinePoints?: TrackPoint[];
  isPublic?: boolean;
}): Promise<Track> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Authentication required');

  const name = input.name.trim();
  if (name.length < 2 || name.length > 100) {
    throw new Error('Track name must be between 2 and 100 characters');
  }

  const { data, error } = await (supabase
    .from('tracks') as any)
    .insert({
      creator_id: user.id,
      name,
      location_name: input.locationName?.trim() || null,
      start_finish_point: `POINT(${input.startFinishPoint.lon} ${input.startFinishPoint.lat})`,
      start_finish_heading: input.startFinishHeading ?? null,
      sector_points: JSON.stringify(input.sectorPoints ?? []),
      length_meters: input.lengthMeters ?? 0,
      outline_points: JSON.stringify(input.outlinePoints ?? []),
      is_public: input.isPublic ?? false, // Default private per Task 3
    })
    .select()
    .single();

  if (error || !data) {
    console.error('[tracks] Insert error:', error?.message);
    throw new Error(`Failed to create track: ${error?.message ?? 'Unknown error'}`);
  }

  return rowToTrack(data);
}

export async function fetchNearbyTracks(
  lon: number,
  lat: number,
  radiusMeters: number = 50_000,
): Promise<Track[]> {
  const { data, error } = await supabase.rpc('get_nearby_tracks', {
    p_lon: lon,
    p_lat: lat,
    p_radius: radiusMeters,
  });

  if (error) {
    console.error('[tracks] Nearby fetch error:', error.message);
    throw new Error(`Failed to load nearby tracks: ${error.message}`);
  }

  return (data ?? []).map(rpcRowToTrack);
}

export async function fetchMyTracks(): Promise<Track[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Authentication required');

  const { data, error } = await supabase
    .from('tracks')
    .select('*')
    .eq('creator_id', user.id)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[tracks] My tracks error:', error.message);
    throw new Error(`Failed to load your tracks: ${error.message}`);
  }

  return (data ?? []).map(rowToTrack);
}

export async function deleteTrack(trackId: string): Promise<void> {
  const { error } = await supabase
    .from('tracks')
    .delete()
    .eq('id', trackId);

  if (error) throw new Error(`Failed to delete track: ${error.message}`);
}

// ─── Lap Recording ───────────────────────────────────────────────────────────

export async function saveLap(input: {
  trackId: string;
  vehicleId?: string | null;
  lapTimeMs: number;
  sectorTimes?: SectorSplit[];
  pathPoints?: TrackPoint[];
}): Promise<Lap> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Authentication required');

  if (input.lapTimeMs <= 0) throw new Error('Lap time must be positive');

  const { data, error } = await supabase
    .from('laps')
    .insert({
      user_id: user.id,
      vehicle_id: input.vehicleId ?? null,
      track_id: input.trackId,
      lap_time_ms: Math.round(input.lapTimeMs),
      sector_times: JSON.stringify(input.sectorTimes ?? []),
      path_points: JSON.stringify(input.pathPoints ?? []),
    })
    .select()
    .single();

  if (error || !data) {
    console.error('[laps] Insert error:', error?.message);
    throw new Error(`Failed to save lap: ${error?.message ?? 'Unknown error'}`);
  }

  return rowToLap(data);
}

export async function fetchLapsForTrack(trackId: string): Promise<Lap[]> {
  const { data, error } = await supabase
    .from('laps')
    .select('*')
    .eq('track_id', trackId)
    .order('recorded_at', { ascending: false });

  if (error) throw new Error(`Failed to load laps: ${error.message}`);
  return (data ?? []).map(rowToLap);
}

export async function fetchPersonalBests(trackId: string): Promise<TrackPersonalBests> {
  const { data, error } = await supabase.rpc('get_track_personal_bests', {
    p_track_id: trackId,
  });

  if (error || !data) {
    console.warn('[laps] Personal bests RPC failed:', error?.message);
    return { totalLaps: 0, bestLapMs: null, avgLapMs: null, lastSession: null };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const res = data as any;
  return {
    totalLaps: Number(res.total_laps) || 0,
    bestLapMs: res.best_lap_ms ? Number(res.best_lap_ms) : null,
    avgLapMs: res.avg_lap_ms ? Number(res.avg_lap_ms) : null,
    lastSession: res.last_session ?? null,
  };
}

export async function deleteLap(lapId: string): Promise<void> {
  const { error } = await supabase.from('laps').delete().eq('id', lapId);
  if (error) throw new Error(`Failed to delete lap: ${error.message}`);
}

// ─── Geometry & Timing Helpers (delegated to @/utils/lapTiming) ────────────────
export {
  CROSSING_RADIUS_METERS,
  HEADING_TOLERANCE_DEG,
  haversineMeters,
  headingDiff,
  isCrossingGate,
  detectSegmentCrossing,
  formatLapTime,
  lapDelta,
} from '@/utils/lapTiming';

// ─── Row mappers ─────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToTrack(row: any): Track {
  const sfp = row.start_finish_point;
  let point: TrackPoint = { lon: 0, lat: 0 };

  // Supabase may return geography as WKT "POINT(lon lat)" or as a GeoJSON object
  if (typeof sfp === 'string') {
    const match = sfp.match(/POINT\(([^ ]+) ([^ )]+)\)/i);
    if (match) point = { lon: parseFloat(match[1]), lat: parseFloat(match[2]) };
  } else if (sfp && typeof sfp === 'object') {
    point = { lon: sfp.lon ?? sfp.coordinates?.[0] ?? 0, lat: sfp.lat ?? sfp.coordinates?.[1] ?? 0 };
  }

  return {
    id: row.id,
    creatorId: row.creator_id,
    name: row.name,
    locationName: row.location_name ?? null,
    startFinishPoint: point,
    startFinishHeading: row.start_finish_heading ?? null,
    sectorPoints: parseJsonb<SectorPoint[]>(row.sector_points, []),
    isPublic: row.is_public ?? false,
    lengthMeters: row.length_meters ? Number(row.length_meters) : undefined,
    outlinePoints: parseJsonb<TrackPoint[]>(row.outline_points, []),
    bestLapMs: row.best_lap_ms ? Number(row.best_lap_ms) : null,
    lapCount: row.lap_count ? Number(row.lap_count) : 0,
    distanceMeters: row.distance_meters ?? undefined,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rpcRowToTrack(row: any): Track {
  const sfp = row.start_finish_point;
  let point: TrackPoint = { lon: 0, lat: 0 };
  if (sfp && typeof sfp === 'object') {
    point = { lon: sfp.lon ?? 0, lat: sfp.lat ?? 0 };
  }
  return {
    id: row.id,
    creatorId: row.creator_id,
    name: row.name,
    locationName: row.location_name ?? null,
    startFinishPoint: point,
    startFinishHeading: row.start_finish_heading ?? null,
    sectorPoints: parseJsonb<SectorPoint[]>(row.sector_points, []),
    isPublic: row.is_public ?? false,
    lengthMeters: row.length_meters ? Number(row.length_meters) : undefined,
    outlinePoints: parseJsonb<TrackPoint[]>(row.outline_points, []),
    bestLapMs: row.best_lap_ms ? Number(row.best_lap_ms) : null,
    lapCount: row.lap_count ? Number(row.lap_count) : 0,
    distanceMeters: row.distance_meters ?? undefined,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToLap(row: any): Lap {
  return {
    id: row.id,
    userId: row.user_id,
    vehicleId: row.vehicle_id ?? null,
    trackId: row.track_id,
    lapTimeMs: row.lap_time_ms,
    sectorTimes: parseJsonb<SectorSplit[]>(row.sector_times, []),
    pathPoints: parseJsonb<TrackPoint[]>(row.path_points, []),
    recordedAt: row.recorded_at,
  };
}

function parseJsonb<T>(value: unknown, fallback: T): T {
  if (Array.isArray(value)) return value as T;
  if (typeof value === 'string') {
    try { return JSON.parse(value) as T; } catch { return fallback; }
  }
  if (value && typeof value === 'object') return value as T;
  return fallback;
}
