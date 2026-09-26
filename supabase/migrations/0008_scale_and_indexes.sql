-- ============================================================
-- Migration: 0008_scale_and_indexes
-- Phase 8 – Scale & Caching: Connection Pooling, Indexing & Rate Limiting
-- ============================================================

-- ------------------------------------------------------------
-- 1. Frequently-filtered Indexes
-- ------------------------------------------------------------

-- Trips Table
-- Query patterns:
-- - Filter by user_id ordered by ended_at DESC (recap / user history)
-- - Filter by vehicle_id (garage / car telemetry)
-- - Order by top_speed DESC, distance_m DESC (leaderboards)
CREATE INDEX IF NOT EXISTS trips_user_ended_at_idx 
  ON public.trips (user_id, ended_at DESC);

CREATE INDEX IF NOT EXISTS trips_vehicle_id_idx 
  ON public.trips (vehicle_id);

CREATE INDEX IF NOT EXISTS trips_top_speed_idx 
  ON public.trips (top_speed DESC);

CREATE INDEX IF NOT EXISTS trips_distance_m_idx 
  ON public.trips (distance_m DESC);

-- Hazard Reports Table
-- Query patterns:
-- - Proximity query via GIST on location (created in 0005)
-- - Filter by active expiration window + time
-- - Filter by reporting user
CREATE INDEX IF NOT EXISTS hazard_reports_user_id_idx 
  ON public.hazard_reports (user_id);

CREATE INDEX IF NOT EXISTS hazard_reports_reported_at_idx 
  ON public.hazard_reports (reported_at DESC);

CREATE INDEX IF NOT EXISTS hazard_reports_active_filter_idx 
  ON public.hazard_reports (expires_at, confirmations);

-- Hazard Confirmations Table
CREATE INDEX IF NOT EXISTS hazard_confirmations_user_id_idx 
  ON public.hazard_confirmations (user_id);

CREATE INDEX IF NOT EXISTS hazard_confirmations_hazard_id_idx 
  ON public.hazard_confirmations (hazard_id);

-- Vehicles Table
CREATE INDEX IF NOT EXISTS vehicles_user_id_idx 
  ON public.vehicles (user_id);

CREATE INDEX IF NOT EXISTS vehicles_make_model_idx 
  ON public.vehicles (make, model);

-- Profiles Table
CREATE INDEX IF NOT EXISTS profiles_created_at_idx 
  ON public.profiles (created_at DESC);

-- Drag Runs Table (leaderboard index)
CREATE INDEX IF NOT EXISTS drag_runs_leaderboard_idx 
  ON public.drag_runs (distance_type, elapsed_ms ASC, top_speed DESC);

-- ------------------------------------------------------------
-- 2. Server-side Rate Limiting Tracker
-- Fallback in-database sliding rate limiter to protect database
-- writes when external edge functions or Redis are unavailable.
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.user_rate_limits (
  user_id     UUID NOT NULL,
  action      TEXT NOT NULL,
  window_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  hit_count   INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (user_id, action)
);

CREATE INDEX IF NOT EXISTS user_rate_limits_window_idx 
  ON public.user_rate_limits (window_start);

-- Security Definer function to check and increment rate limit
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_user_id UUID,
  p_action TEXT,
  p_max_hits INTEGER,
  p_window_seconds INTEGER
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now TIMESTAMPTZ := NOW();
  v_window_start TIMESTAMPTZ;
  v_count INTEGER;
BEGIN
  SELECT window_start, hit_count
  INTO v_window_start, v_count
  FROM public.user_rate_limits
  WHERE user_id = p_user_id AND action = p_action
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.user_rate_limits (user_id, action, window_start, hit_count)
    VALUES (p_user_id, p_action, v_now, 1);
    RETURN TRUE;
  END IF;

  -- Window expired: reset window
  IF v_now > (v_window_start + (p_window_seconds || ' seconds')::INTERVAL) THEN
    UPDATE public.user_rate_limits
    SET window_start = v_now, hit_count = 1
    WHERE user_id = p_user_id AND action = p_action;
    RETURN TRUE;
  END IF;

  -- Check if limit reached
  IF v_count >= p_max_hits THEN
    RETURN FALSE; -- Rate limited
  END IF;

  -- Increment hit count
  UPDATE public.user_rate_limits
  SET hit_count = v_count + 1
  WHERE user_id = p_user_id AND action = p_action;

  RETURN TRUE;
END;
$$;
