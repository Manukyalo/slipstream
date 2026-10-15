-- ============================================================
-- Migration: 0016_circuit_enhancements
-- Phase 5: Circuit Lap Timing, Metrics, and Private Track Default
-- ============================================================

-- 1. Default visibility for tracks to private (false)
ALTER TABLE public.tracks
  ALTER COLUMN is_public SET DEFAULT false;

-- 2. Add telemetry, geometry, and metric columns to tracks
ALTER TABLE public.tracks
  ADD COLUMN IF NOT EXISTS length_meters NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS outline_points JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS best_lap_ms INTEGER DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS lap_count INTEGER DEFAULT 0;

-- 3. Updated RPC: get_nearby_tracks with circuit metrics & personal bests
CREATE OR REPLACE FUNCTION public.get_nearby_tracks(
  p_lon    DOUBLE PRECISION,
  p_lat    DOUBLE PRECISION,
  p_radius INTEGER DEFAULT 100000  -- metres (default 100km)
)
RETURNS TABLE (
  id                   UUID,
  name                 TEXT,
  location_name        TEXT,
  creator_id           UUID,
  start_finish_point   JSONB,
  start_finish_heading NUMERIC,
  sector_points        JSONB,
  is_public            BOOLEAN,
  length_meters        NUMERIC,
  outline_points       JSONB,
  best_lap_ms          INTEGER,
  lap_count            INTEGER,
  distance_meters      DOUBLE PRECISION
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    t.id,
    t.name,
    t.location_name,
    t.creator_id,
    jsonb_build_object(
      'lon', ST_X(t.start_finish_point::geometry),
      'lat', ST_Y(t.start_finish_point::geometry)
    ) AS start_finish_point,
    t.start_finish_heading,
    t.sector_points,
    t.is_public,
    COALESCE(t.length_meters, 0),
    COALESCE(t.outline_points, '[]'::jsonb),
    -- Best personal lap for the current user on this circuit
    (SELECT MIN(l.lap_time_ms) FROM public.laps l WHERE l.track_id = t.id AND l.user_id = auth.uid()) AS best_lap_ms,
    -- Lap count for current user
    (SELECT COUNT(*)::INTEGER FROM public.laps l WHERE l.track_id = t.id AND l.user_id = auth.uid()) AS lap_count,
    ST_Distance(t.start_finish_point, ST_MakePoint(p_lon, p_lat)::geography) AS distance_meters
  FROM public.tracks t
  WHERE
    (t.is_public = true OR t.creator_id = auth.uid())
    AND ST_DWithin(
      t.start_finish_point,
      ST_MakePoint(p_lon, p_lat)::geography,
      p_radius
    )
  ORDER BY distance_meters ASC;
END;
$$;
