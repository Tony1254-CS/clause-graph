
# Phase 2.5 + Phase 3 — Team invites & Contract Upload Pipeline

Phase 2 (auth + multi-tenancy + RLS) is live. Two things remain from the full production plan before we can start billing:

1. **Team invites** — the last unfinished piece of Phase 2 §9.
2. **Contract upload pipeline** — Phase 3: turn uploaded PDFs/DOCX into `contracts` + `clauses` rows with linked regulations, replacing the sample data.

Stripe billing (Phase 6) and infra/observability (Phase 7) get separate plans after this lands.

---

## Part A — Team invites (finish Phase 2 §9)

Goal: an admin can invite a teammate by email, teammate signs up, lands in the same org (not a new one).

- **`settings.team.tsx` route** (under `_authenticated/`): lists current members from `profiles` + `user_roles` (RLS-scoped, so admins and members both see just their org). Admin-only "Invite" form and "Remove" button; UI hides admin-only controls via `has_role`.
- **`inviteTeammate` server fn** (`src/lib/team.functions.ts`, `requireSupabaseAuth`): verifies caller is admin for `current_org_id()` via `context.supabase.rpc('has_role', ...)`, then dynamically imports `supabaseAdmin` and calls `auth.admin.inviteUserByEmail(email, { data: { invited_org_id, full_name } })`. Never uses admin client to check the role.
- **`removeTeammate` server fn**: same admin check, then deletes `user_roles` row and nulls / reassigns `profiles.org_id` (or blocks removing the last admin).
- **`handle_new_user` trigger**: already reads `raw_user_meta_data.invited_org_id` and attaches the user as `member` — verified. No migration needed unless we tighten it further.
- **Invite email**: use Supabase's built-in invite mailer (already covered in Phase 2 plan). Resend/branded email deferred.
- **TopBar account menu**: add a "Team" link visible to all members; admin-only "Invite" quick action.

Verification: two accounts, admin invites second, second signs up via the emailed link and lands in the same org's dashboard with the admin's contracts visible under the same RLS.

---

## Part B — Contract Upload Pipeline (Phase 3)

Goal: a user uploads a contract file, we extract clauses via LLM, link each clause to relevant regulations from the org's ontology, and the contract shows up in `/contracts` alongside sample data.

### 1. Storage bucket

- Create a **private** bucket `contract-files` via `supabase--storage_create_bucket` (public=false).
- RLS on `storage.objects`: authenticated users can INSERT/SELECT/DELETE only under path prefix `${current_org_id()}/…`. Enforced via policies on `storage.objects` that parse the path.

### 2. Upload UI (`/contracts` route)

- Add a "Upload contract" button on `/contracts/index`. Dropzone accepts `.pdf`, `.docx`, `.txt` up to ~10 MB.
- Client-side: validate file, ask user for **Contract name** and **Counterparty** (required) and **Contract value USD** (optional numeric, mono field). Uses the app's existing glass-panel form styling.
- Client uploads to Storage at `${org_id}/${uuid}.${ext}` using the browser Supabase client (RLS approves because path prefix matches `current_org_id()`).
- After upload, client calls `startContractExtraction({ data: { fileKey, name, counterparty, value } })` server fn.

### 3. `contracts` row + extraction pipeline

- `startContractExtraction` (auth server fn):
  1. Verifies file exists in storage under the caller's org path.
  2. Inserts a `contracts` row (`org_id`, `name`, `counterparty`, `value`, `source_file_url = fileKey`, `extraction_status = 'processing'`, `is_sample = false`, `uploaded_by = userId`).
  3. Kicks off extraction in the same request (synchronous for MVP — see "Async decision" below).
- **Text extraction** (server-only): PDFs via `pdfjs-dist` (Worker-compatible; no native binaries), DOCX via `mammoth`, TXT read as-is. All run inside the server fn on the TanStack worker runtime. Bail early on encrypted PDFs with a clear error.
- **Clause segmentation + regulation linking** — one LLM call per contract via `google/gemini-3.6-flash` through Lovable AI Gateway:
  - Input: extracted text + the org's regulation ontology (rows visible via RLS: curated shared library + org-added).
  - Output (structured JSON): `{ clauses: [{ text, position, confidence, linked_reg_ids: string[] }] }`.
  - Bounded response schema so we don't accept hallucinated reg IDs — filter output to only IDs that exist in the ontology.
- Insert `clauses` rows in order; update `contracts.extraction_status` to `'complete'` (or `'failed'` with an error message column — add via migration if not present).

### 4. Contract detail + status

- `/contracts` list: cards show `extraction_status` badge (`processing`, `complete`, `failed`) with a small brass spinner while processing. Poll via TanStack Query `refetchInterval: 3s` when status is `processing`.
- `/contracts/$id`: unchanged UI, but replaces the "sample data" banner when `is_sample = false`. Add a small "Re-run extraction" admin-only action for failures.
- Delete contract action (admin or uploader): removes the row (`clauses` cascade) and the storage object. Confirmation dialog.

### 5. Simulate against real contracts

Already wired in Phase 2 to read from `context.supabase` — no code change needed. Real uploaded contracts appear in the medallion graph and simulate results automatically, replacing sample data as users upload.

### 6. Async decision (kept simple, revisitable)

For MVP we run extraction synchronously inside the server fn (typical contract fits under the ~30s worker timeout with Flash). If a user uploads something large that times out, `extraction_status` stays `processing`; the "Re-run extraction" action retries. A proper job queue is deferred until we hit that limit — this keeps the plan shippable without new infra.

### 7. Migrations required

One migration:
- `contracts.extraction_error text null` — for failure messages.
- Storage RLS policies on `storage.objects` for the `contract-files` bucket (org-prefix path check).
- Optional: index on `contracts(org_id, created_at desc)` for the list view.

Bucket itself is created by tool call, not SQL.

### 8. Verification

- Upload a PDF as user A → row appears in `/contracts` with `processing` → flips to `complete` within ~15s → clauses render with regulation pills.
- User B in a different org cannot list or fetch user A's contract or download the file (RLS + storage RLS both deny).
- Failed extraction (encrypted PDF, garbage file) surfaces `extraction_error` in the UI without crashing the page.
- Simulate Impact medallion now colors real uploaded contracts, not sample ones.

---

## What comes after this plan

- **Phase 6 — Stripe Billing** (separate plan): recommend Stripe (digital SaaS), enable seamless payments, plans (`free`, `pro`, `team`), quotas on `contracts` count / `simulation_runs` per month, checkout on `settings.billing`, webhook route under `/api/public/stripe`, `organizations.plan` + `stripe_customer_id` sync.
- **Phase 7 — Observability & polish** (separate plan): Sentry, uptime checks, Cloud backups review, publish + custom domain.
