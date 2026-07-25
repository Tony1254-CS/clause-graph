
-- 1. Enums
CREATE TYPE public.app_role AS ENUM ('admin', 'member');

-- 2. Organizations
CREATE TABLE public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  plan text NOT NULL DEFAULT 'free',
  stripe_customer_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organizations TO authenticated;
GRANT ALL ON public.organizations TO service_role;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- 3. Profiles
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  full_name text,
  email text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX profiles_org_id_idx ON public.profiles(org_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 4. User Roles
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, org_id, role)
);
CREATE INDEX user_roles_user_org_idx ON public.user_roles(user_id, org_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 5. Security-definer helpers
CREATE OR REPLACE FUNCTION public.current_org_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT org_id FROM public.profiles WHERE id = auth.uid() LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _org_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND org_id = _org_id AND role = _role
  )
$$;

-- 6. Regulations
CREATE TABLE public.regulations (
  id text PRIMARY KEY,
  org_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  jurisdiction text NOT NULL,
  title text NOT NULL,
  summary text NOT NULL,
  obligations jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX regulations_org_id_idx ON public.regulations(org_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.regulations TO authenticated;
GRANT SELECT ON public.regulations TO anon;
GRANT ALL ON public.regulations TO service_role;
ALTER TABLE public.regulations ENABLE ROW LEVEL SECURITY;

-- 7. Contracts
CREATE TABLE public.contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  counterparty text NOT NULL,
  value numeric NOT NULL DEFAULT 0,
  source_file_url text,
  extraction_status text NOT NULL DEFAULT 'complete',
  uploaded_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  is_sample boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX contracts_org_id_idx ON public.contracts(org_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contracts TO authenticated;
GRANT ALL ON public.contracts TO service_role;
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;

-- 8. Clauses
CREATE TABLE public.clauses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  text text NOT NULL,
  linked_regs text[] NOT NULL DEFAULT '{}',
  confidence numeric,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX clauses_contract_id_idx ON public.clauses(contract_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clauses TO authenticated;
GRANT ALL ON public.clauses TO service_role;
ALTER TABLE public.clauses ENABLE ROW LEVEL SECURITY;

-- 9. Simulation runs
CREATE TABLE public.simulation_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  input_regulation_text text NOT NULL,
  result_json jsonb NOT NULL,
  triggered_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX simulation_runs_org_created_idx ON public.simulation_runs(org_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.simulation_runs TO authenticated;
GRANT ALL ON public.simulation_runs TO service_role;
ALTER TABLE public.simulation_runs ENABLE ROW LEVEL SECURITY;

-- 10. Backtest cases (shared reference data)
CREATE TABLE public.backtest_cases (
  id text PRIMARY KEY,
  company text NOT NULL,
  fine_usd numeric NOT NULL,
  case_date date NOT NULL,
  regulation text NOT NULL,
  summary text NOT NULL,
  source text NOT NULL,
  reconstructed_prompt text NOT NULL,
  reconstructed_clauses jsonb NOT NULL,
  fallback jsonb NOT NULL,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.backtest_cases TO authenticated, anon;
GRANT ALL ON public.backtest_cases TO service_role;
ALTER TABLE public.backtest_cases ENABLE ROW LEVEL SECURITY;

-- 11. Sample seed tables
CREATE TABLE public.sample_contracts (
  id text PRIMARY KEY,
  name text NOT NULL,
  counterparty text NOT NULL,
  value numeric NOT NULL,
  position integer NOT NULL DEFAULT 0
);
CREATE TABLE public.sample_clauses (
  id text PRIMARY KEY,
  sample_contract_id text NOT NULL REFERENCES public.sample_contracts(id) ON DELETE CASCADE,
  text text NOT NULL,
  linked_regs text[] NOT NULL DEFAULT '{}',
  position integer NOT NULL DEFAULT 0
);
GRANT SELECT ON public.sample_contracts TO authenticated;
GRANT SELECT ON public.sample_clauses TO authenticated;
GRANT ALL ON public.sample_contracts TO service_role;
GRANT ALL ON public.sample_clauses TO service_role;
ALTER TABLE public.sample_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sample_clauses ENABLE ROW LEVEL SECURITY;

-- 12. RLS policies

-- backtest_cases: public read
CREATE POLICY "Anyone can read backtest cases"
  ON public.backtest_cases FOR SELECT
  USING (true);

-- sample_contracts / sample_clauses: authenticated read
CREATE POLICY "Authenticated can read sample contracts"
  ON public.sample_contracts FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "Authenticated can read sample clauses"
  ON public.sample_clauses FOR SELECT TO authenticated
  USING (true);

-- Organizations
CREATE POLICY "Members read own org"
  ON public.organizations FOR SELECT TO authenticated
  USING (id = public.current_org_id());
CREATE POLICY "Admins update own org"
  ON public.organizations FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), id, 'admin'))
  WITH CHECK (public.has_role(auth.uid(), id, 'admin'));

-- Profiles
CREATE POLICY "Read profiles in own org"
  ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR org_id = public.current_org_id());
CREATE POLICY "Update own profile"
  ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- User roles
CREATE POLICY "Read roles in own org"
  ON public.user_roles FOR SELECT TO authenticated
  USING (org_id = public.current_org_id());
CREATE POLICY "Admins insert roles in org"
  ON public.user_roles FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), org_id, 'admin'));
