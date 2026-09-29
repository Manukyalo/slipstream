-- ============================================================
-- Migration: 0012_track_day
-- Phase 14 – Track Day / Lap Timing
-- Fully isolated from public-road tracking. No hazard alerts,
-- no crossover into public rankings.
-- ============================================================

-- tracks: created by any authenticated user; publicly readable; only creator can mutate
CREATE TABLE IF NOT EXISTS public.tracks (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name             TEXT NOT NULL CHECK (char_length(name) BETWEEN 2 AND 100),
  -- Start/finish line centre point stored as WGS-84 lon/lat
  start_finish_point  GEOGRAPHY(Point, 4326) NOT NULL,
  -- Heading in degrees [0,360) the car must be travelling to count a crossing.
  -- NULL = any heading accepted (useful for oval circuits)
  start_finish_heading NUMERIC(5,2) CHECK (start_finish_heading >= 0 AND start_finish_heading < 360),
  -- Optional sector split points: [{lat,lon,heading?}]
  sector_points    JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Soft metadata
  location_name   TEXT,
  is_public       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- laps: always private — scoped strictly to user_id
CREATE TABLE IF NOT EXISTS public.laps (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vehicle_id    UUID REFERENCES public.vehicles(id) ON DELETE SET NULL,
  track_id      UUID NOT NULL REFERENCES public.tracks(id) ON DELETE CASCADE,
  lap_time_ms   INTEGER NOT NULL CHECK (lap_time_ms > 0),
  -- [{sector_index, split_ms}]
  sector_times  JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Raw GPS polyline for future replay — same purge strategy as trips
  path_points   JSONB NOT NULL DEFAULT '[]'::jsonb,
  recorded_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Indexes ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS tracks_start_finish_gix
  ON public.tracks USING GIST (start_finish_point);

CREATE INDEX IF NOT EXISTS tracks_creator_idx
  ON public.tracks (creator_id);

CREATE INDEX IF NOT EXISTS laps_track_user_idx
  ON public.laps (track_id, user_id, recorded_at DESC);

CREATE INDEX IF NOT EXISTS laps_user_idx
  ON public.laps (user_id, recorded_at DESC);

CREATE INDEX IF NOT EXISTS laps_vehicle_idx
  ON public.laps (vehicle_id);

-- ── updated_at trigger for tracks ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_tracks_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS tracks_set_updated_at ON public.tracks;
CREATE TRIGGER tracks_set_updated_at
  BEFORE UPDATE ON public.tracks
  FOR EACH ROW EXECUTE FUNCTION public.set_tracks_updated_at();

-- ── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE public.tracks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.laps   ENABLE ROW LEVEL SECURITY;

-- tracks: all authenticated users can read public tracks
DROP POLICY IF EXISTS "tracks: read public" ON public.tracks;
CREATE POLICY "tracks: read public"
  ON public.tracks FOR SELECT
  TO authenticated
  USING (is_public = true OR creator_id = auth.uid());

-- tracks: only creator can insert
DROP POLICY IF EXISTS "tracks: creator insert" ON public.tracks;
CREATE POLICY "tracks: creator insert"
  ON public.tracks FOR INSERT
  TO authenticated
  WITH CHECK (creator_id = auth.uid());

-- tracks: only creator can update/delete
DROP POLICY IF EXISTS "tracks: creator update" ON public.tracks;
CREATE POLICY "tracks: creator update"
  ON public.tracks FOR UPDATE
  TO authenticated
  USING (creator_id = auth.uid())
  WITH CHECK (creator_id = auth.uid());

DROP POLICY IF EXISTS "tracks: creator delete" ON public.tracks;
CREATE POLICY "tracks: creator delete"
  ON public.tracks FOR DELETE
  TO authenticated
  USING (creator_id = auth.uid());

-- laps: strict user ownership
DROP POLICY IF EXISTS "laps: user select" ON public.laps;
CREATE POLICY "laps: user select"
  ON public.laps FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "laps: user insert" ON public.laps;
CREATE POLICY "laps: user insert"
  ON public.laps FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "laps: user delete" ON public.laps;
CREATE POLICY "laps: user delete"
  ON public.laps FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- ── RPC: fetch tracks within radius ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_nearby_tracks(
  p_lon    DOUBLE PRECISION,
  p_lat    DOUBLE PRECISION,
  p_radius INTEGER DEFAULT 50000  -- metres, default 50 km
)
RETURNS TABLE (
  id                   UUID,
  name                 TEXT,
  location_name        TEXT,
  creator_id           UUID,
  start_finish_point   JSONB,   -- {lon, lat}
  start_finish_heading NUMERIC,
  sector_points        JSONB,
  is_public            BOOLEAN,
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

-- ── RPC: best lap + session summary ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_track_personal_bests(
  p_track_id  UUID,
  p_user_id   UUID DEFAULT NULL  -- defaults to auth.uid()
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid  UUID;
  v_result JSONB;
BEGIN
  v_uid := COALESCE(p_user_id, auth.uid());

  -- Only the calling user can query their own laps
  IF v_uid != auth.uid() THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  SELECT jsonb_build_object(
    'total_laps',    COUNT(*),
    'best_lap_ms',   MIN(lap_time_ms),
    'avg_lap_ms',    AVG(lap_time_ms)::INTEGER,
    'last_session',  MAX(recorded_at)
  ) INTO v_result
  FROM public.laps
  WHERE track_id = p_track_id AND user_id = v_uid;

  RETURN v_result;
END;
$$;
