-- Ownership-aware lookup for previous_response_id billing / abuse checks.

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

  RETURN jsonb_build_object('found', true, 'owned', true, 'action', v_row.action);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_wallet_proxy_response_action(
  p_user_id uuid,
  p_response_id text
)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT action
  FROM public.wallet_proxy_response_tiers
  WHERE user_id = p_user_id
    AND response_id = trim(p_response_id)
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_wallet_proxy_response_tier(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_wallet_proxy_response_tier(uuid, text) TO service_role;
