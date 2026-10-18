# ClauseGraph: Audit Log & Evaluation Harness (Merged Specification)

**Project:** ClauseGraph (legal-compliance graph platform)
**Features:** (A) Tamper-evident Audit Log · (B) AI Evaluation Harness (`npm run eval`)
**Version:** 2.0 (merge of the two earlier drafts, with gaps closed)
**Date:** 2026-10-18
**Status:** Ready for implementation review
**Stack:** TanStack Start server functions · Supabase Postgres (RLS) · Cloudflare Workers · GPT-4o / Gemini 2.5 Flash via AI gateway · GitHub Actions

> **How to read this document.** SQL and TypeScript are design sketches. Adapt names such as `current_org_id()`, `has_role()`, `organizations`, and the pgcrypto schema to your real project, and run every migration on staging first. Items marked **[NEW]** were missing from both source drafts. Items marked **[FIX]** corrected a defect in one of them. Appendix A explains where each part came from.

---

## Table of Contents

1. Purpose, Scope, Roles
2. Glossary
3. Feature A: Audit Log
4. Feature B: Evaluation Harness
5. How the Features Form One Trust Layer
6. Testing Strategy
7. Rollout Plan
8. Risks and Mitigations
9. Acceptance Criteria
10. Decisions Taken and Open Questions
- Appendix A: Comparison of the two source drafts
- Appendix B: Whitepaper update items

---

## 1. Purpose, Scope, Roles

ClauseGraph's AI makes judgments with legal and financial consequences. Two controls make those judgments trustworthy:

| Feature | Question it answers |
|---|---|
| **Audit log** | *Who* did *what*, *when*, *on what basis*, and can you prove the record was not altered? |
| **Evaluation harness** | *How reliable* is the AI, measured objectively, repeatably, and over time? |

Together with the Human Review Queue they answer what a General Counsel, auditor, or regulator will ask: *"Who decided this?"*, *"Can you prove it?"*, *"Why should I believe the AI?"*

### In scope
- Append-only, tamper-evident audit trail in Postgres, admin-readable, exportable (CSV and PDF)
- Command-line evaluation harness that scores the real production AI pipeline against a golden dataset and writes a report
- CI integration that blocks quality regressions and detects model drift

### Out of scope (this version)
- Third-party SIEM integration and real-time event streaming
- Fine-tuning models from eval results
- Automated deployment of generated artifacts (`artifact.deployed` is reserved for later)

### Roles
Existing roles only. No new `reviewer` role.
- `admin`: reads and exports the audit log, approves or rejects reviews, changes policy
- `member`: uses the product; cannot read the audit log (see open question 1 about self-visibility)

---

## 2. Glossary

| Term | Meaning |
|---|---|
| **Append-only** | Rows can be inserted, never updated or deleted, by any role |
| **Hash chain** | Each row's hash covers its own content plus the previous row's hash; changing or removing a middle row breaks all later links |
| **Anchor** | A copy of the chain head (id, hash, row count) stored outside the database in write-once storage |
| **Correlation ID** | One ID shared by every event in an incident's chain: simulation → review → artifact → export |
| **Golden dataset** | Versioned, human-verified inputs with expected outputs |
| **Hold-out set** | Cases never used for prompt tuning; detects overfitting |
| **Cassette** | A recorded AI response replayed in CI so runs are deterministic and free |
| **Fallback engine** | Deterministic heuristic path used when the AI gateway is unavailable |
| **Baseline** | The last accepted eval report that new runs are compared against |

---

# 3. Feature A: Audit Log

## 3.1 Goals and principles

1. **Complete.** A log with gaps is worse than none; auditors read silence as concealment.
2. **Append-only, enforced by the database,** not by application discipline.
3. **Tamper-evident,** even against someone with elevated database access (hash chain plus external anchor).
4. **Order by `id`,** never by timestamp (timestamps collide).
5. **Server-generated facts.** Timestamp and actor identity never come from the client.
6. **Corrections are new rows.** No row is ever mutated.
7. **Redact at write time.** An immutable log cannot be scrubbed later.
8. **One writer per event.** Each event type is written by exactly one mechanism (application or database trigger), never both, so there are no duplicates. **[NEW]**

## 3.2 Event catalog

Use a lookup table (not free text) so filters and reports stay reliable and new actions are added by a one-row migration.

| Category | Actions |
|---|---|
| Identity and access | `auth.login`, `auth.login_failed`, `role.granted`, `role.revoked`, `member.invited`, `member.removed` |
| Contracts | `contract.uploaded`, `contract.parsed`, `contract.clause_flagged`, `contract.deleted`, `clause.edited` |
| AI runs | `simulation.run`, `simulation.fallback_activated`, `whatif.run`, `code.generated`, `action_plan.generated`, `prediction.run` |
| Review decisions | `review.created`, `review.assigned`, `review.approved`, `review.rejected`, `review.edited`, `review.escalated`, `review.marked_stale` |
| Artifacts and exports | `artifact.generated`, `artifact.exported`, `artifact.deployed` (reserved), `action_plan.exported_pdf` |
| Governance | `policy.updated`, `workspace.deletion_requested`, `workspace.deletion_cancelled` |
| Audit itself | `audit.exported`, `audit.verified`, `audit.correction` |

`audit.verified` logs who ran an integrity check; `audit.correction` is the only way to amend the record (a new row that references the original `id`). **[NEW]**

## 3.3 Data model

