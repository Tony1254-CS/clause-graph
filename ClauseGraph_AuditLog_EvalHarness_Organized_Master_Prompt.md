# MASTER IMPLEMENTATION PROMPT — CLAUSEGRAPH TAMPER-EVIDENT AUDIT LOG + AI EVALUATION HARNESS

**Source of truth:** `ClauseGraph_AuditLog_EvalHarness_Spec_MERGED(1).md` (Version 2.0, dated 2026-10-18).  
**Application:** ClauseGraph legal-compliance graph platform.  
**Target stack in the specification:** TanStack Start server functions, Supabase Postgres with RLS, Cloudflare Workers, GPT-4o / Gemini 2.5 Flash through the existing AI gateway, and GitHub Actions.

---

## QUICK START — EXECUTION MAP

Use this roadmap to implement the full specification without losing detail. The detailed requirements below remain authoritative; this roadmap organizes the order of work and the gates that must be passed.

| Phase | Workstream | Main deliverables | Required gate before continuing |
|---|---|---|---|
| **0 — Inspect and protect** | Read the full merged specification; inspect the repository, schema, auth/RBAC, Review Queue, AI pipeline, current exports, CI and workers; record Git state and baseline | Repository map, baseline results, risk list, requirement traceability matrix | Existing work preserved; baseline failures documented; no code changes made before inspection |
| **1 — Audit foundation** | Create action catalog and audit table; indexes; RLS/grants; append-only protections; canonical, versioned hash helper; central writer | Safe migrations and database-level write controls | Disposable-database migration passes; direct insert/mutation attempts fail; same-org admin read works; cross-tenant/member reads are denied |
| **2 — Capture real business events** | Enforce one writer per event; transactional functions for state-changing actions; governance triggers; correlation IDs; redaction; legacy `simulation_runs` backfill | Complete event ownership matrix and integrated audit writes | Atomicity, redaction, duplicate-prevention, event-coverage and backfill tests pass |
| **3 — Verify, anchor and expose audit history** | Chain verifier; incremental verification; scheduled anchor writer and checker; `/settings/audit`; filters, details, full entity history, cursor pagination, CSV/PDF exports; retention/legal-hold policy | Verifiable admin audit experience and operational runbook | Tamper, middle-deletion, tail-deletion, timezone, export, anchor and permission tests pass; do not claim external anchoring is live until configured and verified |
| **4 — Evaluation foundation** | Dedicated evaluation organization; CLI entry point; versioned datasets; cassettes; runners calling the real production functions; initial deterministic scorers and reports | `npm run eval`, versioned fixtures, replay mode, baseline/report skeleton | Replay is deterministic; cassette miss fails without a live call; evaluation cannot write into production tenants/chains |
| **5 — Evaluation coverage and quality gates** | Full metrics, confidence intervals/sample counts, LLM judge only for fuzzy criteria, warn/fail thresholds, baseline comparison, HTML/Markdown/JSON reports, CI replay, scheduled live drift checks, weekly full sweep | Complete evaluation and regression-gating pipeline | Scorer, thresholds, cost ceiling, fallback separation, regression, report attribution and hold-out tests pass |
| **6 — Human Review Queue integration** | Correct/incorrect labels; sanitized candidate fixtures; expert approval; routing recall/precision; override analytics; shared correlation and model/prompt attribution | Closed feedback loop without label leakage or duplicate review history | Candidates cannot enter approved datasets without approval; hold-out remains protected; review decisions have one authoritative history source |
| **7 — Final verification and rollout** | Full regression suite; security review; docs/whitepaper; staged rollout and rollback; final evidence report | Traceability matrix, test evidence, operations documentation, release recommendation | Every applicable acceptance criterion passes, or remaining blockers are clearly identified; no unsupported claims of success |

### Execution rules

1. **Do not skip Phase 0.** Do not start implementation until the source specification and existing application have been inspected and the baseline has been recorded.
2. Phases 1–3 build the audit capability. The evaluation skeleton in Phase 4 may be developed in parallel with the audit work when that does not create unsafe coupling. Follow the dependencies in the source specification.
3. Each phase is a small, reviewable change set. After each phase, inspect the diff and run its focused tests plus relevant regression tests.
4. Keep all source requirements, including `[NEW]`, `[FIX]`, decisions, acceptance criteria, and Appendices A and B, in the traceability matrix. A roadmap item never replaces a detailed requirement below.
5. Never mark a phase complete based only on code existing. A phase is complete only when its applicable verification gate has actually been run and evidence recorded.
6. Treat missing external services, credentials, storage, approvals, or schedule configuration as deployment blockers or explicit limitations. Do not simulate them and report them as configured.

---

## 0. Role, Mission, and Definition of Done

Act as a Principal Software Architect, senior full-stack engineer, PostgreSQL/Supabase security engineer, AI evaluation engineer, DevSecOps engineer, and QA lead. Implement the two connected capabilities described in the source specification:

1. **Feature A — Tamper-Evident Audit Log:** a tenant-isolated, append-only, redacted, verifiable, admin-readable and exportable audit history.
2. **Feature B — AI Evaluation Harness:** a reproducible CLI that evaluates the actual production AI pipeline against versioned, human-verified golden datasets, produces actionable reports, blocks quality regressions in CI, and detects model drift over time.

Integrate both features with the existing Human Review Queue to create one trust layer answering: who did what, when, and on what basis; whether the record has been tampered with; and whether the AI is reliable enough for its use case.

**Definition of done:** all applicable source-specification requirements, including `[NEW]` and `[FIX]` items, are traceable to implementation and verification evidence; the implementation works end to end in the real application; security and tenant isolation are enforced server-side and in Postgres; the test suite and production build have been run; new regressions are resolved; rollout and rollback steps are documented; and limitations/open decisions are reported honestly.

Do not stop at a UI mockup, isolated database schema, sample runner, or a reimplementation of the AI pipeline. Implement the complete feature within the real repository.

## 1. Mandatory Source-Specification Discipline

1. Read the entire source specification, including its glossary, event catalog, SQL/TypeScript/YAML sketches, evaluation layout and metrics, testing strategy, rollout plan, risks, acceptance criteria, decisions, open questions, Appendix A, and Appendix B.
2. Treat the source spec as the primary authority. Do not silently discard, weaken, or simplify a requirement.
3. SQL and TypeScript snippets are **design sketches**, not blindly copyable migrations. Adapt object names, `current_org_id()`, `has_role()`, `organizations`, pgcrypto/extension schema, existing role checks, and framework-specific integrations to the actual repository.
4. Preserve all `[NEW]` and `[FIX]` corrections. Explicitly verify the twelve gaps listed in Appendix A: timezone-stable hashing; external-anchor detection of tail deletion; atomic action-plus-audit transactions; one writer per event; partitioned-primary-key constraint; safe backfill timestamps; review-routing metrics; sample-size/confidence intervals; eval isolation; cassette staleness/cost ceiling/prompt injection; hash versioning; and verified landmark sources.
5. Do not invent source-backed facts where the specification leaves a question open. Record assumptions, trade-offs, and any unresolved decision. Use conservative, documented defaults when work can safely proceed without a product decision.

## 2. Absolute Existing-Codebase Protection Contract

