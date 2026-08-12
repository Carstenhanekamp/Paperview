-- public.claim_founding_slot() and public.founding_spots_remaining() were
-- transcribed in 20260812091000 without SECURITY DEFINER, which makes them
-- invoker-rights functions. Their bodies call into schema `private`, and
-- `authenticated` / `anon` have no USAGE on that schema (20260804120000:6-7),
-- so both raise "permission denied for schema private" for every client
-- caller.
--
-- This is why founder numbers were never assigned in practice: the old
-- src/hooks/useAuth.js claim path caught the RPC error and silently fell back
-- to a plain profile fetch, so the failure never surfaced. The founding claim
-- is now an explicit, user-triggered action that reports its errors, so the
-- wrappers have to actually work.
--
-- Bodies are unchanged from 20260812091000 — only the security context and the
-- volatility/return signature are re-declared, as CREATE OR REPLACE requires.
--
-- The private.* functions keep their service_role-only grants. They take
-- p_user_id explicitly, so granting them to `authenticated` would let any
-- signed-in user claim a founding slot on another user's behalf; the wrappers
-- below bind the caller to auth.uid() instead.

CREATE OR REPLACE FUNCTION public.claim_founding_slot()
 RETURNS jsonb
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
  SELECT private.claim_founding_slot(auth.uid());
$function$;

CREATE OR REPLACE FUNCTION public.founding_spots_remaining()
 RETURNS integer
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
  SELECT private.founding_spots_remaining();
$function$;

-- CREATE OR REPLACE preserves existing grants, but re-assert them so this
-- migration is self-contained on a clean `supabase db reset`.
REVOKE ALL ON FUNCTION public.claim_founding_slot() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_founding_slot() TO authenticated;
-- The landing page shows the remaining count before sign-in.
GRANT EXECUTE ON FUNCTION public.founding_spots_remaining() TO anon, authenticated;
