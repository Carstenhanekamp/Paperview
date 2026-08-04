-- Founding waitlist + credits-ready wallet schema
-- Applied remotely via Supabase MCP (project wpvfaistmwtkgkqpkkrm).
-- Kept here for repo history / self-hosters.

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO postgres, service_role;

CREATE TABLE IF NOT EXISTS public.profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  email text NOT NULL DEFAULT '',
  founding boolean NOT NULL DEFAULT false,
  founder_number integer UNIQUE,
  launch_grant_status text NOT NULL DEFAULT 'n_a'
    CHECK (launch_grant_status IN ('pending', 'granted', 'n_a')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT founder_number_range CHECK (
    founder_number IS NULL OR (founder_number >= 1 AND founder_number <= 100)
  ),
  CONSTRAINT founding_number_consistency CHECK (
    (founding = false AND founder_number IS NULL)
    OR (founding = true AND founder_number IS NOT NULL)
  )
);

CREATE TABLE IF NOT EXISTS public.wallets (
  user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  balance_microcents bigint NOT NULL DEFAULT 0 CHECK (balance_microcents >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('purchase', 'debit', 'refund', 'grant', 'debit_failed')),
  amount_microcents bigint NOT NULL,
  model text,
  input_tokens integer,
  output_tokens integer,
  openai_cost_microcents bigint,
  request_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ledger_user_id_created_at_idx ON public.ledger (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  stripe_session_id text UNIQUE,
  pack text CHECK (pack IS NULL OR pack IN ('eur3', 'eur5', 'eur10')),
  amount_microcents bigint NOT NULL CHECK (amount_microcents > 0),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'completed', 'failed')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS purchases_user_id_created_at_idx ON public.purchases (user_id, created_at DESC);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;

-- Policies / RPCs: see live project (apply_migration founding_waitlist_credits_ready + revoke_anon_table_grants).