```sql
create table public.audit_actions (
  action text primary key
);

create table public.audit_log (
  id             bigint generated always as identity primary key,
  org_id         uuid        not null references public.organizations(id),
  actor_id       uuid,                      -- null = system or AI engine; deliberately NO foreign key,
                                            -- so deleting a user never touches or blocks the log
  actor_role     text,                      -- role at the time of the action
  action         text        not null references public.audit_actions(action),
  entity_type    text        not null,      -- 'contract' | 'simulation' | 'review_item' | 'artifact' | ...
  entity_id      text,                      -- text: some entities are not uuids
  correlation_id uuid,                      -- first-class column so incident chains are indexable   [NEW]
  before         jsonb,                     -- redacted snapshot or small diff
  after          jsonb,
  basis          jsonb,                     -- WHY: reviewer rationale, model/prompt version,
                                            -- source-regulation hash, input/output hashes
  metadata       jsonb       not null default '{}'::jsonb,   -- request_id, ip, user_agent, source
  hash_version   smallint    not null default 1,             -- lets the hash formula evolve   [NEW]
  created_at     timestamptz not null default clock_timestamp(),
  prev_hash      text,
  row_hash       text        not null
);

create index audit_log_org_id_idx     on public.audit_log (org_id, id desc);
create index audit_log_entity_idx     on public.audit_log (org_id, entity_type, entity_id);
create index audit_log_action_idx     on public.audit_log (org_id, action, id desc);
create index audit_log_actor_idx      on public.audit_log (org_id, actor_id);
create index audit_log_corr_idx       on public.audit_log (org_id, correlation_id) where correlation_id is not null;
```

### Redaction rules
- Always strip: API keys, service-role material, auth tokens, session cookies.
- Never store full contract text in `before` / `after`. Store identifiers, field names, hashes and small diffs. The contract itself stays in its own table, which is the legal record. **[FIX]** (one draft said to keep contract text in the log, which conflicts with its own redaction rule and bloats an un-scrubbable table.)
- Strip national ID numbers and financial account numbers unless legally required.
- For AI outputs store `input_hash`, `output_hash`, `model_name`, `prompt_version`, and a reference to the stored artifact.
- A redaction helper in `audit.server.ts` runs before every write; tests assert that key-like strings never reach the table.

## 3.4 Immutability

Enforced in PostgreSQL. Revoked privileges plus triggers, because the Supabase service-role key bypasses RLS but not triggers or revoked privileges.

```sql
-- 1. No direct writes for any application role, including service_role.
revoke all on public.audit_log from anon, authenticated, service_role;
grant select on public.audit_log to authenticated;      -- still filtered by RLS

-- 2. Block UPDATE, DELETE and TRUNCATE for everyone, including the table owner.
create or replace function public.audit_log_block_mutation()
returns trigger language plpgsql as $$
begin
  raise exception 'audit_log is append-only';
end;
$$;

create trigger audit_log_no_update_delete
  before update or delete on public.audit_log
  for each row execute function public.audit_log_block_mutation();

create trigger audit_log_no_truncate
  before truncate on public.audit_log
  for each statement execute function public.audit_log_block_mutation();

-- 3. RLS: admins of the same org can read. There is NO insert policy.
alter table public.audit_log enable row level security;

create policy audit_log_admin_read on public.audit_log
  for select to authenticated
  using (
    org_id = public.current_org_id()
    and public.has_role(auth.uid(), 'admin')     -- adapt to your has_role signature
  );
```

**[FIX]** One draft used a single tenant-isolation policy with `with check` and no `for select`, which also covers INSERT. Unless INSERT is revoked, any authenticated user could forge audit rows for their own org. The design above has no write policy at all, and writes happen only through `write_audit_event()`.

**Honest limit:** a database superuser can disable triggers (for example `session_replication_role = replica`) or rewrite rows and recompute hashes. That is exactly why the external anchor in 3.6 exists. Do not describe the log as "immutable" to customers without it.

## 3.5 The single write path

All inserts go through one `SECURITY DEFINER` function. It serializes writers per org (so chain order equals `id` order) and calls one shared hash helper.

```sql
-- Shared helper: used by BOTH the writer and the verifier, so they can never drift apart.
-- Uses a JSON array as the canonical form (unambiguous, null-safe, no delimiter collisions)
-- and formats time explicitly in UTC.                                                  [FIX]
-- (Both drafts hashed created_at::text, which depends on the session TimeZone setting and
--  would produce false "tampered" results if the writer and verifier sessions differ.)
create or replace function public.audit_row_hash(
  p_prev_hash text, p_org_id uuid, p_actor_id uuid, p_actor_role text, p_action text,
  p_entity_type text, p_entity_id text, p_correlation_id uuid,
  p_before jsonb, p_after jsonb, p_basis jsonb, p_metadata jsonb,
  p_hash_version smallint, p_created_at timestamptz
) returns text
language sql
set search_path = public, extensions, pg_catalog
as $$
  select encode(
    digest(
      convert_to(
        jsonb_build_array(
          coalesce(p_prev_hash, ''), p_org_id, p_actor_id, p_actor_role, p_action,
          p_entity_type, p_entity_id, p_correlation_id,
          p_before, p_after, p_basis, p_metadata, p_hash_version,
          to_char(p_created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')
        )::text,
        'utf8'),
      'sha256'),
    'hex');
$$;

create or replace function public.write_audit_event(
  p_org_id uuid, p_actor_id uuid, p_actor_role text, p_action text,
  p_entity_type text, p_entity_id text,
  p_before jsonb default null, p_after jsonb default null,
  p_basis jsonb default null, p_metadata jsonb default '{}'::jsonb,
  p_correlation_id uuid default null
) returns bigint
language plpgsql
security definer
set search_path = public, extensions, pg_catalog
as $$
declare
  v_prev    text;
  v_now     timestamptz := clock_timestamp();
  v_hash    text;
  v_id      bigint;
begin
  -- One writer at a time per org; lock is held until the surrounding transaction ends,
  -- so chain order always matches id order.
  perform pg_advisory_xact_lock(hashtextextended(p_org_id::text, 0));

  select row_hash into v_prev
  from public.audit_log where org_id = p_org_id
  order by id desc limit 1;

  v_hash := public.audit_row_hash(
    v_prev, p_org_id, p_actor_id, p_actor_role, p_action, p_entity_type, p_entity_id,
    p_correlation_id, p_before, p_after, p_basis, p_metadata, 1::smallint, v_now);

  insert into public.audit_log
    (org_id, actor_id, actor_role, action, entity_type, entity_id, correlation_id,
     before, after, basis, metadata, hash_version, created_at, prev_hash, row_hash)
  values
    (p_org_id, p_actor_id, p_actor_role, p_action, p_entity_type, p_entity_id, p_correlation_id,
     p_before, p_after, p_basis, p_metadata, 1, v_now, v_prev, v_hash)
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.write_audit_event from public, anon, authenticated;
-- Executable only by other SECURITY DEFINER functions and trusted server code (service_role).
grant execute on function public.write_audit_event to service_role;
```

