-- ==============================================================================
-- ClauseGraph: Audit Anchoring & Tail-Deletion Protection Migration
-- Version: 2.0 (Merged Spec §3.6)
-- Date: 2026-10-18
-- ==============================================================================

-- ── 1. Create audit_anchors Table ─────────────────────────────────────────────
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

-- ── 2. Immutability Enforcements on audit_anchors ─────────────────────────────
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

-- ── 3. Row Level Security & Access Grants ────────────────────────────────────
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

-- ── 4. Atomic create_audit_anchor() Stored Procedure ─────────────────────────
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
  -- 1. Advisory transaction lock per organization ensures point-in-time consistency
  PERFORM pg_advisory_xact_lock(hashtextextended(p_org_id::text, 0));

  -- 2. Inspect head of audit_log
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

  -- 3. Insert into audit_anchors
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

-- ── 5. verify_audit_with_anchor() Stored Procedure ───────────────────────────
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
  -- 1. Run live chain verification from genesis
  v_chain_result := public.verify_audit_chain(p_org_id, 0);

  IF NOT coalesce((v_chain_result->>'valid')::boolean, false) THEN
    RETURN v_chain_result;
  END IF;

  -- 2. Get latest anchor for this organization
  SELECT * INTO v_anchor_rec
    FROM public.audit_anchors
   WHERE org_id = p_org_id
   ORDER BY id DESC LIMIT 1;

  IF v_anchor_rec IS NULL THEN
    -- Valid chain, no anchor established yet
    RETURN jsonb_build_object(
      'valid', true,
      'rows_checked', (v_chain_result->>'rows_checked')::bigint,
      'head_id', (v_chain_result->>'head_id')::bigint,
      'head_hash', v_chain_result->>'head_hash',
      'anchored', false
    );
  END IF;

  -- 3. Check for tail-deletion or truncation against anchor
  SELECT count(*), max(id) INTO v_live_count, v_live_head_id
    FROM public.audit_log
   WHERE org_id = p_org_id;

  v_live_count   := coalesce(v_live_count, 0);
  v_live_head_id := coalesce(v_live_head_id, 0);

  -- Detection A: Live count is strictly less than anchored row count
  IF v_live_count < v_anchor_rec.row_count THEN
    RETURN jsonb_build_object(
      'valid', false,
      'error', 'Tail deletion detected: live row count (' || v_live_count || ') is less than anchored row count (' || v_anchor_rec.row_count || ')',
      'tail_tampered', true,
      'anchored_head_id', v_anchor_rec.head_id,
      'live_head_id', v_live_head_id
    );
  END IF;

  -- Detection B: Live head ID is strictly less than anchored head ID
  IF v_live_head_id < v_anchor_rec.head_id THEN
    RETURN jsonb_build_object(
      'valid', false,
      'error', 'Tail deletion detected: live head id (' || v_live_head_id || ') is less than anchored head id (' || v_anchor_rec.head_id || ')',
      'tail_tampered', true,
      'anchored_head_id', v_anchor_rec.head_id,
      'live_head_id', v_live_head_id
    );
  END IF;

  -- Detection C: Verify that the anchored head record still exists with the exact same row_hash
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

-- ── 6. Permissions ───────────────────────────────────────────────────────────
REVOKE EXECUTE ON FUNCTION public.create_audit_anchor FROM public, anon;
GRANT EXECUTE ON FUNCTION public.create_audit_anchor TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.verify_audit_with_anchor FROM public, anon;
GRANT EXECUTE ON FUNCTION public.verify_audit_with_anchor TO authenticated, service_role;
