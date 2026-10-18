-- ============================================================================
-- Migration: 20261018_audit_events_integration.sql
-- Description: Real Business Events & Transactional Wrappers Integration (Phase 2)
-- Specification: ClauseGraph_AuditLog_EvalHarness_Spec_MERGED.md (§8, §10, §11)
-- ============================================================================

-- ── 1. Authoritative Catalog Update ──────────────────────────────────────────
INSERT INTO public.audit_actions (action, category, description) VALUES
  ('review.comment_added', 'review', 'Comment added to review item')
ON CONFLICT (action) DO UPDATE SET
  category = EXCLUDED.category,
  description = EXCLUDED.description;

-- ── 2. Atomic Simulation Record RPC (public.record_simulation_run) ────────────
-- Atomically writes to public.simulation_runs and writes audit_log event in the
-- same PostgreSQL transaction (§8.3, §8.4).
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
  v_is_fallback boolean := false;
BEGIN
  -- Insert into simulation_runs
  INSERT INTO public.simulation_runs (
    org_id, input_regulation_text, result_json, run_type, triggered_by
  ) VALUES (
    p_org_id, p_input_regulation_text, p_result_json, p_run_type, p_triggered_by
  ) RETURNING id INTO v_sim_id;

  -- Determine caller role
  IF p_triggered_by IS NOT NULL THEN
    SELECT role INTO v_role FROM public.user_roles 
     WHERE user_id = p_triggered_by AND org_id = p_org_id LIMIT 1;
  END IF;
  v_role := COALESCE(v_role, 'member');

  -- Atomic write to audit_log for simulation.run
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

  -- Check if fallback engine was activated
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

-- ── 3. Workspace Deletion Trigger on public.organizations ────────────────────
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

-- ── 4. Human Review Queue Integration with write_audit_event ──────────────────

-- 4.1 Update enqueue_review to write audit_log event
CREATE OR REPLACE FUNCTION public.enqueue_review(
  p_org_id              uuid,
  p_source_type         public.review_source,
  p_source_id           text,
  p_severity            public.review_severity,
  p_risk_score          numeric,
  p_risk_summary        text,
  p_flag_reasons        text[],
  p_engine              text,
  p_model_name          text,
  p_prompt_version      text,
  p_ai_payload          jsonb,
  p_input_snapshot      jsonb,
  p_confidence          numeric DEFAULT NULL,
  p_required_approvals  int DEFAULT 1,
  p_sla_hours           int DEFAULT 72,
  p_submitted_by        uuid DEFAULT auth.uid()
) RETURNS public.review_items
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_out_hash     text;
  v_in_hash      text;
  v_dedupe_key   text;
  v_existing     public.review_items;
  v_old_open     public.review_items;
  v_supersedes   uuid := NULL;
  v_item         public.review_items;
  v_sub_label    text := 'system';
  v_role         public.app_role := 'member';
BEGIN
  IF p_org_id IS NULL THEN
    RAISE EXCEPTION 'org_id required' USING errcode = '22023';
  END IF;

  v_out_hash := public.payload_hash(p_ai_payload);
  v_in_hash := public.payload_hash(p_input_snapshot);
  v_dedupe_key := public.sha256_hex(p_org_id::text || ':' || p_source_type || ':' || p_source_id || ':' || v_out_hash);

  -- Deduplication check
  SELECT * INTO v_existing FROM public.review_items
   WHERE dedupe_key = v_dedupe_key AND status IN ('pending_review', 'escalated')
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
    SELECT role INTO v_role FROM public.user_roles WHERE user_id = p_submitted_by AND org_id = p_org_id LIMIT 1;
    v_role := COALESCE(v_role, 'member');
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

  -- Record review_events row
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

  -- Atomic write into primary audit_log
  PERFORM public.write_audit_event(
    p_org_id,
    'review.created',
    'review_item',
    v_item.id::text,
    p_submitted_by,
    v_role,
    NULL,
    NULL,
    jsonb_build_object('severity', p_severity, 'source_type', p_source_type, 'risk_score', p_risk_score),
    jsonb_build_object('model_name', p_model_name, 'prompt_version', p_prompt_version, 'input_hash', v_in_hash, 'output_hash', v_out_hash),
    jsonb_build_object('source_id', p_source_id, 'flag_reasons', p_flag_reasons)
  );

  RETURN v_item;