## 3.6 Verification and external anchoring

```sql
create or replace function public.verify_audit_chain(p_org_id uuid, p_from_id bigint default 0)
returns table (ok boolean, first_bad_id bigint, rows_checked bigint)
language plpgsql
security definer
set search_path = public, extensions, pg_catalog
as $$
declare
  r      record;
  v_prev text := null;
  v_n    bigint := 0;
begin
  if p_from_id > 0 then      -- incremental check from a trusted checkpoint   [NEW]
    select row_hash into v_prev from public.audit_log where org_id = p_org_id and id = p_from_id;
  end if;

  for r in select * from public.audit_log where org_id = p_org_id and id > p_from_id order by id
  loop
    if r.prev_hash is distinct from v_prev
       or r.row_hash <> public.audit_row_hash(
            r.prev_hash, r.org_id, r.actor_id, r.actor_role, r.action, r.entity_type,
            r.entity_id, r.correlation_id, r.before, r.after, r.basis, r.metadata,
            r.hash_version, r.created_at)
    then
      return query select false, r.id, v_n; return;
    end if;
    v_prev := r.row_hash;
    v_n := v_n + 1;
  end loop;

  return query select true, null::bigint, v_n;
end;
$$;
```

What the chain detects and what it does not:

| Attack | Detected by chain alone? |
|---|---|
| Edit a row | Yes |
| Delete a row in the middle | Yes (link breaks) |
| Delete the **newest** rows (truncate the tail) | **No** |
| Rewrite history and recompute every hash | **No** |

Both gaps are closed by anchoring. **[NEW: the tail-deletion gap was not mentioned in either draft.]**

### External anchoring
- A scheduled worker (daily, or hourly for high-value orgs) writes `{org_id, head_id, head_hash, row_count, anchored_at}` to write-once storage (object storage with retention lock, or a signed email/webhook to the customer).
- Verification compares the live head and row count with the latest anchor. A live head that is older than the anchor, or a smaller count, means the tail was removed.
- The nightly verification worker uses `p_from_id` = the last verified anchor, so cost stays proportional to new rows, not to total history.

## 3.7 Capture strategy: application layer plus database layer

| Layer | Mechanism | Covers |
|---|---|---|
| Application | The business action and `write_audit_event()` run in the **same Postgres transaction** (inside one RPC/function such as `approve_review()`) | Business events: simulations, reviews, uploads, code generation |
| Database | `SECURITY DEFINER` AFTER triggers call `write_audit_event()` | Sensitive governance tables, so direct SQL, migrations, and forgotten code paths are still captured: `user_roles`, workspace deletion fields, contracts |

**One writer per event (principle 8).** For `role.granted`, `role.revoked`, and `workspace.deletion_*`, only the trigger writes. For simulation, review, and export events, only the application function writes. This removes duplicates while keeping the safety net where it matters.

```sql
-- Sketch: governance trigger on user_roles (adapt column names)
create or replace function public.trg_audit_user_roles() returns trigger
language plpgsql security definer set search_path = public, extensions, pg_catalog as $$
begin
  if tg_op = 'INSERT' then
    perform public.write_audit_event(new.org_id, auth.uid(), null, 'role.granted',
      'user_role', new.user_id::text, null, to_jsonb(new) - 'created_at',
      null, jsonb_build_object('source', 'db_trigger'));
  elsif tg_op = 'DELETE' then
    perform public.write_audit_event(old.org_id, auth.uid(), null, 'role.revoked',
      'user_role', old.user_id::text, to_jsonb(old) - 'created_at', null,
      null, jsonb_build_object('source', 'db_trigger'));
  end if;
  return null;
end;
$$;
```
(`auth.uid()` is null for direct SQL; the `source` field makes that visible.)

### Atomicity rule **[FIX]**
Both drafts said "the action and its log entry commit together", but the TypeScript sketch in one of them calls the action and then calls `rpc("write_audit_event")` as a second round trip. If the second call fails, the action has already committed, so "fail the action" is not actually true.

Rules:
1. Any **state-changing database action** is a single Postgres function that performs the change and calls `write_audit_event()` internally (for example `record_simulation_run()`, `approve_review()`, `grant_role()`).
2. For actions **outside the database** (PDF export, external calls), log first with the intended action, and return the data only after the audit write succeeds. Because PDF export is client-side (jspdf), the server must record `action_plan.exported_pdf` when it releases the data, before the client generates the file.
3. The TypeScript `logAudit()` helper below is only for case 2.

```ts
// src/lib/audit.server.ts (sketch). Server-only; never import into client bundles.
export async function logAudit(evt: {
  orgId: string; actorId: string | null; actorRole: string | null;
  action: AuditAction; entityType: string; entityId?: string;
  correlationId?: string; before?: unknown; after?: unknown;
  basis?: Record<string, unknown>; metadata?: Record<string, unknown>;
}) {
  const { error } = await supabaseAdmin.rpc("write_audit_event", {
    p_org_id: evt.orgId, p_actor_id: evt.actorId, p_actor_role: evt.actorRole,
    p_action: evt.action, p_entity_type: evt.entityType, p_entity_id: evt.entityId ?? null,
    p_before: redact(evt.before) ?? null, p_after: redact(evt.after) ?? null,
    p_basis: evt.basis ?? null, p_metadata: evt.metadata ?? {},
    p_correlation_id: evt.correlationId ?? null,
  });
  if (error) throw error; // never swallow: no audit row, no action
}
```

## 3.8 Correlation IDs and AI traceability **[NEW emphasis]**

