-- Applied to the live project (wpvfaistmwtkgkqpkkrm) as
-- `revoke_authenticated_write_grants_on_wallet_tables`. Mirrored here so the
-- repo stops drifting from production.
--
-- public.profiles, wallets, ledger and purchases were created in
-- 20260804120000 with Supabase's default GRANT ALL to anon/authenticated.
-- That migration enabled RLS, which blocks row-level INSERT/UPDATE/DELETE
-- (no policy = deny) and so looked sufficient.
--
-- It is not: PostgreSQL does not apply row-level security to TRUNCATE. TRUNCATE
-- is a table-level operation gated solely by the TRUNCATE privilege, so any
-- user holding the `authenticated` role -- i.e. anyone who completes a magic
-- link signup -- could issue `TRUNCATE public.wallets` through PostgREST and
-- destroy every wallet balance, the ledger, and the founding member list.
-- No foreign key referenced these tables, so nothing blocked it either.
--
-- The invite_* tables were never exposed this way because 20260810090000
-- revoked their grants explicitly. These four were missed.
--
-- Every legitimate write goes through SECURITY DEFINER functions, which execute
-- as the definer rather than the caller, so no client flow needs these grants.

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.profiles, public.wallets, public.ledger, public.purchases
  FROM anon, authenticated;

-- SELECT stays: the app reads public.profiles directly (src/hooks/useAuth.js),
-- and the *_select_own policies scope every read to the caller's own rows.
GRANT SELECT ON public.profiles, public.wallets, public.ledger, public.purchases
  TO authenticated;