**The new features must not unnecessarily destabilize, weaken, or break existing ClauseGraph behavior.** Before editing code, inspect the real repository and prove compatibility as you implement.

### 2.1 Reconnaissance before implementation

Inspect and map:

- Repository structure, framework version, application entry points, TanStack Start routes/server functions, and existing API contracts.
- Existing Supabase schemas, migrations, SQL functions, triggers, indexes, grants, RLS policies, organizations/tenant model, and service-role access.
- Current authentication and RBAC; use the existing `admin` and `member` roles. Do not create a `reviewer` role.
- Human Review Queue state transitions, decision storage, event history, and approval functions. Identify any existing `review_events` usage and its consumers before deciding whether it should remain, become a derived view, or be retired. Do not drop or alter it until all dependencies and migration safety are established.
- `simulation_runs` schema, writers, readers, reports, and any code that depends on its current shape.
- Simulation and `simulateImpact()` flow; contract ingestion/parsing/extraction; evidence generation; code generation; predictive radar; Action Plan generation and PDF export; fallback engine; existing AI gateway, model and prompt versioning, retries, and validation.
- Existing audit/logging utilities and where each action currently commits.
- Background/scheduled-worker facilities, Cloudflare Workers constraints, storage integrations, GitHub Actions, current package manager and lockfile, and secrets conventions.
- UI layouts, navigation, access guards, design system, reporting/export utilities, and test conventions.

Do not assume a function, table, or path from the example layouts exists as written. Trace actual production call paths.

### 2.2 Baseline and change safety

Before changing files:

1. Record branch, working-tree status, current commits, and user-owned/uncommitted changes.
2. Do not reset, discard, overwrite, or reformat unrelated changes.
3. Run and record the current relevant tests, type checks, lint, build, and migration checks where available. Distinguish pre-existing failures from new failures.
4. Record current behavior and interfaces for simulation, review decisions, exports, roles, and tenant access.
5. Build a requirements traceability matrix with: requirement ID/source section, implementation location, migration/API/UI impact, test, result, and any exception.
6. Establish a list of potential regression surfaces and how each will be tested.

### 2.3 Non-negotiable boundaries

- Prefer additive, scoped migrations and isolated modules. Reuse existing utilities and UI components where appropriate.
- Preserve existing routes, request/response shapes, database contracts, user flows, permissions, and outputs unless a source-spec requirement demands a documented change.
- No unrelated refactors, broad rewrites, framework changes, package-manager changes, or dependency upgrades merely for convenience.
- Never weaken RLS, broaden authorization, expose a privileged database function, put server-only code in client bundles, or expose service-role credentials.
- Never hardcode production secrets, tenant IDs, or user IDs.
- Never run destructive operations against production or shared environments. Do not reset databases, drop tables/columns, truncate customer data, rewrite applied migration history, or remove dependencies as a shortcut.
- Run migrations in a disposable local or isolated development database first, then verify in staging before production rollout.
- Protect existing work; prefer a feature branch and small, reviewable commits if repository workflow allows.
- If a requested change could destroy data, break an API contract, compromise security, or affect unrelated workflows, stop that specific change, investigate, and choose a safer compatible migration. Do not hide or silently work around the risk.

### 2.4 Existing-codebase regression gate

After each meaningful phase, rerun the focused tests and inspect the diff. At the end, rerun all baseline checks. For each baseline failure, demonstrate whether it existed before or was introduced by this implementation. Do not claim “no impact” simply because the application starts: support the claim with tests, schema/access checks, build results, and a documented diff.

---

## 3. Scope and Explicit Non-Goals

### In scope

- Append-only, tamper-evident Postgres audit trail.
- Admin-read-only audit timeline, filters, event details, integrity verification, and CSV/PDF exports.
- A CLI that evaluates the real AI production pipeline against a golden dataset and writes machine-readable and human-readable reports.
- CI gates that block quality regressions and scheduled runs that detect model drift.
- Integration with the Human Review Queue, review labels, candidate fixtures, routing recall/precision, override analytics, and correlation-based traceability.
- Documentation, staging-tested migrations, rollout, monitoring, and rollback procedures.

### Out of scope for this version

- Third-party SIEM integration or real-time event streaming.
- Fine-tuning models from evaluation results.
- Automated deployment of generated artifacts. Keep `artifact.deployed` reserved for later.

### Roles

Use existing roles only:

- `admin`: may read and export audit records for their own organization, run/see integrity verification, approve/reject review items, and change policy according to existing authorization rules.
- `member`: uses the application but cannot read the audit log in this version. The open question about self-visibility must remain documented; do not silently grant access.

---

# PART A — TAMPER-EVIDENT AUDIT LOG

## 4. Audit-Log Principles

Implement all eight principles:

1. **Complete:** missing records undermine the audit value.
2. **Database-enforced append-only:** not merely an application convention.
3. **Tamper-evident:** hash chain plus an external anchor, including detection of newest-row deletion.
4. **Order by audit `id`, never timestamp.** Timestamps can collide.
5. **Server-generated facts:** timestamps and actor identities are not trusted from clients.
6. **Corrections are new rows** referencing the original record; never mutate a previous event.
7. **Redact at write time:** immutable logs cannot later be scrubbed.
8. **One writer per event type:** exactly one mechanism—application transaction or database trigger—writes a given event type, preventing duplicates.

## 5. Audit Event Catalog

Create `audit_actions` as an authoritative lookup table. Do not accept arbitrary free-text action values. Add future actions with a migration that inserts a row into the lookup table.

Support the complete source event catalog:

- **Identity and access:** `auth.login`, `auth.login_failed`, `role.granted`, `role.revoked`, `member.invited`, `member.removed`.
- **Contracts:** `contract.uploaded`, `contract.parsed`, `contract.clause_flagged`, `contract.deleted`, `clause.edited`.
- **AI runs:** `simulation.run`, `simulation.fallback_activated`, `whatif.run`, `code.generated`, `action_plan.generated`, `prediction.run`.
- **Review decisions:** `review.created`, `review.assigned`, `review.approved`, `review.rejected`, `review.edited`, `review.escalated`, `review.marked_stale`.
- **Artifacts and exports:** `artifact.generated`, `artifact.exported`, `artifact.deployed` (reserved, not currently implemented as a deployment workflow), `action_plan.exported_pdf`.
- **Governance:** `policy.updated`, `workspace.deletion_requested`, `workspace.deletion_cancelled`.
- **Audit itself:** `audit.exported`, `audit.verified`, `audit.correction`.

`audit.verified` records who ran an integrity check. `audit.correction` is the only permitted correction mechanism: insert a new event that references the original audit `id` and explains the correction. Preserve this distinction between adding a correction and editing history.

For each event, document its owning writer and required redacted payload. Ensure all supported high-consequence event paths are captured, including role changes, workspace-deletion requests/cancellations, simulation runs, fallback activation, reviews, generated artifacts, relevant exports, and governance changes.

## 6. Audit Data Model, Indexes, and Redaction

Implement/adapt `public.audit_actions` and `public.audit_log` to the actual schema. Preserve these data semantics:

- `id`: generated audit ID used for chain order.
- `org_id`: required organization/tenant reference.
- `actor_id`: nullable for system/AI actors; deliberately no user foreign key, so removing a user never cascades to or blocks historical evidence.
- `actor_role`: role at event time.
- `action`: required foreign key to `audit_actions`.
- `entity_type`, `entity_id`: identify the affected entity; `entity_id` is text because not every entity key is a UUID.
- `correlation_id`: first-class nullable UUID shared by an incident's chain of events.
- `before`, `after`: redacted snapshots or small diffs.
- `basis`: rationale/context including reviewer rationale, model/prompt version, source-regulation hash, and input/output hashes as relevant.
- `metadata`: non-null JSON object defaulting to `{}` for request ID, source, safe IP/user-agent metadata, backfill markers, cassette ID, evaluation run ID, and other safe metadata.
- `hash_version`: version of the canonical hashing formula.
- `created_at`: server-generated `timestamptz`.
- `prev_hash`, `row_hash`: chain linkage and current row digest.

Create and validate the source-described indexes, adapted to the actual schema:

- `(org_id, id DESC)`.
- `(org_id, entity_type, entity_id)`.
- `(org_id, action, id DESC)`.
- `(org_id, actor_id)`.
- Partial `(org_id, correlation_id)` where `correlation_id IS NOT NULL`.

### Redaction requirements

- Never log API keys, service-role material, auth tokens, session cookies, or equivalent secrets.
- Never store full contract text in audit `before`/`after`. Store identifiers, field names, hashes, and small diffs. The contract remains in its canonical business table/legal record.
- Strip national ID numbers and financial-account numbers unless there is a documented legal requirement to retain them.
- For AI output, record `input_hash`, `output_hash`, `model_name`, `prompt_version`, and a reference to the stored artifact instead of unnecessarily duplicating the payload.
- Apply a server-only redaction helper (for example `audit.server.ts`) before every application-level write. Ensure database-trigger payloads also obey a defined redaction/allowlist policy.
- Add tests proving key-like strings, tokens, full contract text, and disallowed personal/financial data do not reach the audit table.
- Never place secrets or raw customer contracts in fixtures, reports, cassettes, logs, or committed golden datasets.

## 7. Database-Enforced Append-Only Security

Enforce append-only behavior in PostgreSQL, not only through UI restrictions:

- Revoke direct table write privileges from `anon`, `authenticated`, and `service_role` as required by the actual Supabase permission model. Do not accidentally leave any route for direct application-role `INSERT`.
- Block `UPDATE`, `DELETE`, and `TRUNCATE` through database triggers, including attempts from privileged application paths and the table owner to the extent the platform permissions and trigger execution model permit.
- Enable RLS. Provide a `SELECT` policy only for an `admin` of the same organization, using the real tenant and RBAC helpers. There must be no insert policy.
- Use a carefully constrained `SECURITY DEFINER` writer with a safe `search_path`, minimal privileges, explicit validation, and execution grants only for trusted server/database pathways.
- Confirm which operations still remain possible to an actual database superuser. Do not claim absolute immutability: a sufficiently privileged superuser may disable triggers or rewrite data and recompute hashes. The external anchor is required to detect such historical rewrite/tail-removal scenarios.
- Ensure no client can supply a trusted actor identity, tenant identity, role, or timestamp without server-side validation.
- Add tests for direct insert forgery, cross-tenant list/detail queries, member access denial, admin access, mutation attempts, and function privilege boundaries.

## 8. Canonical Hash Chain and the Single Write Path

Implement one shared `audit_row_hash()` helper used by both writer and verifier. Both must use identical canonical serialization and hash-version rules.

### Canonical hashing requirements

- Use an unambiguous, null-safe canonical form (the source sketch uses a JSON array rather than concatenated delimited strings).
- Hash the event fields in a stable order, including the previous hash, org, actor, role, action, entity identifiers, correlation ID, redacted `before`/`after`, `basis`, metadata, hash version, and server timestamp.
- Format the timestamp explicitly in UTC with stable precision (the source sketch uses `YYYY-MM-DD"T"HH24:MI:SS.US"Z"`). Never hash session-dependent `created_at::text`.
- Use a documented cryptographic digest (the source sketch uses SHA-256) and a stable text encoding.
- Persist `hash_version`, and ensure the verifier can interpret the version. Do not silently change a hash formula under an existing version.
- Serialize concurrent writes per organization using a transaction-scoped advisory lock or a verified equivalent, so the chain is ordered consistently with audit IDs and cannot fork.

### Single approved writer

Implement `write_audit_event()` (or an equivalent trusted database function) as the central writer. It must:

1. Validate the action against `audit_actions` and validate required inputs.
2. Acquire the per-org transaction lock.
3. Read the previous row hash for that organization in ID order.
4. Obtain a server-generated UTC timestamp.
5. Compute the hash using the shared helper.
6. Insert the audit row and return its ID.
7. Redact or reject sensitive inputs before persistence.

Restrict direct execution using minimal grants. Ensure trusted business functions can call it without opening a client-callable forgery path. Adapt service-role access thoughtfully: Supabase's service role bypasses RLS but does not, by itself, make a secure append-only design; explicit grants and triggers still matter.

### Atomicity rule — mandatory

**State-changing database actions and their audit row must commit or fail in the same PostgreSQL transaction.** Create/modify database RPCs such as `record_simulation_run()`, `approve_review()`, role-management functions, and deletion-request functions so the business change and audit write happen within that function/transaction. Do not perform a business mutation and then send a separate application round trip to write the audit record.

If audit insertion fails, the state change must roll back. If the state change fails, the corresponding audit event must not persist.

For external/client-generated outputs such as a PDF:

- Log the intended export server-side and release the export data only after the audit write succeeds.
- The source specifically notes that Action Plan PDF generation uses client-side `jspdf`; record `action_plan.exported_pdf` server-side when the server releases the data, before the client generates/downloads the file.
- `logAudit()` in server-only TypeScript is for such external actions, not a substitute for atomic transactional database functions.
- Never swallow audit errors or allow a consequential action to succeed without its mandatory event.

### One-writer-per-event rule

- Use database triggers as the only writer for governance events including `role.granted`, `role.revoked`, and `workspace.deletion_*`, with coverage for raw SQL or forgotten application paths.
- Use application/database business functions as the only writer for application-owned events including simulations, reviews, uploads, code generation, and exports, according to a documented event ownership matrix.
- Do not have a trigger and application function both emit the same event. Test that no duplicate is written.
- Trigger events should identify `source = db_trigger` where appropriate. `auth.uid()` may be null for direct SQL; represent that honestly rather than fabricating an actor.

## 9. Chain Verification and External Anchoring

Implement `verify_audit_chain(org_id, from_id)` or its equivalent. It should return at least verification status, first bad audit ID, and number of rows checked. It must:

- Recompute each row hash via the shared canonical helper.
- Check each row's `prev_hash` against the preceding row hash.
- Process rows in `id` order.
- Support incremental verification from a trusted checkpoint/anchor without treating an unverified checkpoint as trusted.
- Be timezone independent.
- Make integrity failures observable and auditable.

### What hash chaining alone cannot prove

A hash chain detects row edits and deletion of a middle row, but it does **not** by itself detect deletion of the newest tail rows or a complete history rewrite followed by recomputation. Do not market the chain alone as immutable or fully tamper-proof.