- Generate one `correlation_id` when a simulation starts. Reuse it for the resulting review item, review decision, generated artifact, and export.
- Query "full history of incident X" with one indexed lookup.
- AI events record `model_name`, `prompt_version`, `input_hash`, `output_hash`, and the cassette ID if replayed, inside `basis`. The same fields appear in eval reports (Section 4.8), so a production decision can be tied to the exact version that was evaluated.
- Fallback activations are their own event (`simulation.fallback_activated`) with the reason (gateway timeout, rate limit, invalid JSON).

## 3.9 Admin UI: `/settings/audit`

- Read-only timeline, newest first: time, actor, action, entity, summary
- Filters: date range, actor, action, entity type, entity ID, correlation ID
- "Full history of contract X" view; reuse the Review Queue event-history component
- Detail drawer with redacted `before` / `after` / `basis`
- **Verify integrity** button: runs `verify_audit_chain`, compares with the latest anchor, shows pass/fail, logs `audit.verified`
- **Export** CSV and PDF for outside counsel, SOC 2 / ISO auditors, insurers; the export itself is logged as `audit.exported`
- Cursor pagination on `id`, never offset
- API: `listAuditEvents({ entityType, entityId, correlationId, cursor })`, RLS-scoped

## 3.10 Backfill, retention, partitioning

- **Backfill** existing `simulation_runs` into `audit_log` through `write_audit_event()` (marked `metadata.source = 'backfill'`, original timestamp preserved in `metadata.original_created_at`), so the chain is valid from day one. After backfill, new runs write only through `record_simulation_run()`; `simulation_runs` may become a view. **[NEW detail: backfilled rows cannot reuse the original `created_at` inside the hash without breaking the "server-generated time" rule, so the original time is kept as metadata.]**
- **Retention:** "never deleted" is a legal guarantee, not a storage strategy. Keep for the life of the workspace; decide and document what happens at the end of the 30-day workspace deletion window (export the full chain to the customer, or retain per legal policy).
- **Legal hold:** `legal_hold boolean` on the organization blocks any purge or archival.
- **Partitioning:** start with one table and the indexes above. When growth justifies it, partition monthly by `created_at`. **Gotcha [NEW]:** a partitioned table's primary key must include the partition key, so the key becomes `(id, created_at)`, and the "last row for this org" lookup must still be served by `(org_id, id desc)` indexes on each partition. Archive cold partitions (12-18 months) to cheaper storage while keeping them queryable. Test the chain across partition boundaries.
- **Performance:** the per-org advisory lock is fine for normal volume. If one org produces very high write rates, batch low-value events.

## 3.11 Audit log: focus on and avoid

| Focus on | Avoid |
|---|---|
| Logging meaning ("approved output X, hash …, because …") | Logging only clicks |
| Action and audit row in the same transaction | Best-effort logging in a second call, or from the browser |
| Fixed action list, correlation IDs | Free-text actions, uncorrelated events |
| Redaction at write time | Copying contracts or personal data into the log |
| Hash chain **plus** external anchor before claiming tamper-evidence | Marketing "immutable" with no anchor |
| Read-only admin access, corrections as new rows | Any role that can edit or purge, any "superadmin backdoor" |
| Server-generated UTC time and identity | Client-supplied timestamps or identity claims |

---

# 4. Feature B: Evaluation Harness

## 4.1 Goals

1. Measure AI quality objectively and repeatably, with uncertainty shown.
2. Catch regressions when prompts, models, or code change, and detect upstream model drift.
3. Produce a report a General Counsel can read and an engineer can debug from.
4. Run with one command: `npm run eval`.
5. Test the **real production pipeline**, never a copy of it. A re-implemented copy drifts and the eval becomes a placebo.

## 4.2 What is evaluated

| Area | Metric | Method |
|---|---|---|
| Simulation: detection | Precision, recall, F1 of impacted contracts | Compare with labeled set |
| Simulation: high severity | **Recall on `high` only (headline metric)** | Reported separately; a missed breach is the worst failure |
| Simulation: severity | Exact and within-one-level agreement; confusion matrix | Compare with labeled severity |
| Simulation: exposure | (a) Total equals sum of impacted contract values; (b) median % error versus gold exposure | Deterministic checks |
| Evidence accuracy | Cited clause exists; quote appears verbatim in it; regulation ID exists in the ontology | Deterministic |
| Contract extraction | F1 for parties, values, clause boundaries, regulation tags | Compare with labeled clauses |
| Generated code | `terraform validate` passes; Python parses and lints; audit scripts are read-only (no write/delete SDK calls) | Tooling plus static checks |
| Predictive radar | Calibration (Brier score), band accuracy | Compare with historical amendment outcomes |
| **Review routing [NEW]** | (a) **Routing recall:** of AI outputs that were actually wrong, % sent to `pending_review`; (b) **Routing precision:** of items routed, % a human changed or rejected | Ties the eval to the Review Queue and tunes the confidence threshold |
| Reliability | JSON schema validity, fallback trigger rate, latency, cost per case, run-to-run stability | Instrumentation |

Routing recall matters because the review queue only protects users if wrong outputs actually reach it. A model can score well on accuracy while still sending its worst mistakes straight to "auto-approved".

## 4.3 Repository layout

```
evals/
├── README.md
├── config.ts                    # models, temperature, runs per case, modes
├── thresholds.ts                # per-metric warn / fail levels
├── run.ts                       # entry point for `npm run eval`
├── datasets/                    # versioned like code
│   ├── simulation/
│   │   ├── landmark.v1.json
│   │   ├── synthetic.v1.json
│   │   ├── negative.v1.json
│   │   ├── adversarial.v1.json
│   │   └── holdout.v1.json      # never used for prompt tuning
│   ├── extraction/  evidence/  codegen/  predictive/  routing/
│   └── candidates/              # review-derived cases awaiting human approval   [NEW]
├── cassettes/                   # recorded AI responses for replay
├── runners/
│   ├── run-simulations.ts       # calls the REAL simulateImpact()
│   ├── run-ingestion.ts         # calls the REAL parsing pipeline
│   ├── run-codegen.ts
│   └── run-routing.ts
├── scorers/
│   ├── detection.ts  severity.ts  exposure.ts  evidence.ts
│   ├── extraction.ts  codegen.ts  routing.ts
│   └── judge.ts                 # LLM-as-judge, fuzzy criteria only
├── reporters/
│   ├── markdown.ts  html.ts     # General-Counsel-readable
│   └── json.ts                  # committed artifact for trend charts
├── baselines/baseline.json
└── reports/<run-id>/{report.json, report.md, report.html}
```

