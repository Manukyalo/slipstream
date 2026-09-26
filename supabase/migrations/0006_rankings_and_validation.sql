-- ============================================================
-- Migration: 0006_rankings_and_validation
-- Phase 6 – Rankings & Server-side Physical Validation
-- ============================================================

-- 1. Server-side physical plausibility constraints
ALTER TABLE public.trips 
  DROP CONSTRAINT IF EXISTS trips_physical_plausibility_speed,
  ADD CONSTRAINT trips_physical_plausibility_speed 
    CHECK (top_speed >= 0 AND top_speed <= 500 AND avg_speed >= 0 AND avg_speed <= 500);

ALTER TABLE public.trips 
  DROP CONSTRAINT IF EXISTS trips_physical_plausibility_distance,
  ADD CONSTRAINT trips_physical_plausibility_distance 
    CHECK (distance_m >= 0 AND duration_s >= 0);

ALTER TABLE public.drag_runs
  DROP CONSTRAINT IF EXISTS drag_runs_physical_plausibility_speed,
  ADD CONSTRAINT drag_runs_physical_plausibility_speed 
    CHECK (top_speed >= 0 AND top_speed <= 500);

ALTER TABLE public.drag_runs
  DROP CONSTRAINT IF EXISTS drag_runs_physical_plausibility_time,
  ADD CONSTRAINT drag_runs_physical_plausibility_time 
    CHECK (elapsed_ms >= 5000); -- 1/4 mile cannot be under 5.0 seconds for road vehicles

-- Allow authenticated and anon to read trips, drag_runs, and vehicles for rankings
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'trips' AND policyname = 'trips: select all for rankings'
  ) THEN
    CREATE POLICY "trips: select all for rankings"
      ON public.trips FOR SELECT
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'drag_runs' AND policyname = 'drag_runs: select all for rankings'
  ) THEN
    CREATE POLICY "drag_runs: select all for rankings"
      ON public.drag_runs FOR SELECT
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'vehicles' AND policyname = 'vehicles: select all for rankings'
  ) THEN
    CREATE POLICY "vehicles: select all for rankings"
      ON public.vehicles FOR SELECT
      USING (true);
  END IF;
END $$;

-- 2. Top Speed Leaderboard RPC
CREATE OR REPLACE FUNCTION public.get_top_speed_leaderboard(
  scope_type TEXT DEFAULT 'global',
  filter_make TEXT DEFAULT NULL,
  filter_model TEXT DEFAULT NULL,
  limit_count INTEGER DEFAULT 50
)
RETURNS TABLE (
  rank BIGINT,
  user_id UUID,
  display_name TEXT,
  avatar_url TEXT,
  make TEXT,
  model TEXT,
  year INTEGER,
  top_speed NUMERIC,
  recorded_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
AS $$
  WITH ranked AS (
    SELECT 
      ROW_NUMBER() OVER (ORDER BY t.top_speed DESC) as rank,
      t.user_id,
      COALESCE(p.display_name, 'Driver') as display_name,
      p.avatar_url,
      v.make,
      v.model,
      v.year,
      t.top_speed,
      t.ended_at as recorded_at
    FROM public.trips t
    LEFT JOIN public.profiles p ON p.id = t.user_id
    LEFT JOIN public.vehicles v ON v.id = t.vehicle_id
    WHERE 
      t.top_speed > 0
      AND (
        scope_type != 'same_car' 
        OR (filter_make IS NOT NULL AND filter_model IS NOT NULL AND v.make = filter_make AND v.model = filter_model)
      )
  )
  SELECT * FROM ranked
  LIMIT limit_count;
$$;

-- 3. Drag Race Times Leaderboard RPC
CREATE OR REPLACE FUNCTION public.get_drag_leaderboard(
  target_distance_type TEXT DEFAULT 'quarter_mile',
  scope_type TEXT DEFAULT 'global',
  filter_make TEXT DEFAULT NULL,
  filter_model TEXT DEFAULT NULL,
  limit_count INTEGER DEFAULT 50
)
RETURNS TABLE (
  rank BIGINT,
  user_id UUID,
  display_name TEXT,
  avatar_url TEXT,
  make TEXT,
  model TEXT,
  year INTEGER,
  elapsed_ms INTEGER,
  top_speed NUMERIC,
  recorded_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
AS $$
  WITH ranked AS (
    SELECT 
      ROW_NUMBER() OVER (ORDER BY d.elapsed_ms ASC) as rank,
      d.user_id,
      COALESCE(p.display_name, 'Driver') as display_name,
      p.avatar_url,
      v.make,
      v.model,
      v.year,
      d.elapsed_ms,
      d.top_speed,
      d.recorded_at
    FROM public.drag_runs d
    LEFT JOIN public.profiles p ON p.id = d.user_id
    LEFT JOIN public.vehicles v ON v.id = d.vehicle_id
    WHERE 
      d.distance_type = target_distance_type
      AND (
        scope_type != 'same_car' 
        OR (filter_make IS NOT NULL AND filter_model IS NOT NULL AND v.make = filter_make AND v.model = filter_model)
      )
  )
  SELECT * FROM ranked
  LIMIT limit_count;
$$;

-- 4. Distance Leaderboard RPC
CREATE OR REPLACE FUNCTION public.get_distance_leaderboard(
  scope_type TEXT DEFAULT 'global',
  filter_make TEXT DEFAULT NULL,
  filter_model TEXT DEFAULT NULL,
  limit_count INTEGER DEFAULT 50
)
RETURNS TABLE (
  rank BIGINT,
  user_id UUID,
  display_name TEXT,
  avatar_url TEXT,
  make TEXT,
  model TEXT,
  total_distance_m NUMERIC,
  total_trips BIGINT
)
LANGUAGE sql
STABLE
AS $$
  WITH user_totals AS (
    SELECT 
      t.user_id,
      COALESCE(p.display_name, 'Driver') as display_name,
      p.avatar_url,
      MAX(v.make) as make,
      MAX(v.model) as model,
      SUM(t.distance_m) as total_distance_m,
      COUNT(t.id) as total_trips
    FROM public.trips t
    LEFT JOIN public.profiles p ON p.id = t.user_id
    LEFT JOIN public.vehicles v ON v.id = t.vehicle_id
    WHERE 
      (
        scope_type != 'same_car' 
        OR (filter_make IS NOT NULL AND filter_model IS NOT NULL AND v.make = filter_make AND v.model = filter_model)
      )
    GROUP BY t.user_id, p.display_name, p.avatar_url
  ),
  ranked AS (
    SELECT 
      ROW_NUMBER() OVER (ORDER BY ut.total_distance_m DESC) as rank,
      ut.user_id,
      ut.display_name,
      ut.avatar_url,
      ut.make,
      ut.model,
      ut.total_distance_m,
      ut.total_trips
    FROM user_totals ut
  )
  SELECT * FROM ranked
  LIMIT limit_count;
$$;
