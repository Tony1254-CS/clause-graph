
CREATE TABLE public.supply_chain_nodes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('self','supplier','subprocessor','vendor')),
  tier INT NOT NULL DEFAULT 0,
  jurisdiction TEXT,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.supply_chain_nodes TO authenticated;
GRANT ALL ON public.supply_chain_nodes TO service_role;
ALTER TABLE public.supply_chain_nodes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org members read nodes" ON public.supply_chain_nodes FOR SELECT TO authenticated USING (org_id = public.current_org_id());
CREATE POLICY "org members insert nodes" ON public.supply_chain_nodes FOR INSERT TO authenticated WITH CHECK (org_id = public.current_org_id());
CREATE POLICY "org members update nodes" ON public.supply_chain_nodes FOR UPDATE TO authenticated USING (org_id = public.current_org_id());
CREATE POLICY "org members delete nodes" ON public.supply_chain_nodes FOR DELETE TO authenticated USING (org_id = public.current_org_id());

CREATE TABLE public.supply_chain_edges (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  from_node_id UUID NOT NULL REFERENCES public.supply_chain_nodes(id) ON DELETE CASCADE,
  to_node_id UUID NOT NULL REFERENCES public.supply_chain_nodes(id) ON DELETE CASCADE,
  contract_name TEXT NOT NULL,
  contract_value NUMERIC(14,2) NOT NULL DEFAULT 0,
  key_clauses TEXT[] NOT NULL DEFAULT '{}',
  depends_on_regs TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.supply_chain_edges TO authenticated;
GRANT ALL ON public.supply_chain_edges TO service_role;
ALTER TABLE public.supply_chain_edges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org members read edges" ON public.supply_chain_edges FOR SELECT TO authenticated USING (org_id = public.current_org_id());
CREATE POLICY "org members insert edges" ON public.supply_chain_edges FOR INSERT TO authenticated WITH CHECK (org_id = public.current_org_id());
CREATE POLICY "org members update edges" ON public.supply_chain_edges FOR UPDATE TO authenticated USING (org_id = public.current_org_id());
CREATE POLICY "org members delete edges" ON public.supply_chain_edges FOR DELETE TO authenticated USING (org_id = public.current_org_id());

CREATE TABLE public.compliance_artifacts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  regulation_id TEXT,
  simulation_run_id UUID REFERENCES public.simulation_runs(id) ON DELETE SET NULL,
  gap TEXT NOT NULL,
  stack TEXT NOT NULL CHECK (stack IN ('aws','gcp','azure')),
  audit_script JSONB NOT NULL,
  remediation JSONB NOT NULL,
  runbook TEXT,
  test_cases TEXT[] NOT NULL DEFAULT '{}',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.compliance_artifacts TO authenticated;
GRANT ALL ON public.compliance_artifacts TO service_role;
ALTER TABLE public.compliance_artifacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org members read artifacts" ON public.compliance_artifacts FOR SELECT TO authenticated USING (org_id = public.current_org_id());
CREATE POLICY "org members insert artifacts" ON public.compliance_artifacts FOR INSERT TO authenticated WITH CHECK (org_id = public.current_org_id());
CREATE POLICY "org members delete artifacts" ON public.compliance_artifacts FOR DELETE TO authenticated USING (org_id = public.current_org_id());

CREATE OR REPLACE FUNCTION public.seed_supply_chain(_org UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  self_id UUID; cloud_id UUID; dc_id UUID; energy_id UUID; pay_id UUID; card_id UUID;
BEGIN
  IF EXISTS (SELECT 1 FROM public.supply_chain_nodes WHERE org_id = _org) THEN
    RETURN;
  END IF;

  INSERT INTO public.supply_chain_nodes (org_id, name, role, tier, jurisdiction, description) VALUES
    (_org, 'Your Company',            'self',         0, 'EU', 'Primary entity'),
    (_org, 'Northwind Cloud',         'supplier',     1, 'EU', 'Managed cloud infrastructure provider'),
    (_org, 'Meridian DataCenters',    'subprocessor', 2, 'DE', 'Colocation & hosting facility operator'),
    (_org, 'Rheinstrom Energy',       'vendor',       3, 'DE', 'Regional electricity supplier'),
    (_org, 'Paylane Processor',       'supplier',     1, 'US', 'Card payments processor'),
    (_org, 'GlobalCard Network',      'subprocessor', 2, 'US', 'International card scheme');

  SELECT id INTO self_id   FROM public.supply_chain_nodes WHERE org_id = _org AND name = 'Your Company';
  SELECT id INTO cloud_id  FROM public.supply_chain_nodes WHERE org_id = _org AND name = 'Northwind Cloud';
  SELECT id INTO dc_id     FROM public.supply_chain_nodes WHERE org_id = _org AND name = 'Meridian DataCenters';
  SELECT id INTO energy_id FROM public.supply_chain_nodes WHERE org_id = _org AND name = 'Rheinstrom Energy';
  SELECT id INTO pay_id    FROM public.supply_chain_nodes WHERE org_id = _org AND name = 'Paylane Processor';
  SELECT id INTO card_id   FROM public.supply_chain_nodes WHERE org_id = _org AND name = 'GlobalCard Network';

  INSERT INTO public.supply_chain_edges (org_id, from_node_id, to_node_id, contract_name, contract_value, key_clauses, depends_on_regs) VALUES
    (_org, self_id,  cloud_id,  'Master Cloud Services Agreement', 2000000,
      ARRAY['Adherence to all applicable laws','Force majeure on upstream regulatory failure','99.95% availability SLA'],
      ARRAY['GDPR-ART44']),
    (_org, cloud_id, dc_id,     'Colocation & Hosting SLA',        750000,
      ARRAY['Facility must maintain PUE <= 1.5','Compliance with local energy regulations','Right-to-audit'],
      ARRAY['EU-CSRD','EU-DATA-CENTER-ENERGY']),
    (_org, dc_id,    energy_id, 'Industrial Power Supply Contract', 1200000,
      ARRAY['Renewable mix reporting','Uninterrupted supply guarantee'],
      ARRAY['EU-DATA-CENTER-ENERGY']),
    (_org, self_id,  pay_id,    'Merchant Processing Agreement',    900000,
      ARRAY['PCI-DSS compliance','Chargeback handling','Data residency'],
      ARRAY['PCI-DSS','GDPR-ART44']),
    (_org, pay_id,   card_id,   'Card Network Membership',          400000,
      ARRAY['Network rules adherence','Cross-border transfer safeguards'],
      ARRAY['PCI-DSS']);
END;
$$;

DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT id FROM public.organizations LOOP
    PERFORM public.seed_supply_chain(r.id);
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  new_org_id uuid;
  invited_org_id uuid;
  local_part text;
  ws_name text;
  s_contract record;
  new_contract_id uuid;
BEGIN
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

  INSERT INTO public.organizations (name, plan, trial_ends_at)
  VALUES (ws_name, 'pro', now() + interval '30 days')
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