```json
{
  "scripts": {
    "eval": "tsx evals/run.ts",
    "eval:quick": "tsx evals/run.ts --subset quick --mode replay",
    "eval:live": "tsx evals/run.ts --mode live",
    "eval:record": "tsx evals/run.ts --mode live --record",
    "eval:update-baseline": "tsx evals/run.ts --update-baseline"
  }
}
```

## 4.4 Golden dataset

Versioned JSON committed to the repository. Six classes:

| Class | Source | Purpose |
|---|---|---|
| **Landmark anchors** | Real, public enforcement outcomes (candidates from the whitepaper: Meta €1.2B GDPR 2023, Equifax $700M 2019, Grameenphone BTRC 2022) | Known real-world outcomes; credibility anchors |
| **Synthetic planted violations** | Hand-authored contracts with deliberate breaches (DPA missing SCC language, SLA breaching a 4-hour reporting window, AI-transparency clause violating the EU AI Act) | Controlled coverage across regulation family, severity, jurisdiction (EU / US / BD), clause type |
| **Negative controls** | Clean contracts and regulations that affect nothing | Must produce zero impacted contracts and zero high-severity flags |
| **Adversarial** | Ambiguous clauses, near-miss wording, conflicting jurisdictions, prompt-injection text inside a contract **[NEW]** | Robustness |
| **Hold-out** | A fixed slice of the above, never used for prompt tuning | Detects overfitting |
| **Production-derived** | Rejected or edited AI outputs from the Review Queue, **after** human approval and sanitization | The dataset improves with use |

> **Verify before use.** Each landmark fixture must carry a `source_url` and the figures must be checked against that source. The amounts above come from the project whitepaper and were not independently verified while writing this spec.

Fixture format:

```json
{
  "dataset": "simulation", "version": "1.0.0",
  "cases": [{
    "id": "sim-001",
    "class": "synthetic",
    "tags": ["gdpr", "transfer", "quick"],
    "regulation_family": "GDPR", "jurisdiction": "EU", "clause_type": "data-transfer",
    "regulation_text": "…",
    "contracts": [{ "id": "c1", "name": "…", "value": 1200000, "clauses": ["…"] }],
    "expected": {
      "impacted_contract_ids": ["c1"],
      "severity": { "c1": "high" },
      "total_exposure_usd": 1200000
    },
    "source_url": null,
    "labeled_by": "initials", "labeled_at": "2026-10-10", "reviewed_by": "initials"
  }]
}
```

Dataset rules:
- Include the seeded corpus (15 contracts, 54 clauses) and the backtest cases.
- Domain-expert verified labels; two reviewers on `high` severity labels where possible.
- Never include real customer contracts. Production-derived cases are stripped of customer data and approved by an admin first.
- **Sample size [NEW]:** the seeded corpus is small. Track the number of positives per metric (for example, count of `high` severity cases) and show it next to every score. Below a minimum (suggest 20 high-severity positives) the report labels the metric **"low sample"** rather than implying false precision.
- **Quarterly review:** regulations change, so the dataset must too. Do not let fixtures rot.

## 4.5 Runner behavior

1. Load config and datasets (filter by `--subset` or `--tag`).
2. Run each case through the **production server functions** with pinned model version and `temperature: 0`, `N` times (default 3 live; 1 in replay since cassettes are deterministic).
3. Score each run; aggregate mean, standard deviation, worst case, and a confidence interval (bootstrap or Wilson).
4. Modes:
   - `--mode replay` (default in PRs): replays cassettes. A cassette is keyed by `hash(model + prompt_version + params + input)`. **A cache miss fails the run with a "re-record needed" message; it never silently calls the live gateway.** **[NEW]**
   - `--mode live`: calls the real gateway. Cap concurrency, retry on rate limits, and enforce a **per-run cost ceiling** that aborts with a clear report if exceeded. **[NEW]**
   - `--record`: live run that refreshes cassettes.
5. **Isolation:** evals run against a dedicated eval organization. They never write to production tables or to any production org's audit chain. **[FIX: resolves a conflict between the drafts. One required running the real pipeline, the other forbade production audit entries. The real pipeline writes audit rows too, so it must run in an eval org whose entries sit in their own chain and carry `metadata.eval_run_id`.]**
6. Cases answered by the fallback engine are scored and reported **separately**, never mixed with model results; the fallback trigger rate is reported.
7. Flaky live results: retry once, then flag the case as "unstable" instead of failing the build. Unstable cases are reported with their variance.

## 4.6 Scorers

- Prefer **deterministic scorers**: set comparison, string containment, schema validation, tool execution.
- Use an **LLM judge** only for criteria code cannot check (for example "is the rationale sound"). When used, prefer a different model from the one under test, calibrate against a human-labeled sample and report agreement, and store the judge prompt version in the report.

Definitions:
- **Precision** = correctly flagged contracts / all flagged contracts
- **Recall** = correctly flagged contracts / all truly impacted contracts
- **High-severity recall** = correctly flagged high-severity contracts / all truly high-severity contracts
- **Evidence validity** = citations whose quote appears verbatim in the cited clause / all citations
- **Exposure error** = median of |simulated − gold| / gold across cases
- **Routing recall** = wrong outputs that were routed to `pending_review` / all wrong outputs

## 4.7 Thresholds and CI gate

Two tiers: `warn` is reported, `fail` blocks. Values below are starting points, to be signed off (open question 5).

