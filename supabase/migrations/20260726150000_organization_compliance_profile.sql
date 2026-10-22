-- ============================================================================
-- Migration: Organization Compliance Profiles & Isolated Onboarding
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.organization_compliance_profiles (
  org_id                     uuid PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  entity_name                text NOT NULL,
  headquarters_country       text NOT NULL DEFAULT 'BD',
  is_publicly_traded         boolean NOT NULL DEFAULT false,
  industry_vertical          text NOT NULL DEFAULT 'saas',
  processes_eu_data          boolean NOT NULL DEFAULT false,
  processes_us_health_data   boolean NOT NULL DEFAULT false,
  processes_us_consumer_data boolean NOT NULL DEFAULT false,
  processes_digital_payments boolean NOT NULL DEFAULT false,
  develops_or_uses_ai        boolean NOT NULL DEFAULT false,
  cloud_providers            text[] NOT NULL DEFAULT '{"aws"}',
  active_framework_ids       text[] NOT NULL DEFAULT '{}',
  is_onboarded               boolean NOT NULL DEFAULT false,
  created_at                 timestamptz NOT NULL DEFAULT now(),
  updated_at                 timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_org_compliance_profile ON public.organization_compliance_profiles(org_id);

-- Ensure all existing organizations have a profile row
INSERT INTO public.organization_compliance_profiles (org_id, entity_name, is_onboarded, active_framework_ids)
SELECT 
  o.id,
  o.name,
  CASE WHEN o.name LIKE '%judge%' OR o.name LIKE '%Demo%' THEN true ELSE false END,
  ARRAY['REG-GDPR-5', 'REG-GDPR-33', 'REG-GDPR-44', 'REG-BD-CSO-2025', 'REG-BB-DPS-2023']
FROM public.organizations o
ON CONFLICT (org_id) DO NOTHING;

-- Update handle_new_user() trigger: ONLY seed sample contracts for judge@clausegraph.ai
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  new_org_id uuid; local_part text; ws_name text;
  s_contract record; new_contract_id uuid;
  invited_org text;
  is_demo_user boolean;
BEGIN
  invited_org := NEW.raw_user_meta_data->>'invited_org_id';
  IF invited_org IS NOT NULL THEN
    new_org_id := invited_org::uuid;
    INSERT INTO public.profiles (id, org_id, full_name, email)
      VALUES (NEW.id, new_org_id, NEW.raw_user_meta_data->>'full_name', NEW.email)
      ON CONFLICT (id) DO NOTHING;
    INSERT INTO public.user_roles (user_id, org_id, role)
      VALUES (NEW.id, new_org_id, COALESCE((NEW.raw_user_meta_data->>'invited_role')::public.app_role, 'member'::public.app_role))
      ON CONFLICT (user_id, org_id, role) DO NOTHING;
    RETURN NEW;
  END IF;

  local_part := split_part(COALESCE(NEW.email, 'user'), '@', 1);
  ws_name := local_part || '''s workspace';
  is_demo_user := (LOWER(NEW.email) = 'judge@clausegraph.ai');

  INSERT INTO public.organizations (name, plan, plan_status)
    VALUES (ws_name, 'pro', 'active') RETURNING id INTO new_org_id;

  INSERT INTO public.profiles (id, org_id, full_name, email)
    VALUES (NEW.id, new_org_id, NEW.raw_user_meta_data->>'full_name', NEW.email);

  INSERT INTO public.user_roles (user_id, org_id, role)
    VALUES (NEW.id, new_org_id, 'admin');

  -- Create initial compliance profile
  INSERT INTO public.organization_compliance_profiles 
    (org_id, entity_name, is_onboarded, active_framework_ids)
  VALUES (
    new_org_id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ws_name),
    is_demo_user, -- Only demo user is pre-onboarded
    CASE 
      WHEN is_demo_user THEN ARRAY['REG-GDPR-5', 'REG-GDPR-33', 'REG-GDPR-44', 'REG-BD-CSO-2025', 'REG-BB-DPS-2023', 'REG-CCPA-1798.120', 'REG-HIPAA-SEC', 'REG-SEC-17A4']
      ELSE '{}'::text[]
    END
  )
  ON CONFLICT (org_id) DO NOTHING;

  -- ONLY seed sample contracts & supply chain for the official demo judge account!
  IF is_demo_user THEN
    FOR s_contract IN SELECT * FROM public.sample_contracts ORDER BY position LOOP
      INSERT INTO public.contracts (org_id, name, counterparty, value,
                                    extraction_status, is_sample, uploaded_by)
      VALUES (new_org_id, s_contract.name, s_contract.counterparty, s_contract.value,
              'complete', true, NEW.id)
      RETURNING id INTO new_contract_id;

      INSERT INTO public.clauses (contract_id, text, linked_regs, position, confidence)
      SELECT new_contract_id, sc.text, sc.linked_regs, sc.position, 1.0
      FROM public.sample_clauses sc
      WHERE sc.sample_contract_id = s_contract.id ORDER BY sc.position;
    END LOOP;

    PERFORM public.seed_supply_chain(new_org_id);
  END IF;

  RETURN NEW;
END; 
$$;