### External anchors are required

Implement a scheduled worker (daily by default, optionally hourly for high-value organizations) that writes a trustworthy chain checkpoint to write-once/external storage. Each anchor must preserve:

`{ org_id, head_id, head_hash, row_count, anchored_at }`

Use an appropriate write-once/retention-locked object-storage mechanism or the documented signed customer-delivery mechanism selected for the project. The selected storage provider remains an open deployment decision unless one already exists in the repository. Do not pretend an anchor exists until it is configured and tested.

Verification compares the live chain head and count to the latest trusted anchor. A live head older than the anchor, a smaller count, a mismatched head hash, or an otherwise invalid anchored chain must be reported as a tampering/integrity alert. Nightly verification should start at the last **verified** anchor so work is proportional to new entries. Protect anchor credentials and signing keys; define access, retention, alerting, and ownership.

## 10. Correlation IDs and Traceability

- Generate one `correlation_id` when a simulation begins.
- Reuse it through the simulation, resulting review item, reviewer decision, generated artifact, and export.
- Support an indexed query for the complete history of an incident/correlation ID.
- Include `model_name`, `prompt_version`, `input_hash`, `output_hash`, and cassette ID when replayed in AI event `basis`/metadata as appropriate.
- Use compatible attribution fields in evaluation reports so a production decision can be connected to the version that was evaluated.
- Emit `simulation.fallback_activated` as a separate action and record the reason, such as gateway timeout, rate limit, or invalid JSON.

## 11. Capture Coverage, Backfill, Retention, and Scale

### Capture coverage

Create an event-to-writer matrix covering all applicable catalog actions and actual production call paths. Prioritize all consequential changes, including simulation, fallback activation, review decisions, roles, member lifecycle, contract lifecycle, generated outputs, exports, governance changes, and audit verification/export itself.

For sensitive governance tables such as `user_roles`, workspace deletion fields, and contracts, use carefully designed `SECURITY DEFINER AFTER` triggers where the source calls for database-layer capture. Ensure triggers use safe search paths, allowlisted snapshots, correct organization resolution, and the one-writer rule.

### Historical simulation backfill

- Backfill existing `simulation_runs` through `write_audit_event()` so the historical chain is valid from day one.
- Mark backfilled entries with `metadata.source = 'backfill'` and preserve original event time in `metadata.original_created_at`.
- Use server-generated `created_at` for the new audit-row hash; do not reuse the original simulation timestamp as the audit record's hash timestamp.
- Preserve actor information correctly where available. Do not fabricate missing historical actors.
- Verify row counts and chain integrity before and after backfill; make the operation repeat-safe/idempotent without creating duplicates.
- For new runs, use the approved transactional path such as `record_simulation_run()`. Changing `simulation_runs` into a view is an optional possible future migration, not an automatic destructive change; do it only after inspecting dependencies and proving compatibility.

### Retention and legal hold

- Keep records for the life of the workspace unless a documented legal policy says otherwise.
- Add/implement organization `legal_hold` behavior that blocks any purge or archival prohibited by the hold.
- Document what happens after the source's 30-day workspace-deletion window: export the full chain to the customer, retain it under legal policy, or both. This policy is an open question and must not be silently assumed.
- Do not implement “never delete” as a slogan without a workable retention and storage plan.

### Partitioning and performance

- Begin with one table and the specified indexes; do not partition prematurely.
- If growth later justifies monthly partitioning by `created_at`, account for PostgreSQL's requirement that a partitioned table's primary key include the partition key (for example `(id, created_at)`). Preserve per-org ordered lookups with `(org_id, id DESC)` indexes on partitions.
- Keep chain verification valid across partition boundaries; test it before partitioning is enabled.
- Plan queryable archival for cold partitions after approximately 12–18 months when volume warrants it.
- The per-org advisory lock is acceptable for ordinary volume. If a tenant becomes exceptionally high-volume, evaluate batching for low-value events without weakening chain integrity or event completeness.

## 12. Admin Audit UI and API

Implement the read-only admin page at `/settings/audit` within existing route/layout/access patterns.

Required UI:

- Read-only, newest-first timeline showing time, actor, action, entity, and concise summary.
- Filters for date range, actor, action, entity type, entity ID, and correlation ID.
- “Full history of contract X”/entity history using the same correlated audit records; reuse the existing Review Queue event-history component where compatible.
- Detail drawer/page showing redacted `before`, `after`, and `basis`.
- “Verify integrity” action that runs the chain verifier and compares the live chain with the latest external anchor; show clear pass/fail, checked row count, first bad ID where relevant, and anchor status.
- Log the verification action as `audit.verified` without accidentally creating a recursive or duplicated verification loop.
- CSV and PDF export for outside counsel, SOC 2/ISO auditors, and insurers. Log the export as `audit.exported` and prevent export access before a successful server-side audit write.
- Cursor pagination based on audit `id`; never offset pagination.
- API equivalent to `listAuditEvents({ entityType, entityId, correlationId, cursor })`, adapted to the project's established API patterns and always scoped by server-side authorization and RLS.

Use server-side validation for filters, bounded date ranges/page sizes, safe rendering of stored fields, and CSV formula-injection protection. PDFs/CSVs must never expose non-redacted contract text, secrets, or another tenant's events. Do not make the UI itself the security boundary.

---

# PART B — AI EVALUATION HARNESS

## 13. Objectives and Real-Pipeline Constraint

The harness must:

1. Measure AI quality objectively and repeatably, including uncertainty.
2. Catch regressions when prompts, models, parsers, simulation code, or related logic changes.
3. Detect upstream model drift over time.
4. Produce a report that a General Counsel can understand and an engineer can debug.
5. Run with `npm run eval` (adapt package-manager invocation to the existing repository/lockfile without switching package managers unnecessarily).
6. Exercise the **actual production server functions and pipeline**, not a duplicate or simplified copy. A duplicated pipeline would drift and make the evaluation meaningless.

## 14. Metrics That Must Be Implemented

Implement the relevant scorers, with deterministic checks preferred wherever possible.

### Simulation detection and severity

- Precision, recall, and F1 for impacted-contract detection against labeled cases.
- **High-severity recall as a standalone headline metric**, not hidden inside aggregate accuracy.
- Exact severity agreement and within-one-level agreement.
- Severity confusion matrix.
- Expose positive counts for the relevant metrics.

### Exposure

- Deterministic check that total exposure equals the sum of impacted contract values.
- Median percentage error versus gold exposure, with safe handling of zero/undefined gold denominators.

### Evidence accuracy

- The cited clause exists.
- The quote appears verbatim in the cited clause.
- The regulation ID exists in the ontology.
- Report evidence validity explicitly.

### Contract extraction

- F1 for parties, values, clause boundaries, and regulation tags using labeled examples.

### Generated code

- `terraform validate` must pass for Terraform outputs.
- Python outputs must parse and lint.
- Audit scripts must be read-only; statically detect or test that they do not contain write/delete SDK calls.
- A failure to validate generated code must count as a failing metric, not an informational note only.

### Predictive radar

- Brier score for calibration and band accuracy against historical amendment outcomes, where the existing system supports the necessary task/data.

### Review routing — required `[NEW]`

