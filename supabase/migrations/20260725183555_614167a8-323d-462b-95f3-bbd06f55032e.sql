-- ============================================================
-- Billing parked: everyone gets Pro, unlimited, no trial clock.
-- Flip public.billing_enabled() to TRUE to re-activate paid plans.
-- ============================================================

CREATE OR REPLACE FUNCTION public.billing_enabled()
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$ SELECT false $$;

GRANT EXECUTE ON FUNCTION public.billing_enabled() TO authenticated, service_role;

-- ---------- Plan resolver ----------
CREATE OR REPLACE FUNCTION public.resolve_org_plan(_org uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

  -- Billing paused: every workspace is Pro, nothing expires.
  IF NOT public.billing_enabled() THEN
    IF v_plan <> 'pro' OR v_trial_ends IS NOT NULL THEN
      UPDATE public.organizations
        SET plan = 'pro', plan_status = 'active', trial_ends_at = NULL
        WHERE id = _org;
    END IF;
    RETURN 'pro';
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

-- ---------- Quota gate ----------
CREATE OR REPLACE FUNCTION public.assert_within_quota(_org uuid, _action text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_plan text;
  v_count int;
  v_limit int;
BEGIN
  -- Billing paused: unlimited everything, no PLAN_LIMIT can fire.
  IF NOT public.billing_enabled() THEN
    RETURN;
  END IF;

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

-- ---------- New signups ----------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  new_org_id uuid;
  invited_org_id uuid;
  local_part text;
  ws_name text;
  s_contract record;
  new_contract_id uuid;
  v_trial timestamptz;
BEGIN
  -- Billing paused: provision Pro outright, with no trial expiry.
  v_trial := CASE WHEN public.billing_enabled() THEN now() + interval '30 days' ELSE NULL END;

  invited_org_id := NULLIF((NEW.raw_user_meta_data->>'invited_org_id')::text, '')::uuid;

  IF invited_org_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.organizations WHERE id = invited_org_id
  ) THEN
    INSERT INTO public.profiles (id, org_id, full_name, email)
    VALUES (NEW.id, invited_org_id, NEW.raw_user_meta_data->>'full_name', NEW.email);
    INSERT INTO public.user_roles (user_id, org_id, role)
    VALUES (NEW.id, invited_org_id, 'member');
    RETURN NEW;
  END IF;

  local_part := split_part(COALESCE(NEW.email, 'user'), '@', 1);
  ws_name := local_part || '''s workspace';

  INSERT INTO public.organizations (name, plan, plan_status, trial_ends_at)
  VALUES (ws_name, 'pro', 'active', v_trial)
  RETURNING id INTO new_org_id;

  INSERT INTO public.profiles (id, org_id, full_name, email)
  VALUES (NEW.id, new_org_id, NEW.raw_user_meta_data->>'full_name', NEW.email);

  INSERT INTO public.user_roles (user_id, org_id, role)
  VALUES (NEW.id, new_org_id, 'admin');

  FOR s_contract IN SELECT * FROM public.sample_contracts ORDER BY position LOOP
    INSERT INTO public.contracts (org_id, name, counterparty, value, extraction_status, is_sample, uploaded_by)
    VALUES (new_org_id, s_contract.name, s_contract.counterparty, s_contract.value, 'complete', true, NEW.id)
    RETURNING id INTO new_contract_id;

    INSERT INTO public.clauses (contract_id, text, linked_regs, position, confidence)
    SELECT new_contract_id, sc.text, sc.linked_regs, sc.position, 1.0
    FROM public.sample_clauses sc
    WHERE sc.sample_contract_id = s_contract.id
    ORDER BY sc.position;
  END LOOP;

  PERFORM public.seed_supply_chain(new_org_id);

  RETURN NEW;
END;
$function$;