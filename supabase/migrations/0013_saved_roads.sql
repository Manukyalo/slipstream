-- ============================================================
-- Migration: 0013_saved_roads
-- Phase 15 – Favorite Roads Library
-- Users save and share scenic/twisty routes as PostGIS LineStrings
-- ============================================================

CREATE TABLE IF NOT EXISTS public.saved_roads (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL CHECK (char_length(name) BETWEEN 2 AND 100),
  description TEXT CHECK (char_length(description) <= 500),
  -- Full route as WGS-84 LineString (from a trip's GPS trace)
  route       GEOGRAPHY(LineString, 4326) NOT NULL,
  -- Bounding-box centroid for fast proximity queries without scanning the full linestring
  centroid    GEOGRAPHY(Point, 4326)      GENERATED ALWAYS AS (
                ST_Centroid(route::geometry)::geography
              ) STORED,
  is_public   BOOLEAN NOT NULL DEFAULT true,
  -- Approximate stats stored at save time for fast list rendering
  length_meters  NUMERIC(10,2) GENERATED ALWAYS AS (
                   ST_Length(route::geography)
                 ) STORED,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Indexes ──────────────────────────────────────────────────────────────────
-- Centroid-based proximity index — fast for ST_DWithin browse queries
CREATE INDEX IF NOT EXISTS saved_roads_centroid_gix
  ON public.saved_roads USING GIST (centroid);

CREATE INDEX IF NOT EXISTS saved_roads_user_idx
  ON public.saved_roads (user_id);

CREATE INDEX IF NOT EXISTS saved_roads_public_idx
  ON public.saved_roads (is_public, created_at DESC)
  WHERE is_public = true;

-- ── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE public.saved_roads ENABLE ROW LEVEL SECURITY;

-- SELECT: own roads always; public roads from anyone
DROP POLICY IF EXISTS "roads: select own or public" ON public.saved_roads;
CREATE POLICY "roads: select own or public"
  ON public.saved_roads FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR is_public = true);

-- INSERT: own rows only
DROP POLICY IF EXISTS "roads: insert own" ON public.saved_roads;
CREATE POLICY "roads: insert own"
  ON public.saved_roads FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- UPDATE: own rows only
DROP POLICY IF EXISTS "roads: update own" ON public.saved_roads;
CREATE POLICY "roads: update own"
  ON public.saved_roads FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- DELETE: own rows only
DROP POLICY IF EXISTS "roads: delete own" ON public.saved_roads;
CREATE POLICY "roads: delete own"
  ON public.saved_roads FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- ── RPC: nearby public roads ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_nearby_roads(
  p_lon    DOUBLE PRECISION,
  p_lat    DOUBLE PRECISION,
  p_radius INTEGER DEFAULT 100000  -- metres, default 100 km
)
RETURNS TABLE (
  id             UUID,
  user_id        UUID,
  name           TEXT,
  description    TEXT,
  is_public      BOOLEAN,
  length_meters  NUMERIC,
  distance_meters DOUBLE PRECISION,
  route_wkt      TEXT   -- WKT LineString for client rendering
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
    ST_AsText(r.route::geometry) AS route_wkt
  FROM public.saved_roads r
  WHERE
    (r.is_public = true OR r.user_id = auth.uid())
    AND ST_DWithin(
      r.centroid,
      ST_MakePoint(p_lon, p_lat)::geography,
      p_radius
    )
  ORDER BY distance_meters ASC
  LIMIT 50;
END;
$$;
