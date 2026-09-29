-- ============================================================
-- Migration: 0014_offline_queue
-- Phase 16 – Offline Buffering
-- Server-side: nothing needed — offline queue is purely client-side
-- (expo-sqlite). This migration only adds the idempotency safety net:
-- unique constraints on client_id columns so retried syncs never
-- create duplicate records.
-- ============================================================

-- trips: add client_id for idempotent offline sync
ALTER TABLE public.trips
  ADD COLUMN IF NOT EXISTS client_id UUID UNIQUE;

-- drag_runs: add client_id
ALTER TABLE public.drag_runs
  ADD COLUMN IF NOT EXISTS client_id UUID UNIQUE;

-- hazard_reports: add client_id
ALTER TABLE public.hazard_reports
  ADD COLUMN IF NOT EXISTS client_id UUID UNIQUE;

-- ── Indexes on client_id for fast upsert deduplication ───────────────────────
CREATE INDEX IF NOT EXISTS trips_client_id_idx
  ON public.trips (client_id)
  WHERE client_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS drag_runs_client_id_idx
  ON public.drag_runs (client_id)
  WHERE client_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS hazard_reports_client_id_idx
  ON public.hazard_reports (client_id)
  WHERE client_id IS NOT NULL;