```ts
// evals/thresholds.ts
export default {
  highSeverityRecall:   { warn: 0.95, fail: 0.90 },
  precision:            { warn: 0.80, fail: 0.70 },
  severityAccuracy:     { warn: 0.85, fail: 0.75 },
  exposureMedianError:  { warn: 0.30, fail: 0.50 },   // lower is better
  extractionF1:         { warn: 0.90, fail: 0.80 },
  evidenceValidity:     { warn: 0.98, fail: 0.95 },
  routingRecall:        { warn: 0.95, fail: 0.90 },
  terraformValid:       { fail: 1.0 },
  readOnlyScripts:      { fail: 1.0 },
  negativeControlHighSevFlags: { max: 0 },
  maxRegressionVsBaseline: 0.03,
};
```

- Exit code `0` when no `fail` threshold is breached; non-zero otherwise. `warn` annotates the PR.
- A regression larger than `maxRegressionVsBaseline` fails even if the absolute threshold passes.

| Trigger | Mode | Action |
|---|---|---|
| PR touching prompts, scorers, parsing, or simulation code | Replay (cassettes), quick subset | Block merge on `fail`, warn on `warn` |
| Nightly | Live, current model versions | Drift detection; alert if metrics move beyond tolerance |
| Weekly | Live, full sweep including hold-out | Trend report to the team |
| Before release | Full live run plus manual report review | Sign-off |

```yaml
name: eval
on:
  pull_request:
    paths: ["evals/**", "src/**/prompts/**", "src/**/simulation/**", "src/**/parsing/**"]
  schedule:
    - cron: "0 2 * * *"        # nightly live run
jobs:
  eval:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2           # match your lockfile (bun or npm)
      - run: bun install --frozen-lockfile
      - run: bun run eval:quick
        if: github.event_name == 'pull_request'
      - run: bun run eval:live
        if: github.event_name == 'schedule'
        env:
          AI_GATEWAY_KEY: ${{ secrets.AI_GATEWAY_KEY }}
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: eval-report
          path: evals/reports/
```

## 4.8 Report and attribution

Each run writes `report.json`, `report.md`, and `report.html`.

```json
{
  "run_id": "2026-10-18T10-00-00Z",
  "attribution": {
    "git_sha": "abc1234", "mode": "live",
    "model_versions": { "simulation": "…", "extraction": "…" },
    "prompt_versions": { "simulation": "v7", "extraction": "v3", "judge": "v1" },
    "dataset_versions": { "simulation": "1.0.0" }
  },
  "summary": {
    "simulation": {
      "high_severity_recall": { "mean": 0.95, "std": 0.02, "ci95": [0.88, 0.98], "n_positives": 14, "low_sample": true },
      "precision":            { "mean": 0.91, "std": 0.02, "ci95": [0.86, 0.94], "n": 62 }
    }
  },
  "vs_baseline": { "simulation.recall": -0.01 },
  "failed_thresholds": [], "warned_thresholds": [],
  "fallback": { "cases": 0, "rate": 0.0 },
  "cases": [{ "id": "sim-001", "scores": {}, "verdict": "pass", "notes": [] }]
}
```

Human-readable report contents:
1. Headline scores with confidence intervals and sample counts
2. Per-case verdict table: fixture, expected versus actual, pass/fail
3. Severity confusion matrix
4. Aggregate metrics against thresholds, plus trend versus previous runs
5. On regression: the exact fixture that flipped, with expected and actual output
6. The 10 worst cases with explanations
7. Latency, cost per simulation, fallback rate

Also: a CI annotation on the PR that caused a regression, and JSON artifacts retained for accuracy-over-time charts per model and prompt version. Every result carries `{model_version, prompt_version, dataset_version, git_sha}` so when accuracy moves, attribution is exact.

## 4.9 Closing the loop with the Review Queue

1. Reviewers mark each AI finding **correct / incorrect** when deciding a queue item (stored in the review decision and its audit event).
2. Rejected or edited outputs become **candidate** fixtures in `datasets/candidates/` automatically.
3. An admin or domain expert approves a candidate before it joins a golden set. **[FIX: one draft promoted labels into golden fixtures fully automatically. Unreviewed reviewer labels add label noise and can leak tuning data into the hold-out.]**
4. Candidates are sanitized of customer data. Approved ones go to the training-facing set; the hold-out only grows through a separate, deliberate step.
5. Override analytics: compare human override rates (from the audit log) with eval scores per area to see where the AI is weakest, and compare routing recall with real-world misses.

## 4.10 Evaluation harness: focus on and avoid

| Focus on | Avoid |
|---|---|
| High-severity recall reported separately, with sample counts | A single "accuracy" number |
| Variance and confidence intervals | Averages only |
| Testing the real pipeline, pinned versions, replay for determinism | Evaluating a re-implemented copy of the pipeline |
| Hold-out set and leakage discipline | Tuning prompts on cases you report on |
| Deterministic scorers first, calibrated judge second | Relying only on an LLM judge |
| Replay in CI, live nightly | Flaky live-LLM gates on every PR |
| Separate fallback results | Mixing fallback and model scores |
| Eval org, synthetic or consented data | Production tenant data, real customer contracts |
| Cost and latency tracking | Unbounded live runs |
| Quarterly dataset review | Letting fixtures rot |

---

# 5. How the Features Form One Trust Layer

| Feature | Governs | Proves |
|---|---|---|
| Human Review Queue | What may execute | Humans disposed of every consequential AI output |
| Audit Log | What happened | A tamper-evident record of every action and decision |
| Evaluation Harness | Whether the AI deserves trust | Quantified, trending accuracy with per-case evidence |

| Connection | Description |
|---|---|
| Review decisions in the audit log | `review.*` events are written to `audit_log` in the same transaction as the decision. The reviewer's rationale goes in `basis`. See decision D1 below. |
| Reviewer feedback improves evals | Rejected/edited outputs become candidate eval cases (Section 4.9) |
| Override analytics | Audit-log override rates compared with eval scores and routing recall |
| Traceability | `model_name` and `prompt_version` appear in both audit `basis` and eval reports |
| Eval isolation | Eval runs use a separate eval org with its own audit chain |
| Fallback visibility | `simulation.fallback_activated` events in production; fallback rate in eval reports |

