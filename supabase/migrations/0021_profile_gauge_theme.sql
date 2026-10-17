-- ============================================================
-- Migration: 0021_profile_gauge_theme
-- Add gauge_theme preference column to profiles table
-- Applied: 2026-10-17
-- ============================================================

-- Add the column; safe on re-run because of IF NOT EXISTS
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS gauge_theme TEXT NOT NULL DEFAULT 'slipstream'
    CHECK (gauge_theme IN ('slipstream', 'sport'));

-- Optional index — useful if you ever want to query "all Sport users" for analytics
CREATE INDEX IF NOT EXISTS idx_profiles_gauge_theme
  ON public.profiles (gauge_theme);

-- ============================================================
-- Rollback:
-- ALTER TABLE public.profiles DROP COLUMN IF EXISTS gauge_theme;
-- DROP INDEX IF EXISTS idx_profiles_gauge_theme;
-- ============================================================
