-- 0003_impact_and_review.sql
-- Tenant-scoped impact assessments, full-text search, audit logging, job queue, and invitations

-- 1. Full-text search and citations on clauses
ALTER TABLE public.clauses
  ADD COLUMN IF NOT EXISTS tsv tsvector GENERATED ALWAYS AS (to_tsvector('english', text)) STORED,
  ADD COLUMN IF NOT EXISTS cited_instruments text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS char_start int,
  ADD COLUMN IF NOT EXISTS char_end int;

CREATE INDEX IF NOT EXISTS clauses_tsv_idx ON public.clauses USING gin (tsv);

-- 2. Synthetic marker on contracts
ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS is_synthetic boolean NOT NULL DEFAULT false;

-- Update existing sample contracts to is_synthetic = true
UPDATE public.contracts SET is_synthetic = true WHERE is_sample = true;

-- 3. Evidence-Backed Impact Assessments
CREATE TABLE IF NOT EXISTS public.impact_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  run_id uuid NOT NULL REFERENCES public.simulation_runs(id) ON DELETE CASCADE,
  event_id uuid REFERENCES public.regulatory_events(id),
  contract_id uuid NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  clause_id uuid NOT NULL REFERENCES public.clauses(id) ON DELETE CASCADE,
  obligation_id text REFERENCES public.obligations(id),
  verdict text NOT NULL CHECK (verdict IN ('conflict','gap','needs_update','compliant','insufficient_evidence')),
  severity text CHECK (severity IN ('low','medium','high')),
  clause_quote text NOT NULL,
  rule_quote text,
  rationale text NOT NULL,
  suggested_amendment text,
  confidence numeric CHECK (confidence BETWEEN 0 AND 1),
  origin text NOT NULL CHECK (origin IN ('deterministic','ai','human')),
  model text,
  prompt_version text,
  review_status text NOT NULL DEFAULT 'pending_review' CHECK (review_status IN ('pending_review','approved','rejected','edited')),
  reviewed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS impact_assessments_org_idx ON public.impact_assessments (org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS impact_assessments_run_idx ON public.impact_assessments (run_id);
CREATE INDEX IF NOT EXISTS impact_assessments_contract_idx ON public.impact_assessments (contract_id);
CREATE INDEX IF NOT EXISTS impact_assessments_clause_idx ON public.impact_assessments (clause_id);

-- 4. Append-Only Audit Log
CREATE TABLE IF NOT EXISTS public.audit_log (
  id bigserial PRIMARY KEY,
  org_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  action text NOT NULL,
  target_type text,
  target_id text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip inet,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_log_org_created_idx ON public.audit_log (org_id, created_at DESC);

-- Trigger to make audit_log strictly immutable (no updates or deletes allowed)
CREATE OR REPLACE FUNCTION public.prevent_audit_log_modification()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit_log is append-only: updates and deletes are prohibited.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS audit_log_immutable_trg ON public.audit_log;
CREATE TRIGGER audit_log_immutable_trg
BEFORE UPDATE OR DELETE ON public.audit_log
FOR EACH ROW EXECUTE FUNCTION public.prevent_audit_log_modification();

-- 5. Durable Background Job Queue
CREATE TABLE IF NOT EXISTS public.jobs (
  id bigserial PRIMARY KEY,
  kind text NOT NULL,
  payload jsonb NOT NULL,
  org_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','running','succeeded','failed','dead')),
  attempts int NOT NULL DEFAULT 0,
  max_attempts int NOT NULL DEFAULT 3,
  run_after timestamptz NOT NULL DEFAULT now(),
  locked_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS jobs_ready_idx ON public.jobs (status, run_after) WHERE status = 'queued';
CREATE INDEX IF NOT EXISTS jobs_org_idx ON public.jobs (org_id);

-- 6. Member Invitations Table
CREATE TABLE IF NOT EXISTS public.invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  email text NOT NULL,
  role public.app_role NOT NULL DEFAULT 'member',
  token_sha256 text NOT NULL UNIQUE,
  invited_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS invitations_org_idx ON public.invitations (org_id);
CREATE INDEX IF NOT EXISTS invitations_token_idx ON public.invitations (token_sha256);