- **Routing recall:** among AI outputs that were actually wrong, the percentage routed to `pending_review`.
- **Routing precision:** among routed items, the percentage a human changed or rejected.
- Report how these metrics interact with the Review Queue and confidence thresholds. An accurate aggregate score cannot excuse unsafe routing of the most severe mistakes.

### Reliability and operations

- JSON schema validity.
- Fallback trigger rate.
- Latency.
- Cost per case/simulation and total run cost.
- Run-to-run stability/variance.
- Unstable/flaky case count.
- Separate fallback-engine results from model results.

Use exact definitions from the source:

- Precision = correctly flagged contracts / all flagged contracts.
- Recall = correctly flagged contracts / all truly impacted contracts.
- High-severity recall = correctly flagged high-severity contracts / all truly high-severity contracts.
- Evidence validity = citations whose quote appears verbatim in the cited clause / all citations.
- Exposure error = median of `|simulated − gold| / gold` across cases, with explicitly tested treatment of zero-valued gold data.
- Routing recall = wrong outputs routed to `pending_review` / all wrong outputs.

Document any undefined corner case rather than masking it with a fabricated score.

## 15. Evaluation Repository Layout and Commands

Implement the source-described organization, adapting names to actual project conventions without omitting capabilities:

```text
evals/
├── README.md
├── config.ts
├── thresholds.ts
├── run.ts
├── datasets/
│   ├── simulation/
│   │   ├── landmark.v1.json
│   │   ├── synthetic.v1.json
│   │   ├── negative.v1.json
│   │   ├── adversarial.v1.json
│   │   └── holdout.v1.json
│   ├── extraction/
│   ├── evidence/
│   ├── codegen/
│   ├── predictive/
│   ├── routing/
│   └── candidates/
├── cassettes/
├── runners/
│   ├── run-simulations.ts
│   ├── run-ingestion.ts
│   ├── run-codegen.ts
│   └── run-routing.ts
├── scorers/
│   ├── detection.ts
│   ├── severity.ts
│   ├── exposure.ts
│   ├── evidence.ts
│   ├── extraction.ts
│   ├── codegen.ts
│   ├── routing.ts
│   └── judge.ts
├── reporters/
│   ├── markdown.ts
│   ├── html.ts
│   └── json.ts
├── baselines/baseline.json
└── reports/<run-id>/{report.json,report.md,report.html}
```

Make the following commands available, consistent with the existing package manager:

- `npm run eval`: full/default evaluation.
- `npm run eval:quick`: quick tagged subset, replay mode.
- `npm run eval:live`: live gateway run.
- `npm run eval:record`: live run that records/refreshes cassettes.
- `npm run eval:update-baseline`: explicit reviewed baseline update; never silently update the baseline during ordinary eval runs.

The source sketch uses `tsx evals/run.ts`; use the repository's installed TS execution tooling, without adding unnecessary duplicate runners or changing package managers.

Support runner options including `--subset`, `--tag`, `--mode replay|live`, `--record`, and `--update-baseline` with validation and clear help output.

## 16. Golden Dataset: Six Required Classes

Version datasets as JSON committed with the code. Include the following six classes:

1. **Landmark anchors:** real, public enforcement outcomes. The source lists Meta €1.2B GDPR 2023, Equifax $700M 2019, and Grameenphone BTRC 2022 as candidate examples. These numbers/facts were **not independently verified by the spec author**. Before adding a landmark fixture, include `source_url` and verify the facts and amounts against a trustworthy source. Do not assume the example numbers are correct without verification.
2. **Synthetic planted violations:** deliberately authored cases, e.g. missing SCC language in a DPA, an SLA violating a four-hour reporting window, and an AI-transparency clause conflicting with the EU AI Act. Cover regulation families, severity, jurisdictions (EU/US/BD), and clause types.
3. **Negative controls:** clean contracts/regulations with no relevant impact. They must produce zero impacted contracts and zero high-severity flags.
4. **Adversarial cases:** ambiguous clauses, near-miss wording, conflicting jurisdictions, and prompt-injection text embedded inside a contract. Treat document text as untrusted data, never as instructions to the harness or system.
5. **Hold-out set:** a fixed set that is never used for prompt tuning. Keep strict leakage discipline.
6. **Production-derived cases:** rejected or edited AI outputs from the Review Queue, only after human/domain-expert approval and sanitization. They begin as candidates, not golden fixtures.

Dataset requirements:

- Include the seeded corpus of 15 contracts and 54 clauses plus the specified backtest cases, insofar as the corpus exists in the repository/source materials. Do not fabricate purportedly existing cases if the repository does not contain them; report the gap and create clearly labeled, hand-authored synthetic replacements only where allowed.
- Require domain-expert-verified labels. Where possible, have two reviewers label high-severity cases.
- Do not include real customer contracts. Any production-derived case must be stripped of customer data and approved by an admin/domain expert before joining an approved dataset.
- Track sample sizes/positive counts next to every score. A small sample must not imply false precision. Below the suggested minimum of 20 high-severity positives, label high-severity metrics **“low sample”** and show the actual count.
- Review datasets quarterly because regulations change. Document ownership and a review schedule.
- Record dataset name/version, case ID, class/tags, regulation family, jurisdiction, clause type, input data, expected result, source URL if relevant, label author/date, and reviewer metadata.
- Keep candidate fixtures separate from approved training-facing/golden datasets; grow hold-out only through a separate deliberate approval process.

## 17. Runner Behavior, Modes, Isolation, and Reliability

Each run must:

1. Load validated config and datasets, applying `--subset`/`--tag` selectors.
2. Call real production server functions, including the real `simulateImpact()` and real parsing/ingestion pipeline. Reuse existing production validation, prompts, AI gateway, and fallback behavior.
3. Use pinned model versions/parameters where supported, with `temperature: 0`. Default to three live runs per case and one replay run because cassettes are deterministic, unless an existing API makes a documented adaptation necessary.
4. Score each run and aggregate mean, standard deviation, worst case, and confidence intervals (bootstrap or Wilson as appropriate to the metric). Clearly identify per-run variance and unstable cases.
5. Write reproducible attribution metadata and reports.

### Replay mode — default for PRs

- Replays recorded AI responses to test the real pipeline deterministically.
- Cassette key must include a hash of model, prompt version, parameters, and input.
- **A cassette cache miss fails with a clear “re-record needed” message. It must never silently make a live gateway call.**
- Verify cassette content is sanitized, versioned, and protected from accidental drift.

### Live mode

- Calls the actual AI gateway with bounded concurrency.
- Retries rate limits according to a capped, documented policy.
- Enforces a configurable per-run cost ceiling and aborts clearly when exceeded; report partial completion/cost and status.
- Does not run accidentally because replay data is missing.

### Record mode

- Explicit live run that refreshes cassettes, with clear output and reviewability.
- Never silently overwrites cassettes without making the record operation explicit.

### Evaluation isolation — mandatory

- Run the real pipeline against a dedicated **evaluation organization**.
- All evaluation records and audit events belong to that eval organization and its own chain, with `metadata.eval_run_id`.
- Evaluation must never write to production organization tables or production audit chains, and must not alter real-customer state.
- Enforce the boundary structurally through isolated configuration/tenant selection and authorization, not just by convention.
- Add automated tests proving zero rows are created in production orgs or production audit chains.

