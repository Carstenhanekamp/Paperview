-- Bring the founding-waitlist objects into the repo, transcribed from the live
-- project (wpvfaistmwtkgkqpkkrm) via pg_get_functiondef rather than inferred.
--
-- These were only ever applied through the dashboard/MCP: `profiles` has had
-- RLS enabled since 20260804120000 with no policy recorded here, and
-- claim_founding_slot / founding_spots_remaining are called from
-- invite_tryout_credits.sql, wallet_billing_security.sql and
-- src/hooks/useAuth.js without ever being defined. Both SQL call sites swallow
-- the failure with EXCEPTION WHEN OTHERS THEN NULL, so on a clean
-- `supabase db reset` founder numbers were silently never assigned.
--
-- The definitions below match production byte-for-byte, so re-applying this to
-- the live project is a no-op.

-- 20260804120000 created profiles without this column; production has it and
-- claim_founding_slot depends on it as the idempotency guard.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS slot_resolved boolean NOT NULL DEFAULT false;

-- Owner-only read. Without a policy, RLS denies every client read of profiles.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname = 'profiles_select_own'
  ) THEN
    CREATE POLICY profiles_select_own ON public.profiles
      FOR SELECT TO authenticated
      USING (user_id = auth.uid());
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION private.claim_founding_slot(p_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_profile public.profiles%ROWTYPE;
  v_next integer;
  v_taken integer;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT * INTO v_profile FROM public.profiles WHERE user_id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'profile_missing';
  END IF;

  IF v_profile.slot_resolved THEN
    RETURN jsonb_build_object(
      'founding', v_profile.founding,
      'founder_number', v_profile.founder_number,
      'launch_grant_status', v_profile.launch_grant_status,
      'already_claimed', true,
      'spots_remaining', (SELECT GREATEST(0, 100 - count(*)::integer) FROM public.profiles WHERE founding = true)
    );
  END IF;

  SELECT count(*)::integer INTO v_taken
  FROM public.profiles
  WHERE founding = true;

  IF v_taken >= 100 THEN
    UPDATE public.profiles
    SET founding = false,
        founder_number = NULL,
        launch_grant_status = 'n_a',
        slot_resolved = true,
        email = COALESCE(email, '')
    WHERE user_id = p_user_id
    RETURNING * INTO v_profile;
    RETURN jsonb_build_object(
      'founding', false,
      'founder_number', NULL,
      'launch_grant_status', 'n_a',
      'spots_remaining', 0,
      'already_claimed', false
    );
  END IF;

  SELECT COALESCE(MAX(founder_number), 0) + 1 INTO v_next
  FROM public.profiles
  WHERE founding = true;

  UPDATE public.profiles
  SET founding = true,
      founder_number = v_next,
      launch_grant_status = 'pending',
      slot_resolved = true
  WHERE user_id = p_user_id
  RETURNING * INTO v_profile;

  RETURN jsonb_build_object(
    'founding', true,
    'founder_number', v_profile.founder_number,
    'launch_grant_status', v_profile.launch_grant_status,
    'spots_remaining', GREATEST(0, 100 - v_next),
    'already_claimed', false
  );
END;
$function$;

CREATE OR REPLACE FUNCTION private.founding_spots_remaining()
 RETURNS integer
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT GREATEST(0, 100 - count(*)::integer)
  FROM public.profiles
  WHERE founding = true;
$function$;

CREATE OR REPLACE FUNCTION public.claim_founding_slot()
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO 'public', 'private'
AS $function$
  SELECT private.claim_founding_slot(auth.uid());
$function$;

CREATE OR REPLACE FUNCTION public.founding_spots_remaining()
 RETURNS integer
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'private'
AS $function$
  SELECT private.founding_spots_remaining();
$function$;

REVOKE ALL ON FUNCTION public.claim_founding_slot() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_founding_slot() TO authenticated;
-- The landing page shows the remaining count before sign-in.
GRANT EXECUTE ON FUNCTION public.founding_spots_remaining() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION private.claim_founding_slot(uuid) TO service_role;

-- Seeds the profiles + wallets rows for a new signup. claim_founding_slot
-- raises 'profile_missing' rather than creating a profile, so without this
-- trigger a database built from this repo could never assign founder numbers.
-- Transcribed from production; note it lives in `private`, not `public`.
-- Depends on profiles.slot_resolved, added at the top of this migration.
CREATE OR REPLACE FUNCTION private.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (user_id, email, founding, founder_number, launch_grant_status, slot_resolved)
  VALUES (NEW.id, COALESCE(NEW.email, ''), false, NULL, 'n_a', false);
  INSERT INTO public.wallets (user_id, balance_microcents)
  VALUES (NEW.id, 0);
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION private.handle_new_user();
