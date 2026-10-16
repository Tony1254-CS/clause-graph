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
  SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
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
  invited_org text;
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

-- Sample Contracts (15 Enterprise Agreements)
INSERT INTO public.sample_contracts (id, name, counterparty, value, position) VALUES
('SC-001', 'Data Processing Agreement — Helix Analytics (EU SaaS)', 'Helix Analytics BV', 12500000, 0),
('SC-002', 'Standard Contractual Clauses Addendum — Aegis Cloud',   'Aegis Cloud GmbH',   9800000, 1),
('SC-003', 'Consumer Terms of Service — EU Consumers',              'Nord Retail S.A.',   4200000, 2),
('SC-004', 'Employee Privacy Notice — EU Workforce',                'Internal — DE/FR HR', 1800000, 3),
('SC-005', 'Consumer Privacy Notice — California',                  'Internal — US Legal', 2600000, 4),
('SC-006', 'Adtech Data-Sharing Agreement — Pinecrest Media',       'Pinecrest Media Inc.', 6400000, 5),
('SC-007', 'Business Associate Agreement — Cedar Health',           'Cedar Health Systems, LLC', 15750000, 6),
('SC-008', 'Cloud Hosting Master Agreement — HealthStack',          'HealthStack Cloud, Inc.', 22000000, 7),
('SC-009', 'Broker-Dealer Recordkeeping SLA — Ridgefield Securities','Ridgefield Securities LLC', 3400000, 8),
('SC-010', 'Audit Committee Charter — Ridgefield Holdings',         'Ridgefield Holdings, Inc.', 950000, 9),
('SC-011', 'Merchant Acquiring Agreement — BengalPay Network (Synthetic)', 'BengalPay Limited (Synthetic)', 18300000, 10),
('SC-012', 'Mobile Wallet Terms of Use — Shurjomukhi Consumers (Synthetic)', 'Shurjomukhi Digital Services Ltd. (Synthetic)', 5900000, 11),
('SC-013', 'ISP Data-Retention Compliance Policy — PadmaNet Fiber (Synthetic)', 'PadmaNet Telecom Ltd. (Synthetic)', 2200000, 12),
('SC-014', 'Fixed-Term Employment Contract — Meghna Apparel (Synthetic)', 'Meghna Apparel Manufacturing Ltd. (Synthetic)', 420000, 13),
('SC-015', 'Cross-Border Support Services Agreement — BD→EU Flow (Synthetic)', 'Apex Support Services Ltd. (Synthetic) → Helix Analytics BV', 7800000, 14)
ON CONFLICT (id) DO NOTHING;

