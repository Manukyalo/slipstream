-- ============================================================
-- Migration: 0015_route_privacy
-- Phase 4: Route Privacy, Server-Side 300m Trimming, and Road Reports
-- ============================================================

-- 1. Update default visibility on saved_roads to private (false)
ALTER TABLE public.saved_roads 
  ALTER COLUMN is_public SET DEFAULT false;

-- 2. Add telemetry and metadata columns to saved_roads
ALTER TABLE public.saved_roads
  ADD COLUMN IF NOT EXISTS elevation_gain_m INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS curviness_score NUMERIC(3,1) DEFAULT 7.5,
  ADD COLUMN IF NOT EXISTS best_avg_speed_kmh NUMERIC(5,1) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS saved_count INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS surface_type TEXT DEFAULT 'tarmac' CHECK (surface_type IN ('tarmac', 'off_road', 'mixed', 'track')),
  ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT ARRAY['twisty', 'scenic'];

-- 3. Home Zone / Privacy Zone table
CREATE TABLE IF NOT EXISTS public.user_privacy_zones (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL DEFAULT 'Home',
  location    GEOGRAPHY(Point, 4326) NOT NULL,
  radius_m    INTEGER NOT NULL DEFAULT 500 CHECK (radius_m BETWEEN 100 AND 2000),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT user_privacy_zone_unique UNIQUE (user_id, name)
);

ALTER TABLE public.user_privacy_zones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "privacy_zones: manage own" ON public.user_privacy_zones;
CREATE POLICY "privacy_zones: manage own"
  ON public.user_privacy_zones
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- 4. Server-Side Route Sanitization Function
-- Trims the first and last 300 meters of any route so residential addresses / home garages are never exposed.
CREATE OR REPLACE FUNCTION public.sanitize_shared_route(
  p_route       GEOGRAPHY,
  p_trim_meters DOUBLE PRECISION DEFAULT 300
)
RETURNS GEOMETRY
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_geom       GEOMETRY;
  v_len        DOUBLE PRECISION;
  v_start_frac DOUBLE PRECISION;
  v_end_frac   DOUBLE PRECISION;
BEGIN
  IF p_route IS NULL THEN
    RETURN NULL;
  END IF;

  v_geom := p_route::geometry;
  v_len  := ST_Length(p_route);

  -- Handle short routes: clamp trim to 25% from each end so the line never collapses
  IF v_len <= (p_trim_meters * 2) THEN
    v_start_frac := 0.25;
    v_end_frac   := 0.75;
  ELSE
    v_start_frac := p_trim_meters / v_len;
    v_end_frac   := (v_len - p_trim_meters) / v_len;
  END IF;

  RETURN ST_LineSubstring(v_geom, v_start_frac, v_end_frac);
END;
$$;

-- 5. Road Reports Table
CREATE TABLE IF NOT EXISTS public.saved_road_reports (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  road_id     UUID NOT NULL REFERENCES public.saved_roads(id) ON DELETE CASCADE,
  reporter_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason      TEXT NOT NULL CHECK (reason IN ('private_property', 'dangerous', 'inaccurate', 'offensive', 'other')),
  details     TEXT CHECK (char_length(details) <= 500),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS saved_road_reports_road_idx
  ON public.saved_road_reports (road_id);

ALTER TABLE public.saved_road_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "road_reports: insert report" ON public.saved_road_reports;
CREATE POLICY "road_reports: insert report"
  ON public.saved_road_reports
  FOR INSERT
  TO authenticated
  WITH CHECK (reporter_id = auth.uid());

DROP POLICY IF EXISTS "road_reports: view own reports" ON public.saved_road_reports;
CREATE POLICY "road_reports: view own reports"
  ON public.saved_road_reports
  FOR SELECT
  TO authenticated
  USING (reporter_id = auth.uid());

-- 6. Updated RPC: get_nearby_roads with radius filtering & server-side route trimming
CREATE OR REPLACE FUNCTION public.get_nearby_roads(
  p_lon    DOUBLE PRECISION,
  p_lat    DOUBLE PRECISION,
  p_radius INTEGER DEFAULT 100000,  -- metres (25km, 50km, 100km, 250km)
  p_tag    TEXT DEFAULT NULL        -- optional filter by tag: 'twisty', 'scenic', 'off_road', 'tarmac'
)
RETURNS TABLE (
  id                 UUID,
  user_id            UUID,
  name               TEXT,
  description        TEXT,
  is_public          BOOLEAN,
  length_meters      NUMERIC,
  distance_meters    DOUBLE PRECISION,
  route_wkt          TEXT,
  elevation_gain_m   INTEGER,
  curviness_score    NUMERIC,
  best_avg_speed_kmh NUMERIC,
  saved_count        INTEGER,
  surface_type       TEXT,
  tags               TEXT[]
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    r.id,
    r.user_id,
    r.name,
    r.description,
    r.is_public,
    r.length_meters,
    ST_Distance(r.centroid, ST_MakePoint(p_lon, p_lat)::geography) AS distance_meters,
    -- SERVER-SIDE PRIVACY: If caller is NOT the route owner, trim 300m from start & end
    CASE
      WHEN r.user_id = auth.uid() THEN ST_AsText(r.route::geometry)
      ELSE ST_AsText(public.sanitize_shared_route(r.route, 300))
    END AS route_wkt,
    COALESCE(r.elevation_gain_m, 0),
    COALESCE(r.curviness_score, 7.5),
    COALESCE(r.best_avg_speed_kmh, 0),
    COALESCE(r.saved_count, 1),
    COALESCE(r.surface_type, 'tarmac'),
    COALESCE(r.tags, ARRAY['twisty', 'scenic'])
  FROM public.saved_roads r
  WHERE
    (r.is_public = true OR r.user_id = auth.uid())
    AND ST_DWithin(
      r.centroid,
      ST_MakePoint(p_lon, p_lat)::geography,
      p_radius
    )
    AND (
      p_tag IS NULL 
      OR p_tag = 'all'
      OR (p_tag = 'off_road' AND r.surface_type = 'off_road')
      OR (p_tag = 'tarmac' AND r.surface_type = 'tarmac')
      OR p_tag = ANY(r.tags)
    )
  ORDER BY distance_meters ASC
  LIMIT 50;
END;
$$;

-- 7. RPC: Bookmark / Save Road Toggle
CREATE OR REPLACE FUNCTION public.toggle_saved_road_bookmark(
  p_road_id UUID
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE public.saved_roads
  SET saved_count = COALESCE(saved_count, 0) + 1
  WHERE id = p_road_id
  RETURNING saved_count INTO v_count;
  
  RETURN COALESCE(v_count, 1);
END;
$$;
