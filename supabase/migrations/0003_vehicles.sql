-- ============================================================
-- Migration: 0003_vehicles
-- Phase 3 – Vehicle Profile (global make/model + garage)
-- ============================================================

-- 1. Static global makes table
CREATE TABLE IF NOT EXISTS public.vehicle_makes (
  id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name  TEXT NOT NULL UNIQUE
);

CREATE INDEX IF NOT EXISTS vehicle_makes_name_idx ON public.vehicle_makes(name);
ALTER TABLE public.vehicle_makes ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'vehicle_makes' AND policyname = 'vehicle_makes: public read'
  ) THEN
    CREATE POLICY "vehicle_makes: public read"
      ON public.vehicle_makes FOR SELECT
      USING (true);
  END IF;
END $$;

-- 2. Static global models table
CREATE TABLE IF NOT EXISTS public.vehicle_models (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  make_id   UUID NOT NULL REFERENCES public.vehicle_makes(id) ON DELETE CASCADE,
  name      TEXT NOT NULL,
  UNIQUE(make_id, name)
);

CREATE INDEX IF NOT EXISTS vehicle_models_make_id_idx ON public.vehicle_models(make_id);
CREATE INDEX IF NOT EXISTS vehicle_models_name_idx ON public.vehicle_models(name);
ALTER TABLE public.vehicle_models ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'vehicle_models' AND policyname = 'vehicle_models: public read'
  ) THEN
    CREATE POLICY "vehicle_models: public read"
      ON public.vehicle_models FOR SELECT
      USING (true);
  END IF;
END $$;

-- 3. User vehicles table
CREATE TABLE IF NOT EXISTS public.vehicles (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  make        TEXT NOT NULL,
  model       TEXT NOT NULL,
  year        INTEGER NOT NULL,
  nickname    TEXT,
  is_primary  BOOLEAN NOT NULL DEFAULT false,
  photo_url   TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS vehicles_user_id_idx ON public.vehicles(user_id);
-- Ensure at most one primary vehicle per user
CREATE UNIQUE INDEX IF NOT EXISTS vehicles_one_primary_per_user 
  ON public.vehicles(user_id) 
  WHERE (is_primary = true);

ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'vehicles' AND policyname = 'vehicles: owner full access'
  ) THEN
    CREATE POLICY "vehicles: owner full access"
      ON public.vehicles FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- 4. Foreign key on trips table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'trips_vehicle_id_fkey'
  ) THEN
    ALTER TABLE public.trips 
      ADD CONSTRAINT trips_vehicle_id_fkey 
      FOREIGN KEY (vehicle_id) REFERENCES public.vehicles(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 5. Storage setup for vehicle-photos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'vehicle-photos',
  'vehicle-photos',
  true,
  5242880, -- 5 MB
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'vehicle-photos: owner upload'
  ) THEN
    CREATE POLICY "vehicle-photos: owner upload"
      ON storage.objects FOR INSERT
      WITH CHECK (
        bucket_id = 'vehicle-photos' 
        AND auth.uid()::text = (storage.foldername(name))[1]
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'vehicle-photos: public read'
  ) THEN
    CREATE POLICY "vehicle-photos: public read"
      ON storage.objects FOR SELECT
      USING (bucket_id = 'vehicle-photos');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'vehicle-photos: owner update'
  ) THEN
    CREATE POLICY "vehicle-photos: owner update"
      ON storage.objects FOR UPDATE
      USING (
        bucket_id = 'vehicle-photos' 
        AND auth.uid()::text = (storage.foldername(name))[1]
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'vehicle-photos: owner delete'
  ) THEN
    CREATE POLICY "vehicle-photos: owner delete"
      ON storage.objects FOR DELETE
      USING (
        bucket_id = 'vehicle-photos' 
        AND auth.uid()::text = (storage.foldername(name))[1]
      );
  END IF;
END $$;