### Fallback and flaky results

- Score fallback-engine responses and report them separately from model responses. Also report fallback trigger rate.
- For flaky live results, retry once, then mark the case `unstable` rather than automatically treating it as a model-quality failure. Include its observed variance and notes. Distinguish operational/test instability from quality regressions without hiding either.

## 18. Scorers and LLM-as-Judge

- Prefer deterministic scorers first: set comparisons, string containment, schema validation, executable validation tools, static checks, and exact expected outputs.
- Use an LLM judge only for criteria code cannot reliably assess (such as whether a rationale is sound).
- When using a judge, prefer a different model than the model being evaluated; calibrate against a human-labeled sample; report judge/human agreement; store the judge prompt version in the report.
- Do not let an LLM judge substitute for deterministic checks or decide factual compliance results without calibrated evaluation.
- Unit-test all scorers with handcrafted inputs and known outputs, including missing/empty/null and edge cases.

## 19. Thresholds, Baseline, and CI Gate

Start with these specification thresholds; they must be configurable, visible, tested, and later signed off by an authorized owner. Do not silently weaken them to make CI green.

| Metric | Warn | Fail |
|---|---:|---:|
| High-severity recall | 0.95 | 0.90 |
| Precision | 0.80 | 0.70 |
| Severity accuracy | 0.85 | 0.75 |
| Median exposure error (lower is better) | 0.30 | 0.50 |
| Extraction F1 | 0.90 | 0.80 |
| Evidence validity | 0.98 | 0.95 |
| Routing recall | 0.95 | 0.90 |
| Terraform validity | — | 1.00 |
| Read-only scripts | — | 1.00 |
| Negative-control high-severity flags | — | maximum 0 |

Also enforce `maxRegressionVsBaseline = 0.03`: a regression greater than 0.03 (3 percentage points, interpreted consistently for the metric) fails even when the absolute threshold still passes. Specify the directionality for lower-is-better metrics and test it.

- Exit status `0` only when no fail threshold is breached; warnings annotate/report but do not block by themselves.
- A failed case/threshold must provide a clear explanation and fixture-level details.
- Do not update the baseline automatically during regular runs. Baseline updates need the explicit command and review/sign-off process.
- Low-sample metrics must be marked as low sample and shown with their counts/intervals; do not fabricate certainty. Document how low-sample thresholds interact with blocking gates and secure an explicit decision rather than silently suppressing all failures.

### Required triggers

- **Pull requests:** for relevant changes to `evals/**`, prompts, simulation, parsing, scoring, or routing, run quick replay. Block merge on fail; warn on warning thresholds.
- **Nightly:** live with current supported model versions, detect drift, and alert when metrics move beyond tolerance.
- **Weekly:** live full sweep including hold-out, with trend report.
- **Before release:** full live run and manual review/sign-off of its report.

Adapt the supplied GitHub Actions sketch to the repository's actual lockfile/runtime. Preserve frozen/locked dependency installs and use secrets through GitHub Actions secret storage. Do not paste keys into workflows or reports. Upload eval reports as CI artifacts even on failure, provided they contain no sensitive customer data. Scheduled live jobs must have concurrency/cost bounds and clear failure visibility.

## 20. Evaluation Reports and Attribution

Every run must generate all three artifacts:

- `report.json` — stable machine-readable report for trends/analytics.
- `report.md` — concise engineering/domain-expert report.
- `report.html` — readable report for a General Counsel and engineers.

Include, at minimum:

- Run ID/time, Git SHA, mode, model versions, prompt versions (including judge prompt), dataset versions, parameters, and relevant cassette references.
- Headline scores with confidence intervals, standard deviation/variance, sample sizes, and low-sample flags.
- Per-case verdicts with fixture ID, expected versus actual result, scores, pass/fail/unstable state, and notes.
- Severity confusion matrix.
- Threshold status, warned/failed thresholds, and comparison with the accepted baseline and previous runs.
- On regression, exact fixture(s) that flipped, expected and actual outputs, and useful diagnostics.
- The ten worst cases with explanations.
- Latency, cost per simulation/case, total cost, fallback case count/rate, and instability rate.
- Review-routing precision/recall and available override analytics.
- `{model_version, prompt_version, dataset_version, git_sha}` attribution for every relevant result.

Post CI annotations on the PR responsible for a regression where supported. Retain JSON artifacts for accuracy-over-time trend charts by model and prompt version. Avoid including raw production inputs, full contracts, secrets, or other sensitive data in the reports.

## 21. Human Review Queue Feedback Loop

Integrate evaluation with the existing review system:

1. When a reviewer decides a queue item, allow them to label the AI finding **correct** or **incorrect**, stored in the review decision and its associated audit event. Adapt to the existing Review Queue UI and data model rather than creating a competing state/history system.
2. Rejected or edited AI outputs automatically become **candidate fixtures** under `evals/datasets/candidates/` or the equivalent approved storage mechanism.
3. Sanitize customer information before candidate creation/persistence.
4. Require an admin or domain expert to approve a candidate before it enters an approved golden/training-facing set.
5. Never automatically promote a candidate directly to the hold-out set. Hold-out changes require a separate deliberate process to prevent leakage.
6. Track label provenance, candidate status, approver, sanitization, dataset version, and audit linkage.
7. Compare human override rates in the audit log against evaluation scores by area, and compare routing recall to real-world misses.

### Source decision for review history

The merged specification makes `audit_log` the single source of truth for `review.*` events, written inside `approve_review()` and related decision functions. The Review Queue should hold current state; its event-history view should read/filter `audit_log` by entity. However, **inspect existing production dependencies before changing any current `review_events` table**. If it exists and is depended upon, preserve compatibility using a derived view/adapter or a safe staged migration; do not abruptly drop it simply because the spec allows it to become a derived view or be retired.

---

# PART C — TRUST-LAYER INTEGRATION, TESTING, ROLLOUT, AND DOCUMENTATION

## 22. Trust-Layer Integration

Keep the three controls coherent:

- **Human Review Queue:** determines which consequential AI outputs are reviewed/approved/rejected before they may execute.
- **Audit Log:** records actions and decisions as verifiable history.
- **Evaluation Harness:** measures AI quality over time and gives evidence about whether it deserves trust.

Implement and verify these connections:

- `review.*` events and their business state transitions commit in the same transaction.
- Reviewer rationale belongs in `basis` in redacted form.
- Review outcomes are connected to the related simulation/artifact/export using `correlation_id`.
- AI model and prompt attribution is consistent between audit records and eval reports.
- Eval runs use a separate evaluation organization and its own audit chain.
- Production fallback activations are auditable; eval fallback results are separately summarized.
- Override metrics are traceable to human decisions and evaluation areas.

Do not add a second source of truth for review history or duplicate event writers.

## 23. Audit-Log Test Plan — All Must Be Implemented and Run

Create automated tests against a disposable database/test environment and applicable application APIs.