END;
$$;

-- 4.2 Update decide_review to write audit_log event
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

  SELECT * INTO v_item FROM public.review_items
   WHERE id = p_id AND org_id = public.current_org_id() FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'not found' USING errcode = 'P0002';
  END IF;

  IF v_item.version <> p_expected_version THEN
    RAISE EXCEPTION 'version conflict' USING errcode = '40001';
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

    -- Atomic write into primary audit_log
    PERFORM public.write_audit_event(
      v_item.org_id,
      'review.rejected',
      'review_item',
      v_item.id::text,
      v_uid,
      'admin',
      NULL,
      jsonb_build_object('status', v_from),
      jsonb_build_object('status', 'rejected', 'reason_code', p_reason_code),
      jsonb_build_object('rationale', p_reason),
      jsonb_build_object('content_hash', coalesce(v_item.reviewed_hash, v_item.output_hash), 'self_approval', v_self)
    );

    RETURN v_item;
  END IF;

  -- Edit-and-approve
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

    -- Atomic write into primary audit_log
    PERFORM public.write_audit_event(
      v_item.org_id,
      'review.edited',
      'review_item',
      v_item.id::text,
      v_uid,
      'admin',
      NULL,
      jsonb_build_object('reviewed_hash', v_old),
      jsonb_build_object('reviewed_hash', v_new),
      NULL,
      jsonb_build_object('before_hash', v_old, 'after_hash', v_new)
    );
  END IF;

  -- Multi-approval vote counting
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
    RETURN v_item;
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

  -- Atomic write into primary audit_log
  PERFORM public.write_audit_event(
    v_item.org_id,
    'review.approved',
    'review_item',
    v_item.id::text,
    v_uid,
    'admin',
    NULL,
    jsonb_build_object('status', v_from),
    jsonb_build_object('status', 'approved', 'votes', v_votes),
    jsonb_build_object('rationale', p_reason),
    jsonb_build_object('content_hash', coalesce(v_item.reviewed_hash, v_item.output_hash), 'self_approval', v_self)
  );

  RETURN v_item;
END;
$$;

-- 4.3 Update assign_review to write audit_log event
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

  -- Atomic write into primary audit_log
  PERFORM public.write_audit_event(
    v_item.org_id,
    'review.assigned',
    'review_item',
    v_item.id::text,
    v_uid,
    'admin',
    NULL,
    jsonb_build_object('assigned_to', v_item.assigned_to),
    jsonb_build_object('assigned_to', p_user_id),
    NULL,
    '{}'::jsonb
  );

  RETURN v_item;
END;
$$;

-- 4.4 Update comment_review to write audit_log event
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
  v_role    public.app_role := 'member';
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
  SELECT role INTO v_role FROM public.user_roles WHERE user_id = v_uid AND org_id = v_item.org_id LIMIT 1;
  v_role := COALESCE(v_role, 'member');
  v_hash := public.sha256_hex(p_text);

  INSERT INTO public.review_comments (
    review_id, org_id, author_id, author_label, comment_text, comment_hash
  ) VALUES (
    v_item.id, v_item.org_id, v_uid, v_label, p_text, v_hash
  ) RETURNING * INTO v_comment;

  INSERT INTO public.review_events (
    review_id, org_id, actor_id, actor_label, event_type, payload
  ) VALUES (
    v_item.id, v_item.org_id, v_uid, v_label, 'comment_added',
    jsonb_build_object('comment_id', v_comment.id, 'comment_hash', v_hash)
  );

  -- Atomic write into primary audit_log (storing hash/redacted reference, not sensitive plaintext)
  PERFORM public.write_audit_event(
    v_item.org_id,
    'review.comment_added',
    'review_item',
    v_item.id::text,
    v_uid,
    v_role,
    NULL,
    NULL,
    jsonb_build_object('comment_id', v_comment.id, 'comment_hash', v_hash),
    NULL,
    jsonb_build_object('author_label', v_label)
  );

  RETURN v_comment;
END;
$$;

-- ── 5. Historical Backfill Stored Procedure ──────────────────────────────────
-- Safely backfills simulation_runs into public.audit_log (§11).
-- Preserves original timestamp in metadata.original_created_at.
-- Uses server-generated created_at for cryptographic chain integrity.
-- Idempotent: checks for prior backfilled row by entity_id.
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
