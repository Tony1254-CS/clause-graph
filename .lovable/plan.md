## Goal

1. Park subscriptions: keep all Paddle/billing code in the repo, but nothing charges, gates, or limits anyone. Every workspace — existing and new — is effectively **Pro, unlimited, no trial clock**.
2. Fix what's actually broken (verified in a sweep, not guessed).
3. Rewrite the docs so they contain the real database SQL and a step-by-step "move off Lovable Cloud to my own Supabase" runbook.

## What I verified before writing this

- `ARCHITECTURE.md` documents tables in prose (section 6.2) but contains **no `CREATE TABLE` / DDL anywhere** — so it can't be used to rebuild the database elsewhere. This is the gap you flagged; confirmed.
- Plan enforcement is spread across 7 server-function files plus two Postgres functions (`resolve_org_plan`, `assert_within_quota`), so "everyone Pro" has to be switched off in the database *and* respected by the UI, not just hidden in the frontend.
- I have **not** yet confirmed a specific new runtime bug from your latest screenshots, so step 1 below is an actual verification sweep. I won't assert a root cause I haven't reproduced.

---

## A. Turn billing off without deleting it

**Database (one migration)**
- `handle_new_user`: new signups get `plan='pro'`, `plan_status='active'`, and `trial_ends_at = NULL` — no countdown, nothing to expire.
- `resolve_org_plan`: while billing is parked, always resolves to `pro` and never downgrades to `free`. The paid-subscription logic stays in the function body, disabled behind a single flag.
- `assert_within_quota`: unlimited for every action (upload, simulate, invite, action plan, compliance code) — no `PLAN_LIMIT` error can fire.
- Backfill: every existing organization set to `plan='pro'`, `plan_status='active'`, `trial_ends_at=NULL`, so no one is stuck on Free.
- Single toggle (`billing_enabled = false`) in the resolver, so flipping it back on later re-enables real plans with no rewrite.

**App**
- `getOrgUsage` returns Pro with unlimited limits and never silently degrades to Free on error.
- TopBar badge: plain `PRO`, no trial text.
- Billing page (`/settings/billing`): keep the file and the checkout code, but render a single calm panel — "Billing is not active yet. Every workspace has full Pro access." No pricing cards, no disabled buttons, no `PADDLE_LIVE_API_KEY is not configured` red panel.
- Remove/neutralise `PlanLimitDialog` triggers and `PlanStatusBanner` plan states so no upgrade nag can appear anywhere.
- Landing/pricing copy: plans shown as "included during early access" instead of paid tiers.
- Paddle webhook route, `paddle.server.ts`, `plans.ts`, checkout hook: **left in place, untouched**, ready to reactivate.

## B. Breakage sweep (fix everything found)

Run the app on every authenticated route and every AI action, then fix what fails:
- All 17 routes render with real data (dashboard, contracts, contract detail, regulations, feed, simulate, backtest, actions, what-if, predictive, predictive detail, supply-chain, settings ×3).
- Every server function returns without a config/auth error; missing-env failures show a legible message instead of a raw variable name.
- Regulation obligations render text (not empty numbered boxes) for all 10 regulations.
- Sidebar reachability at 857×579 (your current viewport) and at 360px.
- Console/network clean: no React key warnings, no failed RPCs, no 401 storms.

Anything broken gets fixed in this pass — no deferrals.

## C. Documentation rewrite

**`ARCHITECTURE.md`**
- New **Database DDL** section with the complete, copy-pasteable SQL: every `CREATE TYPE`, `CREATE TABLE` (all 16 tables with exact columns, types, defaults, FKs), every `GRANT`, `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`, every `CREATE POLICY`, every function and trigger, plus indexes and the storage bucket definition.
- ER diagram kept, corrected against the live schema.
- Billing section marked **parked**, with exactly what to change to switch it back on.

**`README.md`**
- Feature list updated: all features available to everyone, no plan badges.
- Billing described as "built, not activated".

**New `MIGRATION.md` — Lovable Cloud → your own Supabase/host**
Step-by-step, ordered, with commands:
1. Create your own Supabase project; where to find URL, publishable key, service-role key, DB URL.
2. Apply schema: run the DDL from `ARCHITECTURE.md` (or `supabase/migrations/`) in order.
3. Move data: `pg_dump`/CSV export per table, plus the correct insert order for FK constraints.
4. Storage: recreate the private `contract-files` bucket and its policies, copy objects.
5. Auth: enable Email + Google, redirect URLs, and the caveat that existing users' password hashes/OAuth identities need Supabase's user migration path.
6. Secrets: the exact env-var list for both client (`VITE_*`) and server, and which Lovable-injected ones you must now provide yourself (`SUPABASE_*`, `LOVABLE_API_KEY` → your own AI provider key).
7. AI gateway: what to swap `LOVABLE_API_KEY` calls for (OpenAI/Gemini direct) and which files touch it.
8. Hosting: Vercel/Cloudflare build settings, the required env vars, and the webhook URL to register if you later re-enable Paddle.
9. Post-move verification checklist mirroring section B.

### Technical notes
One migration (`handle_new_user`, `resolve_org_plan`, `assert_within_quota`, org backfill). Code changes limited to `billing.functions.ts`, `settings.billing.tsx`, `TopBar.tsx`, `PlanStatusBanner.tsx`, `PlanLimitDialog` call sites, `plans.ts` copy, landing pricing section, plus whatever the sweep in B turns up. No Paddle files deleted.