1. **Mutation attempts:** `UPDATE`, `DELETE`, and `TRUNCATE` fail when attempted as `anon`, `authenticated`, `service_role`, and table owner, to the extent enforceable by PostgreSQL trigger/privilege design. Document any platform/superuser exception precisely.
2. **Forgery:** application users cannot directly `INSERT`; only approved trusted writer paths can write.
3. **Tenant isolation:** org A sees zero org B rows for both list and detail endpoints.
4. **Role access:** `member` cannot read; same-org `admin` can.
5. **Concurrency:** 10,000 rapid inserts across concurrent sessions result in a strictly ordered, fork-free chain, with each previous hash consistent.
6. **Tamper detection:** controlled privileged test setup modifies a row and verifier reports the first bad row.
7. **Tail deletion:** remove newest rows only in isolated test setup and prove anchor comparison catches the mismatch.
8. **Timezone stability:** verification succeeds under different database session `TimeZone` settings.
9. **Atomicity:** a failed business action leaves no corresponding audit row; a failed audit write rolls back the business action.
10. **Trigger coverage:** raw-SQL role grants produce `role.granted` with `source = db_trigger` and are not double-logged by the application.
11. **Redaction:** tokens, key-like strings, full contract text, and restricted personal/financial data never reach the log.
12. **Backfill:** historical `simulation_runs` are represented with accurate available actors, safe source metadata, no duplicate entries, and a verifiable chain.
13. **Partition boundary:** if/when partitioning is enabled, chain verification across month boundaries passes.
14. **Export:** CSV and PDF exports succeed, remain tenant-scoped/redacted, and log `audit.exported` after the required authorization and before data release as applicable.
15. **Correlation:** one incident can be followed from simulation through review/artifact/export using a single correlation ID.
16. **Event uniqueness:** every action uses exactly one writer and produces no duplicate audit records.
17. **Anchor health:** successful anchor creation, comparison, missing/stale anchor, mismatched hash/count/head, alerting, and failure paths are tested.

Never perform destructive/tampering tests against real customer or production data.

## 24. Evaluation-Harness Test Plan — All Must Be Implemented and Run

- Unit tests for every deterministic scorer with known correct and incorrect examples.
- Two identical replay runs produce identical scored results/reports, apart from intentionally nondeterministic metadata such as run ID/time; document how stable comparisons work.
- Cassette miss fails with a clear re-record message and proves it does not call the live gateway.
- Threshold tests: deliberately worsen a fixture/score and ensure the process exits non-zero.
- Baseline-regression tests, including directionality for lower-is-better metrics.
- Eval isolation test proves no rows are written to production tenants/tables/audit chains.
- Cost-ceiling test proves a live run aborts with a visible report when the limit is exceeded.
- Negative-control test uses a deliberately broken model stub that flags everything and must fail.
- Prompt-injection fixtures prove contract text is treated as untrusted input.
- Tests for JSON schema validity, fallback separation, routing recall/precision, small-sample labeling, intervals, instability, cost/latency, report fields, and attribution.
- Tests for `terraform validate`, Python parse/lint, and read-only audit scripts.
- Tests for fixture sanitization, approval flow, no automatic candidate promotion, and hold-out leakage rules.

## 25. Existing-Application Regression Test Plan

In addition to feature tests, create/run regression checks for the existing application:

- Existing login/session flows and role checks still work.
- Existing organization/tenant access remains unchanged.
- Existing contract upload, parsing, and extraction work.
- Existing simulations and `simulateImpact()` output contracts remain compatible.
- Existing fallback behavior remains correct and observable.
- Existing Human Review Queue create/assign/approve/reject/edit/escalate/stale flows continue to work.
- Existing generated code and Action Plan generation still work.
- Existing client-side Action Plan PDF export works with the required server-side audit authorization/release sequence.
- Existing dashboards, navigation, routes, and API contracts remain functional.
- Existing `simulation_runs` consumers work throughout and after the backfill/migration strategy.
- New route access controls do not leak audit data.
- Client bundles contain no server-only audit helper, secrets, or privileged credentials.
- Build, typecheck, lint, migration checks, and test suites pass or have clearly itemized pre-existing failures.

Fix all regressions introduced by the feature. If a pre-existing failure prevents a reliable check, explicitly identify it and use a targeted independent verification where possible; do not claim success without evidence.

## 26. Risks and Required Mitigations

Explicitly test/document mitigations for all risks in the source specification:

- **Service-role bypasses RLS:** use correct privileges/triggers, hash chain, and external anchor.
- **Superuser disables triggers or rewrites chain:** anchor head ID, hash, and count; alert on mismatch.
- **Tail rows deleted:** compare anchored head/count.
- **Action commits but audit fails:** one database transaction.
- **Duplicate events:** one writer per event type.
- **Hash mismatches from timezone/serialization:** shared canonical helper, UTC serialization, hash version.
- **Sensitive data in immutable log:** write-time redaction and no contract text.
- **Unbounded log growth:** indexes, documented retention/legal hold, archival, partitions only when justified.
- **Overfitting:** hold-out set, refresh schedule, strict leakage rules.
- **Small samples:** sample sizes, confidence intervals, low-sample warnings.
- **LLM-judge bias:** deterministic scoring first, calibration, different judge model where feasible.
- **Flaky/costly evals:** PR replay, nightly live, bounded concurrency, retry-then-unstable, cost ceilings.
- **Stale cassettes:** complete cassette keys and fail loudly on cache miss.
- **Weak labels:** expert review and two reviewers for high-severity labels where possible.
- **Unvetted review-derived labels:** candidate staging, sanitization, admin/domain expert approval, hold-out isolation.

Add any further implementation risks discovered during repository reconnaissance to the risk register.

## 27. Rollout Order and Dependencies

Use the source rollout plan, adapting it to the actual dependency graph without skipping gates:

1. Create `audit_actions`, `audit_log`, indexes, RLS, mutation protection, hash helper, and writer.
2. Convert state-changing application paths to transactional audit-capable functions: simulation, code generation, role changes, deletion requests, exports; add governance triggers and backfill `simulation_runs`.
3. In parallel, create eval skeleton: runner, initial 10–20 golden cases across landmark/synthetic/negative where source material and verified labels permit, deterministic scorers, and `report.md`.
4. Implement chain verifier, nightly verification worker, and `/settings/audit` UI with filters, detail, integrity verification, CSV/PDF export.
5. Add evidence, exposure, and code-validity scorers; adversarial/hold-out sets; cassette recording and replay.
6. Add CI quick-replay gates, warning/failure thresholds, and accepted baseline.
7. Add external anchoring and tail-deletion verification in UI and scheduled worker.
8. Add nightly live evaluation/drift alerts, weekly full sweep, LLM judge where justified, and confidence intervals.
9. Integrate Review Queue correct/incorrect labels, candidate fixtures, routing metrics, and override analytics.
10. Schedule quarterly dataset review and update the whitepaper after verified initial baseline data exists.

Do not enable a production cutover just because a phase's code has merged. Each phase needs migration verification, tests, operational readiness, and a rollback/mitigation path.

## 28. Open Questions — Handle Explicitly

The specification leaves these product/operations questions open. Do not pretend they have already been decided:

1. Whether members should ever see their own audit entries. For this version, preserve the specified default: members cannot read audit logs.
2. Audit-data retention duration by customer/jurisdiction (EU/US/BD).
3. What happens to the chain after permanent workspace deletion and the 30-day window: export to the customer, retain under legal policy, or both.
4. Who labels/approves golden cases, how often datasets refresh, and who approves Review Queue candidates.
5. Who signs off launch thresholds.
6. Which write-once storage holds anchors and who owns the key/bucket.
7. Whether any separate approval is needed before a dataset sample derived from real documents is used.
8. Whether anchors should also be delivered to customers for independent proof.

