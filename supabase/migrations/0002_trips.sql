-- ============================================================
-- Migration: 0002_trips
-- Phase 2 – Core Trip Tracking
-- ============================================================

CREATE TABLE IF NOT EXISTS public.trips (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  vehicle_id      UUID,
  route           geography(LineString, 4326),
  distance_m      NUMERIC(10, 2) NOT NULL DEFAULT 0,
  duration_s      INTEGER NOT NULL DEFAULT 0,
  top_speed       NUMERIC(6, 2) NOT NULL DEFAULT 0,
  avg_speed       NUMERIC(6, 2) NOT NULL DEFAULT 0,
  speed_samples   JSONB NOT NULL DEFAULT '[]'::jsonb,
  started_at      TIMESTAMPTZ NOT NULL,
  ended_at        TIMESTAMPTZ NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS trips_user_id_idx ON public.trips(user_id);
CREATE INDEX IF NOT EXISTS trips_route_geo_idx ON public.trips USING GIST(route);
CREATE INDEX IF NOT EXISTS trips_started_at_idx ON public.trips(started_at DESC);

ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'trips' AND policyname = 'trips: select own'
  ) THEN
    CREATE POLICY "trips: select own"
      ON public.trips FOR SELECT
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'trips' AND policyname = 'trips: insert own'
  ) THEN
    CREATE POLICY "trips: insert own"
      ON public.trips FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'trips' AND policyname = 'trips: delete own'
  ) THEN
    CREATE POLICY "trips: delete own"
      ON public.trips FOR DELETE
      USING (auth.uid() = user_id);
  END IF;
END
$$;
