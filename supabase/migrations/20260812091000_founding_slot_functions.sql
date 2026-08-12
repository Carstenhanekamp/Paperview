-- Fill in the founding-waitlist pieces that were only ever applied to the live
-- project, so the repo can stand up a working database on its own.
--
-- `profiles` has had RLS enabled since the first migration but no policy, and
-- private.claim_founding_slot / public.founding_spots_remaining are *called*
-- (invite_tryout_credits.sql, wallet_billing_security.sql, src/hooks/useAuth.js)
-- without ever being defined here. Both call sites swallow the resulting error
-- with EXCEPTION WHEN OTHERS THEN NULL, so on a clean `supabase db reset`
-- founder numbers were silently never assigned.
--
-- Everything below is created only when absent, so applying this to the live
-- project cannot overwrite the definitions already running there.

-- Owner-only read on profiles. Without a policy, RLS denies every client read.
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

-- Profiles are written by the founding/grant RPCs (SECURITY DEFINER), never by
-- the client directly.
REVOKE INSERT, UPDATE, DELETE ON TABLE public.profiles FROM anon, authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'private' AND p.proname = 'claim_founding_slot'
  ) THEN
    EXECUTE $fn$
      CREATE FUNCTION private.claim_founding_slot(p_user_id uuid)
      RETURNS jsonb
      LANGUAGE plpgsql
      SECURITY DEFINER
      SET search_path TO 'public', 'auth'
      AS $body$
      DECLARE
        v_profile public.profiles%ROWTYPE;
        v_next integer;
        v_cap constant integer := 100;
      BEGIN
        IF p_user_id IS NULL THEN
          RAISE EXCEPTION 'not_authenticated';
        END IF;

        INSERT INTO public.profiles (user_id, email)
        SELECT id, lower(trim(COALESCE(email, '')))
        FROM auth.users
        WHERE id = p_user_id
        ON CONFLICT (user_id) DO NOTHING;

        -- Serialize concurrent claims so two users cannot take one number.
        SELECT * INTO v_profile
        FROM public.profiles
        WHERE user_id = p_user_id
        FOR UPDATE;

        IF v_profile.founding THEN
          RETURN jsonb_build_object(
            'founding', true,
            'founder_number', v_profile.founder_number,
            'already_claimed', true
          );
        END IF;

        SELECT COALESCE(MAX(founder_number), 0) + 1 INTO v_next
        FROM public.profiles
        WHERE founder_number IS NOT NULL;

        IF v_next > v_cap THEN
          UPDATE public.profiles
          SET launch_grant_status = CASE
                WHEN launch_grant_status = 'n_a' THEN 'n_a'
                ELSE launch_grant_status
              END
          WHERE user_id = p_user_id;
          RETURN jsonb_build_object('founding', false, 'founder_number', NULL, 'waitlisted', true);
        END IF;

        UPDATE public.profiles
        SET founding = true,
            founder_number = v_next,
            launch_grant_status = CASE
              WHEN launch_grant_status = 'granted' THEN 'granted'
              ELSE 'pending'
            END
        WHERE user_id = p_user_id;

        RETURN jsonb_build_object(
          'founding', true,
          'founder_number', v_next,
          'already_claimed', false
        );
      END;
      $body$;
    $fn$;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'claim_founding_slot'
  ) THEN
    EXECUTE $fn$
      CREATE FUNCTION public.claim_founding_slot()
      RETURNS jsonb
      LANGUAGE sql
      SECURITY DEFINER
      SET search_path TO 'public', 'private'
      AS $body$
        SELECT private.claim_founding_slot(auth.uid());
      $body$;
    $fn$;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'founding_spots_remaining'
  ) THEN
    EXECUTE $fn$
      CREATE FUNCTION public.founding_spots_remaining()
      RETURNS integer
      LANGUAGE sql
      STABLE
      SECURITY DEFINER
      SET search_path TO 'public'
      AS $body$
        SELECT GREATEST(
          0,
          100 - (SELECT count(*)::integer FROM public.profiles WHERE founding = true)
        );
      $body$;
    $fn$;
  END IF;
END
$$;

REVOKE ALL ON FUNCTION public.claim_founding_slot() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.founding_spots_remaining() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_founding_slot() TO authenticated;
-- The landing page shows the remaining count before sign-in.
GRANT EXECUTE ON FUNCTION public.founding_spots_remaining() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION private.claim_founding_slot(uuid) TO service_role;
