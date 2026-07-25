
-- 1. Extend organizations for billing state
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS paddle_customer_id text,
  ADD COLUMN IF NOT EXISTS plan_status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS plan_renews_at timestamptz;

-- 2. subscriptions table (Paddle canonical shape + org linkage)
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  paddle_subscription_id text NOT NULL UNIQUE,
  paddle_customer_id text NOT NULL,
  product_id text NOT NULL,
  price_id text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean DEFAULT false,
  environment text NOT NULL DEFAULT 'sandbox',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON public.subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_org_id ON public.subscriptions(org_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_paddle_id ON public.subscriptions(paddle_subscription_id);

GRANT SELECT ON public.subscriptions TO authenticated;
GRANT ALL ON public.subscriptions TO service_role;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "subscriptions: self read" ON public.subscriptions;
CREATE POLICY "subscriptions: self read"
ON public.subscriptions FOR SELECT
TO authenticated
USING (user_id = auth.uid() OR org_id = public.current_org_id());

-- 3. paddle_events (idempotency)
CREATE TABLE IF NOT EXISTS public.paddle_events (
  event_id text PRIMARY KEY,
  event_type text NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.paddle_events TO service_role;
ALTER TABLE public.paddle_events ENABLE ROW LEVEL SECURITY;
-- no policies -> only service_role (which bypasses RLS) can access

-- 4. Quota helper
CREATE OR REPLACE FUNCTION public.assert_within_quota(_org uuid, _action text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan text;
  v_count int;
  v_limit int;
BEGIN
  SELECT plan INTO v_plan FROM public.organizations WHERE id = _org;
  IF v_plan IS NULL THEN
    RAISE EXCEPTION 'organization not found';
  END IF;

  IF _action = 'upload_contract' THEN
    SELECT count(*) INTO v_count FROM public.contracts
      WHERE org_id = _org AND is_sample = false;
    v_limit := CASE v_plan WHEN 'free' THEN 3 WHEN 'pro' THEN 50 ELSE 1000000 END;

  ELSIF _action = 'run_simulation' THEN
    SELECT count(*) INTO v_count FROM public.simulation_runs
      WHERE org_id = _org AND created_at >= date_trunc('month', now());
    v_limit := CASE v_plan WHEN 'free' THEN 5 WHEN 'pro' THEN 100 ELSE 1000000 END;

  ELSIF _action = 'invite_teammate' THEN
    SELECT count(*) INTO v_count FROM public.profiles
      WHERE org_id = _org;
    v_limit := CASE v_plan WHEN 'free' THEN 1 WHEN 'pro' THEN 3 ELSE 1000000 END;

  ELSE
    RAISE EXCEPTION 'unknown quota action: %', _action;
  END IF;

  IF v_count >= v_limit THEN
    RAISE EXCEPTION 'PLAN_LIMIT: % (used %/%, plan %)', _action, v_count, v_limit, v_plan
      USING HINT = 'PLAN_LIMIT';
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.assert_within_quota(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.assert_within_quota(uuid, text) TO authenticated, service_role;

-- 5. Usage read helper (safe for authenticated to call)
CREATE OR REPLACE FUNCTION public.get_org_usage(_org uuid)
RETURNS TABLE(contracts int, simulations int, members int)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    (SELECT count(*)::int FROM public.contracts WHERE org_id = _org AND is_sample = false),
    (SELECT count(*)::int FROM public.simulation_runs WHERE org_id = _org AND created_at >= date_trunc('month', now())),
    (SELECT count(*)::int FROM public.profiles WHERE org_id = _org);
$$;

REVOKE EXECUTE ON FUNCTION public.get_org_usage(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_org_usage(uuid) TO authenticated, service_role;
