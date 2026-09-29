-- ============================================================
-- Migration: 0009_security_and_compliance
-- Phase 9 – Security Hardening & Compliance (GDPR/CCPA, RLS, Retention)
-- ============================================================

-- ------------------------------------------------------------
-- 1. Full RLS Audit & Policy Tightening
-- ------------------------------------------------------------

-- Ensure public.user_rate_limits has RLS enabled
ALTER TABLE IF EXISTS public.user_rate_limits ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'user_rate_limits' AND policyname = 'user_rate_limits: deny direct client access'
  ) THEN
    -- Deny direct SELECT/INSERT/UPDATE from public/authenticated clients
    -- All accesses must be mediated via the check_rate_limit SECURITY DEFINER function
    CREATE POLICY "user_rate_limits: deny direct client access"
      ON public.user_rate_limits
      FOR ALL
      USING (false);
  END IF;
END $$;

-- Allow public read of profiles for leaderboard and referral name resolution
-- (Sensitive fields like email live in auth.users, never public.profiles)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'profiles: select public display info'
  ) THEN
    CREATE POLICY "profiles: select public display info"
      ON public.profiles FOR SELECT
      USING (true);
  END IF;
END $$;

-- ------------------------------------------------------------
-- 2. Data Retention & Hygiene: Purge Raw Speed Samples Older than 30 Days
-- Purges high-frequency per-point coordinates while preserving
-- aggregated trip metrics (distance, top speed, duration, avg speed).
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.purge_old_speed_samples(p_days_old INTEGER DEFAULT 30)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_purged_count INTEGER;
BEGIN
  UPDATE public.trips
  SET speed_samples = '[]'::jsonb
  WHERE ended_at < (NOW() - (p_days_old || ' days')::INTERVAL)
    AND speed_samples <> '[]'::jsonb;
  
  GET DIAGNOSTICS v_purged_count = ROW_COUNT;
  RETURN v_purged_count;
END;
$$;

-- ------------------------------------------------------------
-- 3. GDPR / CCPA Account Deletion
-- Completely cascades removal of auth user, profile, trips,
-- vehicles, telemetry, drag runs, and referrals.
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.delete_user_account()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: cannot delete account without active session';
  END IF;

  -- Delete from auth.users directly. Foreign keys with ON DELETE CASCADE
  -- automatically clean up public.profiles, vehicles, trips, drag_runs, etc.
  DELETE FROM auth.users WHERE id = v_user_id;
  RETURN TRUE;
END;
$$;

-- ------------------------------------------------------------
-- 4. GDPR / CCPA User Data Export
-- Returns a structured, comprehensive JSON dump of all user data.
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.export_user_data()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_profile JSONB;
  v_vehicles JSONB;
  v_trips JSONB;
  v_drag_runs JSONB;
  v_hazards JSONB;
  v_referrals JSONB;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: cannot export data without active session';
  END IF;

  SELECT to_jsonb(p) INTO v_profile FROM public.profiles p WHERE id = v_user_id;
  SELECT coalesce(jsonb_agg(to_jsonb(v)), '[]'::jsonb) INTO v_vehicles FROM public.vehicles v WHERE user_id = v_user_id;
  SELECT coalesce(jsonb_agg(to_jsonb(t) - 'speed_samples'), '[]'::jsonb) INTO v_trips FROM public.trips t WHERE user_id = v_user_id;
  SELECT coalesce(jsonb_agg(to_jsonb(d)), '[]'::jsonb) INTO v_drag_runs FROM public.drag_runs d WHERE user_id = v_user_id;
  SELECT coalesce(jsonb_agg(to_jsonb(h)), '[]'::jsonb) INTO v_hazards FROM public.hazard_reports h WHERE user_id = v_user_id;
  SELECT coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb) INTO v_referrals FROM public.referrals r WHERE referrer_id = v_user_id OR referred_user_id = v_user_id;

  RETURN jsonb_build_object(
    'export_version', '1.0',
    'exported_at', NOW(),
    'user_id', v_user_id,
    'profile', v_profile,
    'vehicles', v_vehicles,
    'trips', v_trips,
    'drag_runs', v_drag_runs,
    'hazards_reported', v_hazards,
    'referrals', v_referrals
  );
END;
$$;
