-- Invite emails + tryout wallet grants / debits
-- Money unit: 1 EUR = 100_000_000 microcents (€2 grant = 200_000_000; €0.02 action = 2_000_000)

CREATE EXTENSION IF NOT EXISTS citext WITH SCHEMA extensions;

CREATE TABLE IF NOT EXISTS public.invite_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email extensions.citext NOT NULL,
  grant_microcents bigint NOT NULL DEFAULT 200000000 CHECK (grant_microcents > 0),
  active boolean NOT NULL DEFAULT true,
  note text NOT NULL DEFAULT '',
  claimed_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  claimed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT invite_emails_email_unique UNIQUE (email),
  CONSTRAINT invite_emails_claim_consistency CHECK (
    (claimed_by IS NULL AND claimed_at IS NULL)
    OR (claimed_by IS NOT NULL AND claimed_at IS NOT NULL)
  )
);

CREATE TABLE IF NOT EXISTS public.invite_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL,
  grant_microcents bigint NOT NULL DEFAULT 200000000 CHECK (grant_microcents > 0),
  max_redemptions integer NOT NULL DEFAULT 1 CHECK (max_redemptions > 0),
  redemption_count integer NOT NULL DEFAULT 0 CHECK (redemption_count >= 0),
  active boolean NOT NULL DEFAULT true,
  note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT invite_codes_code_unique UNIQUE (code),
  CONSTRAINT invite_codes_redemption_cap CHECK (redemption_count <= max_redemptions)
);

CREATE TABLE IF NOT EXISTS public.invite_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code_id uuid NOT NULL REFERENCES public.invite_codes (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT invite_redemptions_code_user_unique UNIQUE (code_id, user_id)
);

CREATE INDEX IF NOT EXISTS invite_emails_claimed_by_idx ON public.invite_emails (claimed_by);
CREATE INDEX IF NOT EXISTS invite_redemptions_user_id_idx ON public.invite_redemptions (user_id);

ALTER TABLE public.invite_emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invite_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invite_redemptions ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.invite_emails FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.invite_codes FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.invite_redemptions FROM PUBLIC, anon, authenticated;

-- Authenticated users can read their own redemption + claimed invite email rows (not the full allowlist).
CREATE POLICY invite_emails_select_own ON public.invite_emails
  FOR SELECT TO authenticated
  USING (claimed_by = auth.uid());

CREATE POLICY invite_redemptions_select_own ON public.invite_redemptions
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

GRANT SELECT ON TABLE public.invite_emails TO authenticated;
GRANT SELECT ON TABLE public.invite_redemptions TO authenticated;

-- Wallets / ledger readable by owner (if not already).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'wallets' AND policyname = 'wallets_select_own'
  ) THEN
    CREATE POLICY wallets_select_own ON public.wallets
      FOR SELECT TO authenticated
      USING (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'ledger' AND policyname = 'ledger_select_own'
  ) THEN
    CREATE POLICY ledger_select_own ON public.ledger
      FOR SELECT TO authenticated
      USING (user_id = auth.uid());
  END IF;
END $$;

GRANT SELECT ON TABLE public.wallets TO authenticated;
GRANT SELECT ON TABLE public.ledger TO authenticated;