---

# 6. Testing Strategy

## 6.1 Audit log

| Test | Pass criteria |
|---|---|
| Mutation attempts | `UPDATE`, `DELETE`, `TRUNCATE` fail as `anon`, `authenticated`, `service_role`, and the table owner |
| Forgery | An authenticated user cannot `INSERT` directly; only `write_audit_event()` works **[NEW]** |
| Tenant isolation | Org A sees zero rows of Org B (list and detail) |
| Role access | `member` cannot read; `admin` can |
| Concurrency | 10,000 rapid inserts across concurrent sessions yield a strictly increasing, fork-free chain |
| Tamper detection | Editing a row (privileged test setup) makes `verify_audit_chain` report the first bad row |
| Tail deletion | Deleting the newest rows is caught by anchor comparison **[NEW]** |
| Timezone stability | Verification passes when run from sessions with different `TimeZone` settings **[NEW]** |
| Atomicity | A failed action leaves no audit row; a failed audit write rolls back the action |
| Trigger coverage | A role granted by raw SQL appears in the log with `source = db_trigger`; no duplicate from the app layer |
| Redaction | Key-like strings and full contract text never appear in the log |
| Backfill | All historical `simulation_runs` present with correct actors; chain verifies |
| Partition boundary | Chain verifies across month partitions (once partitioned) **[NEW]** |
| Export | CSV/PDF export succeeds and logs `audit.exported` |

## 6.2 Evaluation harness

- Scorer unit tests with hand-built inputs and known outputs
- Replay run is deterministic: two runs give identical reports
- Cassette miss fails with a clear "re-record" message **[NEW]**
- Threshold test: lowering a score in a fixture makes the process exit non-zero
- Baseline comparison and `maxRegression` test
- Isolation test: an eval run creates no rows in production tables or production audit chains
- Cost-ceiling test: a live run aborts and reports when the ceiling is hit **[NEW]**
- Negative controls: a deliberately broken model stub that flags everything fails the build

---

# 7. Rollout Plan

| Step | Deliverable | Depends on |
|---|---|---|
| 1 | `audit_actions`, `audit_log`, triggers, RLS, `audit_row_hash()`, `write_audit_event()` | None |
| 2 | Convert existing state-changing actions into transactional functions that log (simulation, code generation, role changes, deletion requests, exports); governance triggers; `simulation_runs` backfill | 1 |
| 3 | Eval skeleton: runner, 10-20 golden cases (landmark + synthetic + negative), deterministic scorers, `report.md` | None (parallel with 1-2) |
| 4 | `verify_audit_chain`, nightly verification worker, `/settings/audit` UI with filters and CSV/PDF export | 1 |
| 5 | Evidence, exposure, code-validity scorers; adversarial and hold-out sets; cassette record/replay | 3 |
| 6 | CI gate: quick replay subset on relevant PRs; warn/fail thresholds; baseline | 5 |
| 7 | External anchoring of chain heads; tail-deletion check in UI and worker | 4 |
| 8 | Nightly live eval with drift alerts; LLM-judge scorers; weekly full sweep; confidence intervals | 5, 6 |
| 9 | Review Queue link: correct/incorrect labels, candidate fixtures, routing-recall scorer, override analytics | Review Queue |
| 10 | Quarterly dataset review scheduled; whitepaper updated | 8 |

---

# 8. Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Service-role key bypasses RLS | Log could be altered | Revoked privileges, triggers, hash chain, external anchor |
| Superuser disables triggers or rewrites the chain | Undetected tampering | External anchor (head id, hash, count); alert on anchor mismatch |
| Tail rows deleted | Not visible in chain | Anchored row count and head id |
| Action commits but log write fails | Gap in record | Single-transaction functions; no second-round-trip logging |
| Duplicate events (trigger and app both log) | Noisy, misleading log | One writer per event rule |
| Hash mismatch from time-zone or serialization differences | False tamper alarms | Shared `audit_row_hash()`, canonical JSON array, UTC formatting, `hash_version` |
| Sensitive data in the log | Privacy breach, cannot be scrubbed | Write-time redaction, no contract text, redaction tests |
| Unbounded log growth | Cost, slow queries | Indexes, monthly partitions (with composite PK), archival, retention policy |
| Overfitting to golden set | Misleading quality claims | Hold-out, dataset refresh, leakage rules |
| Small sample sizes | Overconfident scores | Show n and confidence intervals; "low sample" label |
| LLM-judge bias | Unreliable scores | Deterministic first; calibrate judge; different judge model |
| Flaky or costly evals | Team ignores red builds | Replay in PRs, live nightly, retry-then-flag, cost ceiling |
| Stale cassettes | Evals test old behavior | Cassette key includes prompt and model; miss fails the run |
| Weak labels | Wrong conclusions | Expert review, two reviewers on high severity |
| Unvetted reviewer labels become fixtures | Label noise, leakage | Candidate staging with admin approval |

---

# 9. Acceptance Criteria

### Audit log
- [ ] No role (including `service_role` and the table owner) can update, delete, or truncate `audit_log`
- [ ] No application role can insert directly; all inserts go through `write_audit_event()`
- [ ] State-changing actions and their log entries commit or fail together
- [ ] Each event type has exactly one writer (app or trigger); no duplicates
- [ ] Hash writer and verifier share one helper; verification is time-zone independent
- [ ] `verify_audit_chain` detects a modified row; anchor comparison detects tail deletion
- [ ] Chain heads (id, hash, count) are exported to write-once external storage on a schedule
- [ ] Only admins of the same org can read entries
- [ ] Admin UI supports filters (including correlation ID), detail view, verification, CSV and PDF export
- [ ] `simulation_runs` backfilled and chain verifies
- [ ] Retention, legal hold, and workspace-deletion behavior documented

