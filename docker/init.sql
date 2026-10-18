-- ============================================================================
-- ClauseGraph PostgreSQL Initialization Script
-- Self-contained production schema, RLS policies, functions, and seed data.
-- Works seamlessly in PostgreSQL 16+ (Docker or Cloud Managed).
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── 0. Supabase Role Stubs (for vanilla PostgreSQL environments) ───────────
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role NOLOGIN;
  END IF;
END $$;

-- ── 1. Auth Schema Compatibility (for standard PostgreSQL environments) ─────
CREATE SCHEMA IF NOT EXISTS auth;

CREATE TABLE IF NOT EXISTS auth.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE,
  encrypted_password text,
  email_confirmed_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  raw_app_meta_data jsonb DEFAULT '{}'::jsonb,
  raw_user_meta_data jsonb DEFAULT '{}'::jsonb
);

CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT COALESCE(
    nullif(current_setting('request.jwt.claim.sub', true), '')::uuid,
    (SELECT id FROM auth.users ORDER BY created_at ASC LIMIT 1)
  );
$$;

-- ── 2. Enums ────────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'member');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- ── 3. Organizations (Workspaces) ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.organizations (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name                   text NOT NULL,
  plan                   text NOT NULL DEFAULT 'pro',
  plan_status            text NOT NULL DEFAULT 'active',
  plan_renews_at         timestamptz,
  trial_ends_at          timestamptz,
  paddle_customer_id     text,
  stripe_customer_id     text,
  deletion_scheduled_at  timestamptz,
  deletion_requested_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  deleted_at             timestamptz,
  created_at             timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_org_deletion_scheduled_at ON public.organizations (deletion_scheduled_at)
  WHERE deletion_scheduled_at IS NOT NULL;

-- ── 4. Profiles ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.profiles (
  id         uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id     uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  full_name  text,
  email      text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS profiles_org_id_idx ON public.profiles (org_id);

-- ── 5. User Roles (RBAC) ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_roles (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id     uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  role       public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, org_id, role)
);
CREATE INDEX IF NOT EXISTS user_roles_user_org_idx ON public.user_roles (user_id, org_id);

-- ── 6. Contracts Portfolio ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.contracts (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name              text NOT NULL,
  counterparty      text NOT NULL,
  value             numeric NOT NULL DEFAULT 0,
  source_file_url   text,
  extraction_status text NOT NULL DEFAULT 'complete',
  extraction_error  text,
  uploaded_by       uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  is_sample         boolean NOT NULL DEFAULT false,
  created_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS contracts_org_id_idx ON public.contracts (org_id);
CREATE INDEX IF NOT EXISTS contracts_org_created_idx ON public.contracts (org_id, created_at DESC);

-- ── 7. Clauses ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.clauses (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  text        text NOT NULL,
  linked_regs text[] NOT NULL DEFAULT '{}',
  confidence  numeric,
  position    integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS clauses_contract_id_idx ON public.clauses (contract_id);

-- ── 8. Regulations (Curated Ontology) ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.regulations (
  id                 text PRIMARY KEY,
  org_id             uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  jurisdiction       text NOT NULL,
  title              text NOT NULL,
  summary            text NOT NULL,
  obligations        jsonb NOT NULL DEFAULT '[]',
  news_signal_boost  numeric NOT NULL DEFAULT 0 CHECK (news_signal_boost BETWEEN 0 AND 1),
  created_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS regulations_org_id_idx ON public.regulations (org_id);

-- ── 9. Regulation Amendments (History for Forecasts) ────────────────────────
CREATE TABLE IF NOT EXISTS public.regulation_amendments (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  regulation_id text NOT NULL REFERENCES public.regulations(id) ON DELETE CASCADE,
  amended_on    date NOT NULL,
  summary       text NOT NULL,
  direction     text NOT NULL CHECK (direction IN ('tightened','loosened','clarified','expanded')),
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS regulation_amendments_reg_idx ON public.regulation_amendments (regulation_id, amended_on DESC);

-- ── 10. Simulation Runs ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.simulation_runs (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  input_regulation_text text NOT NULL,
  result_json           jsonb NOT NULL,
  run_type              text NOT NULL DEFAULT 'reactive'
                          CHECK (run_type IN ('reactive','forecast','what_if','supply_chain')),
  triggered_by          uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at            timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS simulation_runs_org_created_idx ON public.simulation_runs (org_id, created_at DESC);

-- ── 11. Compliance-as-Code Artifacts ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.compliance_artifacts (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  regulation_id     text,
  simulation_run_id uuid REFERENCES public.simulation_runs(id) ON DELETE SET NULL,
  gap               text NOT NULL,
  stack             text NOT NULL CHECK (stack IN ('aws','gcp','azure')),
  audit_script      jsonb NOT NULL,
  remediation       jsonb NOT NULL,
  runbook           text,
  test_cases        text[] NOT NULL DEFAULT '{}',
  created_by        uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at        timestamptz NOT NULL DEFAULT now()
);

-- ── 12. Cross-Enterprise Supply Chain ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.supply_chain_nodes (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name         text NOT NULL,
  role         text NOT NULL CHECK (role IN ('self','supplier','subprocessor','vendor')),
  tier         integer NOT NULL DEFAULT 0,
  jurisdiction text,
  description  text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.supply_chain_edges (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  from_node_id    uuid NOT NULL REFERENCES public.supply_chain_nodes(id) ON DELETE CASCADE,
  to_node_id      uuid NOT NULL REFERENCES public.supply_chain_nodes(id) ON DELETE CASCADE,
  contract_name   text NOT NULL,
  contract_value  numeric NOT NULL DEFAULT 0,
  key_clauses     text[] NOT NULL DEFAULT '{}',
  depends_on_regs text[] NOT NULL DEFAULT '{}',
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- ── 13. Backtest Cases ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.backtest_cases (
  id                    text PRIMARY KEY,
  company               text NOT NULL,
  fine_usd              numeric NOT NULL,
  case_date             date NOT NULL,
  regulation            text NOT NULL,
  summary               text NOT NULL,
  source                text NOT NULL,
  reconstructed_prompt  text NOT NULL,
  reconstructed_clauses jsonb NOT NULL,
  fallback              jsonb NOT NULL,
  position              integer NOT NULL DEFAULT 0,
  created_at            timestamptz NOT NULL DEFAULT now()
);

-- ── 14. Sample Templates ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.sample_contracts (
  id           text PRIMARY KEY,
  name         text NOT NULL,
  counterparty text NOT NULL,
  value        numeric NOT NULL,
  position     integer NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.sample_clauses (
  id                 text PRIMARY KEY,
  sample_contract_id text NOT NULL REFERENCES public.sample_contracts(id) ON DELETE CASCADE,
  text               text NOT NULL,
  linked_regs        text[] NOT NULL DEFAULT '{}',
  position           integer NOT NULL DEFAULT 0
);

-- ── 15. Subscriptions & Payments ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id                 uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  paddle_subscription_id text NOT NULL UNIQUE,
  paddle_customer_id     text NOT NULL,
  product_id             text NOT NULL,
  price_id               text NOT NULL,
  status                 text NOT NULL DEFAULT 'active',
  current_period_start   timestamptz,
  current_period_end     timestamptz,
  cancel_at_period_end   boolean DEFAULT false,
  environment            text NOT NULL DEFAULT 'sandbox',
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.paddle_events (
  event_id    text PRIMARY KEY,
  event_type  text NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now()
);

-- ── 16. Security & Tenant Functions ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.current_org_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT org_id FROM public.profiles WHERE id = auth.uid() LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _org_id uuid, _role app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles
                 WHERE user_id = _user_id AND org_id = _org_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.billing_enabled()
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = public AS $$ SELECT false $$;

CREATE OR REPLACE FUNCTION public.resolve_org_plan(_org uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_plan text;
BEGIN
  SELECT plan INTO v_plan FROM public.organizations WHERE id = _org;
  IF v_plan IS NULL THEN RETURN NULL; END IF;
  RETURN 'pro';
END; $$;

CREATE OR REPLACE FUNCTION public.get_org_usage(_org uuid)
RETURNS TABLE(contracts integer, simulations integer, members integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    (SELECT count(*)::int FROM public.contracts WHERE org_id = _org AND is_sample = false),
    (SELECT count(*)::int FROM public.simulation_runs
       WHERE org_id = _org AND created_at >= date_trunc('month', now())),
    (SELECT count(*)::int FROM public.profiles WHERE org_id = _org);
$$;

CREATE OR REPLACE FUNCTION public.assert_within_quota(_org uuid, _action text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Unlimited during early access / hackathon evaluation
  RETURN;
END; $$;

CREATE OR REPLACE FUNCTION public.seed_supply_chain(_org uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  self_id uuid; cloud_id uuid; dc_id uuid; energy_id uuid; pay_id uuid; card_id uuid;
BEGIN
  IF EXISTS (SELECT 1 FROM public.supply_chain_nodes WHERE org_id = _org) THEN RETURN; END IF;

  INSERT INTO public.supply_chain_nodes (org_id, name, role, tier, jurisdiction, description) VALUES
    (_org, 'Your Company',         'self',         0, 'EU', 'Primary entity'),
    (_org, 'Northwind Cloud',      'supplier',     1, 'EU', 'Managed cloud infrastructure provider'),
    (_org, 'Meridian DataCenters', 'subprocessor', 2, 'DE', 'Colocation & hosting facility operator'),
    (_org, 'Rheinstrom Energy',    'vendor',       3, 'DE', 'Regional electricity supplier'),
    (_org, 'Paylane Processor',    'supplier',     1, 'US', 'Card payments processor'),
    (_org, 'GlobalCard Network',   'subprocessor', 2, 'US', 'International card scheme');

  SELECT id INTO self_id   FROM public.supply_chain_nodes WHERE org_id = _org AND name = 'Your Company';
  SELECT id INTO cloud_id  FROM public.supply_chain_nodes WHERE org_id = _org AND name = 'Northwind Cloud';
  SELECT id INTO dc_id     FROM public.supply_chain_nodes WHERE org_id = _org AND name = 'Meridian DataCenters';
  SELECT id INTO energy_id FROM public.supply_chain_nodes WHERE org_id = _org AND name = 'Rheinstrom Energy';
  SELECT id INTO pay_id    FROM public.supply_chain_nodes WHERE org_id = _org AND name = 'Paylane Processor';
  SELECT id INTO card_id   FROM public.supply_chain_nodes WHERE org_id = _org AND name = 'GlobalCard Network';

  INSERT INTO public.supply_chain_edges
    (org_id, from_node_id, to_node_id, contract_name, contract_value, key_clauses, depends_on_regs) VALUES
    (_org, self_id,  cloud_id,  'Master Cloud Services Agreement', 2000000,
      ARRAY['Adherence to all applicable laws','Force majeure on upstream regulatory failure','99.95% availability SLA'],
      ARRAY['REG-GDPR-44']),
    (_org, cloud_id, dc_id,     'Colocation & Hosting SLA',         750000,
      ARRAY['Facility must maintain PUE <= 1.5','Compliance with local energy regulations','Right-to-audit'],
      ARRAY['EU-CSRD','EU-DATA-CENTER-ENERGY']),
    (_org, dc_id,    energy_id, 'Industrial Power Supply Contract', 1200000,
      ARRAY['Renewable mix reporting','Uninterrupted supply guarantee'],
      ARRAY['EU-DATA-CENTER-ENERGY']),
    (_org, self_id,  pay_id,    'Merchant Processing Agreement',     900000,
      ARRAY['PCI-DSS compliance','Chargeback handling','Data residency'],
      ARRAY['PCI-DSS','REG-GDPR-44']),
    (_org, pay_id,   card_id,   'Card Network Membership',            400000,
      ARRAY['Network rules adherence','Cross-border transfer safeguards'],
      ARRAY['PCI-DSS']);
END; $$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  new_org_id uuid; local_part text; ws_name text;
  s_contract record; new_contract_id uuid;
BEGIN
  local_part := split_part(COALESCE(NEW.email, 'user'), '@', 1);
  ws_name := local_part || '''s workspace';

  INSERT INTO public.organizations (name, plan, plan_status)
    VALUES (ws_name, 'pro', 'active') RETURNING id INTO new_org_id;

  INSERT INTO public.profiles (id, org_id, full_name, email)
    VALUES (NEW.id, new_org_id, NEW.raw_user_meta_data->>'full_name', NEW.email);

  INSERT INTO public.user_roles (user_id, org_id, role)
    VALUES (NEW.id, new_org_id, 'admin');

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
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ── 17. Seed Reference Data (Regulations, Amendments, Samples, Backtests) ───

-- 10 Curated Regulations
INSERT INTO public.regulations (id, jurisdiction, title, summary, obligations, news_signal_boost) VALUES
('REG-GDPR-5', 'EU', 'GDPR Article 5 — Principles / Data Minimization',
 'Personal data must be adequate, relevant, and limited to what is necessary for the purpose it was collected for.',
 '["data_minimization","purpose_limitation","storage_limitation","accountability","accuracy"]'::jsonb, 0.05),
('REG-GDPR-33', 'EU', 'GDPR Article 33 — Personal Data Breach Notification',
 'A controller must notify the supervisory authority of a breach within 72 hours of becoming aware of it.',
 '["72h_breach_notification","breach_documentation","risk_assessment","processor_notification"]'::jsonb, 0.10),
('REG-GDPR-44', 'EU', 'GDPR Article 44 — International Data Transfers',
 'Any transfer of personal data outside the EEA must comply with adequacy decisions, SCCs, or specific safeguards.',
 '["adequacy_or_safeguards","transfer_impact_assessment","onward_transfer_controls"]'::jsonb, 0.15),
('REG-SEC-17A4', 'US', 'SEC Rule 17a-4 — Broker-Dealer Records',
 'Broker-dealers must preserve records in non-rewriteable format or equivalent audit-trail system.',
 '["immutable_retention","audit_trail","designated_executive","offsite_backup"]'::jsonb, 0.08),
('REG-CCPA-1798.120', 'US', 'CCPA §1798.120 — Right to Opt Out of Sale/Sharing',
 'Consumers have the right to direct a business not to sell or share their personal information.',
 '["opt_out_link","global_privacy_control","sharing_disclosure","minor_opt_in"]'::jsonb, 0.12),
('REG-HIPAA-SEC', 'US', 'HIPAA Security Rule (45 CFR §164.306–.312)',
 'Covered entities must implement administrative, physical, and technical safeguards for ePHI.',
 '["access_controls","audit_controls","encryption_at_rest_and_transit","incident_response"]'::jsonb, 0.14),
('REG-SOX-302', 'US', 'SOX §302 — Officer Certification',
 'Principal executive and financial officers must certify quarterly and annual reports and controls.',
 '["officer_certification","disclosure_controls","audit_committee_disclosure"]'::jsonb, 0.06),
('REG-BB-DPS-2023', 'BD', 'Bangladesh Bank Digital Payment Security Circular (2023)',
 'Digital payment providers must enforce 2FA, tokenization, transaction monitoring, and 6-hour incident reporting.',
 '["strong_customer_authentication","tokenization","transaction_monitoring","6h_incident_report"]'::jsonb, 0.09),
('REG-BD-DSA-2018', 'BD', 'Digital Security Act 2018 §26 — Unauthorized Use of Identity Information',
 'Unauthorized collection, transfer, or sale of identity information is prohibited with mandatory safeguards.',
 '["identity_info_safeguards","lawful_production","incident_cooperation"]'::jsonb, 0.11),
('REG-BD-LA-2006', 'BD', 'Bangladesh Labour Act 2006 §26 — Notice of Termination',
 'Permanent workers termination requires 120 days written notice or wages in lieu and statutory dues.',
 '["written_notice_period","reason_in_writing","statutory_compensation"]'::jsonb, 0.04)
ON CONFLICT (id) DO NOTHING;

-- Sample Contracts
INSERT INTO public.sample_contracts (id, name, counterparty, value, position) VALUES
('SC-001', 'Data Processing Agreement — Helix Analytics (EU SaaS)', 'Helix Analytics BV', 12500000, 0),
('SC-002', 'Standard Contractual Clauses Addendum — Aegis Cloud',   'Aegis Cloud GmbH',   9800000, 1),
('SC-003', 'Consumer Terms of Service — EU Consumers',              'Nord Retail S.A.',   4200000, 2),
('SC-005', 'Consumer Privacy Notice — California',                  'Internal — US Legal', 2600000, 4),
('SC-007', 'Business Associate Agreement — Cedar Health',           'Cedar Health Systems, LLC', 15750000, 6),
('SC-009', 'Broker-Dealer Recordkeeping SLA — Ridgefield Securities','Ridgefield Securities LLC', 3400000, 8),
('SC-011', 'Merchant Acquiring Agreement — bKash Payments',         'bKash Limited',       18300000, 10),
('SC-014', 'Fixed-Term Employment Contract — Padma Knitwear',       'Padma Knitwear Mills Ltd.', 420000, 13)
ON CONFLICT (id) DO NOTHING;

-- Sample Clauses
INSERT INTO public.sample_clauses (id, sample_contract_id, text, linked_regs, position) VALUES
('SCL-001-0', 'SC-001', 'Processor shall process personal data only on documented instructions from Controller and only for the purposes set out in Annex I.', ARRAY['REG-GDPR-5'], 0),
('SCL-001-1', 'SC-001', 'Processor shall notify Controller of any personal data breach without undue delay and within 24 hours of becoming aware of it.', ARRAY['REG-GDPR-33'], 1),
('SCL-001-2', 'SC-001', 'Any transfer of personal data by Processor outside the EEA shall be made only under Standard Contractual Clauses.', ARRAY['REG-GDPR-44'], 2),
('SCL-002-0', 'SC-002', 'The parties adopt the Standard Contractual Clauses set out in Commission Implementing Decision (EU) 2021/914.', ARRAY['REG-GDPR-44'], 0),
('SCL-005-0', 'SC-005', 'California residents have the right to direct us not to sell or share their personal information via Do Not Sell link.', ARRAY['REG-CCPA-1798.120'], 0),
('SCL-007-0', 'SC-007', 'Business Associate shall implement administrative, physical, and technical safeguards protecting confidentiality of ePHI.', ARRAY['REG-HIPAA-SEC'], 0),
('SCL-009-0', 'SC-009', 'Service Provider shall preserve all books and records in non-rewriteable format for periods prescribed by SEC Rule 17a-4.', ARRAY['REG-SEC-17A4'], 0),
('SCL-011-0', 'SC-011', 'Merchant shall implement 2FA for all digital payment transactions above BDT 5,000 per Bangladesh Bank guidelines.', ARRAY['REG-BB-DPS-2023'], 0),
('SCL-014-0', 'SC-014', 'Either party may terminate upon 120 days written notice or payment of wages in lieu pursuant to §26 Labour Act.', ARRAY['REG-BD-LA-2006'], 0)
ON CONFLICT (id) DO NOTHING;

-- Backtest Cases
INSERT INTO public.backtest_cases (id, company, fine_usd, case_date, regulation, summary, source, reconstructed_prompt, reconstructed_clauses, fallback, position) VALUES
('case-meta-gdpr', 'Meta Ireland', 1300000000, '2023-05-22', 'GDPR Article 46(1)', 
 'Irish DPC fined Meta €1.2B ($1.3B) and ordered suspension of transatlantic user data transfers under flawed Standard Contractual Clauses.',
 'Irish Data Protection Commission (DPC) Decision',
 'All transfers of personal data to US servers without binding supplementary technical protections preventing foreign surveillance access are void with immediate suspension mandated.',
 '[{"id":"cl-meta-1","text":"Company may transfer European user identifiers to parent servers in the United States for unified infrastructure redundancy and ad delivery."},
   {"id":"cl-meta-2","text":"Transfers rely upon EU Standard Contractual Clauses without additional localized cryptographic escrow barriers."}]'::jsonb,
 '{"summary":"Transatlantic data transfers invalidated under Schrems II doctrine.","impacts":[{"contract_id":"cl-meta-1","severity":"high","suggested_amendment":"Mandate EU-only data residency and cryptographic enclave isolation."}]}'::jsonb, 0),

('case-equifax-ccpa', 'Equifax', 575000000, '2019-07-22', 'FTC Act / Pre-CCPA Safeguards',
 'FTC, CFPB and 50 states settled with Equifax for up to $700M over failure to patch a known Apache Struts vulnerability exposing 147M consumer records.',
 'FTC Enforcement Order Docket C-4687',
 'Covered consumer reporting entities must patch known security vulnerabilities within 30 days of discovery and maintain perimeter intrusion monitoring for all credit data stores.',
 '[{"id":"cl-eq-1","text":"Vendor provides portal hosting on Apache frameworks with quarterly maintenance and scheduled security patch review cycles."},
   {"id":"cl-eq-2","text":"Consumer credit records are stored in plaintext relational partitions accessible across internal test networks."}]'::jsonb,
 '{"summary":"Severe failure to patch known CVE vulnerability exposing sensitive consumer credit profiles.","impacts":[{"contract_id":"cl-eq-1","severity":"high","suggested_amendment":"Enforce automated critical CVE patching within 7 days and continuous penetration testing."}]}'::jsonb, 1)
ON CONFLICT (id) DO NOTHING;

-- ── 18. Feature 16: Stale-Citation Detector & Temporal Legal Graph ───────────

-- Extend regulations with temporal columns
ALTER TABLE public.regulations 
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active' 
  CHECK (status IN ('active', 'amended', 'repealed', 'superseded', 'lapsed', 'renumbered')),
  ADD COLUMN IF NOT EXISTS effective_from date,
  ADD COLUMN IF NOT EXISTS effective_to date,
  ADD COLUMN IF NOT EXISTS repealed_by text REFERENCES public.regulations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS superseded_by text REFERENCES public.regulations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS current_version integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS official_source_url text,
  ADD COLUMN IF NOT EXISTS gazette_reference text,
  ADD COLUMN IF NOT EXISTS last_verified_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_regulations_status ON public.regulations(status);

-- Regulation Versions
CREATE TABLE IF NOT EXISTS public.regulation_versions (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  regulation_id       text NOT NULL REFERENCES public.regulations(id) ON DELETE CASCADE,
  version             integer NOT NULL,
  effective_from      date,
  effective_to        date,
  amendment_type      text CHECK (amendment_type IS NULL OR amendment_type IN ('substantive', 'cosmetic', 'clarification', 'renumbering', 'repeal')),
  summary             text,
  diff_from_previous  jsonb NOT NULL DEFAULT '{}'::jsonb,
  full_text           text,
  obligations         jsonb NOT NULL DEFAULT '[]'::jsonb,
  official_source_url text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (regulation_id, version)
);
CREATE INDEX IF NOT EXISTS idx_regulation_versions_reg_id ON public.regulation_versions(regulation_id);

-- Citation Instances
CREATE TABLE IF NOT EXISTS public.citation_instances (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  clause_id             uuid NOT NULL REFERENCES public.clauses(id) ON DELETE CASCADE,
  contract_id           uuid NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  regulation_id         text REFERENCES public.regulations(id) ON DELETE SET NULL,
  raw_citation          text NOT NULL,
  cited_article         text,
  cited_version         integer,
  cited_year            integer,
  as_of_date            date NOT NULL DEFAULT CURRENT_DATE,
  extraction_confidence numeric(3,2) NOT NULL DEFAULT 1.00,
  extraction_method     text NOT NULL DEFAULT 'regex' CHECK (extraction_method IN ('regex', 'ner', 'llm', 'hybrid')),
  created_at            timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_citation_instances_clause ON public.citation_instances(clause_id);
CREATE INDEX IF NOT EXISTS idx_citation_instances_contract ON public.citation_instances(contract_id);
CREATE INDEX IF NOT EXISTS idx_citation_instances_reg ON public.citation_instances(regulation_id);
CREATE INDEX IF NOT EXISTS idx_citation_instances_org ON public.citation_instances(org_id);

-- Stale Citation Findings
CREATE TABLE IF NOT EXISTS public.stale_citation_findings (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  citation_instance_id  uuid NOT NULL REFERENCES public.citation_instances(id) ON DELETE CASCADE,
  scan_run_id           uuid NOT NULL,
  severity              text NOT NULL CHECK (severity IN ('critical', 'high', 'medium', 'low')),
  staleness_type        text NOT NULL CHECK (staleness_type IN ('repealed', 'substantive_amendment', 'renumbered', 'superseded', 'cosmetic')),
  reason                text NOT NULL,
  evidence              jsonb NOT NULL DEFAULT '{}'::jsonb,
  ai_reasoning          text,
  confidence            numeric(3,2) NOT NULL DEFAULT 1.00,
  suggested_citation    text,
  suggested_clause_text text,
  financial_exposure    numeric(14,2),
  transition_deadline   date,
  status                text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'acknowledged', 'remediated', 'ignored')),
  created_at            timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_stale_findings_org ON public.stale_citation_findings(org_id);
CREATE INDEX IF NOT EXISTS idx_stale_findings_severity ON public.stale_citation_findings(severity);
CREATE INDEX IF NOT EXISTS idx_stale_findings_status ON public.stale_citation_findings(status);
CREATE INDEX IF NOT EXISTS idx_stale_findings_citation ON public.stale_citation_findings(citation_instance_id);
CREATE INDEX IF NOT EXISTS idx_stale_findings_scan ON public.stale_citation_findings(scan_run_id);

-- Stale Citation Scans (Audit Log)
CREATE TABLE IF NOT EXISTS public.stale_citation_scans (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  triggered_by      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  trigger_source    text NOT NULL DEFAULT 'manual' CHECK (trigger_source IN ('manual', 'ontology_update', 'scheduled', 'backtest')),
  citations_scanned integer NOT NULL DEFAULT 0,
  findings_count    integer NOT NULL DEFAULT 0,
  critical_count    integer NOT NULL DEFAULT 0,
  total_exposure    numeric(14,2) NOT NULL DEFAULT 0.00,
  duration_ms       integer NOT NULL DEFAULT 0,
  model_used        text,
  created_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_stale_scans_org ON public.stale_citation_scans(org_id, created_at DESC);

-- Regulation Update Queue
CREATE TABLE IF NOT EXISTS public.regulation_update_queue (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  regulation_id  text REFERENCES public.regulations(id) ON DELETE CASCADE,
  change_type    text NOT NULL,
  queued_at      timestamptz NOT NULL DEFAULT now(),
  processed      boolean NOT NULL DEFAULT false,
  processed_at   timestamptz,
  error_message  text
);
CREATE INDEX IF NOT EXISTS idx_reg_update_queue_pending ON public.regulation_update_queue(processed, queued_at)
  WHERE processed = false;

-- Trigger Function & Trigger on regulation_versions
CREATE OR REPLACE FUNCTION public.enqueue_regulation_version_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.regulation_update_queue (regulation_id, change_type)
  VALUES (NEW.regulation_id, COALESCE(NEW.amendment_type, 'version_update'));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_regulation_version_update ON public.regulation_versions;
CREATE TRIGGER trg_regulation_version_update
  AFTER INSERT OR UPDATE ON public.regulation_versions
  FOR EACH ROW EXECUTE FUNCTION public.enqueue_regulation_version_update();

-- ============================================================================
-- Migration: 20261018_human_review_queue.sql
-- Description: Human Review Queue (HITL), Enforced Gate, and Tamper-Evident Audit Trail
-- Specification: ClauseGraph_Human_Review_Queue_Master_Spec.md — Version 2.0
-- Stack: Supabase PostgreSQL, RLS, Append-Only Hash-Chained Audit Events
-- ============================================================================

-- ── 0. Extensions & Helper Functions ─────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Helper to safely calculate sha256 hex string across extension schema variants
CREATE OR REPLACE FUNCTION public.sha256_hex(input_text text) RETURNS text
LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
  BEGIN
    RETURN encode(extensions.digest(input_text, 'sha256'), 'hex');
  EXCEPTION WHEN OTHERS THEN
    RETURN encode(digest(input_text, 'sha256'), 'hex');
  END;
END;
$$;

-- Canonical JSON hash function used across database and application code
CREATE OR REPLACE FUNCTION public.payload_hash(p jsonb) RETURNS text
LANGUAGE sql IMMUTABLE AS $$
  SELECT public.sha256_hex(p::text);
$$;

-- Two-argument overload for has_role: public.has_role(user_id, role)
-- Scoped automatically to current organization
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id 
      AND org_id = public.current_org_id() 
      AND role = _role
  )
$$;

-- ── 1. Types ─────────────────────────────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'review_status') THEN
    CREATE TYPE public.review_status AS ENUM (
      'pending_review', 'approved', 'rejected', 'escalated', 'superseded', 'stale'
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'review_source') THEN
    CREATE TYPE public.review_source AS ENUM (
      'simulation', 'compliance_artifact', 'clause', 'supply_chain', 'what_if', 'action_plan'
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'review_severity') THEN
    CREATE TYPE public.review_severity AS ENUM ('high', 'medium', 'low');
  END IF;
END $$;

-- ── 2. Settings & Policy Tables ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.org_review_settings (
  org_id                uuid PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  enabled               boolean NOT NULL DEFAULT true, -- default true so HITL gate protects org
  require_second_person boolean NOT NULL DEFAULT false,
  sla_hours             int NOT NULL DEFAULT 72 CHECK (sla_hours > 0),
  escalated_digest_days int NOT NULL DEFAULT 7 CHECK (escalated_digest_days > 0),
  qa_sample_rate        numeric(3,2) NOT NULL DEFAULT 0.05 CHECK (qa_sample_rate BETWEEN 0 AND 1),
  updated_by            uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.review_policies (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id             uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  source_type        public.review_source NOT NULL,
  name               text NOT NULL,
  condition          jsonb NOT NULL,
  required_approvals int NOT NULL DEFAULT 1 CHECK (required_approvals BETWEEN 1 AND 3),
  reviewer_hint      text,
  enabled            boolean NOT NULL DEFAULT true,
  updated_by         uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at         timestamptz NOT NULL DEFAULT now()
);

-- ── 3. Queue Tables: review_items & review_events ────────────────────────────
CREATE TABLE IF NOT EXISTS public.review_items (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  source_type       public.review_source NOT NULL,
  source_id         uuid NOT NULL,
  status            public.review_status NOT NULL DEFAULT 'pending_review',
  severity          public.review_severity NOT NULL,
  risk_score        numeric(5,2) NOT NULL,
  risk_summary      text NOT NULL,
  flag_reasons      jsonb NOT NULL,
  engine            text NOT NULL CHECK (engine IN ('llm', 'deterministic_fallback')),
  model_name        text,
  prompt_version    text,
  confidence        numeric(4,3) CHECK (confidence BETWEEN 0 AND 1),

  -- Immutable snapshot of what AI produced
  ai_payload        jsonb NOT NULL,
  output_hash       text NOT NULL,
  input_snapshot    jsonb NOT NULL,
  input_hash        text NOT NULL,

  -- Reviewer edited version (never overwrites snapshot)
  reviewed_payload  jsonb,
  reviewed_hash     text,

  required_approvals int NOT NULL DEFAULT 1,
  dedupe_key        text NOT NULL,
  supersedes_id     uuid REFERENCES public.review_items(id) ON DELETE SET NULL,

  submitted_by      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_to       uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  decided_by        uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  decided_by_label  text,
  decided_at        timestamptz,
  decision_reason   text,
  reason_code       text CHECK (reason_code IN (
                      'wrong_clause', 'wrong_regulation', 'severity_overstated', 'severity_understated',
                      'hallucinated_citation', 'bad_amendment_language', 'unsafe_infrastructure', 'other'
                    )),

  sla_due_at        timestamptz NOT NULL,
  version           int NOT NULL DEFAULT 1,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT reject_needs_reason
    CHECK (status <> 'rejected' OR length(btrim(coalesce(decision_reason, ''))) >= 10),
  CONSTRAINT decided_has_time
    CHECK (status NOT IN ('approved', 'rejected') OR decided_at IS NOT NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS review_items_open_dedupe
  ON public.review_items (org_id, dedupe_key)
  WHERE status IN ('pending_review', 'escalated', 'approved');

CREATE INDEX IF NOT EXISTS review_items_queue_idx
  ON public.review_items (org_id, status, risk_score DESC, created_at ASC);

CREATE INDEX IF NOT EXISTS review_items_source_idx
  ON public.review_items (org_id, source_type, source_id, status);

CREATE INDEX IF NOT EXISTS review_items_sla_idx
  ON public.review_items (sla_due_at)
  WHERE status = 'pending_review';

CREATE INDEX IF NOT EXISTS review_items_assignee_idx
  ON public.review_items (assigned_to)
  WHERE status IN ('pending_review', 'escalated');

-- Append-only, hash-chained review events
CREATE TABLE IF NOT EXISTS public.review_events (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  review_id   uuid NOT NULL REFERENCES public.review_items(id) ON DELETE CASCADE,
  org_id      uuid NOT NULL,
  actor_id    uuid,
  actor_label text NOT NULL,
  event_type  text NOT NULL CHECK (event_type IN (
                'created', 'viewed', 'assigned', 'comment', 'approval_vote', 'approved', 'rejected',
                'edited', 'escalated', 'superseded', 'marked_stale', 'redacted', 'qa_sampled'
              )),
  from_status public.review_status,
  to_status   public.review_status,
  payload     jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT clock_timestamp(),
  prev_hash   text,
  row_hash    text NOT NULL
);

CREATE INDEX IF NOT EXISTS review_events_review_idx 
  ON public.review_events (review_id, id ASC);

-- Redactable comments table (privacy & GDPR compliance)
CREATE TABLE IF NOT EXISTS public.review_comments (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id    uuid NOT NULL REFERENCES public.review_items(id) ON DELETE CASCADE,
  org_id       uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  author_id    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  author_label text NOT NULL,
  comment_text text NOT NULL,
  comment_hash text NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  redacted     boolean NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS review_comments_review_idx 
  ON public.review_comments (review_id, created_at ASC);

-- ── 4. Triggers: Hash chain, Append-only, Guard & Immutability ───────────────

-- Hash chain trigger: serialized by row lock on parent review_items
CREATE OR REPLACE FUNCTION public.review_events_chain() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  v_prev text;
BEGIN
  SELECT row_hash INTO v_prev FROM public.review_events
   WHERE review_id = NEW.review_id ORDER BY id DESC LIMIT 1;
  NEW.prev_hash := coalesce(v_prev, 'genesis');
  NEW.row_hash  := public.sha256_hex(concat_ws('|',
      NEW.prev_hash, NEW.review_id, coalesce(NEW.actor_id::text, 'system'), NEW.event_type,
      coalesce(NEW.from_status::text, ''), coalesce(NEW.to_status::text, ''),
      NEW.payload::text, NEW.created_at::text));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_review_events_chain ON public.review_events;
CREATE TRIGGER trg_review_events_chain BEFORE INSERT ON public.review_events
  FOR EACH ROW EXECUTE FUNCTION public.review_events_chain();

-- Append-only trigger for review_events
CREATE OR REPLACE FUNCTION public.review_events_block_change() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'review_events is append-only' USING errcode = '55000';
END;
$$;

DROP TRIGGER IF EXISTS trg_review_events_no_update ON public.review_events;
CREATE TRIGGER trg_review_events_no_update BEFORE UPDATE OR DELETE ON public.review_events
  FOR EACH ROW EXECUTE FUNCTION public.review_events_block_change();

DROP TRIGGER IF EXISTS trg_review_events_no_truncate ON public.review_events;
CREATE TRIGGER trg_review_events_no_truncate BEFORE TRUNCATE ON public.review_events
  FOR EACH STATEMENT EXECUTE FUNCTION public.review_events_block_change();

-- Review items guard: immutable snapshot columns, valid state transitions, version bump
CREATE OR REPLACE FUNCTION public.review_items_guard() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.org_id <> OLD.org_id 
     OR NEW.source_type <> OLD.source_type 
     OR NEW.source_id <> OLD.source_id
     OR NEW.output_hash <> OLD.output_hash 
     OR NEW.input_hash <> OLD.input_hash
     OR NEW.created_at <> OLD.created_at THEN
    RAISE EXCEPTION 'immutable column changed' USING errcode = '55000';
  END IF;

  -- Payload columns may change only inside audited redaction
  IF coalesce(current_setting('app.redacting', true), '') <> 'on'
     AND (NEW.ai_payload IS DISTINCT FROM OLD.ai_payload
          OR NEW.input_snapshot IS DISTINCT FROM OLD.input_snapshot) THEN
    RAISE EXCEPTION 'snapshot is immutable' USING errcode = '55000';
  END IF;

  -- Legal status machine transitions
  IF NEW.status <> OLD.status AND NOT (
       (OLD.status = 'pending_review' AND NEW.status IN ('approved', 'rejected', 'escalated', 'superseded', 'stale'))
    OR (OLD.status = 'escalated'      AND NEW.status IN ('approved', 'rejected', 'pending_review', 'superseded', 'stale'))
    OR (OLD.status = 'approved'       AND NEW.status IN ('stale', 'superseded'))
  ) THEN
    RAISE EXCEPTION 'illegal transition % -> %', OLD.status, NEW.status USING errcode = '55000';
  END IF;

  NEW.updated_at := now();
  NEW.version    := OLD.version + 1;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_review_items_guard ON public.review_items;
CREATE TRIGGER trg_review_items_guard BEFORE UPDATE ON public.review_items
  FOR EACH ROW EXECUTE FUNCTION public.review_items_guard();

-- ── 5. RLS Policies & Grants ─────────────────────────────────────────────────
ALTER TABLE public.org_review_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_policies     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_items        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_events       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_comments     ENABLE ROW LEVEL SECURITY;

-- Read policies for org members
DROP POLICY IF EXISTS settings_read ON public.org_review_settings;
CREATE POLICY settings_read ON public.org_review_settings FOR SELECT TO authenticated
  USING (org_id = public.current_org_id());

DROP POLICY IF EXISTS policies_read ON public.review_policies;
CREATE POLICY policies_read ON public.review_policies FOR SELECT TO authenticated
  USING (org_id = public.current_org_id());

DROP POLICY IF EXISTS review_items_read ON public.review_items;
CREATE POLICY review_items_read ON public.review_items FOR SELECT TO authenticated
  USING (org_id = public.current_org_id());

DROP POLICY IF EXISTS review_events_read ON public.review_events;
CREATE POLICY review_events_read ON public.review_events FOR SELECT TO authenticated
  USING (org_id = public.current_org_id());

DROP POLICY IF EXISTS review_comments_read ON public.review_comments;
CREATE POLICY review_comments_read ON public.review_comments FOR SELECT TO authenticated
  USING (org_id = public.current_org_id());

-- Admin writes for settings & policies
DROP POLICY IF EXISTS settings_admin_write ON public.org_review_settings;
CREATE POLICY settings_admin_write ON public.org_review_settings FOR ALL TO authenticated
  USING (org_id = public.current_org_id() AND public.has_role(auth.uid(), 'admin'))
  WITH CHECK (org_id = public.current_org_id() AND public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS policies_admin_write ON public.review_policies;
CREATE POLICY policies_admin_write ON public.review_policies FOR ALL TO authenticated
  USING (org_id = public.current_org_id() AND public.has_role(auth.uid(), 'admin'))
  WITH CHECK (org_id = public.current_org_id() AND public.has_role(auth.uid(), 'admin'));

-- Revoke write privileges on queue and audit events from authenticated & anon
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.review_items, public.review_events
  FROM public, anon, authenticated;
REVOKE UPDATE, DELETE, TRUNCATE ON public.review_events FROM service_role;

GRANT SELECT ON public.review_items, public.review_events, public.org_review_settings, public.review_policies, public.review_comments
  TO authenticated;
GRANT ALL ON public.review_items, public.review_events, public.org_review_settings, public.review_policies, public.review_comments
  TO service_role;

-- ── 6. Database Functions (SECURITY DEFINER) ─────────────────────────────────

-- 6.1 Enqueue Review Item
CREATE OR REPLACE FUNCTION public.enqueue_review(
  p_org_id             uuid,
  p_source_type        public.review_source,
  p_source_id          uuid,
  p_severity           public.review_severity,
  p_risk_score         numeric,
  p_risk_summary       text,
  p_flag_reasons       jsonb,
  p_engine             text,
  p_model_name         text,
  p_prompt_version     text,
  p_confidence         numeric,
  p_ai_payload         jsonb,
  p_input_snapshot     jsonb,
  p_required_approvals int DEFAULT 1,
  p_submitted_by       uuid DEFAULT NULL,
  p_sla_hours          int DEFAULT 72
) RETURNS public.review_items
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_out_hash   text;
  v_in_hash    text;
  v_dedupe_key text;
  v_existing   public.review_items;
  v_old_open   public.review_items;
  v_item       public.review_items;
  v_supersedes uuid := NULL;
  v_sub_label  text := 'system';
BEGIN
  v_out_hash := public.payload_hash(p_ai_payload);
  v_in_hash  := public.payload_hash(p_input_snapshot);
  v_dedupe_key := public.sha256_hex(concat_ws('|', p_org_id::text, p_source_type::text, p_source_id::text, v_out_hash));

  -- If identical output already exists in open or approved state, reuse it!
  SELECT * INTO v_existing FROM public.review_items
   WHERE org_id = p_org_id AND dedupe_key = v_dedupe_key
     AND status IN ('pending_review', 'escalated', 'approved')
   LIMIT 1;

  IF FOUND THEN
    RETURN v_existing;
  END IF;

  -- Check if an older open item exists for the same source with different content
  SELECT * INTO v_old_open FROM public.review_items
   WHERE org_id = p_org_id AND source_type = p_source_type AND source_id = p_source_id
     AND status IN ('pending_review', 'escalated')
   FOR UPDATE LIMIT 1;

  IF FOUND THEN
    UPDATE public.review_items
       SET status = 'superseded', updated_at = now()
     WHERE id = v_old_open.id;

    INSERT INTO public.review_events (
      review_id, org_id, actor_id, actor_label, event_type, from_status, to_status, payload
    ) VALUES (
      v_old_open.id, p_org_id, p_submitted_by, 'system:regenerate',
      'superseded', v_old_open.status, 'superseded',
      jsonb_build_object('superseded_by_hash', v_out_hash)
    );
    v_supersedes := v_old_open.id;
  END IF;

  IF p_submitted_by IS NOT NULL THEN
    SELECT coalesce(email, p_submitted_by::text) INTO v_sub_label FROM auth.users WHERE id = p_submitted_by;
  END IF;

  -- Insert new review item
  INSERT INTO public.review_items (
    org_id, source_type, source_id, status, severity, risk_score, risk_summary,
    flag_reasons, engine, model_name, prompt_version, confidence,
    ai_payload, output_hash, input_snapshot, input_hash,
    required_approvals, dedupe_key, supersedes_id, submitted_by,
    sla_due_at
  ) VALUES (
    p_org_id, p_source_type, p_source_id, 'pending_review', p_severity, p_risk_score, p_risk_summary,
    p_flag_reasons, p_engine, p_model_name, p_prompt_version, p_confidence,
    p_ai_payload, v_out_hash, p_input_snapshot, v_in_hash,
    p_required_approvals, v_dedupe_key, v_supersedes, p_submitted_by,
    now() + (coalesce(p_sla_hours, 72) || ' hours')::interval
  ) RETURNING * INTO v_item;

  -- Record created event
  INSERT INTO public.review_events (
    review_id, org_id, actor_id, actor_label, event_type, from_status, to_status, payload
  ) VALUES (
    v_item.id, p_org_id, p_submitted_by, v_sub_label, 'created', NULL, 'pending_review',
    jsonb_build_object(
      'output_hash', v_out_hash,
      'input_hash', v_in_hash,
      'engine', p_engine,
      'risk_score', p_risk_score,
      'flag_reasons', p_flag_reasons
    )
  );

  RETURN v_item;
END;
$$;

-- 6.2 Decide Review (Approve / Reject / Edit-and-Approve)
CREATE OR REPLACE FUNCTION public.decide_review(
  p_id               uuid,
  p_expected_version int,
  p_decision         text,
  p_reason           text DEFAULT NULL,
  p_reason_code      text DEFAULT NULL,
  p_edited_payload   jsonb DEFAULT NULL
) RETURNS public.review_items
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid       uuid := auth.uid();
  v_item      public.review_items;
  v_settings  public.org_review_settings;
  v_from      public.review_status;
  v_label     text;
  v_self      boolean;
  v_last_edit bigint;
  v_votes     int;
  v_old       text;
  v_new       text;
  v_viewed    boolean;
BEGIN
  IF v_uid IS NULL OR NOT public.has_role(v_uid, 'admin') THEN
    RAISE EXCEPTION 'admin role required' USING errcode = '42501';
  END IF;

  IF p_decision NOT IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'invalid decision' USING errcode = '22023';
  END IF;

  -- Scope strictly to current organization; return 404 if item does not exist
  SELECT * INTO v_item FROM public.review_items
   WHERE id = p_id AND org_id = public.current_org_id() FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'not found' USING errcode = 'P0002';
  END IF;

  IF v_item.version <> p_expected_version THEN
    RAISE EXCEPTION 'version conflict' USING errcode = '40001'; -- 409 for the loser
  END IF;

  IF v_item.status NOT IN ('pending_review', 'escalated') THEN
    RAISE EXCEPTION 'item is already %', v_item.status USING errcode = '55000';
  END IF;

  v_from := v_item.status;

  SELECT * INTO v_settings FROM public.org_review_settings WHERE org_id = v_item.org_id;
  v_self := (v_item.submitted_by = v_uid);

  IF v_self AND coalesce(v_settings.require_second_person, false) THEN
    RAISE EXCEPTION 'a second person must decide this item' USING errcode = '42501';
  END IF;

  -- Reason of at least 10 characters mandatory for reject, high severity, or compliance artifact
  IF p_decision = 'rejected' OR v_item.severity = 'high' OR v_item.source_type = 'compliance_artifact' THEN
    IF length(btrim(coalesce(p_reason, ''))) < 10 THEN
      RAISE EXCEPTION 'a reason of at least 10 characters is required' USING errcode = '22023';
    END IF;
  END IF;

  SELECT coalesce(email, v_uid::text) INTO v_label FROM auth.users WHERE id = v_uid;

  IF p_decision = 'rejected' THEN
    UPDATE public.review_items
       SET status = 'rejected',
           decided_by = v_uid,
           decided_by_label = v_label,
           decided_at = now(),
           decision_reason = btrim(p_reason),
           reason_code = p_reason_code
     WHERE id = v_item.id RETURNING * INTO v_item;

    INSERT INTO public.review_events (
      review_id, org_id, actor_id, actor_label, event_type, from_status, to_status, payload
    ) VALUES (
      v_item.id, v_item.org_id, v_uid, v_label, 'rejected', v_from, 'rejected',
      jsonb_build_object(
        'reason_code', p_reason_code,
        'self_approval', v_self,
        'content_hash', coalesce(v_item.reviewed_hash, v_item.output_hash)
      )
    );
    RETURN v_item;
  END IF;

  -- Edit-and-approve: snapshot remains untouched; edit stored separately with its own hash
  IF p_edited_payload IS NOT NULL THEN
    v_old := coalesce(v_item.reviewed_hash, v_item.output_hash);
    v_new := public.payload_hash(p_edited_payload);
    UPDATE public.review_items
       SET reviewed_payload = p_edited_payload,
           reviewed_hash = v_new
     WHERE id = v_item.id RETURNING * INTO v_item;

    INSERT INTO public.review_events (
      review_id, org_id, actor_id, actor_label, event_type, payload
    ) VALUES (
      v_item.id, v_item.org_id, v_uid, v_label, 'edited',
      jsonb_build_object('before_hash', v_old, 'after_hash', v_new)
    );
  END IF;

  -- Approvals counted only after latest edit
  SELECT coalesce(max(id), 0) INTO v_last_edit FROM public.review_events
   WHERE review_id = v_item.id AND event_type = 'edited';

  IF EXISTS (
    SELECT 1 FROM public.review_events
     WHERE review_id = v_item.id AND event_type = 'approval_vote'
       AND actor_id = v_uid AND id > v_last_edit
  ) THEN
    RAISE EXCEPTION 'you have already approved this version' USING errcode = '55000';
  END IF;

  v_viewed := EXISTS (
    SELECT 1 FROM public.review_events
     WHERE review_id = v_item.id AND event_type = 'viewed' AND actor_id = v_uid
  );

  INSERT INTO public.review_events (
    review_id, org_id, actor_id, actor_label, event_type, payload
  ) VALUES (
    v_item.id, v_item.org_id, v_uid, v_label, 'approval_vote',
    jsonb_build_object('self_approval', v_self, 'viewed_before_deciding', v_viewed)
  );

  SELECT count(DISTINCT actor_id) INTO v_votes FROM public.review_events
   WHERE review_id = v_item.id AND event_type = 'approval_vote' AND id > v_last_edit;

  IF v_votes < v_item.required_approvals THEN
    UPDATE public.review_items SET updated_at = now() WHERE id = v_item.id RETURNING * INTO v_item;
    RETURN v_item; -- Still pending: more distinct admins required for multi-approval
  END IF;

  UPDATE public.review_items
     SET status = 'approved',
         decided_by = v_uid,
         decided_by_label = v_label,
         decided_at = now(),
         decision_reason = nullif(btrim(p_reason), ''),
         reason_code = p_reason_code
   WHERE id = v_item.id RETURNING * INTO v_item;

  INSERT INTO public.review_events (
    review_id, org_id, actor_id, actor_label, event_type, from_status, to_status, payload
  ) VALUES (
    v_item.id, v_item.org_id, v_uid, v_label, 'approved', v_from, 'approved',
    jsonb_build_object(
      'self_approval', v_self,
      'votes', v_votes,
      'content_hash', coalesce(v_item.reviewed_hash, v_item.output_hash)
    )
  );

  RETURN v_item;
END;
$$;

-- 6.3 Assign Review
CREATE OR REPLACE FUNCTION public.assign_review(
  p_id      uuid,
  p_user_id uuid
) RETURNS public.review_items
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid   uuid := auth.uid();
  v_item  public.review_items;
  v_label text;
BEGIN
  IF v_uid IS NULL OR NOT public.has_role(v_uid, 'admin') THEN
    RAISE EXCEPTION 'admin role required' USING errcode = '42501';
  END IF;

  SELECT * INTO v_item FROM public.review_items
   WHERE id = p_id AND org_id = public.current_org_id() FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'not found' USING errcode = 'P0002';
  END IF;

  SELECT coalesce(email, v_uid::text) INTO v_label FROM auth.users WHERE id = v_uid;

  UPDATE public.review_items
     SET assigned_to = p_user_id, updated_at = now()
   WHERE id = v_item.id RETURNING * INTO v_item;

  INSERT INTO public.review_events (
    review_id, org_id, actor_id, actor_label, event_type, payload
  ) VALUES (
    v_item.id, v_item.org_id, v_uid, v_label, 'assigned',
    jsonb_build_object('assigned_to', p_user_id)
  );

  RETURN v_item;
END;
$$;

-- 6.4 Add Comment to Review
CREATE OR REPLACE FUNCTION public.comment_review(
  p_id   uuid,
  p_text text
) RETURNS public.review_comments
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid     uuid := auth.uid();
  v_item    public.review_items;
  v_label   text;
  v_hash    text;
  v_comment public.review_comments;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'authenticated user required' USING errcode = '42501';
  END IF;

  IF length(btrim(coalesce(p_text, ''))) = 0 THEN
    RAISE EXCEPTION 'comment text cannot be empty' USING errcode = '22023';
  END IF;

  SELECT * INTO v_item FROM public.review_items
   WHERE id = p_id AND org_id = public.current_org_id() FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'not found' USING errcode = 'P0002';
  END IF;

  SELECT coalesce(email, v_uid::text) INTO v_label FROM auth.users WHERE id = v_uid;
  v_hash := public.sha256_hex(p_text);

  INSERT INTO public.review_comments (
    review_id, org_id, author_id, author_label, comment_text, comment_hash
  ) VALUES (
    v_item.id, v_item.org_id, v_uid, v_label, p_text, v_hash
  ) RETURNING * INTO v_comment;

  -- Review events holds comment hash ONLY (privacy & redaction safe)
  INSERT INTO public.review_events (
    review_id, org_id, actor_id, actor_label, event_type, payload
  ) VALUES (
    v_item.id, v_item.org_id, v_uid, v_label, 'comment',
    jsonb_build_object('comment_id', v_comment.id, 'comment_hash', v_hash)
  );

  RETURN v_comment;
END;
$$;

-- 6.5 Log Review Viewed (Rubber-stamp detection telemetry)
CREATE OR REPLACE FUNCTION public.log_review_view(
  p_id uuid
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid   uuid := auth.uid();
  v_item  public.review_items;
  v_label text;
BEGIN
  IF v_uid IS NULL THEN RETURN; END IF;

  SELECT * INTO v_item FROM public.review_items
   WHERE id = p_id AND org_id = public.current_org_id();

  IF NOT FOUND THEN RETURN; END IF;

  SELECT coalesce(email, v_uid::text) INTO v_label FROM auth.users WHERE id = v_uid;

  INSERT INTO public.review_events (
    review_id, org_id, actor_id, actor_label, event_type, payload
  ) VALUES (
    v_item.id, v_item.org_id, v_uid, v_label, 'viewed', '{}'::jsonb
  );
END;
$$;

-- 6.6 Mark Stale (Invalidate approval when underlying inputs change)
CREATE OR REPLACE FUNCTION public.mark_stale(
  p_source_type public.review_source,
  p_source_id   uuid,
  p_reason      text
) RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_rec       record;
  v_new_item  public.review_items;
  v_count     int := 0;
BEGIN
  FOR v_rec IN
    SELECT * FROM public.review_items
     WHERE org_id = public.current_org_id()
       AND source_type = p_source_type AND source_id = p_source_id
       AND status IN ('approved', 'pending_review', 'escalated')
     FOR UPDATE
  LOOP
    -- Mark old item as stale (terminal state)
    UPDATE public.review_items
       SET status = 'stale', updated_at = now()
     WHERE id = v_rec.id;

    INSERT INTO public.review_events (
      review_id, org_id, actor_id, actor_label, event_type, from_status, to_status, payload
    ) VALUES (
      v_rec.id, v_rec.org_id, NULL, 'system:staleness-detector',
      'marked_stale', v_rec.status, 'stale',
      jsonb_build_object('reason', p_reason)
    );

    -- If it was approved, create a fresh pending_review item linked back via supersedes_id
    IF v_rec.status = 'approved' THEN
      INSERT INTO public.review_items (
        org_id, source_type, source_id, status, severity, risk_score, risk_summary,
        flag_reasons, engine, model_name, prompt_version, confidence,
        ai_payload, output_hash, input_snapshot, input_hash,
        required_approvals, dedupe_key, supersedes_id, submitted_by, sla_due_at
      ) VALUES (
        v_rec.org_id, v_rec.source_type, v_rec.source_id, 'pending_review', v_rec.severity,
        v_rec.risk_score, v_rec.risk_summary,
        v_rec.flag_reasons || jsonb_build_array('previously_approved_marked_stale: ' || p_reason),
        v_rec.engine, v_rec.model_name, v_rec.prompt_version, v_rec.confidence,
        v_rec.ai_payload, v_rec.output_hash, v_rec.input_snapshot, v_rec.input_hash,
        v_rec.required_approvals, v_rec.dedupe_key || ':stale:' || now()::text,
        v_rec.id, v_rec.submitted_by, now() + interval '72 hours'
      ) RETURNING * INTO v_new_item;

      INSERT INTO public.review_events (
        review_id, org_id, actor_id, actor_label, event_type, to_status, payload
      ) VALUES (
        v_new_item.id, v_rec.org_id, NULL, 'system:staleness-detector',
        'created', 'pending_review',
        jsonb_build_object('staled_predecessor_id', v_rec.id, 'reason', p_reason)
      );
    END IF;

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

-- 6.7 Escalate Overdue Items (SLA worker, idempotent)
CREATE OR REPLACE FUNCTION public.escalate_overdue() RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_n int;
BEGIN
  WITH moved AS (
    UPDATE public.review_items
       SET status = 'escalated'
     WHERE status = 'pending_review' AND sla_due_at < now()
     RETURNING id, org_id
  )
  INSERT INTO public.review_events (
    review_id, org_id, actor_id, actor_label, event_type, from_status, to_status
  )
  SELECT id, org_id, NULL, 'system:sla-worker', 'escalated', 'pending_review', 'escalated'
    FROM moved;

  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END;
$$;

-- 6.8 The Single Server-Side Enforcement Check
CREATE OR REPLACE FUNCTION public.is_output_approved(
  p_source_type  public.review_source,
  p_source_id    uuid,
  p_content_hash text
) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.review_items
     WHERE org_id = public.current_org_id()
       AND source_type = p_source_type
       AND source_id = p_source_id
       AND status = 'approved'
       AND coalesce(reviewed_hash, output_hash) = p_content_hash
  );
$$;

-- View: approved outputs for dashboard & exposure totals
CREATE OR REPLACE VIEW public.approved_outputs WITH (security_invoker = true) AS
  SELECT * FROM public.review_items WHERE status = 'approved';

-- 6.9 Verify Hash Chain
CREATE OR REPLACE FUNCTION public.verify_review_chain(
  p_id uuid
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_event      record;
  v_last_hash  text := 'genesis';
  v_calc_hash  text;
  v_count      int := 0;
BEGIN
  FOR v_event IN
    SELECT * FROM public.review_events
     WHERE review_id = p_id
     ORDER BY id ASC
  LOOP
    IF v_event.prev_hash <> v_last_hash THEN
      RETURN jsonb_build_object(
        'valid', false,
        'event_count', v_count,
        'broken_at_id', v_event.id,
        'error', 'prev_hash mismatch: expected ' || v_last_hash || ', got ' || v_event.prev_hash
      );
    END IF;

    v_calc_hash := public.sha256_hex(concat_ws('|',
      v_event.prev_hash, v_event.review_id, coalesce(v_event.actor_id::text, 'system'), v_event.event_type,
      coalesce(v_event.from_status::text, ''), coalesce(v_event.to_status::text, ''),
      v_event.payload::text, v_event.created_at::text));

    IF v_event.row_hash <> v_calc_hash THEN
      RETURN jsonb_build_object(
        'valid', false,
        'event_count', v_count,
        'broken_at_id', v_event.id,
        'error', 'row_hash mismatch: expected ' || v_calc_hash || ', got ' || v_event.row_hash
      );
    END IF;

    v_last_hash := v_event.row_hash;
    v_count := v_count + 1;
  END LOOP;

  RETURN jsonb_build_object('valid', true, 'event_count', v_count);
END;
$$;

-- 6.10 Redact Review Payload (Admin-only privacy erasure)
CREATE OR REPLACE FUNCTION public.redact_review_payload(
  p_id     uuid,
  p_reason text
) RETURNS public.review_items
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid   uuid := auth.uid();
  v_item  public.review_items;
  v_label text;
BEGIN
  IF v_uid IS NULL OR NOT public.has_role(v_uid, 'admin') THEN
    RAISE EXCEPTION 'admin role required' USING errcode = '42501';
  END IF;

  SELECT * INTO v_item FROM public.review_items
   WHERE id = p_id AND org_id = public.current_org_id() FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'not found' USING errcode = 'P0002';
  END IF;

  SELECT coalesce(email, v_uid::text) INTO v_label FROM auth.users WHERE id = v_uid;

  -- Set session config to permit payload redaction through trigger
  PERFORM set_config('app.redacting', 'on', true);

  UPDATE public.review_items
     SET ai_payload = '{}'::jsonb,
         input_snapshot = '{}'::jsonb,
         reviewed_payload = NULL
   WHERE id = v_item.id RETURNING * INTO v_item;

  UPDATE public.review_comments
     SET comment_text = '[REDACTED]',
         redacted = true
   WHERE review_id = v_item.id;

  INSERT INTO public.review_events (
    review_id, org_id, actor_id, actor_label, event_type, payload
  ) VALUES (
    v_item.id, v_item.org_id, v_uid, v_label, 'redacted',
    jsonb_build_object('reason', p_reason, 'redacted_by', v_uid)
  );

  RETURN v_item;
END;
$$;

-- Function execution grants
REVOKE EXECUTE ON FUNCTION public.enqueue_review FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.decide_review FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.assign_review FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.comment_review FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.log_review_view FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.mark_stale FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.escalate_overdue FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.redact_review_payload FROM public, anon;

GRANT EXECUTE ON FUNCTION public.decide_review TO authenticated;
GRANT EXECUTE ON FUNCTION public.assign_review TO authenticated;
GRANT EXECUTE ON FUNCTION public.comment_review TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_review_view TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_output_approved TO authenticated;
GRANT EXECUTE ON FUNCTION public.verify_review_chain TO authenticated;
GRANT EXECUTE ON FUNCTION public.redact_review_payload TO authenticated;

GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO service_role;

-- ── 7. Seed Default Policies & Settings for Existing Orgs ───────────────────
DO $$
DECLARE
  v_org record;
BEGIN
  FOR v_org IN SELECT id FROM public.organizations LOOP
    -- Org review settings
    INSERT INTO public.org_review_settings (org_id, enabled, require_second_person, sla_hours)
    VALUES (v_org.id, true, false, 72)
    ON CONFLICT (org_id) DO NOTHING;

    -- Default Review Policies
    -- 1. Simulation findings with high severity or exposure > $500,000
    INSERT INTO public.review_policies (org_id, source_type, name, condition, required_approvals, reviewer_hint)
    VALUES (
      v_org.id, 'simulation', 'High Severity Simulation Breach',
      jsonb_build_object('or', jsonb_build_array(
        jsonb_build_object('severity', 'high'),
        jsonb_build_object('exposure_usd_gt', 500000)
      )),
      1, 'Legal counsel'
    ) ON CONFLICT DO NOTHING;

    -- 2. Compliance-as-Code (Terraform / Python) - Always gated
    INSERT INTO public.review_policies (org_id, source_type, name, condition, required_approvals, reviewer_hint)
    VALUES (
      v_org.id, 'compliance_artifact', 'Compliance-as-Code Remediation Gate',
      jsonb_build_object('always', true),
      1, 'DevOps lead + Legal'
    ) ON CONFLICT DO NOTHING;

    -- 3. Contract clause extraction confidence < 0.75
    INSERT INTO public.review_policies (org_id, source_type, name, condition, required_approvals, reviewer_hint)
    VALUES (
      v_org.id, 'clause', 'Low Confidence Clause Extraction',
      jsonb_build_object('confidence_lt', 0.75),
      1, 'Contract analyst'
    ) ON CONFLICT DO NOTHING;

    -- 4. Action plan proposed contract amendments
    INSERT INTO public.review_policies (org_id, source_type, name, condition, required_approvals, reviewer_hint)
    VALUES (
      v_org.id, 'action_plan', 'Action Plan Contract Amendment Suggestions',
      jsonb_build_object('always', true),
      1, 'Legal counsel'
    ) ON CONFLICT DO NOTHING;

    -- 5. Supply chain indirect exposure > $500,000
    INSERT INTO public.review_policies (org_id, source_type, name, condition, required_approvals, reviewer_hint)
    VALUES (
      v_org.id, 'supply_chain', 'High Value Supply Chain Exposure',
      jsonb_build_object('exposure_usd_gt', 500000),
      1, 'Risk officer'
    ) ON CONFLICT DO NOTHING;
  END LOOP;
END $$;
-- ============================================================================
-- Migration: 20261018_audit_log_system.sql
-- Description: Tamper-Evident Audit Log Foundation (Feature A)
-- Specification: ClauseGraph_AuditLog_EvalHarness_Spec_MERGED.md (v2.0)
-- Stack: PostgreSQL 16+, Supabase RLS, Append-Only Triggers, Hash Chaining
-- ============================================================================

-- ── 1. Authoritative Action Catalog ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.audit_actions (
  action      text PRIMARY KEY,
  category    text NOT NULL,
  description text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Seed authoritative catalog (§5)
INSERT INTO public.audit_actions (action, category, description) VALUES
  -- Identity and access
  ('auth.login', 'auth', 'User authenticated into workspace'),
  ('auth.login_failed', 'auth', 'Authentication attempt failed'),
  ('role.granted', 'auth', 'Role granted or promoted in organization'),
  ('role.revoked', 'auth', 'Role revoked or demoted in organization'),
  ('member.invited', 'auth', 'New member invited to organization'),
  ('member.removed', 'auth', 'Member removed from organization'),

  -- Contracts & clauses
  ('contract.uploaded', 'contract', 'New contract uploaded for ingestion'),
  ('contract.parsed', 'contract', 'Contract parsed and clauses extracted'),
  ('contract.clause_flagged', 'contract', 'Contract clause flagged for regulatory risk'),
  ('contract.deleted', 'contract', 'Contract deleted from organization repository'),
  ('clause.edited', 'contract', 'Contract clause text or metadata updated'),

  -- AI runs & predictions
  ('simulation.run', 'ai', 'Regulatory blast radius simulation executed'),
  ('simulation.fallback_activated', 'ai', 'Deterministic fallback engine activated due to LLM failure/timeout'),
  ('whatif.run', 'ai', 'Regulatory hypothetical simulation run'),
  ('code.generated', 'ai', 'Executable compliance code generated (Python/Terraform)'),
  ('action_plan.generated', 'ai', 'Remediation action plan generated'),
  ('prediction.run', 'ai', 'Predictive radar forecast calculation run'),

  -- Review decisions (Human Review Queue)
  ('review.created', 'review', 'Item enqueued into human review queue'),
  ('review.assigned', 'review', 'Review item assigned to reviewer'),
  ('review.approved', 'review', 'Review item approved by admin'),
  ('review.rejected', 'review', 'Review item rejected by admin'),
  ('review.edited', 'review', 'Review item edited and approved with human modifications'),
  ('review.escalated', 'review', 'Review item escalated due to SLA breach'),
  ('review.marked_stale', 'review', 'Review item or prior approval invalidated by ontology change'),

  -- Artifacts & exports
  ('artifact.generated', 'artifact', 'Compliance-as-Code artifact generated'),
  ('artifact.exported', 'artifact', 'Compliance code or runbook exported'),
  ('artifact.deployed', 'artifact', 'Reserved: compliance artifact deployed to infrastructure'),
  ('action_plan.exported_pdf', 'artifact', 'Remediation action plan exported as PDF'),

  -- Governance
  ('policy.updated', 'governance', 'Organization review policy or threshold updated'),
  ('workspace.deletion_requested', 'governance', 'Workspace deletion requested (30-day grace)'),
  ('workspace.deletion_cancelled', 'governance', 'Workspace deletion request cancelled'),

  -- Audit itself
  ('audit.exported', 'audit', 'Audit log exported as CSV or PDF report'),
  ('audit.verified', 'audit', 'Cryptographic audit chain integrity verification executed'),
  ('audit.correction', 'audit', 'Correction note recorded referencing prior audit event')
ON CONFLICT (action) DO UPDATE SET
  category = EXCLUDED.category,
  description = EXCLUDED.description;

-- ── 2. Primary Audit Log Table ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.audit_log (
  id              bigserial PRIMARY KEY,
  org_id          uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  actor_id        uuid, -- deliberately no FK to auth.users so user deletion never cascades to historical evidence
  actor_role      public.app_role NOT NULL DEFAULT 'member',
  action          text NOT NULL REFERENCES public.audit_actions(action),
  entity_type     text NOT NULL,
  entity_id       text NOT NULL,
  correlation_id  uuid,
  before          jsonb,
  after           jsonb,
  basis           jsonb,
  metadata        jsonb NOT NULL DEFAULT '{}'::jsonb,
  hash_version    smallint NOT NULL DEFAULT 1,
  created_at      timestamptz NOT NULL DEFAULT clock_timestamp(),
  prev_hash       text NOT NULL,
  row_hash        text NOT NULL
);

-- ── 3. High-Performance Indexes (§6) ─────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_audit_log_org_id_desc ON public.audit_log (org_id, id DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON public.audit_log (org_id, entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON public.audit_log (org_id, action, id DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_actor ON public.audit_log (org_id, actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_correlation ON public.audit_log (org_id, correlation_id) 
  WHERE correlation_id IS NOT NULL;

-- ── 4. Append-Only Trigger Protections (§7) ──────────────────────────────────
CREATE OR REPLACE FUNCTION public.prevent_audit_log_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'audit_log is append-only: UPDATE, DELETE, and TRUNCATE are prohibited'
    USING errcode = '42501';
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_log_no_update ON public.audit_log;
CREATE TRIGGER trg_audit_log_no_update
  BEFORE UPDATE ON public.audit_log
  FOR EACH ROW EXECUTE FUNCTION public.prevent_audit_log_mutation();

DROP TRIGGER IF EXISTS trg_audit_log_no_delete ON public.audit_log;
CREATE TRIGGER trg_audit_log_no_delete
  BEFORE DELETE ON public.audit_log
  FOR EACH ROW EXECUTE FUNCTION public.prevent_audit_log_mutation();

DROP TRIGGER IF EXISTS trg_audit_log_no_truncate ON public.audit_log;
CREATE TRIGGER trg_audit_log_no_truncate
  BEFORE TRUNCATE ON public.audit_log
  FOR EACH STATEMENT EXECUTE FUNCTION public.prevent_audit_log_mutation();

-- ── 5. Row Level Security & Access Grants (§7) ───────────────────────────────
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log FORCE ROW LEVEL SECURITY;

REVOKE ALL ON public.audit_log FROM public, anon;
-- Direct write access revoked from authenticated; writes must pass through write_audit_event()
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.audit_log FROM authenticated;
GRANT SELECT ON public.audit_log TO authenticated;

-- RLS: Only admins belonging to the same organization can read audit logs
DROP POLICY IF EXISTS audit_log_admin_select ON public.audit_log;
CREATE POLICY audit_log_admin_select ON public.audit_log
  FOR SELECT TO authenticated
  USING (
    org_id = public.current_org_id() 
    AND public.has_role(auth.uid(), 'admin')
  );

-- ── 6. Shared Canonical Row Hash Helper (§8) ─────────────────────────────────
-- Explicit UTC formatting YYYY-MM-DD"T"HH24:MI:SS.US"Z" guarantees timezone invariance
CREATE OR REPLACE FUNCTION public.audit_row_hash(
  p_prev_hash      text,
  p_org_id         uuid,
  p_actor_id       uuid,
  p_actor_role     public.app_role,
  p_action         text,
  p_entity_type    text,
  p_entity_id      text,
  p_correlation_id uuid,
  p_before         jsonb,
  p_after          jsonb,
  p_basis          jsonb,
  p_metadata       jsonb,
  p_hash_version   smallint,
  p_created_at     timestamptz
) RETURNS text
LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  v_time_str text;
  v_payload  jsonb;
BEGIN
  -- Stable UTC formatting with microseconds
  v_time_str := to_char(p_created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"');

  v_payload := jsonb_build_array(
    p_prev_hash,
    p_org_id::text,
    coalesce(p_actor_id::text, 'system'),
    p_actor_role::text,
    p_action,
    p_entity_type,
    p_entity_id,
    coalesce(p_correlation_id::text, ''),
    coalesce(p_before, 'null'::jsonb),
    coalesce(p_after, 'null'::jsonb),
    coalesce(p_basis, 'null'::jsonb),
    coalesce(p_metadata, '{}'::jsonb),
    p_hash_version,
    v_time_str
  );

  RETURN public.sha256_hex(v_payload::text);
END;
$$;

-- ── 7. Central Authorized Writer: write_audit_event() (§8) ────────────────────
CREATE OR REPLACE FUNCTION public.write_audit_event(
  p_org_id         uuid,
  p_action         text,
  p_entity_type    text,
  p_entity_id      text,
  p_actor_id       uuid DEFAULT NULL,
  p_actor_role     public.app_role DEFAULT NULL,
  p_correlation_id uuid DEFAULT NULL,
  p_before         jsonb DEFAULT NULL,
  p_after          jsonb DEFAULT NULL,
  p_basis          jsonb DEFAULT NULL,
  p_metadata       jsonb DEFAULT '{}'::jsonb
) RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_role       public.app_role;
  v_prev_hash  text;
  v_created_at timestamptz := clock_timestamp();
  v_row_hash   text;
  v_id         bigint;
  v_meta       jsonb := coalesce(p_metadata, '{}'::jsonb);
BEGIN
  -- 1. Validate action against lookup catalog
  IF NOT EXISTS (SELECT 1 FROM public.audit_actions WHERE action = p_action) THEN
    RAISE EXCEPTION 'invalid audit action: %', p_action USING errcode = '22023';
  END IF;

  -- 2. Resolve actor and role
  IF p_actor_id IS NULL THEN
    p_actor_id := auth.uid();
  END IF;

  IF p_actor_role IS NOT NULL THEN
    v_role := p_actor_role;
  ELSIF p_actor_id IS NOT NULL THEN
    SELECT role INTO v_role FROM public.user_roles 
     WHERE user_id = p_actor_id AND org_id = p_org_id LIMIT 1;
    v_role := coalesce(v_role, 'member');
  ELSE
    v_role := 'member';
  END IF;

  -- 3. Serialize concurrent writes per organization using advisory lock
  PERFORM pg_advisory_xact_lock(hashtext('audit_lock_' || p_org_id::text));

  -- 4. Read previous row hash for this organization
  SELECT row_hash INTO v_prev_hash
    FROM public.audit_log
   WHERE org_id = p_org_id
   ORDER BY id DESC
   LIMIT 1;

  IF v_prev_hash IS NULL THEN
    v_prev_hash := 'genesis';
  END IF;

  -- 5. Calculate row hash
  v_row_hash := public.audit_row_hash(
    v_prev_hash,
    p_org_id,
    p_actor_id,
    v_role,
    p_action,
    p_entity_type,
    p_entity_id,
    p_correlation_id,
    p_before,
    p_after,
    p_basis,
    v_meta,
    1::smallint,
    v_created_at
  );

  -- 6. Insert audit record
  INSERT INTO public.audit_log (
    org_id, actor_id, actor_role, action,
    entity_type, entity_id, correlation_id,
    before, after, basis, metadata,
    hash_version, created_at, prev_hash, row_hash
  ) VALUES (
    p_org_id, p_actor_id, v_role, p_action,
    p_entity_type, p_entity_id, p_correlation_id,
    p_before, p_after, p_basis, v_meta,
    1::smallint, v_created_at, v_prev_hash, v_row_hash
  ) RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- ── 8. Chain Verifier: verify_audit_chain() (§9) ──────────────────────────────
CREATE OR REPLACE FUNCTION public.verify_audit_chain(
  p_org_id  uuid,
  p_from_id bigint DEFAULT 0
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_rec       record;
  v_last_hash text;
  v_calc_hash text;
  v_count     bigint := 0;
BEGIN
  IF p_from_id > 0 THEN
    SELECT row_hash INTO v_last_hash
      FROM public.audit_log
     WHERE org_id = p_org_id AND id = p_from_id;
    IF v_last_hash IS NULL THEN
      RETURN jsonb_build_object(
        'valid', false,
        'error', 'Checkpoint row not found for organization'
      );
    END IF;
  ELSE
    v_last_hash := 'genesis';
  END IF;

  FOR v_rec IN
    SELECT *
      FROM public.audit_log
     WHERE org_id = p_org_id AND id > p_from_id
     ORDER BY id ASC
  LOOP
    IF v_rec.prev_hash <> v_last_hash THEN
      RETURN jsonb_build_object(
        'valid', false,
        'first_bad_id', v_rec.id,
        'rows_checked', v_count,
        'error', 'Chain breakage: expected prev_hash ' || v_last_hash || ', found ' || v_rec.prev_hash
      );
    END IF;

    v_calc_hash := public.audit_row_hash(
      v_rec.prev_hash,
      v_rec.org_id,
      v_rec.actor_id,
      v_rec.actor_role,
      v_rec.action,
      v_rec.entity_type,
      v_rec.entity_id,
      v_rec.correlation_id,
      v_rec.before,
      v_rec.after,
      v_rec.basis,
      v_rec.metadata,
      v_rec.hash_version,
      v_rec.created_at
    );

    IF v_rec.row_hash <> v_calc_hash THEN
      RETURN jsonb_build_object(
        'valid', false,
        'first_bad_id', v_rec.id,
        'rows_checked', v_count,
        'error', 'Content tampering: row_hash mismatch on id ' || v_rec.id
      );
    END IF;

    v_last_hash := v_rec.row_hash;
    v_count := v_count + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'valid', true,
    'rows_checked', v_count,
    'head_id', coalesce(v_rec.id, p_from_id),
    'head_hash', coalesce(v_last_hash, 'genesis')
  );
END;
$$;

-- ── 9. Function Execution Grants ─────────────────────────────────────────────
REVOKE EXECUTE ON FUNCTION public.write_audit_event FROM public, anon;
GRANT EXECUTE ON FUNCTION public.write_audit_event TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.verify_audit_chain FROM public, anon;
GRANT EXECUTE ON FUNCTION public.verify_audit_chain TO authenticated, service_role;

-- ── 10. Audit Integration Functions & Triggers (Phase 2) ────────────────────
INSERT INTO public.audit_actions (action, category, description) VALUES
  ('review.comment_added', 'review', 'Comment added to review item')
ON CONFLICT (action) DO UPDATE SET
  category = EXCLUDED.category,
  description = EXCLUDED.description;

CREATE OR REPLACE FUNCTION public.record_simulation_run(
  p_org_id                uuid,
  p_input_regulation_text text,
  p_result_json           jsonb,
  p_run_type              text,
  p_triggered_by          uuid,
  p_correlation_id        uuid DEFAULT NULL,
  p_basis                 jsonb DEFAULT NULL,
  p_metadata              jsonb DEFAULT '{}'::jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sim_id      uuid;
  v_audit_id    bigint;
  v_role        public.app_role;
BEGIN
  INSERT INTO public.simulation_runs (
    org_id, input_regulation_text, result_json, run_type, triggered_by
  ) VALUES (
    p_org_id, p_input_regulation_text, p_result_json, p_run_type, p_triggered_by
  ) RETURNING id INTO v_sim_id;

  IF p_triggered_by IS NOT NULL THEN
    SELECT role INTO v_role FROM public.user_roles 
     WHERE user_id = p_triggered_by AND org_id = p_org_id LIMIT 1;
  END IF;
  v_role := COALESCE(v_role, 'member');

  v_audit_id := public.write_audit_event(
    p_org_id,
    'simulation.run',
    'simulation',
    v_sim_id::text,
    p_triggered_by,
    v_role,
    p_correlation_id,
    NULL,
    p_result_json,
    p_basis,
    p_metadata
  );

  IF (p_result_json->>'fallback')::boolean IS TRUE OR p_result_json->>'engine' = 'deterministic_fallback' THEN
    PERFORM public.write_audit_event(
      p_org_id,
      'simulation.fallback_activated',
      'simulation',
      v_sim_id::text,
      p_triggered_by,
      v_role,
      p_correlation_id,
      NULL,
      jsonb_build_object('fallback', true, 'engine', 'deterministic_fallback'),
      p_basis,
      p_metadata || jsonb_build_object('reason', COALESCE(p_metadata->>'fallback_reason', 'LLM unavailable or timeout'))
    );
  END IF;

  RETURN v_sim_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_audit_organizations_fn()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.deletion_scheduled_at IS NULL AND NEW.deletion_scheduled_at IS NOT NULL THEN
    PERFORM public.write_audit_event(
      NEW.id,
      'workspace.deletion_requested',
      'organization',
      NEW.id::text,
      COALESCE(NEW.deletion_requested_by, auth.uid()),
      'admin',
      NULL,
      jsonb_build_object('deletion_scheduled_at', null),
      jsonb_build_object('deletion_scheduled_at', NEW.deletion_scheduled_at, 'deletion_requested_by', NEW.deletion_requested_by),
      NULL,
      jsonb_build_object('source', 'db_trigger')
    );
  ELSIF OLD.deletion_scheduled_at IS NOT NULL AND NEW.deletion_scheduled_at IS NULL THEN
    PERFORM public.write_audit_event(
      NEW.id,
      'workspace.deletion_cancelled',
      'organization',
      NEW.id::text,
      auth.uid(),
      'admin',
      NULL,
      jsonb_build_object('deletion_scheduled_at', OLD.deletion_scheduled_at),
      jsonb_build_object('deletion_scheduled_at', null),
      NULL,
      jsonb_build_object('source', 'db_trigger')
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_organizations ON public.organizations;
CREATE TRIGGER trg_audit_organizations
AFTER UPDATE ON public.organizations
FOR EACH ROW
EXECUTE FUNCTION public.trg_audit_organizations_fn();

CREATE OR REPLACE FUNCTION public.backfill_simulation_runs(p_org_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_run RECORD;
  v_count int := 0;
  v_audit_id bigint;
  v_role public.app_role;
BEGIN
  FOR v_run IN 
    SELECT sr.id, sr.org_id, sr.input_regulation_text, sr.result_json, sr.run_type, sr.triggered_by, sr.created_at
    FROM public.simulation_runs sr
    WHERE (p_org_id IS NULL OR sr.org_id = p_org_id)
      AND NOT EXISTS (
        SELECT 1 FROM public.audit_log al
        WHERE al.org_id = sr.org_id 
          AND al.action = 'simulation.run'
          AND al.entity_id = sr.id::text
      )
    ORDER BY sr.created_at ASC, sr.id ASC
  LOOP
    IF v_run.triggered_by IS NOT NULL THEN
      SELECT role INTO v_role FROM public.user_roles 
       WHERE user_id = v_run.triggered_by AND org_id = v_run.org_id LIMIT 1;
    END IF;
    v_role := COALESCE(v_role, 'member');

    v_audit_id := public.write_audit_event(
      v_run.org_id,
      'simulation.run',
      'simulation',
      v_run.id::text,
      v_run.triggered_by,
      v_role,
      NULL,
      NULL,
      v_run.result_json,
      jsonb_build_object('source', 'historical_backfill'),
      jsonb_build_object(
        'source', 'backfill',
        'run_type', v_run.run_type,
        'original_created_at', to_char(v_run.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')
      )
    );
    v_count := v_count + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'backfilled_count', v_count,
    'status', 'completed'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_simulation_run TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.backfill_simulation_runs TO authenticated, service_role;

-- ── 11. Audit Anchoring & Tail-Deletion Protection (Phase 3) ─────────────────
CREATE TABLE IF NOT EXISTS public.audit_anchors (
  id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  org_id          UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  head_id         BIGINT NOT NULL,
  head_hash       TEXT NOT NULL,
  row_count       BIGINT NOT NULL,
  anchored_at     TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  metadata        JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS audit_anchors_org_idx 
  ON public.audit_anchors (org_id, id DESC);

DROP TRIGGER IF EXISTS trg_audit_anchors_no_update ON public.audit_anchors;
CREATE TRIGGER trg_audit_anchors_no_update
  BEFORE UPDATE ON public.audit_anchors
  FOR EACH ROW EXECUTE FUNCTION public.prevent_audit_log_mutation();

DROP TRIGGER IF EXISTS trg_audit_anchors_no_delete ON public.audit_anchors;
CREATE TRIGGER trg_audit_anchors_no_delete
  BEFORE DELETE ON public.audit_anchors
  FOR EACH ROW EXECUTE FUNCTION public.prevent_audit_log_mutation();

DROP TRIGGER IF EXISTS trg_audit_anchors_no_truncate ON public.audit_anchors;
CREATE TRIGGER trg_audit_anchors_no_truncate
  BEFORE TRUNCATE ON public.audit_anchors
  FOR EACH STATEMENT EXECUTE FUNCTION public.prevent_audit_log_mutation();

ALTER TABLE public.audit_anchors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_anchors FORCE ROW LEVEL SECURITY;

REVOKE ALL ON public.audit_anchors FROM public, anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.audit_anchors FROM authenticated;
GRANT SELECT ON public.audit_anchors TO authenticated;

DROP POLICY IF EXISTS audit_anchors_admin_select ON public.audit_anchors;
CREATE POLICY audit_anchors_admin_select ON public.audit_anchors
  FOR SELECT TO authenticated
  USING (
    org_id = public.current_org_id()
    AND public.has_role(auth.uid(), 'admin')
  );

CREATE OR REPLACE FUNCTION public.create_audit_anchor(
  p_org_id   UUID,
  p_metadata JSONB DEFAULT '{}'::jsonb
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions, pg_catalog AS $$
DECLARE
  v_head_id   BIGINT;
  v_head_hash TEXT;
  v_row_count BIGINT;
  v_anchor_id BIGINT;
  v_at        TIMESTAMPTZ := clock_timestamp();
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_org_id::text, 0));

  SELECT id, row_hash INTO v_head_id, v_head_hash
    FROM public.audit_log
   WHERE org_id = p_org_id
   ORDER BY id DESC LIMIT 1;

  IF v_head_id IS NULL THEN
    v_head_id   := 0;
    v_head_hash := 'genesis';
    v_row_count := 0;
  ELSE
    SELECT count(*) INTO v_row_count
      FROM public.audit_log
     WHERE org_id = p_org_id;
  END IF;

  INSERT INTO public.audit_anchors (
    org_id, head_id, head_hash, row_count, anchored_at, metadata
  ) VALUES (
    p_org_id, v_head_id, v_head_hash, v_row_count, v_at, coalesce(p_metadata, '{}'::jsonb)
  ) RETURNING id INTO v_anchor_id;

  RETURN jsonb_build_object(
    'anchor_id', v_anchor_id,
    'org_id', p_org_id,
    'head_id', v_head_id,
    'head_hash', v_head_hash,
    'row_count', v_row_count,
    'anchored_at', to_char(v_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.verify_audit_with_anchor(
  p_org_id UUID
) RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, extensions, pg_catalog AS $$
DECLARE
  v_chain_result    JSONB;
  v_anchor_rec      RECORD;
  v_anchored_row    RECORD;
  v_live_count      BIGINT;
  v_live_head_id    BIGINT;
BEGIN
  v_chain_result := public.verify_audit_chain(p_org_id, 0);

  IF NOT coalesce((v_chain_result->>'valid')::boolean, false) THEN
    RETURN v_chain_result;
  END IF;

  SELECT * INTO v_anchor_rec
    FROM public.audit_anchors
   WHERE org_id = p_org_id
   ORDER BY id DESC LIMIT 1;

  IF v_anchor_rec IS NULL THEN
    RETURN jsonb_build_object(
      'valid', true,
      'rows_checked', (v_chain_result->>'rows_checked')::bigint,
      'head_id', (v_chain_result->>'head_id')::bigint,
      'head_hash', v_chain_result->>'head_hash',
      'anchored', false
    );
  END IF;

  SELECT count(*), max(id) INTO v_live_count, v_live_head_id
    FROM public.audit_log
   WHERE org_id = p_org_id;

  v_live_count   := coalesce(v_live_count, 0);
  v_live_head_id := coalesce(v_live_head_id, 0);

  IF v_live_count < v_anchor_rec.row_count THEN
    RETURN jsonb_build_object(
      'valid', false,
      'error', 'Tail deletion detected: live row count (' || v_live_count || ') is less than anchored row count (' || v_anchor_rec.row_count || ')',
      'tail_tampered', true,
      'anchored_head_id', v_anchor_rec.head_id,
      'live_head_id', v_live_head_id
    );
  END IF;

  IF v_live_head_id < v_anchor_rec.head_id THEN
    RETURN jsonb_build_object(
      'valid', false,
      'error', 'Tail deletion detected: live head id (' || v_live_head_id || ') is less than anchored head id (' || v_anchor_rec.head_id || ')',
      'tail_tampered', true,
      'anchored_head_id', v_anchor_rec.head_id,
      'live_head_id', v_live_head_id
    );
  END IF;

  IF v_anchor_rec.head_id > 0 THEN
    SELECT * INTO v_anchored_row
      FROM public.audit_log
     WHERE org_id = p_org_id AND id = v_anchor_rec.head_id;

    IF v_anchored_row IS NULL OR v_anchored_row.row_hash <> v_anchor_rec.head_hash THEN
      RETURN jsonb_build_object(
        'valid', false,
        'error', 'Anchored checkpoint record missing or modified at id ' || v_anchor_rec.head_id,
        'tail_tampered', true,
        'anchored_head_id', v_anchor_rec.head_id
      );
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'valid', true,
    'rows_checked', (v_chain_result->>'rows_checked')::bigint,
    'head_id', (v_chain_result->>'head_id')::bigint,
    'head_hash', v_chain_result->>'head_hash',
    'anchored', true,
    'anchor', jsonb_build_object(
      'anchor_id', v_anchor_rec.id,
      'anchored_at', to_char(v_anchor_rec.anchored_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
      'head_id', v_anchor_rec.head_id,
      'head_hash', v_anchor_rec.head_hash,
      'row_count', v_anchor_rec.row_count,
      'tail_intact', true
    )
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_audit_anchor FROM public, anon;
GRANT EXECUTE ON FUNCTION public.create_audit_anchor TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.verify_audit_with_anchor FROM public, anon;
GRANT EXECUTE ON FUNCTION public.verify_audit_with_anchor TO authenticated, service_role;


