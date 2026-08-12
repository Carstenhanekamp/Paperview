-- Bound the free continuation chain.
--
-- Previously any response the user owned could be continued for free via
-- previous_response_id, and each free continuation was itself recorded as
-- owned. That made the chain self-perpetuating: one paid root turn funded an
-- unlimited number of requests against the server's OpenAI key.
--
-- A billed root turn now opens a fixed round budget; each free continuation
-- spends one unit and inherits the root's id. When the budget is gone the next
-- turn is billed as a fresh root.

ALTER TABLE public.wallet_proxy_response_tiers
  ADD COLUMN IF NOT EXISTS root_request_id text,
  ADD COLUMN IF NOT EXISTS rounds_remaining integer NOT NULL DEFAULT 0;

-- Pre-existing rows default to 0 remaining, so conversations in flight at
-- deploy time are billed as new roots rather than grandfathered into unlimited
-- free continuations.

CREATE OR REPLACE FUNCTION public.get_wallet_proxy_response_tier(
  p_user_id uuid,
  p_response_id text
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_row public.wallet_proxy_response_tiers%ROWTYPE;
BEGIN
  IF p_user_id IS NULL OR p_response_id IS NULL OR length(trim(p_response_id)) = 0 THEN
    RETURN NULL;
  END IF;

  SELECT * INTO v_row
  FROM public.wallet_proxy_response_tiers
  WHERE response_id = trim(p_response_id)
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('found', false);
  END IF;

  IF v_row.user_id <> p_user_id THEN
    RETURN jsonb_build_object('found', true, 'owned', false, 'action', v_row.action);
  END IF;

  RETURN jsonb_build_object(
    'found', true,
    'owned', true,
    'action', v_row.action,
    'root_request_id', v_row.root_request_id,
    'rounds_remaining', COALESCE(v_row.rounds_remaining, 0)
  );
END;
$$;

DROP FUNCTION IF EXISTS public.record_wallet_proxy_response_tier(uuid, text, text);

CREATE OR REPLACE FUNCTION public.record_wallet_proxy_response_tier(
  p_user_id uuid,
  p_response_id text,
  p_action text,
  p_root_request_id text DEFAULT NULL,
  p_rounds_remaining integer DEFAULT 0
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF p_user_id IS NULL OR p_response_id IS NULL OR length(trim(p_response_id)) = 0 THEN
    RAISE EXCEPTION 'invalid_response_tier_args';
  END IF;
  IF p_action IS NULL OR p_action NOT IN ('chat', 'explain', 'agent') THEN
    RAISE EXCEPTION 'invalid_action';
  END IF;

  INSERT INTO public.wallet_proxy_response_tiers (
    response_id, user_id, action, root_request_id, rounds_remaining
  )
  VALUES (
    trim(p_response_id),
    p_user_id,
    p_action,
    p_root_request_id,
    GREATEST(COALESCE(p_rounds_remaining, 0), 0)
  )
  ON CONFLICT (response_id) DO UPDATE
  SET
    -- Never downgrade agent → chat on conflict.
    action = CASE
      WHEN public.wallet_proxy_response_tiers.action = 'agent' OR excluded.action = 'agent' THEN 'agent'
      WHEN public.wallet_proxy_response_tiers.action = 'explain' OR excluded.action = 'explain' THEN 'explain'
      ELSE excluded.action
    END,
    -- Never extend an existing budget, and never hand ownership to a second
    -- user: this table is the boundary that keeps one user's conversation out
    -- of another's hands, so a conflict must not be able to move it.
    rounds_remaining = LEAST(
      COALESCE(public.wallet_proxy_response_tiers.rounds_remaining, 0),
      GREATEST(COALESCE(excluded.rounds_remaining, 0), 0)
    ),
    root_request_id = COALESCE(
      public.wallet_proxy_response_tiers.root_request_id,
      excluded.root_request_id
    )
  WHERE public.wallet_proxy_response_tiers.user_id = excluded.user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.record_wallet_proxy_response_tier(uuid, text, text, text, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_wallet_proxy_response_tier(uuid, text, text, text, integer)
  TO service_role;

-- Refund the amount actually debited for this request rather than whatever the
-- caller passes. Only service_role can reach this, so it was not exploitable —
-- but the ledger, not the caller, is the authority on what was taken.
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
  v_debit_amount bigint;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
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

  -- Only refund a debit we actually took for this request_id, and only for the
  -- amount that debit recorded.
  SELECT amount_microcents INTO v_debit_amount
  FROM public.ledger
  WHERE user_id = p_user_id
    AND kind = 'debit'
    AND request_id = p_request_id
  LIMIT 1;

  IF v_debit_amount IS NULL THEN
    RAISE EXCEPTION 'debit_not_found';
  END IF;
  IF v_debit_amount <= 0 THEN
    RETURN jsonb_build_object(
      'ok', true,
      'already_refunded', false,
      'balance_microcents', COALESCE(
        (SELECT balance_microcents FROM public.wallets WHERE user_id = p_user_id), 0
      ),
      'refunded_microcents', 0
    );
  END IF;

  INSERT INTO public.wallets (user_id, balance_microcents, updated_at)
  VALUES (p_user_id, 0, now())
  ON CONFLICT (user_id) DO NOTHING;

  PERFORM 1 FROM public.wallets WHERE user_id = p_user_id FOR UPDATE;

  UPDATE public.wallets
  SET balance_microcents = balance_microcents + v_debit_amount,
      updated_at = now()
  WHERE user_id = p_user_id
  RETURNING balance_microcents INTO v_balance;

  INSERT INTO public.ledger (
    user_id, kind, amount_microcents, request_id
  ) VALUES (
    p_user_id, 'refund', v_debit_amount, p_request_id
  );

  RETURN jsonb_build_object(
    'ok', true,
    'already_refunded', false,
    'balance_microcents', v_balance,
    'refunded_microcents', v_debit_amount
  );
END;
$$;

GRANT EXECUTE ON FUNCTION private.refund_wallet(uuid, bigint, text) TO service_role;
