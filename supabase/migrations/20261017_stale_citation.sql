-- ============================================================================
-- Migration: 20261017_stale_citation.sql
-- Description: Stale-Citation Detector & Temporal Legal Graph (Feature 16)
-- Adds temporal tracking to regulations, historical versioning,
-- citation instance tracking, deterministic findings, audit logs, and update queue.
-- ============================================================================

-- ── 1. Extend public.regulations with Temporal Metadata ──────────────────────
DO $$ BEGIN
  -- Status column with enum-like check
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'regulations' AND column_name = 'status'
  ) THEN
    ALTER TABLE public.regulations 
      ADD COLUMN status text NOT NULL DEFAULT 'active' 
      CHECK (status IN ('active', 'amended', 'repealed', 'superseded', 'lapsed', 'renumbered'));
  END IF;

  -- Effective date range
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'regulations' AND column_name = 'effective_from'
  ) THEN
    ALTER TABLE public.regulations ADD COLUMN effective_from date;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'regulations' AND column_name = 'effective_to'
  ) THEN
    ALTER TABLE public.regulations ADD COLUMN effective_to date;
  END IF;

  -- Self-referencing lineage (text IDs matching regulations.id)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'regulations' AND column_name = 'repealed_by'
  ) THEN
    ALTER TABLE public.regulations ADD COLUMN repealed_by text REFERENCES public.regulations(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'regulations' AND column_name = 'superseded_by'
  ) THEN
    ALTER TABLE public.regulations ADD COLUMN superseded_by text REFERENCES public.regulations(id) ON DELETE SET NULL;
  END IF;

  -- Versioning & official provenance
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'regulations' AND column_name = 'current_version'
  ) THEN
    ALTER TABLE public.regulations ADD COLUMN current_version integer NOT NULL DEFAULT 1;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'regulations' AND column_name = 'official_source_url'
  ) THEN
    ALTER TABLE public.regulations ADD COLUMN official_source_url text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'regulations' AND column_name = 'gazette_reference'
  ) THEN
    ALTER TABLE public.regulations ADD COLUMN gazette_reference text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'regulations' AND column_name = 'last_verified_at'
  ) THEN
    ALTER TABLE public.regulations ADD COLUMN last_verified_at timestamptz;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_regulations_status ON public.regulations(status);
CREATE INDEX IF NOT EXISTS idx_regulations_jurisdiction ON public.regulations(jurisdiction);


-- ── 2. Create public.regulation_versions ──────────────────────────────────────
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
CREATE INDEX IF NOT EXISTS idx_regulation_versions_effective ON public.regulation_versions(regulation_id, effective_from, effective_to);


-- ── 3. Create public.citation_instances ──────────────────────────────────────
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


-- ── 4. Create public.stale_citation_findings ─────────────────────────────────
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


-- ── 5. Create public.stale_citation_scans ───────────────────────────────────
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


-- ── 6. Create public.regulation_update_queue ─────────────────────────────────
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


-- ── 7. Automation Trigger on regulation_versions ─────────────────────────────
CREATE OR REPLACE FUNCTION public.enqueue_regulation_version_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Insert into queue using NEW.regulation_id
  INSERT INTO public.regulation_update_queue (regulation_id, change_type)
  VALUES (NEW.regulation_id, COALESCE(NEW.amendment_type, 'version_update'));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_regulation_version_update ON public.regulation_versions;
CREATE TRIGGER trg_regulation_version_update
  AFTER INSERT OR UPDATE ON public.regulation_versions
  FOR EACH ROW EXECUTE FUNCTION public.enqueue_regulation_version_update();


-- ── 8. RLS and Grants ────────────────────────────────────────────────────────
ALTER TABLE public.regulation_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.citation_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stale_citation_findings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stale_citation_scans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.regulation_update_queue ENABLE ROW LEVEL SECURITY;

