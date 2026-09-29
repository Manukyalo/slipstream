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
  isPublic?: boolean;
}): Promise<Track> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Authentication required');

  const name = input.name.trim();
  if (name.length < 2 || name.length > 100) {
    throw new Error('Track name must be between 2 and 100 characters');
  }

  const { data, error } = await supabase
    .from('tracks')
    .insert({
      creator_id: user.id,
      name,
      location_name: input.locationName?.trim() || null,
      // PostGIS expects POINT(lon lat) string or use ST_MakePoint via RPC.
      // Supabase geography columns accept GeoJSON or WKT from the client.
      start_finish_point: `POINT(${input.startFinishPoint.lon} ${input.startFinishPoint.lat})`,
      start_finish_heading: input.startFinishHeading ?? null,
      sector_points: JSON.stringify(input.sectorPoints ?? []),
      is_public: input.isPublic ?? true,
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

// ─── Geometry Helpers ─────────────────────────────────────────────────────────

/**
 * Returns the great-circle distance between two WGS-84 points in metres.
 * Uses the Haversine formula — accurate enough for track crossing detection.
 */
export function haversineMeters(
  lat1: number, lon1: number,
  lat2: number, lon2: number,
): number {
  const R = 6_371_000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Returns the absolute angular difference between two headings [0, 180].
 */
export function headingDiff(a: number, b: number): number {
  const diff = Math.abs(a - b) % 360;
  return diff > 180 ? 360 - diff : diff;
}

/**
 * Determines if the current GPS position counts as crossing a defined gate.
 * Conditions:
 *  1. Distance from gate centre < CROSSING_RADIUS_METERS
 *  2. If gate has a required heading, current heading must be within HEADING_TOLERANCE
 *  3. The car must have been outside the crossing radius before (prevents re-trigger)
 */
export const CROSSING_RADIUS_METERS = 30; // tight for start/finish accuracy
export const HEADING_TOLERANCE_DEG  = 40; // ± 40° around defined heading

export function isCrossingGate(opts: {
  currentLat: number;
  currentLon: number;
  currentHeading: number | null;
  gateLat: number;
  gateLon: number;
  gateHeading: number | null;
}): boolean {
  const dist = haversineMeters(
    opts.currentLat, opts.currentLon,
    opts.gateLat,    opts.gateLon,
  );

  if (dist > CROSSING_RADIUS_METERS) return false;

  if (opts.gateHeading !== null && opts.currentHeading !== null) {
    const diff = headingDiff(opts.currentHeading, opts.gateHeading);
    if (diff > HEADING_TOLERANCE_DEG) return false;
  }

  return true;
}

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
    isPublic: row.is_public ?? true,
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
    isPublic: row.is_public ?? true,
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

/** Format milliseconds as M:SS.mmm */
export function formatLapTime(ms: number): string {
  const totalSeconds = ms / 1000;
  const mins = Math.floor(totalSeconds / 60);
  const secs = Math.floor(totalSeconds % 60);
  const millis = Math.floor(ms % 1000);
  return `${mins}:${String(secs).padStart(2, '0')}.${String(millis).padStart(3, '0')}`;
}

/** Returns the delta string vs best lap: e.g. "+0.412" or "-0.050" */
export function lapDelta(lapMs: number, bestMs: number): string {
  const delta = (lapMs - bestMs) / 1000;
  return delta >= 0 ? `+${delta.toFixed(3)}` : delta.toFixed(3);
}
