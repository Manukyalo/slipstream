-- ============================================================
-- Migration: 0018_settings_garage_and_payments
-- Phase 9: Garage Odometer, Drive Attachment & Regional Payments
-- ============================================================

-- 1. Add odometer to vehicles table
ALTER TABLE public.vehicles 
  ADD COLUMN IF NOT EXISTS odometer INTEGER DEFAULT 0 CHECK (odometer >= 0);

-- 2. Add supporter fields to profiles
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS supporter_tier TEXT DEFAULT NULL;

ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS supporter_badge TEXT DEFAULT NULL;

-- 3. Payment status enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_status') THEN
    CREATE TYPE payment_status AS ENUM ('pending', 'processing', 'succeeded', 'failed', 'refunded');
  END IF;
END $$;

-- 4. Payments table (money strictly in integer cents, idempotency required)
CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tier_id TEXT NOT NULL,
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  currency VARCHAR(3) NOT NULL,
  provider VARCHAR(32) NOT NULL,
  provider_tx_id TEXT,
  idempotency_key TEXT UNIQUE NOT NULL,
  status payment_status NOT NULL DEFAULT 'pending',
  phone_masked TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS payments_user_id_idx ON public.payments(user_id);
CREATE INDEX IF NOT EXISTS payments_idempotency_key_idx ON public.payments(idempotency_key);
CREATE INDEX IF NOT EXISTS payments_status_idx ON public.payments(status);

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'payments' AND policyname = 'payments: owner select'
  ) THEN
    CREATE POLICY "payments: owner select"
      ON public.payments FOR SELECT
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'payments' AND policyname = 'payments: owner insert'
  ) THEN
    CREATE POLICY "payments: owner insert"
      ON public.payments FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- 5. Immutable payment ledger for audit & reconciliation
CREATE TABLE IF NOT EXISTS public.payment_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID NOT NULL REFERENCES public.payments(id) ON DELETE CASCADE,
  previous_status payment_status,
  new_status payment_status NOT NULL,
  provider_event_id TEXT,
  raw_payload JSONB,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS payment_ledger_payment_id_idx ON public.payment_ledger(payment_id);
ALTER TABLE public.payment_ledger ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'payment_ledger' AND policyname = 'payment_ledger: owner select'
  ) THEN
    CREATE POLICY "payment_ledger: owner select"
      ON public.payment_ledger FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM public.payments p
          WHERE p.id = payment_ledger.payment_id AND p.user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- 6. RPC: Attach drives / unassigned trips to a vehicle
CREATE OR REPLACE FUNCTION public.attach_drives_to_vehicle(
  p_vehicle_id UUID,
  p_trip_ids UUID[] DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated_count INTEGER;
BEGIN
  -- Verify ownership of vehicle
  IF NOT EXISTS (
    SELECT 1 FROM public.vehicles WHERE id = p_vehicle_id AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Access denied: vehicle not owned by user';
  END IF;

  IF p_trip_ids IS NOT NULL AND array_length(p_trip_ids, 1) > 0 THEN
    UPDATE public.trips
    SET vehicle_id = p_vehicle_id
    WHERE user_id = auth.uid() AND id = ANY(p_trip_ids);
  ELSE
    -- Attach all unassigned trips
    UPDATE public.trips
    SET vehicle_id = p_vehicle_id
    WHERE user_id = auth.uid() AND vehicle_id IS NULL;
  END IF;

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  RETURN v_updated_count;
END;
$$;