CREATE POLICY "Admins delete roles in org"
  ON public.user_roles FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), org_id, 'admin'));

-- Regulations
CREATE POLICY "Read curated or own org regs"
  ON public.regulations FOR SELECT
  USING (org_id IS NULL OR org_id = public.current_org_id());
CREATE POLICY "Members insert own org regs"
  ON public.regulations FOR INSERT TO authenticated
  WITH CHECK (org_id = public.current_org_id());
CREATE POLICY "Members update own org regs"
  ON public.regulations FOR UPDATE TO authenticated
  USING (org_id = public.current_org_id())
  WITH CHECK (org_id = public.current_org_id());
CREATE POLICY "Members delete own org regs"
  ON public.regulations FOR DELETE TO authenticated
  USING (org_id = public.current_org_id());

-- Contracts
CREATE POLICY "Members read own org contracts"
  ON public.contracts FOR SELECT TO authenticated
  USING (org_id = public.current_org_id());
CREATE POLICY "Members insert own org contracts"
  ON public.contracts FOR INSERT TO authenticated
  WITH CHECK (org_id = public.current_org_id());
CREATE POLICY "Members update own org contracts"
  ON public.contracts FOR UPDATE TO authenticated
  USING (org_id = public.current_org_id())
  WITH CHECK (org_id = public.current_org_id());
CREATE POLICY "Members delete own org contracts"
  ON public.contracts FOR DELETE TO authenticated
  USING (org_id = public.current_org_id());

-- Clauses (via parent contract)
CREATE POLICY "Members read own org clauses"
  ON public.clauses FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.contracts c
    WHERE c.id = clauses.contract_id AND c.org_id = public.current_org_id()
  ));
CREATE POLICY "Members insert own org clauses"
  ON public.clauses FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.contracts c
    WHERE c.id = clauses.contract_id AND c.org_id = public.current_org_id()
  ));
CREATE POLICY "Members update own org clauses"
  ON public.clauses FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.contracts c
    WHERE c.id = clauses.contract_id AND c.org_id = public.current_org_id()
  ));
CREATE POLICY "Members delete own org clauses"
  ON public.clauses FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.contracts c
    WHERE c.id = clauses.contract_id AND c.org_id = public.current_org_id()
  ));

-- Simulation runs
CREATE POLICY "Members read own org sims"
  ON public.simulation_runs FOR SELECT TO authenticated
  USING (org_id = public.current_org_id());
CREATE POLICY "Members insert own org sims"
  ON public.simulation_runs FOR INSERT TO authenticated
  WITH CHECK (org_id = public.current_org_id());

-- 13. Signup trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
    VALUES (
      NEW.id,
      invited_org_id,
      NEW.raw_user_meta_data->>'full_name',
      NEW.email
    );
    INSERT INTO public.user_roles (user_id, org_id, role)
    VALUES (NEW.id, invited_org_id, 'member');
    RETURN NEW;
  END IF;

  local_part := split_part(COALESCE(NEW.email, 'user'), '@', 1);
  ws_name := local_part || '''s workspace';

  INSERT INTO public.organizations (name)
  VALUES (ws_name)
  RETURNING id INTO new_org_id;

  INSERT INTO public.profiles (id, org_id, full_name, email)
  VALUES (
    NEW.id,
    new_org_id,
    NEW.raw_user_meta_data->>'full_name',
    NEW.email
  );

  INSERT INTO public.user_roles (user_id, org_id, role)
  VALUES (NEW.id, new_org_id, 'admin');

  FOR s_contract IN
    SELECT * FROM public.sample_contracts ORDER BY position
  LOOP
    INSERT INTO public.contracts (org_id, name, counterparty, value, extraction_status, is_sample, uploaded_by)
    VALUES (new_org_id, s_contract.name, s_contract.counterparty, s_contract.value, 'complete', true, NEW.id)
    RETURNING id INTO new_contract_id;

    INSERT INTO public.clauses (contract_id, text, linked_regs, position, confidence)
    SELECT new_contract_id, sc.text, sc.linked_regs, sc.position, 1.0
    FROM public.sample_clauses sc
    WHERE sc.sample_contract_id = s_contract.id
    ORDER BY sc.position;
  END LOOP;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
