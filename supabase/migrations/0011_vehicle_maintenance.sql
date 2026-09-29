-- ============================================================
-- Migration: 0011_vehicle_maintenance
-- Phase 12 – Vehicle Maintenance Log
-- Tracks mileage, service records, and upkeep expenses per vehicle
-- ============================================================

CREATE TABLE IF NOT EXISTS public.maintenance_logs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id   UUID NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type         TEXT NOT NULL CHECK (type IN ('oil_change', 'tires', 'brakes', 'battery', 'inspection', 'other')),
  description  TEXT NOT NULL,
  odometer     INTEGER NOT NULL CHECK (odometer >= 0),
  cost         NUMERIC(10, 2) NOT NULL DEFAULT 0.00 CHECK (cost >= 0),
  service_date DATE NOT NULL,
  next_due_date DATE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS maintenance_logs_vehicle_date_idx
  ON public.maintenance_logs (vehicle_id, service_date DESC);

CREATE INDEX IF NOT EXISTS maintenance_logs_user_idx
  ON public.maintenance_logs (user_id);

CREATE INDEX IF NOT EXISTS maintenance_logs_next_due_idx
  ON public.maintenance_logs (next_due_date)
  WHERE next_due_date IS NOT NULL;

-- Enable RLS
ALTER TABLE public.maintenance_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies: users may only access logs for vehicles they own
DROP POLICY IF EXISTS "Users can view maintenance logs for their vehicles" ON public.maintenance_logs;
CREATE POLICY "Users can view maintenance logs for their vehicles"
  ON public.maintenance_logs
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.vehicles v
      WHERE v.id = maintenance_logs.vehicle_id AND v.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can create maintenance logs for their vehicles" ON public.maintenance_logs;
CREATE POLICY "Users can create maintenance logs for their vehicles"
  ON public.maintenance_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.vehicles v
      WHERE v.id = maintenance_logs.vehicle_id AND v.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update their own maintenance logs" ON public.maintenance_logs;
CREATE POLICY "Users can update their own maintenance logs"
  ON public.maintenance_logs
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.vehicles v
      WHERE v.id = maintenance_logs.vehicle_id AND v.user_id = auth.uid()
    )
  )
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.vehicles v
      WHERE v.id = maintenance_logs.vehicle_id AND v.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can delete their own maintenance logs" ON public.maintenance_logs;
CREATE POLICY "Users can delete their own maintenance logs"
  ON public.maintenance_logs
  FOR DELETE
  TO authenticated
  USING (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.vehicles v
      WHERE v.id = maintenance_logs.vehicle_id AND v.user_id = auth.uid()
    )
  );

-- Maintenance summary RPC
CREATE OR REPLACE FUNCTION public.get_vehicle_maintenance_summary(p_vehicle_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_summary JSONB;
BEGIN
  -- Verify ownership
  IF NOT EXISTS (
    SELECT 1 FROM public.vehicles
    WHERE id = p_vehicle_id AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Access denied: vehicle not owned by user';
  END IF;

  SELECT jsonb_build_object(
    'total_logs', COUNT(*),
    'total_cost', COALESCE(SUM(cost), 0),
    'latest_odometer', COALESCE(MAX(odometer), 0),
    'latest_service_date', MAX(service_date),
    'next_due_date', MIN(next_due_date) FILTER (WHERE next_due_date >= CURRENT_DATE),
    'upcoming_service_type', (
      SELECT type FROM public.maintenance_logs
      WHERE vehicle_id = p_vehicle_id AND next_due_date >= CURRENT_DATE
      ORDER BY next_due_date ASC
      LIMIT 1
    )
  ) INTO v_summary
  FROM public.maintenance_logs
  WHERE vehicle_id = p_vehicle_id;

  RETURN v_summary;
END;
$$;
