-- ============================================================
-- Migration: 0010_sprint_timer
-- Phase 10 – Sprint Timer (0-60 / 0-100)
-- Extends drag_runs with run_type enum to support sprint modes.
-- ============================================================

-- Add run_type column to drag_runs (defaults to quarter_mile for backcompat)
ALTER TABLE public.drag_runs
  ADD COLUMN IF NOT EXISTS run_type TEXT NOT NULL DEFAULT 'quarter_mile'
    CHECK (run_type IN ('quarter_mile', 'half_mile', 'one_mile', 'zero_to_60', 'zero_to_100'));

-- Drop and recreate the physical plausibility check to allow sprint times
-- (0-60 sprint can be under 5 seconds for performance cars, some as low as 2s)
ALTER TABLE public.drag_runs
  DROP CONSTRAINT IF EXISTS drag_runs_physical_plausibility_time;

ALTER TABLE public.drag_runs
  ADD CONSTRAINT drag_runs_physical_plausibility_time
    CHECK (elapsed_ms >= 1500); -- 1.5s minimum — physically impossible under this

-- Update leaderboard index to include run_type for sprint leaderboard queries
DROP INDEX IF EXISTS drag_runs_leaderboard_idx;

CREATE INDEX IF NOT EXISTS drag_runs_leaderboard_idx
  ON public.drag_runs (run_type, elapsed_ms ASC, top_speed DESC);

-- Sprint Leaderboard RPC
CREATE OR REPLACE FUNCTION public.get_sprint_leaderboard(
  sprint_type TEXT DEFAULT 'zero_to_60',
  scope_type TEXT DEFAULT 'global',
  filter_make TEXT DEFAULT NULL,
  filter_model TEXT DEFAULT NULL,
  limit_count INTEGER DEFAULT 50
)
RETURNS TABLE (
  rank         BIGINT,
  user_id      UUID,
  display_name TEXT,
  elapsed_ms   INTEGER,
  top_speed    NUMERIC,
  vehicle_make TEXT,
  vehicle_model TEXT,
  vehicle_year INTEGER,
  recorded_at  TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Validate sprint_type
  IF sprint_type NOT IN ('zero_to_60', 'zero_to_100') THEN
    RAISE EXCEPTION 'Invalid sprint_type: %. Must be zero_to_60 or zero_to_100', sprint_type;
  END IF;

  RETURN QUERY
  SELECT
    RANK() OVER (ORDER BY dr.elapsed_ms ASC) AS rank,
    dr.user_id,
    p.display_name,
    dr.elapsed_ms,
    dr.top_speed,
    v.make AS vehicle_make,
    v.model AS vehicle_model,
    v.year AS vehicle_year,
    dr.recorded_at
  FROM public.drag_runs dr
  JOIN public.profiles p ON p.id = dr.user_id
  LEFT JOIN public.vehicles v ON v.id = dr.vehicle_id
  WHERE dr.run_type = sprint_type
    AND (filter_make IS NULL OR v.make ILIKE filter_make)
    AND (filter_model IS NULL OR v.model ILIKE filter_model)
    -- Physical plausibility server-side sanity gate (reject implausibly fast times)
    AND dr.elapsed_ms >= 1500
    AND dr.top_speed > 0
  ORDER BY dr.elapsed_ms ASC
  LIMIT limit_count;
END;
$$;