-- Sample Clauses (54 Clauses mapped to Regulatory Ontology)
INSERT INTO public.sample_clauses (id, sample_contract_id, text, linked_regs, position) VALUES
-- SC-001: DPA — GDPR-5, 33, 44
('SCL-001-0', 'SC-001', 'Processor shall process personal data only on documented instructions from Controller and only for the purposes set out in Annex I, and shall not retain personal data beyond the retention periods specified therein.', ARRAY['REG-GDPR-5'], 0),
('SCL-001-1', 'SC-001', 'Processor shall notify Controller of any personal data breach without undue delay and in any event within 24 hours of becoming aware of it, providing the information necessary for Controller to comply with its notification obligation to the competent supervisory authority within 72 hours.', ARRAY['REG-GDPR-33'], 1),
('SCL-001-2', 'SC-001', 'Any transfer of personal data by Processor to a country outside the European Economic Area shall be made only under the Standard Contractual Clauses attached as Annex III, and Processor shall carry out a transfer impact assessment prior to any such transfer.', ARRAY['REG-GDPR-44'], 2),
('SCL-001-3', 'SC-001', 'Processor shall assist Controller in demonstrating compliance with the principles of lawfulness, fairness, transparency, purpose limitation, and data minimization, and shall make available all information reasonably necessary to demonstrate such compliance.', ARRAY['REG-GDPR-5'], 3),
-- SC-002: SCC Addendum — GDPR-44
('SCL-002-0', 'SC-002', 'The parties adopt the Standard Contractual Clauses set out in Commission Implementing Decision (EU) 2021/914, Module Two (controller to processor), as incorporated herein by reference.', ARRAY['REG-GDPR-44'], 0),
('SCL-002-1', 'SC-002', 'Data importer represents that it has no reason to believe that the laws and practices in the destination country prevent it from fulfilling its obligations under these Clauses, and shall notify data exporter promptly if such circumstances change.', ARRAY['REG-GDPR-44'], 1),
('SCL-002-2', 'SC-002', 'Data importer shall implement the supplementary technical and organizational measures set out in Annex II, including end-to-end encryption of personal data in transit and pseudonymization prior to any government access request.', ARRAY['REG-GDPR-44'], 2),
-- SC-003: EU consumer ToS — GDPR-5, 33
('SCL-003-0', 'SC-003', 'We collect only the personal data strictly necessary to provide and secure the Services described in Section 2, and we retain it only for the periods disclosed in our Privacy Notice.', ARRAY['REG-GDPR-5'], 0),
('SCL-003-1', 'SC-003', 'In the event of a personal data breach that is likely to result in a risk to your rights and freedoms, we will notify the competent supervisory authority within 72 hours and, where the risk is high, notify affected users without undue delay.', ARRAY['REG-GDPR-33'], 1),
('SCL-003-2', 'SC-003', 'This Agreement shall be governed by the laws of the member state in which you have your habitual residence, without prejudice to any mandatory consumer protection provisions.', ARRAY[]::text[], 2),
-- SC-004: EU Employee Privacy Notice — GDPR-5
('SCL-004-0', 'SC-004', 'The Company processes employee personal data solely for purposes strictly necessary to the employment relationship, including payroll, benefits administration, performance management, and legal compliance, in accordance with the principle of data minimization.', ARRAY['REG-GDPR-5'], 0),
('SCL-004-1', 'SC-004', 'Special category data (such as health data collected for sick leave certification) is processed only where necessary for carrying out obligations under employment and social security law and is retained no longer than statutorily required.', ARRAY['REG-GDPR-5'], 1),
('SCL-004-2', 'SC-004', 'Employees may exercise their rights of access, rectification, erasure, and objection by contacting the Data Protection Officer at the address set forth on the Company intranet.', ARRAY[]::text[], 2),
-- SC-005: California Privacy Notice — CCPA
('SCL-005-0', 'SC-005', 'California residents have the right to direct us not to sell or share their personal information. To exercise this right, use the "Do Not Sell or Share My Personal Information" link at the footer of every page of the Service.', ARRAY['REG-CCPA-1798.120'], 0),
('SCL-005-1', 'SC-005', 'We honor opt-out preference signals transmitted through Global Privacy Control (GPC), and treat any such signal as a valid opt-out request under §1798.120 for the browser or device from which it is received.', ARRAY['REG-CCPA-1798.120'], 1),
('SCL-005-2', 'SC-005', 'We do not knowingly sell or share the personal information of consumers under 16 years of age without affirmative authorization in accordance with §1798.120(c).', ARRAY['REG-CCPA-1798.120'], 2),
('SCL-005-3', 'SC-005', 'Verifiable consumer requests may be submitted through the online request portal or by calling the toll-free number published in Section 12 of this Notice.', ARRAY[]::text[], 3),
-- SC-006: Adtech data-sharing — CCPA + GDPR-44
('SCL-006-0', 'SC-006', 'Partner may receive Site Data for the purpose of cross-context behavioral advertising as defined under the CCPA; such disclosure is deemed a "sharing" for which each user has the right to opt out.', ARRAY['REG-CCPA-1798.120'], 0),
('SCL-006-1', 'SC-006', 'Partner shall pass through and honor any opt-out preference signal, including GPC, and shall not enable downstream monetization of the affected identifier for at least 12 months.', ARRAY['REG-CCPA-1798.120'], 1),
('SCL-006-2', 'SC-006', 'Where Site Data relates to identifiable EU data subjects, Partner shall not transfer such data outside the EEA except under an adequacy decision or Standard Contractual Clauses accompanied by a documented transfer impact assessment.', ARRAY['REG-GDPR-44'], 2),
('SCL-006-3', 'SC-006', 'Partner shall provide monthly attestation reports listing the number of opt-out signals received and the corresponding suppression actions taken.', ARRAY['REG-CCPA-1798.120'], 3),
-- SC-007: BAA — HIPAA
('SCL-007-0', 'SC-007', 'Business Associate shall implement administrative, physical, and technical safeguards that reasonably and appropriately protect the confidentiality, integrity, and availability of electronic protected health information it creates, receives, maintains, or transmits on behalf of Covered Entity.', ARRAY['REG-HIPAA-SEC'], 0),
('SCL-007-1', 'SC-007', 'Business Associate shall report any Security Incident of which it becomes aware to Covered Entity within 24 hours, and shall report any Breach of Unsecured PHI without unreasonable delay and no later than 30 calendar days after discovery.', ARRAY['REG-HIPAA-SEC'], 1),
('SCL-007-2', 'SC-007', 'Business Associate shall ensure that any subcontractor that creates, receives, maintains, or transmits Electronic PHI on its behalf agrees in writing to the same restrictions and conditions that apply to Business Associate.', ARRAY['REG-HIPAA-SEC'], 2),
('SCL-007-3', 'SC-007', 'Business Associate shall encrypt Electronic PHI at rest and in transit using algorithms consistent with NIST SP 800-111 and SP 800-52, respectively.', ARRAY['REG-HIPAA-SEC'], 3),
-- SC-008: Cloud hosting — HIPAA + GDPR-33
('SCL-008-0', 'SC-008', 'Provider shall maintain SOC 2 Type II and HITRUST attestations covering all in-scope services and shall provide Customer with the latest reports upon request.', ARRAY['REG-HIPAA-SEC'], 0),
('SCL-008-1', 'SC-008', 'Provider shall notify Customer of any confirmed unauthorized access to Customer content within 6 hours of confirmation, and shall provide sufficient information for Customer to comply with its 72-hour supervisory-authority notification obligation.', ARRAY['REG-HIPAA-SEC','REG-GDPR-33'], 1),
('SCL-008-2', 'SC-008', 'Provider shall not access, use, or disclose Customer content except as necessary to maintain or provide the Services, or as required by applicable law after providing Customer with prompt notice unless legally prohibited.', ARRAY['REG-HIPAA-SEC'], 2),
('SCL-008-3', 'SC-008', 'Data at rest shall be encrypted using AES-256 with keys managed under a FIPS 140-2 Level 2 or higher validated module.', ARRAY['REG-HIPAA-SEC'], 3),
-- SC-009: Broker-dealer recordkeeping — SEC-17A4 + SOX-302
('SCL-009-0', 'SC-009', 'Service Provider shall preserve all books and records specified in Schedule A in a non-rewriteable, non-erasable format, or in an electronic recordkeeping system that maintains a complete, time-stamped audit trail of all record modifications, in either case for the periods prescribed by SEC Rule 17a-4.', ARRAY['REG-SEC-17A4'], 0),
('SCL-009-1', 'SC-009', 'Service Provider shall designate at least one executive officer who has independent access to the required records and who is authorized to promptly produce such records to the Commission upon request.', ARRAY['REG-SEC-17A4'], 1),
('SCL-009-2', 'SC-009', 'Service Provider shall provide sufficient documentation of controls over the preservation systems described herein to enable Client''s principal executive and financial officers to certify the effectiveness of Client''s disclosure controls and internal control over financial reporting.', ARRAY['REG-SOX-302','REG-SEC-17A4'], 2),
('SCL-009-3', 'SC-009', 'Service Provider shall maintain an offsite backup of preserved records that can be restored to a fully readable state within 24 hours of a documented request.', ARRAY['REG-SEC-17A4'], 3),
-- SC-010: Audit Committee Charter — SOX-302
('SCL-010-0', 'SC-010', 'The Audit Committee shall review, prior to filing, the quarterly and annual reports of the Company and the certifications required to be delivered by the principal executive officer and principal financial officer pursuant to §302 of the Sarbanes-Oxley Act.', ARRAY['REG-SOX-302'], 0),
('SCL-010-1', 'SC-010', 'The Committee shall receive from management, at least quarterly, an assessment of the design and operating effectiveness of the Company''s disclosure controls and procedures and internal control over financial reporting.', ARRAY['REG-SOX-302'], 1),
('SCL-010-2', 'SC-010', 'The Committee shall be promptly informed of any material weakness in internal control over financial reporting and any fraud, whether or not material, that involves management or other employees with a significant role in internal control.', ARRAY['REG-SOX-302'], 2),
-- SC-011: Merchant acquiring BD — BB-DPS-2023
('SCL-011-0', 'SC-011', 'Merchant shall implement transaction authentication mechanisms consistent with the Bangladesh Bank Digital Payment Security Circular, including two-factor authentication for all customer-initiated transactions above BDT 5,000.', ARRAY['REG-BB-DPS-2023'], 0),
('SCL-011-1', 'SC-011', 'Acquirer shall tokenize primary account numbers at the point of capture and shall not permit storage of full PANs on merchant systems.', ARRAY['REG-BB-DPS-2023'], 1),
('SCL-011-2', 'SC-011', 'Merchant shall report any confirmed security incident affecting the payment environment to Acquirer and to Bangladesh Bank within 6 hours of confirmation.', ARRAY['REG-BB-DPS-2023'], 2),
('SCL-011-3', 'SC-011', 'Chargebacks arising from unauthorized transactions where the merchant failed to enforce required authentication shall be borne by Merchant.', ARRAY['REG-BB-DPS-2023'], 3),
-- SC-012: Mobile wallet ToS BD — BB-DPS-2023, DSA-2018
('SCL-012-0', 'SC-012', 'Users must complete identity verification using a government-issued National ID or biometric registration in accordance with the applicable KYC guidelines before the wallet may be activated for peer transfers.', ARRAY['REG-BB-DPS-2023'], 0),
('SCL-012-1', 'SC-012', 'The Company shall implement reasonable safeguards over identity information collected in connection with wallet registration and shall not sell, transfer, or use such information for purposes other than those disclosed to the user or required by lawful authority.', ARRAY['REG-BD-DSA-2018'], 1),
('SCL-012-2', 'SC-012', 'The Company will cooperate with lawful production requests from designated investigating authorities under §26 of the Digital Security Act 2018 upon receipt of a written order specifying the identity information sought.', ARRAY['REG-BD-DSA-2018'], 2),
('SCL-012-3', 'SC-012', 'Any incident that materially affects the confidentiality or availability of user funds or credentials will be reported to Bangladesh Bank within 6 hours of confirmation.', ARRAY['REG-BB-DPS-2023'], 3),
-- SC-013: ISP data-retention policy BD — DSA-2018
('SCL-013-0', 'SC-013', 'Subscriber identity information shall be retained in accordance with statutory retention orders and shall be released only in response to a written lawful production request from an authorized officer.', ARRAY['REG-BD-DSA-2018'], 0),
('SCL-013-1', 'SC-013', 'Access to stored identity information shall be limited to a documented list of authorized personnel; all access shall be logged and reviewed monthly.', ARRAY['REG-BD-DSA-2018'], 1),
('SCL-013-2', 'SC-013', 'Copies of any material provided under §26 lawful production requests shall be retained for at least three years together with the underlying request.', ARRAY['REG-BD-DSA-2018'], 2),
-- SC-014: Fixed-term employment BD — LA-2006
('SCL-014-0', 'SC-014', 'This engagement is a permanent worker engagement within the meaning of §4 of the Bangladesh Labour Act 2006. Either party may terminate this engagement upon 120 days'' written notice, or payment of wages in lieu of such notice.', ARRAY['REG-BD-LA-2006'], 0),
('SCL-014-1', 'SC-014', 'Where termination is initiated by the Employer, the reason for termination shall be recorded in writing and communicated to the Worker.', ARRAY['REG-BD-LA-2006'], 1),
('SCL-014-2', 'SC-014', 'Statutory compensation, wages due, and any leave encashment payable to the Worker shall be deposited in the Worker''s designated bank account within 30 days of the effective date of termination.', ARRAY['REG-BD-LA-2006'], 2),
-- SC-015: Cross-border support BD→EU — LA-2006 + GDPR-44
('SCL-015-0', 'SC-015', 'Service Provider shall provide customer support services from its Dhaka delivery center to Customer''s data subjects located in the European Economic Area, on the terms set out in the applicable Statement of Work.', ARRAY[]::text[], 0),
('SCL-015-1', 'SC-015', 'Where Service Provider''s personnel access personal data of EU data subjects, such access constitutes a transfer under Article 44 GDPR and shall be governed by the Standard Contractual Clauses in Annex II supplemented by the technical measures in Annex III.', ARRAY['REG-GDPR-44'], 1),
('SCL-015-2', 'SC-015', 'Termination of any support agent engaged under this Agreement shall comply with the notice, written-reason, and dues-deposit obligations of §26 of the Bangladesh Labour Act 2006 and shall not disrupt the continuity obligations owed to Customer.', ARRAY['REG-BD-LA-2006'], 2),
('SCL-015-3', 'SC-015', 'Service Provider shall implement the pseudonymization and access-logging measures in Annex III prior to any onward transfer, whether internal or external.', ARRAY['REG-GDPR-44'], 3)
ON CONFLICT (id) DO NOTHING;

