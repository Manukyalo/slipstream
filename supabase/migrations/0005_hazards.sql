-- ============================================================
-- Migration: 0005_hazards
-- Phase 5 – Hazard / Radar Alerts
-- ============================================================

CREATE TABLE IF NOT EXISTS public.hazard_reports (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type            TEXT NOT NULL CHECK (type IN ('speed_trap', 'camera', 'police')),
  location        geography(Point, 4326) NOT NULL,
  reported_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at      TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '3 hours'),
  confirmations   INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS hazard_reports_location_gix ON public.hazard_reports USING GIST(location);
CREATE INDEX IF NOT EXISTS hazard_reports_expires_at_idx ON public.hazard_reports(expires_at);
CREATE INDEX IF NOT EXISTS hazard_reports_confirmations_idx ON public.hazard_reports(confirmations);

-- Table to track confirmations uniquely per user per hazard
CREATE TABLE IF NOT EXISTS public.hazard_confirmations (
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  hazard_id   UUID NOT NULL REFERENCES public.hazard_reports(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, hazard_id)
);

ALTER TABLE public.hazard_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hazard_confirmations ENABLE ROW LEVEL SECURITY;

-- RLS policies for hazard_reports
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'hazard_reports' AND policyname = 'hazard_reports: read active'
  ) THEN
    CREATE POLICY "hazard_reports: read active"
      ON public.hazard_reports FOR SELECT
      USING (expires_at > NOW());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'hazard_reports' AND policyname = 'hazard_reports: insert own'
  ) THEN
    CREATE POLICY "hazard_reports: insert own"
      ON public.hazard_reports FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'hazard_confirmations' AND policyname = 'hazard_confirmations: insert own'
  ) THEN
    CREATE POLICY "hazard_confirmations: insert own"
      ON public.hazard_confirmations FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'hazard_confirmations' AND policyname = 'hazard_confirmations: read all'
  ) THEN
    CREATE POLICY "hazard_confirmations: read all"
      ON public.hazard_confirmations FOR SELECT
      USING (true);
  END IF;
END $$;

-- RPC: Get nearby hazards within radius (meters) using ST_DWithin
CREATE OR REPLACE FUNCTION public.get_nearby_hazards(
  user_lon DOUBLE PRECISION,
  user_lat DOUBLE PRECISION,
  radius_meters DOUBLE PRECISION DEFAULT 2000.0
)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  type TEXT,
  longitude DOUBLE PRECISION,
  latitude DOUBLE PRECISION,
  distance_meters DOUBLE PRECISION,
  confirmations INTEGER,
  reported_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
AS $$
  SELECT 
    h.id,
    h.user_id,
    h.type,
    ST_X(h.location::geometry) as longitude,
    ST_Y(h.location::geometry) as latitude,
    ST_Distance(h.location, ST_SetSRID(ST_MakePoint(user_lon, user_lat), 4326)::geography) as distance_meters,
    h.confirmations,
    h.reported_at,
    h.expires_at
  FROM public.hazard_reports h
  WHERE 
    h.expires_at > NOW()
    AND ST_DWithin(h.location, ST_SetSRID(ST_MakePoint(user_lon, user_lat), 4326)::geography, radius_meters)
  ORDER BY distance_meters ASC;
$$;

-- RPC: Report hazard from lat/lon
CREATE OR REPLACE FUNCTION public.report_hazard(
  hazard_type TEXT,
  lon DOUBLE PRECISION,
  lat DOUBLE PRECISION
)
RETURNS public.hazard_reports
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_report public.hazard_reports;
BEGIN
  INSERT INTO public.hazard_reports (user_id, type, location, confirmations)
  VALUES (
    auth.uid(),
    hazard_type,
    ST_SetSRID(ST_MakePoint(lon, lat), 4326)::geography,
    1
  )
  RETURNING * INTO new_report;

  -- Insert confirmation for creator
  INSERT INTO public.hazard_confirmations (user_id, hazard_id)
  VALUES (auth.uid(), new_report.id)
  ON CONFLICT DO NOTHING;

  RETURN new_report;
END;
$$;

-- RPC: Confirm hazard
CREATE OR REPLACE FUNCTION public.confirm_hazard(target_hazard_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_count INTEGER;
BEGIN
  -- Insert into hazard_confirmations
  INSERT INTO public.hazard_confirmations (user_id, hazard_id)
  VALUES (auth.uid(), target_hazard_id);

  -- Update count and refresh expiration by 1 hour (max 4 hours total)
  UPDATE public.hazard_reports
  SET 
    confirmations = confirmations + 1,
    expires_at = LEAST(NOW() + INTERVAL '4 hours', expires_at + INTERVAL '1 hour')
  WHERE id = target_hazard_id
  RETURNING confirmations INTO new_count;

  RETURN new_count;
END;
$$;
