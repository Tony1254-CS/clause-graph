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
