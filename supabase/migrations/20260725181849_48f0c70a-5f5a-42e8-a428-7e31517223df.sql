CREATE OR REPLACE FUNCTION public.resolve_org_plan(_org uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_plan text;
  v_trial_ends timestamptz;
  v_has_paid boolean;
BEGIN
  SELECT plan, trial_ends_at INTO v_plan, v_trial_ends
    FROM public.organizations WHERE id = _org;
  IF v_plan IS NULL THEN
    RETURN NULL;
  END IF;

  IF v_trial_ends IS NOT NULL AND v_trial_ends < now() THEN
    SELECT EXISTS (
      SELECT 1 FROM public.subscriptions s
      WHERE (s.org_id = _org OR s.user_id IN (SELECT id FROM public.profiles WHERE org_id = _org))
        AND s.status IN ('active', 'trialing', 'past_due')
        AND (s.current_period_end IS NULL OR s.current_period_end > now())
    ) INTO v_has_paid;

    IF NOT v_has_paid THEN
      UPDATE public.organizations
        SET plan = 'free', plan_status = 'active', trial_ends_at = NULL
        WHERE id = _org;
      v_plan := 'free';
    ELSE
      UPDATE public.organizations SET trial_ends_at = NULL WHERE id = _org;
    END IF;
  END IF;

  RETURN v_plan;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.resolve_org_plan(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.assert_within_quota(_org uuid, _action text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_plan text;
  v_count int;
  v_limit int;
BEGIN
  v_plan := public.resolve_org_plan(_org);
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

  ELSIF _action IN ('generate_action_plan', 'generate_compliance_code') THEN
    -- Premium reports: paid or trial workspaces only, and they draw on the
    -- monthly simulation allowance so LLM spend stays bounded.
    SELECT count(*) INTO v_count FROM public.simulation_runs
      WHERE org_id = _org AND created_at >= date_trunc('month', now());
    v_limit := CASE v_plan WHEN 'free' THEN 0 WHEN 'pro' THEN 100 ELSE 1000000 END;

  ELSE
    RAISE EXCEPTION 'unknown quota action: %', _action;
  END IF;

  IF v_count >= v_limit THEN
    RAISE EXCEPTION 'PLAN_LIMIT: % (used %/%, plan %)', _action, v_count, v_limit, v_plan
      USING HINT = 'PLAN_LIMIT';
  END IF;
END;
$function$;