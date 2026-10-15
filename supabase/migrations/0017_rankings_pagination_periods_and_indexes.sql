-- ============================================================
-- Migration: 0017_rankings_pagination_periods_and_indexes
-- Phase 7: Leaderboard pagination, period filters (Week/Month/All),
--          covering composite indexes, and single-user rank resolution.
-- ============================================================

-- 1. Covering composite indexes for efficient period and ordering queries
CREATE INDEX IF NOT EXISTS trips_top_speed_period_idx 
  ON public.trips (top_speed DESC, ended_at DESC) 
  WHERE top_speed > 0;

CREATE INDEX IF NOT EXISTS trips_distance_period_idx 
  ON public.trips (distance_m DESC, ended_at DESC) 
  WHERE distance_m > 0;

CREATE INDEX IF NOT EXISTS drag_runs_dist_elapsed_rec_idx 
  ON public.drag_runs (distance_type, elapsed_ms ASC, recorded_at DESC) 
  WHERE elapsed_ms > 0;

-- 2. Top Speed Leaderboard RPC (paginated + period filters)
CREATE OR REPLACE FUNCTION public.get_top_speed_leaderboard(
  scope_type TEXT,
  period_type TEXT,
  filter_make TEXT,
  filter_model TEXT,
  limit_count INTEGER,
  offset_count INTEGER
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
  WITH user_best AS (
    SELECT 
      t.user_id,
      MAX(t.top_speed) as top_speed,
      MAX(t.ended_at) as recorded_at,
      (ARRAY_AGG(v.make ORDER BY t.top_speed DESC))[1] as make,
      (ARRAY_AGG(v.model ORDER BY t.top_speed DESC))[1] as model,
      (ARRAY_AGG(v.year ORDER BY t.top_speed DESC))[1] as year
    FROM public.trips t
    LEFT JOIN public.vehicles v ON v.id = t.vehicle_id
    WHERE 
      t.top_speed > 0
      AND (
        period_type = 'all' 
        OR (period_type = 'week' AND t.ended_at >= (NOW() - INTERVAL '7 days'))
        OR (period_type = 'month' AND t.ended_at >= (NOW() - INTERVAL '30 days'))
      )
      AND (
        scope_type != 'same_car' 
        OR (filter_make IS NOT NULL AND filter_model IS NOT NULL AND v.make = filter_make AND v.model = filter_model)
      )
    GROUP BY t.user_id
  ),
  ranked AS (
    SELECT 
      ROW_NUMBER() OVER (ORDER BY ub.top_speed DESC, ub.recorded_at ASC) as rank,
      ub.user_id,
      COALESCE(p.display_name, 'Driver') as display_name,
      p.avatar_url,
      ub.make,
      ub.model,
      ub.year,
      ub.top_speed,
      ub.recorded_at
    FROM user_best ub
    LEFT JOIN public.profiles p ON p.id = ub.user_id
  )
  SELECT * FROM ranked
  ORDER BY rank ASC
  LIMIT limit_count
  OFFSET offset_count;
$$;

-- 3. Drag Race Times Leaderboard RPC (paginated + period filters)
CREATE OR REPLACE FUNCTION public.get_drag_leaderboard(
  target_distance_type TEXT,
  scope_type TEXT,
  period_type TEXT,
  filter_make TEXT,
  filter_model TEXT,
  limit_count INTEGER,
  offset_count INTEGER
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
  WITH user_best AS (
    SELECT 
      d.user_id,
      MIN(d.elapsed_ms) as elapsed_ms,
      MAX(d.top_speed) as top_speed,
      MAX(d.recorded_at) as recorded_at,
      (ARRAY_AGG(v.make ORDER BY d.elapsed_ms ASC))[1] as make,
      (ARRAY_AGG(v.model ORDER BY d.elapsed_ms ASC))[1] as model,
      (ARRAY_AGG(v.year ORDER BY d.elapsed_ms ASC))[1] as year
    FROM public.drag_runs d
    LEFT JOIN public.vehicles v ON v.id = d.vehicle_id
    WHERE 
      d.distance_type = target_distance_type
      AND d.elapsed_ms > 0
      AND (
        period_type = 'all' 
        OR (period_type = 'week' AND d.recorded_at >= (NOW() - INTERVAL '7 days'))
        OR (period_type = 'month' AND d.recorded_at >= (NOW() - INTERVAL '30 days'))
      )
      AND (
        scope_type != 'same_car' 
        OR (filter_make IS NOT NULL AND filter_model IS NOT NULL AND v.make = filter_make AND v.model = filter_model)
      )
    GROUP BY d.user_id
  ),
  ranked AS (
    SELECT 
      ROW_NUMBER() OVER (ORDER BY ub.elapsed_ms ASC, ub.recorded_at ASC) as rank,
      ub.user_id,
      COALESCE(p.display_name, 'Driver') as display_name,
      p.avatar_url,
      ub.make,
      ub.model,
      ub.year,
      ub.elapsed_ms,
      ub.top_speed,
      ub.recorded_at
    FROM user_best ub
    LEFT JOIN public.profiles p ON p.id = ub.user_id
  )
  SELECT * FROM ranked
  ORDER BY rank ASC
  LIMIT limit_count
  OFFSET offset_count;
$$;

-- 4. Distance Leaderboard RPC (paginated + period filters)
CREATE OR REPLACE FUNCTION public.get_distance_leaderboard(
  scope_type TEXT,
  period_type TEXT,
  filter_make TEXT,
  filter_model TEXT,
  limit_count INTEGER,
  offset_count INTEGER
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
      SUM(t.distance_m) as total_distance_m,
      COUNT(t.id) as total_trips,
      (ARRAY_AGG(v.make ORDER BY t.ended_at DESC))[1] as make,
      (ARRAY_AGG(v.model ORDER BY t.ended_at DESC))[1] as model
    FROM public.trips t
    LEFT JOIN public.vehicles v ON v.id = t.vehicle_id
    WHERE 
      t.distance_m > 0
      AND (
        period_type = 'all' 
        OR (period_type = 'week' AND t.ended_at >= (NOW() - INTERVAL '7 days'))
        OR (period_type = 'month' AND t.ended_at >= (NOW() - INTERVAL '30 days'))
      )
      AND (
        scope_type != 'same_car' 
        OR (filter_make IS NOT NULL AND filter_model IS NOT NULL AND v.make = filter_make AND v.model = filter_model)
      )
    GROUP BY t.user_id
  ),
  ranked AS (
    SELECT 
      ROW_NUMBER() OVER (ORDER BY ut.total_distance_m DESC) as rank,
      ut.user_id,
      COALESCE(p.display_name, 'Driver') as display_name,
      p.avatar_url,
      ut.make,
      ut.model,
      ut.total_distance_m,
      ut.total_trips
    FROM user_totals ut
    LEFT JOIN public.profiles p ON p.id = ut.user_id
  )
  SELECT * FROM ranked
  ORDER BY rank ASC
  LIMIT limit_count
  OFFSET offset_count;
$$;

-- 5. User rank resolution RPC (for the pinned 'You, #N' bar)
CREATE OR REPLACE FUNCTION public.get_my_leaderboard_rank(
  target_user_id UUID,
  board_type TEXT,
  period_type TEXT DEFAULT 'all',
  scope_type TEXT DEFAULT 'global',
  filter_make TEXT DEFAULT NULL,
  filter_model TEXT DEFAULT NULL,
  target_distance_type TEXT DEFAULT 'quarter_mile'
)
RETURNS TABLE (
  rank BIGINT,
  value NUMERIC,
  sub_value NUMERIC,
  make TEXT,
  model TEXT,
  year INTEGER
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  IF board_type = 'top_speed' THEN
    RETURN QUERY
    WITH user_best AS (
      SELECT 
        t.user_id,
        MAX(t.top_speed) as top_speed,
        MAX(t.ended_at) as recorded_at,
        (ARRAY_AGG(v.make ORDER BY t.top_speed DESC))[1] as make,
        (ARRAY_AGG(v.model ORDER BY t.top_speed DESC))[1] as model,
        (ARRAY_AGG(v.year ORDER BY t.top_speed DESC))[1] as year
      FROM public.trips t
      LEFT JOIN public.vehicles v ON v.id = t.vehicle_id
      WHERE 
        t.top_speed > 0
        AND (
          period_type = 'all' 
          OR (period_type = 'week' AND t.ended_at >= (NOW() - INTERVAL '7 days'))
          OR (period_type = 'month' AND t.ended_at >= (NOW() - INTERVAL '30 days'))
        )
        AND (
          scope_type != 'same_car' 
          OR (filter_make IS NOT NULL AND filter_model IS NOT NULL AND v.make = filter_make AND v.model = filter_model)
        )
      GROUP BY t.user_id
    ),
    ranked AS (
      SELECT 
        ROW_NUMBER() OVER (ORDER BY ub.top_speed DESC, ub.recorded_at ASC) as r,
        ub.user_id,
        ub.top_speed as val,
        0::NUMERIC as s_val,
        ub.make as mk,
        ub.model as md,
        ub.year as yr
      FROM user_best ub
    )
    SELECT ranked.r, ranked.val, ranked.s_val, ranked.mk, ranked.md, ranked.yr
    FROM ranked
    WHERE ranked.user_id = target_user_id;

  ELSIF board_type = 'drag' THEN
    RETURN QUERY
    WITH user_best AS (
      SELECT 
        d.user_id,
        MIN(d.elapsed_ms)::NUMERIC as elapsed_ms,
        MAX(d.top_speed) as top_speed,
        MAX(d.recorded_at) as recorded_at,
        (ARRAY_AGG(v.make ORDER BY d.elapsed_ms ASC))[1] as make,
        (ARRAY_AGG(v.model ORDER BY d.elapsed_ms ASC))[1] as model,
        (ARRAY_AGG(v.year ORDER BY d.elapsed_ms ASC))[1] as year
      FROM public.drag_runs d
      LEFT JOIN public.vehicles v ON v.id = d.vehicle_id
      WHERE 
        d.distance_type = target_distance_type
        AND d.elapsed_ms > 0
        AND (
          period_type = 'all' 
          OR (period_type = 'week' AND d.recorded_at >= (NOW() - INTERVAL '7 days'))
          OR (period_type = 'month' AND d.recorded_at >= (NOW() - INTERVAL '30 days'))
        )
        AND (
          scope_type != 'same_car' 
          OR (filter_make IS NOT NULL AND filter_model IS NOT NULL AND v.make = filter_make AND v.model = filter_model)
        )
      GROUP BY d.user_id
    ),
    ranked AS (
      SELECT 
        ROW_NUMBER() OVER (ORDER BY ub.elapsed_ms ASC, ub.recorded_at ASC) as r,
        ub.user_id,
        ub.elapsed_ms as val,
        ub.top_speed as s_val,
        ub.make as mk,
        ub.model as md,
        ub.year as yr
      FROM user_best ub
    )
    SELECT ranked.r, ranked.val, ranked.s_val, ranked.mk, ranked.md, ranked.yr
    FROM ranked
    WHERE ranked.user_id = target_user_id;

  ELSIF board_type = 'distance' THEN
    RETURN QUERY
    WITH user_totals AS (
      SELECT 
        t.user_id,
        SUM(t.distance_m) as total_distance_m,
        COUNT(t.id)::NUMERIC as total_trips,
        (ARRAY_AGG(v.make ORDER BY t.ended_at DESC))[1] as make,
        (ARRAY_AGG(v.model ORDER BY t.ended_at DESC))[1] as model
      FROM public.trips t
      LEFT JOIN public.vehicles v ON v.id = t.vehicle_id
      WHERE 
        t.distance_m > 0
        AND (
          period_type = 'all' 
          OR (period_type = 'week' AND t.ended_at >= (NOW() - INTERVAL '7 days'))
          OR (period_type = 'month' AND t.ended_at >= (NOW() - INTERVAL '30 days'))
        )
        AND (
          scope_type != 'same_car' 
          OR (filter_make IS NOT NULL AND filter_model IS NOT NULL AND v.make = filter_make AND v.model = filter_model)
        )
      GROUP BY t.user_id
    ),
    ranked AS (
      SELECT 
        ROW_NUMBER() OVER (ORDER BY ut.total_distance_m DESC) as r,
        ut.user_id,
        ut.total_distance_m as val,
        ut.total_trips as s_val,
        ut.make as mk,
        ut.model as md,
        NULL::INTEGER as yr
      FROM user_totals ut
    )
    SELECT ranked.r, ranked.val, ranked.s_val, ranked.mk, ranked.md, ranked.yr
    FROM ranked
    WHERE ranked.user_id = target_user_id;
  END IF;
END;
$$;