-- Grants
GRANT SELECT ON public.regulation_versions TO authenticated;
GRANT ALL ON public.regulation_versions TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.citation_instances TO authenticated;
GRANT ALL ON public.citation_instances TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.stale_citation_findings TO authenticated;
GRANT ALL ON public.stale_citation_findings TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.stale_citation_scans TO authenticated;
GRANT ALL ON public.stale_citation_scans TO service_role;

GRANT SELECT, INSERT, UPDATE ON public.regulation_update_queue TO authenticated;
GRANT ALL ON public.regulation_update_queue TO service_role;

-- Policies for regulation_versions (Global read)
DROP POLICY IF EXISTS "Anyone reads regulation versions" ON public.regulation_versions;
CREATE POLICY "Anyone reads regulation versions"
  ON public.regulation_versions FOR SELECT
  USING (true);

-- Policies for citation_instances (Tenant-isolated)
DROP POLICY IF EXISTS "Members read own org citation instances" ON public.citation_instances;
CREATE POLICY "Members read own org citation instances"
  ON public.citation_instances FOR SELECT TO authenticated
  USING (org_id = public.current_org_id());

DROP POLICY IF EXISTS "Members insert own org citation instances" ON public.citation_instances;
CREATE POLICY "Members insert own org citation instances"
  ON public.citation_instances FOR INSERT TO authenticated
  WITH CHECK (
    org_id = public.current_org_id()
    AND EXISTS (
      SELECT 1 FROM public.contracts c 
      WHERE c.id = contract_id AND c.org_id = public.current_org_id()
    )
    AND EXISTS (
      SELECT 1 FROM public.clauses cl 
      JOIN public.contracts c ON c.id = cl.contract_id
      WHERE cl.id = clause_id AND c.org_id = public.current_org_id()
    )
  );

DROP POLICY IF EXISTS "Members delete own org citation instances" ON public.citation_instances;
CREATE POLICY "Members delete own org citation instances"
  ON public.citation_instances FOR DELETE TO authenticated
  USING (org_id = public.current_org_id());

-- Policies for stale_citation_findings (Tenant-isolated)
DROP POLICY IF EXISTS "Members read own org stale findings" ON public.stale_citation_findings;
CREATE POLICY "Members read own org stale findings"
  ON public.stale_citation_findings FOR SELECT TO authenticated
  USING (org_id = public.current_org_id());

DROP POLICY IF EXISTS "Members insert own org stale findings" ON public.stale_citation_findings;
CREATE POLICY "Members insert own org stale findings"
  ON public.stale_citation_findings FOR INSERT TO authenticated
  WITH CHECK (org_id = public.current_org_id());

DROP POLICY IF EXISTS "Members update own org stale findings" ON public.stale_citation_findings;
CREATE POLICY "Members update own org stale findings"
  ON public.stale_citation_findings FOR UPDATE TO authenticated
  USING (org_id = public.current_org_id())
  WITH CHECK (org_id = public.current_org_id());

DROP POLICY IF EXISTS "Members delete own org stale findings" ON public.stale_citation_findings;
CREATE POLICY "Members delete own org stale findings"
  ON public.stale_citation_findings FOR DELETE TO authenticated
  USING (org_id = public.current_org_id());

-- Policies for stale_citation_scans (Tenant-isolated)
DROP POLICY IF EXISTS "Members read own org stale scans" ON public.stale_citation_scans;
CREATE POLICY "Members read own org stale scans"
  ON public.stale_citation_scans FOR SELECT TO authenticated
  USING (org_id = public.current_org_id());

DROP POLICY IF EXISTS "Members insert own org stale scans" ON public.stale_citation_scans;
CREATE POLICY "Members insert own org stale scans"
  ON public.stale_citation_scans FOR INSERT TO authenticated
  WITH CHECK (org_id = public.current_org_id());

-- Policies for regulation_update_queue
DROP POLICY IF EXISTS "Read queue items" ON public.regulation_update_queue;
CREATE POLICY "Read queue items"
  ON public.regulation_update_queue FOR SELECT TO authenticated
  USING (true);