### Evaluation harness
- [ ] `npm run eval` runs end to end and writes `report.json`, `report.md`, `report.html`
- [ ] Golden dataset includes landmark, synthetic, negative, adversarial, and hold-out cases across EU / US / BD
- [ ] Harness calls the real production functions, not copies
- [ ] High-severity recall reported separately with sample size and confidence interval
- [ ] Variance across runs reported; low-sample metrics labeled
- [ ] Review-routing recall and precision reported
- [ ] Report records git SHA, model, prompt, and dataset versions
- [ ] `warn` and `fail` thresholds work; `fail` exits non-zero; regression versus baseline enforced
- [ ] PRs run replay mode; nightly runs live with drift alerts; cassette miss fails loudly
- [ ] Eval runs never write to production data or production audit chains
- [ ] Fallback results are reported separately

---

# 10. Decisions Taken and Open Questions

## Decisions taken in this merged spec (change if you disagree)

| # | Decision | Reason |
|---|---|---|
| D1 | **One source of truth for review decisions:** `review.*` events live in `audit_log`, written inside `approve_review()` and friends. The Review Queue holds current state only; its history view reads `audit_log` filtered by entity. | Avoids two tables that can disagree. If your Review Queue spec already has a `review_events` table, keep it only as a derived view or drop it. |
| D2 | Existing roles only (`admin`, `member`) | Matches the existing RBAC feature; no `reviewer` role |
| D3 | Replay mode replaces "mock mode" | Replay exercises the real pipeline; plain mocks do not |
| D4 | Review-derived fixtures are candidates until a human approves them | Prevents label noise and leakage |
| D5 | Start unpartitioned; partition later with composite PK | Avoids early complexity |
| D6 | Eval runs in a dedicated eval org | Real pipeline + no production pollution |

## Open questions

1. Should `member` users see audit entries for their own actions?
2. How long must audit data be retained, and does it differ by customer or jurisdiction (EU / US / BD)?
3. What happens to the chain when a workspace is permanently deleted: export to customer, retain, or both?
4. Who labels and approves golden cases, and how often is the dataset refreshed? Who approves candidates from the Review Queue?
5. What are the launch thresholds, and who signs them off?
6. Which write-once storage holds chain anchors, and who owns the key or bucket?
7. Is a separate approval needed before any dataset sample derived from real documents is used?
8. Should anchors also be delivered to the customer, so they hold independent proof?

---

# Appendix A: Comparison of the two source drafts

| Aspect | Draft 1 (`clausegraph-audit-log-and-eval-harness-spec.md`) | Draft 2 (`ClauseGraph_AuditLog_EvalHarness_Spec.md`) | Merged choice |
|---|---|---|---|
| Overall character | Engineering-complete: working SQL, tests, rollout, risks, acceptance criteria, open questions | Product and domain-strong: GC framing, landmark fixtures, trust-layer story; thinner implementation | Draft 1's structure and SQL, Draft 2's domain content |
| Hash chain | Working writer + verifier, advisory lock | Described only; no concurrency control; verifier is pseudo-code | Draft 1, with time-zone and canonical-form fixes |
| Immutability | Revoke + triggers (UPDATE/DELETE/TRUNCATE) + admin-only RLS | Revoke only; one RLS policy also allows forged INSERTs | Draft 1, plus revoke from `service_role` |
| Anchoring | Yes | None | Draft 1, plus tail-deletion explanation |
| DB trigger capture layer | None | Yes (belt and suspenders) | Draft 2, with "one writer per event" rule |
| Backfill, partitioning | Partitioning mentioned; no backfill | Both | Draft 2, with composite-PK gotcha |
| `basis`, correlation ID | In metadata only | `basis` column; correlation as a principle | Both as real columns |
| Action list | Fixed enum | Informal catalog | Lookup table, merged catalog |
| Redaction | Strict (no full contract text) | Keeps contract text in the log | Draft 1 |
| Export | CSV | CSV and PDF | Both |
| Eval runner | N runs, variance, mock/live, hold-out, cache | Single run, cassettes, nightly drift | Merged (replay + live) |
| Eval dataset | General rules, negatives, adversarial, hold-out | Landmark anchors, planted violations, negative controls, jurisdictions | Merged, six classes |
| Metrics | Precision/recall, evidence validity, code validity, Brier | Exposure error, fallback rate, severity confusion matrix | Merged |
| Thresholds | Single `min` | warn / fail tiers | Draft 2's tiers + Draft 1's regression limit |
| Reports | JSON + markdown | GC-readable HTML, trends, PR annotation | Merged |
| Attribution | Pinned versions in report | `{model, prompt, fixture, sha}` | Merged |
| Review Queue link | Candidate cases from rejects | Automatic fixtures from correct/incorrect labels | Merged with human approval step |
| Process sections | Glossary, risks, acceptance, open questions | Rollout checklist | Draft 1's, extended |

**Gaps found in both drafts (now closed here):**
1. Hash input used `created_at::text`, which varies with session time zone → false tamper alarms.
2. Tail-row deletion is undetectable by a hash chain alone.
3. "Commit together" claim was not true for a two-call TypeScript flow.
4. Trigger layer plus app layer would double-log without a one-writer rule.
5. Partitioning with an identity-only primary key is not valid in Postgres.
6. Backfill cannot reuse the original timestamp inside the hash.
7. No review-routing metric, even though the Review Queue is the core safety control.
8. No sample-size or confidence-interval handling for small datasets.
9. Real-pipeline evals versus "no production audit entries" were in conflict.
10. Cassette staleness, cost ceiling, and prompt-injection test cases were absent.
11. No hash-versioning, so the formula could never change safely.
12. Landmark fixture figures need sources and verification.

---

# Appendix B: Whitepaper update items

- [ ] Add "Immutable Audit Log" and "Evaluation Harness" as new numbered features (the draft suggested 17 and 18; confirm numbering)
- [ ] Update the "Immutable Audit Logging" section to say it generalizes `simulation_runs` into a platform-wide ledger
- [ ] Describe the trust layer: Review Queue + Audit Log + Evaluation Harness
- [ ] Describe tamper-evidence honestly: hash chain **and** external anchor, not "immutable" alone
- [ ] Add the eval results summary (headline metrics with confidence intervals) once the first baseline exists
- [ ] Schedule the quarterly golden-dataset review
