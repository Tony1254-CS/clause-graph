-- ============================================================================
-- Migration: Human Review Queue and Decision Audit History
-- ============================================================================

-- 1. Review Status & Action Enums
DO $$ BEGIN
  CREATE TYPE public.review_status AS ENUM (
    'PENDING_REVIEW',
    'IN_REVIEW',
    'APPROVED',
    'REJECTED',
    'NEEDS_CORRECTION'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE public.review_action AS ENUM (
    'APPROVE',
    'REJECT',
    'REQUEST_CORRECTION'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 2. Review Tasks Table
CREATE TABLE IF NOT EXISTS public.review_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  trigger_type text NOT NULL,
  risk_level text NOT NULL DEFAULT 'medium',
  status public.review_status NOT NULL DEFAULT 'PENDING_REVIEW',
  title text NOT NULL,
  description text,
  source_type text NOT NULL DEFAULT 'simulation',
  source_id text,
  original_ai_response text NOT NULL,
  corrected_content text,
  citations_snapshot jsonb DEFAULT '[]'::jsonb,
  warnings_snapshot jsonb DEFAULT '[]'::jsonb,
  assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

-- Unique index to prevent duplicate active review tasks for the same triggering event/source
CREATE UNIQUE INDEX IF NOT EXISTS idx_review_tasks_dedup 
  ON public.review_tasks (org_id, source_type, source_id, trigger_type) 
  WHERE status IN ('PENDING_REVIEW', 'IN_REVIEW', 'NEEDS_CORRECTION');

CREATE INDEX IF NOT EXISTS idx_review_tasks_org_status ON public.review_tasks (org_id, status);
CREATE INDEX IF NOT EXISTS idx_review_tasks_assigned_to ON public.review_tasks (assigned_to);
CREATE INDEX IF NOT EXISTS idx_review_tasks_created_at ON public.review_tasks (created_at DESC);

-- 3. Review Decisions Audit Log Table
CREATE TABLE IF NOT EXISTS public.review_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.review_tasks(id) ON DELETE CASCADE,
  reviewer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action public.review_action NOT NULL,
  reason text NOT NULL,
  proposed_corrections text,
  review_notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_review_decisions_task_id ON public.review_decisions (task_id);
CREATE INDEX IF NOT EXISTS idx_review_decisions_reviewer ON public.review_decisions (reviewer_id);

-- 4. Permissions & Compatibility
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    GRANT SELECT, INSERT, UPDATE ON public.review_tasks TO authenticated;
    GRANT SELECT, INSERT ON public.review_decisions TO authenticated;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT ALL ON public.review_tasks TO service_role;
    GRANT ALL ON public.review_decisions TO service_role;
  END IF;
END $$;

ALTER TABLE public.review_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_decisions ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies
DROP POLICY IF EXISTS "review_tasks_org_access" ON public.review_tasks;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE POLICY "review_tasks_org_access" ON public.review_tasks
      FOR ALL TO authenticated
      USING (org_id = public.current_org_id())
      WITH CHECK (org_id = public.current_org_id());
  ELSE
    CREATE POLICY "review_tasks_org_access" ON public.review_tasks
      FOR ALL
      USING (org_id = public.current_org_id())
      WITH CHECK (org_id = public.current_org_id());
  END IF;
END $$;

DROP POLICY IF EXISTS "review_decisions_org_access" ON public.review_decisions;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE POLICY "review_decisions_org_access" ON public.review_decisions
      FOR ALL TO authenticated
      USING (task_id IN (SELECT id FROM public.review_tasks WHERE org_id = public.current_org_id()))
      WITH CHECK (task_id IN (SELECT id FROM public.review_tasks WHERE org_id = public.current_org_id()));
  ELSE
    CREATE POLICY "review_decisions_org_access" ON public.review_decisions
      FOR ALL
      USING (task_id IN (SELECT id FROM public.review_tasks WHERE org_id = public.current_org_id()))
      WITH CHECK (task_id IN (SELECT id FROM public.review_tasks WHERE org_id = public.current_org_id()));
  END IF;
END $$;
