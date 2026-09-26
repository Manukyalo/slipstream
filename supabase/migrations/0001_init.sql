-- ============================================================
-- Migration: 0001_init
-- DriveTrack – initial schema
-- ============================================================

-- 1. Enable PostGIS (needed for Phase 2 geo queries)
CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA public;

-- 2. Profiles table
--    Mirrors auth.users 1:1. Created by a trigger on sign-up.
CREATE TABLE IF NOT EXISTS public.profiles (
  id           UUID    PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url   TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for display_name lookup (used in rankings)
CREATE INDEX IF NOT EXISTS profiles_display_name_idx ON public.profiles (display_name);

-- 3. RLS – profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Users can read their own profile
CREATE POLICY "profiles: select own"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "profiles: update own"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Insertion is performed by the trigger below (service-role context), not by users directly
-- No INSERT policy for authenticated role: trigger uses SECURITY DEFINER

-- 4. Auto-create profile on new user
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      split_part(NEW.email, '@', 1)
    ),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