-- Backtest Cases (2 Landmark Enforcement Actions - Ground Truth Sourced)
INSERT INTO public.backtest_cases (id, company, fine_usd, case_date, regulation, summary, source, reconstructed_prompt, reconstructed_clauses, fallback, position) VALUES
('case-meta-gdpr', 'Meta Ireland', 1300000000, '2023-05-22', 'GDPR Article 46(1)', 
 'Irish DPC fined Meta €1.2B ($1.3B) and ordered suspension of transatlantic user data transfers under flawed Standard Contractual Clauses.',
 'Irish Data Protection Commission (DPC) Decision, 22 May 2023',
 'All transfers of personal data to US servers without binding supplementary technical protections preventing foreign surveillance access are void with immediate suspension mandated.',
 '[{"id":"cl-meta-1","text":"Company may transfer European user identifiers to parent servers in the United States for unified infrastructure redundancy and ad delivery."},
   {"id":"cl-meta-2","text":"Transfers rely upon EU Standard Contractual Clauses without additional localized cryptographic escrow barriers."}]'::jsonb,
 '{"summary":"Transatlantic data transfers invalidated under Schrems II doctrine.","impacts":[{"contract_id":"cl-meta-1","severity":"high","suggested_amendment":"Mandate EU-only data residency and cryptographic enclave isolation."}]}'::jsonb, 0),

('case-equifax-ccpa', 'Equifax', 700000000, '2019-07-22', 'FTC Act / Pre-CCPA Safeguards',
 'FTC, CFPB, and 50 states settled with Equifax for up to $700M over failure to patch a known Apache Struts vulnerability exposing 147M consumer records.',
 'CFPB / FTC / 50 States & Territories Settlement (2019) (FTC File No. 172 3203, CFPB Docket 2019-BCFP-0006)',
 'Covered consumer reporting entities must patch known security vulnerabilities within 30 days of discovery and maintain perimeter intrusion monitoring for all credit data stores.',
 '[{"id":"cl-eq-1","text":"Vendor provides portal hosting on Apache frameworks with quarterly maintenance and scheduled security patch review cycles."},
   {"id":"cl-eq-2","text":"Consumer credit records are stored in plaintext relational partitions accessible across internal test networks."}]'::jsonb,
 '{"summary":"Severe failure to patch known CVE vulnerability exposing sensitive consumer credit profiles.","impacts":[{"contract_id":"cl-eq-1","severity":"high","suggested_amendment":"Enforce automated critical CVE patching within 7 days and continuous penetration testing."}]}'::jsonb, 1)
ON CONFLICT (id) DO NOTHING;

