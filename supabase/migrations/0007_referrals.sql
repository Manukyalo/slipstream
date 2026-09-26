-- ============================================================
-- Migration: 0007_referrals
-- Phase 7 – Invite / Share & Referral Tracking
-- ============================================================

-- 1. Helper function to generate a random 6-character alphanumeric referral code
CREATE OR REPLACE FUNCTION public.generate_unique_referral_code()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v_chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- Exclude ambiguous chars (0, O, 1, I)
  v_result TEXT := '';
  v_i INTEGER;
  v_exists BOOLEAN;
BEGIN
  LOOP
    v_result := '';
    FOR v_i IN 1..6 LOOP
      v_result := v_result || substr(v_chars, floor(random() * length(v_chars) + 1)::integer, 1);
    END LOOP;

    -- Ensure uniqueness in profiles table
    SELECT EXISTS (SELECT 1 FROM public.profiles WHERE referral_code = v_result) INTO v_exists;
    IF NOT v_exists THEN
      RETURN v_result;
    END IF;
  END LOOP;
END;
$$;

-- 2. Add referral_code column to public.profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE;

-- Backfill any existing profiles that don't have a referral_code yet
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT id FROM public.profiles WHERE referral_code IS NULL LOOP
    UPDATE public.profiles
    SET referral_code = public.generate_unique_referral_code()
    WHERE id = r.id;
  END LOOP;
END $$;

-- Set default for future inserts
ALTER TABLE public.profiles
  ALTER COLUMN referral_code SET DEFAULT public.generate_unique_referral_code();

-- Create index for fast referral code lookups
CREATE INDEX IF NOT EXISTS profiles_referral_code_idx ON public.profiles (referral_code);

-- 3. Referrals table
CREATE TABLE IF NOT EXISTS public.referrals (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  referred_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  referral_code    TEXT NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT referrals_referred_user_id_key UNIQUE (referred_user_id),
  CONSTRAINT referrals_no_self_referral CHECK (referrer_id != referred_user_id)
);

CREATE INDEX IF NOT EXISTS referrals_referrer_id_idx ON public.referrals (referrer_id);
CREATE INDEX IF NOT EXISTS referrals_referred_user_id_idx ON public.referrals (referred_user_id);

-- Enable RLS
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

-- 4. RLS policies
-- Users can see referrals where they are either the referrer or referred
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'referrals' AND policyname = 'referrals: select own'
  ) THEN
    CREATE POLICY "referrals: select own"
      ON public.referrals FOR SELECT
      USING (auth.uid() = referrer_id OR auth.uid() = referred_user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'referrals' AND policyname = 'referrals: insert own'
  ) THEN
    CREATE POLICY "referrals: insert own"
      ON public.referrals FOR INSERT
      WITH CHECK (auth.uid() = referred_user_id);
  END IF;
END $$;

-- 5. RPC function to safely claim a referral code
CREATE OR REPLACE FUNCTION public.claim_referral_code(referral_code_input TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_referrer_id UUID;
  v_user_id UUID := auth.uid();
  v_clean_code TEXT;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  v_clean_code := UPPER(TRIM(referral_code_input));

  -- Look up referrer
  SELECT id INTO v_referrer_id
  FROM public.profiles
  WHERE UPPER(referral_code) = v_clean_code;

  IF v_referrer_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid referral code');
  END IF;

  IF v_referrer_id = v_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot refer yourself');
  END IF;

  -- Check if user was already referred
  IF EXISTS (SELECT 1 FROM public.referrals WHERE referred_user_id = v_user_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'User already referred');
  END IF;

  -- Insert referral record
  INSERT INTO public.referrals (referrer_id, referred_user_id, referral_code)
  VALUES (v_referrer_id, v_user_id, v_clean_code);

  RETURN jsonb_build_object('success', true, 'referrer_id', v_referrer_id);
END;
$$;

-- 6. Update handle_new_user() trigger to generate referral_code and process metadata referral_code
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_referral_code TEXT;
  v_incoming_ref_code TEXT;
  v_referrer_id UUID;
BEGIN
  v_new_referral_code := public.generate_unique_referral_code();

  INSERT INTO public.profiles (id, display_name, avatar_url, referral_code)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      split_part(NEW.email, '@', 1)
    ),
    NEW.raw_user_meta_data->>'avatar_url',
    v_new_referral_code
  );

  -- Check if user signed up with a referral code in metadata
  v_incoming_ref_code := UPPER(TRIM(COALESCE(NEW.raw_user_meta_data->>'referral_code', '')));
  IF v_incoming_ref_code <> '' THEN
    SELECT id INTO v_referrer_id
    FROM public.profiles
    WHERE UPPER(referral_code) = v_incoming_ref_code;

    IF v_referrer_id IS NOT NULL AND v_referrer_id <> NEW.id THEN
      INSERT INTO public.referrals (referrer_id, referred_user_id, referral_code)
      VALUES (v_referrer_id, NEW.id, v_incoming_ref_code)
      ON CONFLICT (referred_user_id) DO NOTHING;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
