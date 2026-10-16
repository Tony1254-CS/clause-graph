-- ============================================================================
-- ClauseGraph PostgreSQL Initialization Script
-- Self-contained production schema, RLS policies, functions, and seed data.
-- Works seamlessly in PostgreSQL 16+ (Docker or Cloud Managed).
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

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
