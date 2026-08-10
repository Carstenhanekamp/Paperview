-- Track billed action per OpenAI response id so agent chains cannot be
-- continued at chat price via previous_response_id + search_document.

CREATE TABLE IF NOT EXISTS public.wallet_proxy_response_tiers (
  response_id text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  action text NOT NULL CHECK (action IN ('chat', 'explain', 'agent')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS wallet_proxy_response_tiers_user_id_idx
  ON public.wallet_proxy_response_tiers (user_id);

ALTER TABLE public.wallet_proxy_response_tiers ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.wallet_proxy_response_tiers FROM PUBLIC, anon, authenticated;
-- service_role bypasses RLS; no client policies.

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
    AND response_id = p_response_id
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.record_wallet_proxy_response_tier(
  p_user_id uuid,
  p_response_id text,
  p_action text
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

  INSERT INTO public.wallet_proxy_response_tiers (response_id, user_id, action)
  VALUES (trim(p_response_id), p_user_id, p_action)
  ON CONFLICT (response_id) DO UPDATE
  SET
    -- Never downgrade agent → chat on conflict.
    action = CASE
      WHEN public.wallet_proxy_response_tiers.action = 'agent' OR excluded.action = 'agent' THEN 'agent'
      WHEN public.wallet_proxy_response_tiers.action = 'explain' OR excluded.action = 'explain' THEN 'explain'
      ELSE excluded.action
    END,
    user_id = excluded.user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.get_wallet_proxy_response_action(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.record_wallet_proxy_response_tier(uuid, text, text) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.get_wallet_proxy_response_action(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_wallet_proxy_response_tier(uuid, text, text) TO service_role;
