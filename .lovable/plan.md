
# Phase 2 — Auth & Multi-Tenancy

Goal: turn ClauseGraph from a single-user demo running on hardcoded JSON into a real multi-tenant app where each user belongs to an organization, sees only their org's data, and every table is protected by RLS. Nothing in Phases 3–7 (upload, simulate against real contracts, billing) can start until this is in place.

Stack decision (from your answers): stay on TanStack Start with Lovable Cloud (Postgres + Auth + Storage + Secrets). No separate Express service.

---

## 1. Enable Lovable Cloud

- Turn on Lovable Cloud so we get Postgres, Auth, Storage, `supabase` clients, `requireSupabaseAuth` middleware, and the `_authenticated` route gate wired in automatically.
- Confirm the auto-provisioned env: `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and the VITE_ mirror for the browser.

## 2. Database schema (migration)

One migration, in this order, so RLS is on before any row exists:

- `organizations` — `id, name, plan default 'free', stripe_customer_id (nullable, wired in Phase 6), created_at`.
- `app_role` enum: `admin`, `member`.
- `user_roles` — `(user_id, org_id, role)`, unique on `(user_id, org_id, role)`. Roles live in a separate table, never on profiles.
- `profiles` — `id references auth.users(id) on delete cascade, org_id references organizations(id), full_name, created_at`. One row per auth user; created by trigger on signup.
- `regulations` — add `org_id uuid null references organizations(id)`. NULL = shared curated library visible to everyone; non-NULL = org-private.
- `contracts` — add `org_id`, `source_file_url`, `extraction_status default 'pending'`, `uploaded_by references profiles(id)`, `created_at`. Phase 3 will use the file/extraction columns; we're adding them now so we don't re-migrate.
- `clauses` — add `contract_id` FK, `confidence numeric` (nullable until Phase 3 fills it).
- `simulation_runs` — `org_id, input_regulation_text, result_json jsonb, triggered_by references profiles(id), created_at`. Written by the existing simulate flow after this phase so we have an audit log.
- `backtest_cases` — stays global (no `org_id`); it's reference data.

`GRANT SELECT, INSERT, UPDATE, DELETE ... TO authenticated` and `GRANT ALL ... TO service_role` on every org-scoped public table (per Lovable Cloud rules; `anon` gets nothing except `SELECT` on `regulations WHERE org_id IS NULL`, which is what makes the curated ontology readable on public routes).

## 3. RLS policies

Enable RLS on every table above. All authenticated policies use a `security definer` helper `public.current_org_id()` that reads the caller's org from `user_roles` — this avoids recursive-RLS on `profiles`/`user_roles`.

- `organizations`: member can SELECT their own row; admin can UPDATE it.
- `user_roles`: member can SELECT rows in their org; admin can INSERT/DELETE within their org.
- `profiles`: user can SELECT/UPDATE their own row; members can SELECT profiles in their org (needed for the team list).
- `regulations`: `SELECT` when `org_id IS NULL OR org_id = current_org_id()`; INSERT/UPDATE/DELETE only when `org_id = current_org_id()`.
- `contracts`, `clauses` (via `contract_id → contracts.org_id`), `simulation_runs`: all four operations gated on `org_id = current_org_id()`.
- `backtest_cases`: `SELECT` to authenticated; no writes from clients.

A separate `has_role(_user_id, _org_id, _role)` security-definer function backs admin-only checks (invite/remove teammate in Phase 2, admin-only writes in later phases).

Test with two separate signed-in orgs, confirming zero cross-tenant read/write on `contracts`, `clauses`, `simulation_runs`, and `user_roles`.

## 4. Signup trigger

A `handle_new_user()` trigger on `auth.users` insert:

1. Creates an `organizations` row (default name: "<email local-part>'s workspace"; user renames in settings).
2. Inserts a `profiles` row linking `auth.users.id` → new `org_id`.
3. Inserts a `user_roles` row with role `admin` for the creator.
4. Copies 2–3 sample contracts from the curated dataset into the new org so the app isn't empty on first login. Sample rows tagged so the UI can label them "Sample data — upload your own to replace."

## 5. Auth UI (public routes)

- `/auth` — sign-in / sign-up tabs. Email + password (default). Google sign-in via the Lovable broker (`lovable.auth.signInWithOAuth("google", ...)`, `redirect_uri = window.location.origin`); provider enabled via `supabase--configure_social_auth`. Password HIBP check enabled.
- `/auth/forgot-password` — calls `resetPasswordForEmail` with `redirectTo: ${origin}/reset-password`.
- `/reset-password` — public route; reads `type=recovery` from the URL, calls `updateUser({ password })`.
- All three routes SSR-on, no auth gate.

## 6. Route architecture

- Move every authenticated app route under `src/routes/_authenticated/`: `dashboard`, `contracts`, `contracts/$contractId`, `regulations/$regId`, `feed`, `simulate`, `backtest`, plus new `settings/team` and `settings/organization`.
- The `_authenticated/route.tsx` layout is integration-managed (`ssr: false`, redirect to `/auth`) — do not author it.
- `src/routes/index.tsx` becomes a public landing page with a "Sign in" CTA; signed-in users get redirected to `/dashboard`.
- Delete/relocate the existing route files as they move under the gate. No duplicate `/` route file.

## 7. Client wiring

- `src/routes/__root.tsx`: single `onAuthStateChange` subscriber filtered to `SIGNED_IN | SIGNED_OUT | USER_UPDATED`, calling `router.invalidate()` and `queryClient.invalidateQueries()` (skipping invalidate on `SIGNED_OUT`).
- `src/start.ts`: keep `attachSupabaseAuth` (or existing bearer middleware) in `functionMiddleware` so every `createServerFn` call ships the user's JWT.
- `TopBar`: replace the static "Simulate Impact" chrome with a session-aware account menu (avatar, org name, "Team", "Sign out"). Sign-out follows the four-step teardown: `cancelQueries → clear → signOut → navigate('/auth', { replace: true })`.

## 8. Server-function migration

Every existing server fn (`simulate`, `backtest`, `action-plan`, plus new list/read fns for contracts/clauses/regulations/simulation_runs) gets `.middleware([requireSupabaseAuth])` and uses `context.supabase` — scoped to the caller by RLS. The current hardcoded JSON reads move into a one-time seed inside the signup trigger; runtime code reads from Postgres only.

- `simulate` now queries the caller's contracts/regulations from Postgres, runs the LLM call, and writes a `simulation_runs` row before returning.
- The Federal Register proxy stays public (server route under `/api/public/regulatory-feed` or an unauthenticated server fn) since it's not org-scoped.

## 9. Team management (in-scope for Phase 2, admin-only)

- `settings/team` route under the gate:
  - Lists current members (via `profiles` joined with `user_roles`, RLS-scoped).
  - "Invite teammate" — admin-only form. Calls `supabase.auth.admin.inviteUserByEmail` inside a server fn that verifies the caller is admin via `has_role`, then loads `supabaseAdmin` (dynamic import). The invited user lands on `/auth`, sets a password, and a small variant of the signup trigger attaches them to the inviter's org instead of creating a new one (invite metadata carries `org_id`).
  - Admin can remove a member (`user_roles` delete + `profiles.org_id` handling).

Resend for outgoing email is out of scope for this phase — Supabase's built-in invite email covers this until we need branded emails in a later phase.

## 10. Verification checklist for this phase

- Two fresh accounts sign up, each lands on their own dashboard with only their own sample contracts.
- Signed-in user A cannot fetch signed-in user B's contract by ID (RLS denies, server fn returns 404/empty).
- Existing simulate/backtest/action-plan flows still work end-to-end for a signed-in user, now writing `simulation_runs` rows.
- Sign-out clears the cache and lands on `/auth`; back button does not restore the dashboard.
- Password reset round-trip works.
- Admin can invite a teammate; teammate signs up via the invite and lands in the same org.

## Out of scope for this plan (Phase 2 only)

Contract upload/extraction pipeline (Phase 3), billing (Phase 6), Sentry/uptime/backups (Phase 7 infra), Resend, custom domain, physical deploy — all get their own plans after Phase 2 lands.

## Technical notes

- Roles table + `has_role()` + `current_org_id()` are `security definer` with pinned `search_path = public` to prevent recursive-RLS and search-path attacks.
- `SUPABASE_SERVICE_ROLE_KEY` never leaves server-only code; `supabaseAdmin` is loaded via `await import(...)` inside handler bodies, never at module scope of `.functions.ts` files.
- Public routes (landing, `/auth`, `/reset-password`, `/feed` if we choose to keep the Federal Register feed public) must not call `requireSupabaseAuth`-gated fns in their loaders — SSR has no bearer.
- Google OAuth `redirect_uri` is `window.location.origin`, not a protected route.
