-- Display name + library label for onboarding / in-app chrome.
-- Writes go through SECURITY DEFINER in private (authenticated has SELECT-only
-- on public.profiles after revoke_authenticated_write_grants).

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS display_name text,
  ADD COLUMN IF NOT EXISTS library_name text;

CREATE OR REPLACE FUNCTION private.update_own_profile(
  p_user_id uuid,
  p_display_name text,
  p_library_name text
)
RETURNS public.profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_display text;
  v_library text;
  v_row public.profiles%ROWTYPE;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  v_display := NULLIF(btrim(COALESCE(p_display_name, '')), '');
  v_library := NULLIF(btrim(COALESCE(p_library_name, '')), '');

  IF v_display IS NOT NULL AND char_length(v_display) > 80 THEN
    RAISE EXCEPTION 'display_name_too_long';
  END IF;
  IF v_library IS NOT NULL AND char_length(v_library) > 80 THEN
    RAISE EXCEPTION 'library_name_too_long';
  END IF;
  IF v_display IS NULL THEN
    RAISE EXCEPTION 'display_name_required';
  END IF;
  IF v_library IS NULL THEN
    RAISE EXCEPTION 'library_name_required';
  END IF;

  UPDATE public.profiles
  SET display_name = v_display,
      library_name = v_library
  WHERE user_id = p_user_id
  RETURNING * INTO v_row;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'profile_missing';
  END IF;

  RETURN v_row;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_own_profile(
  p_display_name text,
  p_library_name text
)
RETURNS public.profiles
LANGUAGE sql
-- SECURITY DEFINER is load-bearing, not decoration. `authenticated` has no
-- USAGE on schema `private` (20260804120000) and no EXECUTE on the function
-- below (revoked here), so an invoker-rights wrapper raises
-- "permission denied for schema private" for every caller. Matches the
-- existing wrappers in 20260810090000 (claim_tryout_grant et al).
SECURITY DEFINER
SET search_path TO 'public', 'private'
AS $function$
  SELECT private.update_own_profile(auth.uid(), p_display_name, p_library_name);
$function$;

-- Never grant this to `authenticated`: it takes p_user_id, so a direct grant
-- would let any signed-in user rewrite another user's profile. Clients reach
-- it only through the auth.uid()-bound wrapper above.
REVOKE ALL ON FUNCTION private.update_own_profile(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.update_own_profile(uuid, text, text) TO service_role;

REVOKE ALL ON FUNCTION public.update_own_profile(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_own_profile(text, text) TO authenticated;
