-- Migration: 0022_per_vehicle_records.sql
-- Backfills vehicle_id on trips/drag_runs/laps for rows with no vehicle attached.
-- Never deletes or overwrites existing records.
-- Safe to run multiple times (idempotent).

BEGIN;

-- 1. Backfill trips.vehicle_id -> user's current primary vehicle
UPDATE public.trips t
SET vehicle_id = (
  SELECT v.id
  FROM public.vehicles v
  WHERE v.user_id = t.user_id
    AND v.is_primary = true
  LIMIT 1
)
WHERE t.vehicle_id IS NULL
  AND EXISTS (
    SELECT 1 FROM public.vehicles v2
    WHERE v2.user_id = t.user_id AND v2.is_primary = true
  );

-- 2. Backfill drag_runs.vehicle_id
UPDATE public.drag_runs d
SET vehicle_id = (
  SELECT v.id
  FROM public.vehicles v
  WHERE v.user_id = d.user_id
    AND v.is_primary = true
  LIMIT 1
)
WHERE d.vehicle_id IS NULL
  AND EXISTS (
    SELECT 1 FROM public.vehicles v2
    WHERE v2.user_id = d.user_id AND v2.is_primary = true
  );

-- 3. Backfill laps.vehicle_id
UPDATE public.laps l
SET vehicle_id = (
  SELECT v.id
  FROM public.vehicles v
  WHERE v.user_id = l.user_id
    AND v.is_primary = true
  LIMIT 1
)
WHERE l.vehicle_id IS NULL
  AND EXISTS (
    SELECT 1 FROM public.vehicles v2
    WHERE v2.user_id = l.user_id AND v2.is_primary = true
  );

-- 4. Index vehicle_id on trips for per-car queries
CREATE INDEX IF NOT EXISTS trips_vehicle_id_idx ON public.trips(vehicle_id);

-- 5. Per-vehicle records view (top_speed, best drag, best lap, peak G per vehicle)
CREATE OR REPLACE VIEW public.vehicle_personal_bests AS
SELECT
  t.vehicle_id,
  t.user_id,
  MAX(t.top_speed)                                                  AS top_speed_kmh,
  MIN(d.elapsed_ms) FILTER (WHERE d.distance_type = 'quarter_mile') AS best_quarter_ms,
  MIN(l.lap_time_ms)                                                AS best_lap_ms,
  SUM(t.distance_m) / 1000.0                                       AS total_distance_km,
  COUNT(DISTINCT t.id)                                              AS trip_count
FROM public.vehicles v
LEFT JOIN public.trips          t ON t.vehicle_id = v.id AND t.user_id = v.user_id
LEFT JOIN public.drag_runs      d ON d.vehicle_id = v.id AND d.user_id = v.user_id
LEFT JOIN public.laps           l ON l.vehicle_id = v.id AND l.user_id = v.user_id
GROUP BY t.vehicle_id, t.user_id;

-- 6. RPC: move trips from one vehicle to another (with confirmation)
CREATE OR REPLACE FUNCTION public.move_trips_to_vehicle(
  p_from_vehicle_id UUID,
  p_to_vehicle_id   UUID
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  -- Verify both vehicles belong to the calling user
  IF NOT EXISTS (
    SELECT 1 FROM public.vehicles
    WHERE id = p_from_vehicle_id AND user_id = auth.uid()
  ) OR NOT EXISTS (
    SELECT 1 FROM public.vehicles
    WHERE id = p_to_vehicle_id AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Access denied: one or both vehicles not owned by user';
  END IF;

  UPDATE public.trips
  SET vehicle_id = p_to_vehicle_id
  WHERE vehicle_id = p_from_vehicle_id
    AND user_id = auth.uid();

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

COMMIT;
