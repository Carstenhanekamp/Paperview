-- Harden tryout billing: one grant per user, refund + annotate for debit-first proxy flow

-- One tryout grant row per user (email invite and code cannot stack / race).
CREATE UNIQUE INDEX IF NOT EXISTS ledger_one_grant_per_user_idx
  ON public.ledger (user_id)
  WHERE (kind = 'grant');

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

  PERFORM private.ensure_wallet(p_user_id);

  -- Serialize concurrent email+code claims for the same user.
  SELECT balance_microcents INTO v_balance
  FROM public.wallets
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF private.user_has_tryout_grant(p_user_id) THEN
    RETURN jsonb_build_object(
      'granted', false,
      'already_granted', true,
      'balance_microcents', COALESCE(v_balance, 0),
      'grant_microcents', 0
    );
  END IF;

  BEGIN
    INSERT INTO public.ledger (
      user_id, kind, amount_microcents, request_id
    ) VALUES (
      p_user_id, 'grant', p_amount_microcents, p_request_id
    );
  EXCEPTION WHEN unique_violation THEN
    SELECT balance_microcents INTO v_balance FROM public.wallets WHERE user_id = p_user_id;
    RETURN jsonb_build_object(
      'granted', false,
      'already_granted', true,
      'balance_microcents', COALESCE(v_balance, 0),
      'grant_microcents', 0
    );
  END;

  UPDATE public.wallets
  SET balance_microcents = balance_microcents + p_amount_microcents,
      updated_at = now()
  WHERE user_id = p_user_id
  RETURNING balance_microcents INTO v_balance;

  UPDATE public.profiles
  SET launch_grant_status = 'granted'
  WHERE user_id = p_user_id;

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

CREATE OR REPLACE FUNCTION private.refund_wallet(
  p_user_id uuid,
  p_amount_microcents bigint,
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
    RAISE EXCEPTION 'invalid_refund_amount';
  END IF;
  IF p_request_id IS NULL OR length(trim(p_request_id)) = 0 THEN
    RAISE EXCEPTION 'invalid_request_id';
  END IF;

  -- Idempotent: already refunded this debit request.
  IF EXISTS (
    SELECT 1 FROM public.ledger
    WHERE user_id = p_user_id
      AND kind = 'refund'
      AND request_id = p_request_id
  ) THEN
    SELECT balance_microcents INTO v_balance FROM public.wallets WHERE user_id = p_user_id;
    RETURN jsonb_build_object(
      'ok', true,
      'already_refunded', true,
      'balance_microcents', COALESCE(v_balance, 0),
      'refunded_microcents', 0
    );
  END IF;

  -- Only refund a debit we actually took for this request_id.
  IF NOT EXISTS (
    SELECT 1 FROM public.ledger
    WHERE user_id = p_user_id
      AND kind = 'debit'
      AND request_id = p_request_id
  ) THEN
    RAISE EXCEPTION 'debit_not_found';
  END IF;

  INSERT INTO public.wallets (user_id, balance_microcents, updated_at)
  VALUES (p_user_id, 0, now())
  ON CONFLICT (user_id) DO NOTHING;

  SELECT balance_microcents INTO v_balance
  FROM public.wallets
  WHERE user_id = p_user_id
  FOR UPDATE;

  UPDATE public.wallets
  SET balance_microcents = balance_microcents + p_amount_microcents,
      updated_at = now()
  WHERE user_id = p_user_id
  RETURNING balance_microcents INTO v_balance;

  INSERT INTO public.ledger (
    user_id, kind, amount_microcents, request_id
  ) VALUES (
    p_user_id, 'refund', p_amount_microcents, p_request_id
  );

  RETURN jsonb_build_object(
    'ok', true,
    'already_refunded', false,
    'balance_microcents', v_balance,
    'refunded_microcents', p_amount_microcents
  );
END;
$$;

CREATE OR REPLACE FUNCTION private.annotate_wallet_debit(
  p_user_id uuid,
  p_request_id text,
  p_openai_cost_microcents bigint,
  p_model text,
  p_input_tokens integer,
  p_output_tokens integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF p_user_id IS NULL OR p_request_id IS NULL OR length(trim(p_request_id)) = 0 THEN
    RAISE EXCEPTION 'invalid_annotate_args';
  END IF;

  UPDATE public.ledger
  SET openai_cost_microcents = COALESCE(p_openai_cost_microcents, 0),
      model = COALESCE(p_model, model),
      input_tokens = COALESCE(p_input_tokens, input_tokens),
      output_tokens = COALESCE(p_output_tokens, output_tokens)
  WHERE user_id = p_user_id
    AND kind = 'debit'
    AND request_id = p_request_id
  RETURNING id INTO v_id;

  IF v_id IS NULL THEN
    RAISE EXCEPTION 'debit_not_found';
  END IF;

  RETURN jsonb_build_object('ok', true, 'ledger_id', v_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.refund_wallet_for_proxy(
  p_user_id uuid,
  p_amount_microcents bigint,
  p_request_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'private'
AS $$
BEGIN
  RETURN private.refund_wallet(p_user_id, p_amount_microcents, p_request_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.annotate_wallet_debit_for_proxy(
  p_user_id uuid,
  p_request_id text,
  p_openai_cost_microcents bigint DEFAULT 0,
  p_model text DEFAULT NULL,
  p_input_tokens integer DEFAULT NULL,
  p_output_tokens integer DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'private'
AS $$
BEGIN
  RETURN private.annotate_wallet_debit(
    p_user_id,
    p_request_id,
    p_openai_cost_microcents,
    p_model,
    p_input_tokens,
    p_output_tokens
  );
END;
$$;

REVOKE ALL ON FUNCTION public.refund_wallet_for_proxy(uuid, bigint, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.annotate_wallet_debit_for_proxy(uuid, text, bigint, text, integer, integer) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.refund_wallet_for_proxy(uuid, bigint, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.annotate_wallet_debit_for_proxy(uuid, text, bigint, text, integer, integer) TO service_role;

GRANT EXECUTE ON FUNCTION private.refund_wallet(uuid, bigint, text) TO service_role;
GRANT EXECUTE ON FUNCTION private.annotate_wallet_debit(uuid, text, bigint, text, integer, integer) TO service_role;
