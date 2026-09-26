-- ============================================================
-- Migration: 0004_drag_runs
-- Phase 4 – Drag Race Timer
-- ============================================================

CREATE TABLE IF NOT EXISTS public.drag_runs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vehicle_id      UUID REFERENCES public.vehicles(id) ON DELETE SET NULL,
  distance_type   TEXT NOT NULL CHECK (distance_type IN ('quarter_mile', 'half_mile', 'one_mile')),
  elapsed_ms      INTEGER NOT NULL,
  top_speed       NUMERIC(6, 2) NOT NULL DEFAULT 0,
  recorded_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS drag_runs_user_id_idx ON public.drag_runs(user_id);
CREATE INDEX IF NOT EXISTS drag_runs_vehicle_id_idx ON public.drag_runs(vehicle_id);
CREATE INDEX IF NOT EXISTS drag_runs_recorded_at_idx ON public.drag_runs(recorded_at DESC);
CREATE INDEX IF NOT EXISTS drag_runs_elapsed_ms_idx ON public.drag_runs(distance_type, elapsed_ms ASC);

ALTER TABLE public.drag_runs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'drag_runs' AND policyname = 'drag_runs: select own'
  ) THEN
    CREATE POLICY "drag_runs: select own"
      ON public.drag_runs FOR SELECT
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'drag_runs' AND policyname = 'drag_runs: insert own'
  ) THEN
    CREATE POLICY "drag_runs: insert own"
      ON public.drag_runs FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'drag_runs' AND policyname = 'drag_runs: delete own'
  ) THEN
    CREATE POLICY "drag_runs: delete own"
      ON public.drag_runs FOR DELETE
      USING (auth.uid() = user_id);
  END IF;
END $$;