For decisions not necessary to safely implement locally, record them as launch blockers or operational configuration decisions. For decisions that are safe to provisionally default, use a conservative documented default and do not overstate that a real external service/approval has been configured.

## 29. Documentation and Whitepaper Updates

Create/update implementation docs including:

- `evals/README.md`: setup, modes, commands, dataset format/versioning, fixture approval, cassette behavior, cost limits, threshold semantics, report artifacts, baseline process, and troubleshooting.
- Audit-log architecture: event ownership/writer matrix, schema, grants/RLS, redaction, canonical hashing/versioning, atomicity, verification, anchoring, correlation IDs, retention/legal hold, backfill, export, and known superuser limits.
- Operations runbook: schedule/worker configuration, anchor health, chain verification, alerts, drift alerts, failed eval triage, budget/secret configuration, recovery/rollback.
- Testing instructions and requirement traceability matrix.
- Whitepaper updates from Appendix B: add “Immutable Audit Log” and “Evaluation Harness” as new numbered features (suggested numbers 17 and 18, but confirm numbering); update the audit section to explain that the log generalizes `simulation_runs` into a platform-wide ledger; explain the trust layer (Review Queue + Audit Log + Evaluation Harness); accurately describe tamper evidence as hash chain **plus external anchor**, not as “immutable” alone; add initial headline eval results with confidence intervals only after the first accepted baseline exists; and schedule quarterly golden-dataset review.

Do not add invented evaluation results, independently unverified landmark numbers, or claims that anchoring/production controls are deployed when they are not.

## 30. Acceptance Checklist — Final Release Gate

### Audit log: every applicable item must pass

- [ ] No application role can update/delete/truncate audit records; privileged platform exceptions are honestly documented and anchored.
- [ ] Direct application-role insertion is denied; all writes use the authorized writer.
- [ ] State changes and audit entries commit or fail together.
- [ ] Each event type has exactly one writer, without duplicate rows.
- [ ] Writer and verifier share one canonical hash helper and timezone-independent serialization.
- [ ] Modified rows/middle deletions are detected; tail deletion is detected through trusted anchor comparison.
- [ ] Chain head ID/hash/count are exported to write-once external storage on the configured schedule and verified.
- [ ] Only same-org admins can read entries; members and other organizations cannot.
- [ ] Admin UI supports all specified filters including correlation ID, detail view, verification, CSV, PDF, and cursor pagination.
- [ ] `simulation_runs` history is backfilled safely and the resulting chain verifies.
- [ ] Legal hold, retention, workspace deletion behavior, and archival plan are documented.
- [ ] Redaction and correlation-ID tracing tests pass.

### Evaluation harness: every applicable item must pass

- [ ] `npm run eval` works end to end and emits `report.json`, `report.md`, and `report.html`.
- [ ] Dataset contains landmark, synthetic, negative, adversarial, and hold-out fixtures across EU/US/BD where relevant; landmark facts are source-verified.
- [ ] Harness calls real production functions, never a copied implementation.
- [ ] High-severity recall is a headline metric with sample size, confidence interval, and low-sample flag.
- [ ] Variance, worst cases, per-run results, and confidence intervals are reported.
- [ ] Review-routing recall and precision are reported.
- [ ] Reports capture Git SHA, model/prompt/dataset versions, thresholds, cost, latency, fallback, and case-level expected-vs-actual outcomes.
- [ ] Warn/fail thresholds and baseline regression guard behave correctly; fail returns non-zero.
- [ ] PR uses replay; cache miss fails loudly; nightly live detects drift; weekly full sweep and pre-release sign-off are documented/configured as appropriate.
- [ ] Live runs have concurrency and cost ceilings; fallback results remain separate.
- [ ] Eval data writes are isolated from production tenants and production audit chains.
- [ ] Candidates require sanitization and human approval; hold-out leakage is prevented.

### Existing application: every applicable item must pass

- [ ] Relevant baseline tests and final test suites recorded with accurate pass/fail details.
- [ ] Existing authentication, RBAC, tenant isolation, contract workflows, simulations, fallback engine, review flows, generated code, Action Plans, PDF export, routes, dashboards, and APIs remain compatible.
- [ ] Migrations have been tested against a disposable environment and staging, with no unsafe destructive operations.
- [ ] No secrets/server-only modules leaked to client bundles.
- [ ] Build, typecheck, lint, and migration/test checks pass, or pre-existing blockers are clearly listed and not misrepresented.
- [ ] Rollout, monitoring, unresolved decisions, operational ownership, and rollback are documented.

---

## 31. Required Final Report from the Coding Agent

At completion, do not respond with “implemented” alone. Provide an evidence-based report containing:

1. **Summary:** what was implemented, what remains incomplete, and the real deployment status.
2. **Requirement traceability:** each source requirement and its implementation/test evidence, including every `[NEW]`/`[FIX]` item and Appendices A/B.
3. **Files changed:** grouped by database/migrations, audit server services, app routes/UI, evaluation runner/scorers/datasets/reporters, CI/workers, tests, and docs.
4. **Database changes:** migrations applied in which environments, added functions/triggers/policies/indexes, grants/RLS details, backfill counts, and verification status.
5. **Security review:** mutation protection, actor/tenant validation, direct-write prevention, redaction, external anchor implementation/status, and known privileged-operator limits.
6. **Evaluation evidence:** commands run, cases/samples evaluated, metric values, confidence intervals, warnings/failures, report locations, cassette coverage, threshold/baseline results, cost and latency where available. Never fabricate metric results from unrun evaluations.
7. **Regression evidence:** baseline versus final tests/build/typecheck/lint, what changed, any remaining pre-existing failures, and how existing behavior was verified.
8. **Rollout status:** completed phases, staged/production status, schedules/workers configured, external storage/secret requirements, alerts, and rollback plan.
9. **Open questions and assumptions:** list every unresolved spec decision, who needs to decide it, and whether it blocks launch.
10. **Limitations:** clearly distinguish implemented controls from controls requiring external setup (especially write-once anchor storage, scheduled workers, live model access, and operational approvals).

## 32. Execution Protocol

Proceed in small, reviewable phases. Begin by inspecting the specification and repository, establishing the baseline, and producing the traceability matrix. Then implement the smallest foundational slice, verify it, and continue through the rollout order. After each phase, inspect the diff and rerun targeted regressions.

Do not ask for unnecessary confirmation when a safe, reversible implementation choice is available. Do not silently resolve an open legal/product/security decision that could affect retention, privacy, costs, or customer commitments; document it and mark it as a decision/launch blocker. Do not claim any tests, migration, anchor, or live evaluation succeeded unless it was actually executed and verified.

**Final governing rule:** Deliver the complete specification with measurable evidence, while making the smallest safe set of changes needed to the existing ClauseGraph codebase. If any requirement conflicts with current architecture, preserve security and existing data first, document the conflict, and propose a compatibility-preserving implementation rather than damaging unrelated functionality.