CREATE OR REPLACE FUNCTION private.ensure_wallet(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.wallets (user_id, balance_microcents, updated_at)
  VALUES (p_user_id, 0, now())
  ON CONFLICT (user_id) DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION private.user_has_tryout_grant(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.ledger
    WHERE user_id = p_user_id AND kind = 'grant'
  );
$$;

CREATE OR REPLACE FUNCTION private.apply_tryout_grant(
  p_user_id uuid,
  p_amount_microcents bigint,
  p_request_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'private'
AS $$
DECLARE
  v_balance bigint;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;
  IF p_amount_microcents IS NULL OR p_amount_microcents <= 0 THEN
    RAISE EXCEPTION 'invalid_grant_amount';
  END IF;

  -- One tryout grant per user (email or code — no stacking).
  IF private.user_has_tryout_grant(p_user_id) THEN
    PERFORM private.ensure_wallet(p_user_id);
    SELECT balance_microcents INTO v_balance FROM public.wallets WHERE user_id = p_user_id;
    RETURN jsonb_build_object(
      'granted', false,
      'already_granted', true,
      'balance_microcents', COALESCE(v_balance, 0),
      'grant_microcents', 0
    );
  END IF;

  PERFORM private.ensure_wallet(p_user_id);

  UPDATE public.wallets
  SET balance_microcents = balance_microcents + p_amount_microcents,
      updated_at = now()
  WHERE user_id = p_user_id
  RETURNING balance_microcents INTO v_balance;

  INSERT INTO public.ledger (
    user_id, kind, amount_microcents, request_id
  ) VALUES (
    p_user_id, 'grant', p_amount_microcents, p_request_id
  );

  UPDATE public.profiles
  SET launch_grant_status = 'granted'
  WHERE user_id = p_user_id;

  -- Best-effort founding claim (may land on waitlist if full).
  BEGIN
    PERFORM private.claim_founding_slot(p_user_id);
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN jsonb_build_object(
    'granted', true,
    'already_granted', false,
    'balance_microcents', v_balance,
    'grant_microcents', p_amount_microcents
  );
END;
$$;

CREATE OR REPLACE FUNCTION private.claim_tryout_grant(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'private', 'auth'
AS $$
DECLARE
  v_email text;
  v_invite public.invite_emails%ROWTYPE;
  v_result jsonb;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT lower(trim(COALESCE(email, ''))) INTO v_email
  FROM auth.users
  WHERE id = p_user_id;

  IF v_email IS NULL OR v_email = '' THEN
    RETURN jsonb_build_object(
      'granted', false,
      'reason', 'no_email',
      'balance_microcents', COALESCE((SELECT balance_microcents FROM public.wallets WHERE user_id = p_user_id), 0)
    );
  END IF;

  IF private.user_has_tryout_grant(p_user_id) THEN
    PERFORM private.ensure_wallet(p_user_id);
    RETURN jsonb_build_object(
      'granted', false,
      'already_granted', true,
      'reason', 'already_granted',
      'balance_microcents', (SELECT balance_microcents FROM public.wallets WHERE user_id = p_user_id)
    );
  END IF;

  SELECT * INTO v_invite
  FROM public.invite_emails
  WHERE email = v_email
    AND active = true
    AND claimed_by IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    PERFORM private.ensure_wallet(p_user_id);
    RETURN jsonb_build_object(
      'granted', false,
      'reason', 'not_invited',
      'balance_microcents', COALESCE((SELECT balance_microcents FROM public.wallets WHERE user_id = p_user_id), 0)
    );
  END IF;

  UPDATE public.invite_emails
  SET claimed_by = p_user_id,
      claimed_at = now()
  WHERE id = v_invite.id;

  v_result := private.apply_tryout_grant(
    p_user_id,
    v_invite.grant_microcents,
    'invite_email:' || v_invite.id::text
  );

  RETURN v_result || jsonb_build_object('source', 'invite_email');
END;
$$;

CREATE OR REPLACE FUNCTION private.redeem_invite_code(p_user_id uuid, p_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'private'
AS $$
DECLARE
  v_code public.invite_codes%ROWTYPE;
  v_normalized text;
  v_result jsonb;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  v_normalized := upper(trim(COALESCE(p_code, '')));
  IF v_normalized = '' THEN
    RAISE EXCEPTION 'invalid_code';
  END IF;

  IF private.user_has_tryout_grant(p_user_id) THEN
    PERFORM private.ensure_wallet(p_user_id);
    RETURN jsonb_build_object(
      'granted', false,
      'already_granted', true,
      'reason', 'already_granted',
      'balance_microcents', (SELECT balance_microcents FROM public.wallets WHERE user_id = p_user_id)
    );
  END IF;

  SELECT * INTO v_code
  FROM public.invite_codes
  WHERE upper(code) = v_normalized
  FOR UPDATE;

  IF NOT FOUND OR v_code.active IS NOT TRUE THEN
    RAISE EXCEPTION 'invalid_code';
  END IF;

  IF v_code.redemption_count >= v_code.max_redemptions THEN
    RAISE EXCEPTION 'code_exhausted';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.invite_redemptions
    WHERE code_id = v_code.id AND user_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'already_redeemed';
  END IF;

  INSERT INTO public.invite_redemptions (code_id, user_id)
  VALUES (v_code.id, p_user_id);

  UPDATE public.invite_codes
  SET redemption_count = redemption_count + 1
  WHERE id = v_code.id;

  v_result := private.apply_tryout_grant(
    p_user_id,
    v_code.grant_microcents,
    'invite_code:' || v_code.id::text
  );

  RETURN v_result || jsonb_build_object('source', 'invite_code');
END;
$$;

CREATE OR REPLACE FUNCTION private.get_wallet_balance(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'private'
AS $$
DECLARE
  v_balance bigint;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;
  PERFORM private.ensure_wallet(p_user_id);
  SELECT balance_microcents INTO v_balance FROM public.wallets WHERE user_id = p_user_id;
  RETURN jsonb_build_object('balance_microcents', COALESCE(v_balance, 0));
END;
$$;

CREATE OR REPLACE FUNCTION private.debit_wallet(
  p_user_id uuid,
  p_amount_microcents bigint,
  p_openai_cost_microcents bigint,
  p_model text,
  p_input_tokens integer,
  p_output_tokens integer,
  p_request_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_balance bigint;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;
  IF p_amount_microcents IS NULL OR p_amount_microcents <= 0 THEN
    RAISE EXCEPTION 'invalid_debit_amount';
  END IF;

  INSERT INTO public.wallets (user_id, balance_microcents, updated_at)
  VALUES (p_user_id, 0, now())
  ON CONFLICT (user_id) DO NOTHING;

  SELECT balance_microcents INTO v_balance
  FROM public.wallets
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF v_balance < p_amount_microcents THEN
    INSERT INTO public.ledger (
      user_id, kind, amount_microcents, model, input_tokens, output_tokens,
      openai_cost_microcents, request_id
    ) VALUES (
      p_user_id, 'debit_failed', p_amount_microcents, p_model, p_input_tokens, p_output_tokens,
      COALESCE(p_openai_cost_microcents, 0), p_request_id
    );
    RAISE EXCEPTION 'insufficient_balance' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.wallets
  SET balance_microcents = balance_microcents - p_amount_microcents,
      updated_at = now()
  WHERE user_id = p_user_id
  RETURNING balance_microcents INTO v_balance;

  INSERT INTO public.ledger (
    user_id, kind, amount_microcents, model, input_tokens, output_tokens,
    openai_cost_microcents, request_id
  ) VALUES (
    p_user_id, 'debit', -p_amount_microcents, p_model, p_input_tokens, p_output_tokens,
    COALESCE(p_openai_cost_microcents, 0), p_request_id
  );

  RETURN jsonb_build_object(
    'ok', true,
    'balance_microcents', v_balance,
    'debited_microcents', p_amount_microcents
  );
END;
$$;

-- Public wrappers for authenticated clients
CREATE OR REPLACE FUNCTION public.claim_tryout_grant()
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public', 'private'
AS $$
  SELECT private.claim_tryout_grant(auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.redeem_invite_code(p_code text)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public', 'private'
AS $$
  SELECT private.redeem_invite_code(auth.uid(), p_code);
$$;

CREATE OR REPLACE FUNCTION public.get_wallet_balance()
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public', 'private'
AS $$
  SELECT private.get_wallet_balance(auth.uid());
$$;

-- Proxy-only debit (service_role). Pass user id explicitly.
CREATE OR REPLACE FUNCTION public.debit_wallet_for_proxy(
  p_user_id uuid,
  p_amount_microcents bigint,
  p_openai_cost_microcents bigint DEFAULT 0,
  p_model text DEFAULT NULL,
  p_input_tokens integer DEFAULT NULL,
  p_output_tokens integer DEFAULT NULL,
  p_request_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'private'
AS $$
BEGIN
  -- EXECUTE granted only to service_role.
  RETURN private.debit_wallet(
    p_user_id,
    p_amount_microcents,
    p_openai_cost_microcents,
    p_model,
    p_input_tokens,
    p_output_tokens,
    p_request_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.claim_tryout_grant() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.redeem_invite_code(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_wallet_balance() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.debit_wallet_for_proxy(uuid, bigint, bigint, text, integer, integer, text) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.claim_tryout_grant() TO authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_invite_code(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_wallet_balance() TO authenticated;
GRANT EXECUTE ON FUNCTION public.debit_wallet_for_proxy(uuid, bigint, bigint, text, integer, integer, text) TO service_role;

GRANT USAGE ON SCHEMA private TO postgres, service_role;
GRANT EXECUTE ON FUNCTION private.debit_wallet(uuid, bigint, bigint, text, integer, integer, text) TO service_role;

-- No shared public backup code. Prefer invite_emails; create one-time codes via SQL when needed.
-- Example one-time code:
--   insert into public.invite_codes (code, grant_microcents, max_redemptions, note)
--   values ('FRIEND-ALICE', 200000000, 1, 'one-time for Alice');

