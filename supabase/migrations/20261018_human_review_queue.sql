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
