-- ============================================================
-- Migration: 0020_maintenance_currency_and_due_odometer
-- Add currency code and optional next due odometer to maintenance_logs
-- ============================================================

ALTER TABLE public.maintenance_logs
  ADD COLUMN IF NOT EXISTS currency VARCHAR(3) NOT NULL DEFAULT 'KES',
  ADD COLUMN IF NOT EXISTS next_due_odometer INTEGER;
