# Documentation: ARCHITECTURE.md + README.md

Create two top-level markdown files that fully document ClauseGraph — from stack to schema to every feature. No code changes.

## File 1 — `ARCHITECTURE.md` (deep technical reference)

1. **Overview** — one-paragraph product summary + high-level system diagram (Mermaid).
2. **Tech Stack** (exhaustive, with role of each):
   - **Frontend:** React 19, TanStack Start v1, TanStack Router (file-based), TanStack Query, Vite 7, TypeScript (strict), Tailwind v4, shadcn/ui, Radix primitives, lucide-react, Sora / Manrope / JetBrains Mono, `next-themes` pattern via custom `theme-provider`.
   - **Backend:** Lovable Cloud (Supabase Postgres + Auth + Storage + RLS), TanStack `createServerFn` for app-internal RPC, TanStack API routes under `src/routes/api/public/*` for webhooks.
   - **AI:** Lovable AI Gateway — Gemini 2.5 Flash (contract extraction), GPT-4o (Simulate Impact, Action Plan, hypothetical amendments, Compliance-as-Code).
   - **Billing:** Paddle (server: Node SDK; client: Paddle.js), sandbox + live webhook secrets.
   - **External APIs:** Federal Register (`/api/v1/documents`).
   - **Utility libs:** `jspdf`, `zod`, `date-fns`, `@tanstack/react-query`.
   - **Runtime:** Cloudflare Workers (nodejs_compat) via TanStack Start SSR.
3. **Folder Structure** — annotated tree, every directory and its role:
   - `src/routes/` — every route file with purpose: `__root.tsx`, `index.tsx`, `auth.tsx`, and under `_authenticated/`: `dashboard`, `contracts`, `contracts.$id`, `regulations`, `simulate`, `backtest`, `action-plan`, `radar`, `sandbox`, `supply-chain`, `settings`. Plus `routes/api/public/paddle-webhook.ts`.
   - `src/components/clausegraph/` — every component + its role (AppShell, Sidebar, TopBar, GraphMedallion, ContractCard, ClauseRow, RegulationPill, FederalRegisterFeed, BacktestCard, ActionPlanPanel, SupplyChainGraph, ComplianceCodePanel, PlanLimitDialog, PlanStatusBanner, theme-provider, etc.).
   - `src/components/ui/` — shadcn primitives in use.
   - `src/lib/` — every `*.functions.ts` server function file and its handler (simulate, action-plan, contract-upload, predict-amendment, supply-chain-trace, compliance-code, paddle-checkout, quota).
   - `src/integrations/supabase/` — `client`, `client.server`, `auth-middleware`, `auth-attacher`, `types` (with note: auto-generated, don't edit).
   - `src/data/` — seed sources (ontology, contracts, backtest cases, historical amendments).
   - `src/hooks/`, `src/styles.css` (all design tokens), `src/start.ts`, `src/router.tsx`.
4. **System Architecture** — Mermaid diagram: Browser ↔ TanStack SSR (Cloudflare Worker) ↔ Supabase (Postgres/Auth/Storage) ↔ AI Gateway / Paddle / Federal Register. Explains the three Supabase clients (browser publishable, `requireSupabaseAuth`, `supabaseAdmin`) and where each is used.
5. **Data Flow Walk-throughs** — Mermaid sequence diagrams for:
   - Contract upload → Storage → extraction serverFn → Gemini → `clauses` table.
   - Simulate Impact → serverFn → GPT-4o → `simulation_runs` → medallion render.
   - Paddle checkout → `/api/public/paddle-webhook` (HMAC verified) → `subscriptions` / `organizations` update.
   - Quota check (`assert_within_quota`) trial → free downgrade path.
   - Supply-chain recursive trace.
6. **Database — Full Reference**
   - Mermaid `erDiagram` covering every table: `organizations`, `profiles`, `user_roles`, `contracts`, `clauses`, `regulations`, `regulation_amendments`, `simulation_runs`, `backtest_cases`, `compliance_artifacts`, `supply_chain_nodes`, `supply_chain_edges`, `subscriptions`, `paddle_events`, `sample_contracts`, `sample_clauses`.
   - Per-table reference: columns, types, FKs, indexes, RLS policies, GRANTs (queried via `supabase--read_query`).
   - All DB functions in SQL fences: `has_role`, `current_org_id`, `handle_new_user`, `get_org_usage`, `assert_within_quota`, `request_workspace_deletion`, `cancel_workspace_deletion`, `seed_supply_chain`.
   - `app_role` enum, storage bucket `contract-files`.
7. **Auth & Multi-Tenancy** — Supabase Auth (email + Google OAuth via Lovable broker), `handle_new_user` trigger creates org + admin role + 30-day Pro trial + seeds sample contracts + supply chain, `user_roles` isolation, `has_role` security-definer function, org-scoped RLS via `current_org_id()`.
8. **Billing & Entitlements** — Paddle products/prices, webhook signature verification, subscription lifecycle (`trialing`/`active`/`past_due`/`canceled`), dunning, pro-rated plan swap, quota table (Free 3/5/1, Pro 50/100/3, Enterprise ∞), 30-day soft-delete window.
9. **AI Pipelines** — model per task, prompt shape, input/output contracts, fallbacks and error handling.
10. **Design System** — Obsidian & Mint tokens (every CSS variable from `styles.css`), typography scale, radii (20 / 12), motion (150–200ms), glass recipe, sidebar rail behavior, medallion animation, light/dark theme wiring.
11. **Routing Map** — table of every route: layout parent, auth requirement, purpose.
12. **Environment & Secrets** — used env/secrets (`LOVABLE_API_KEY`, `PADDLE_*`, `SUPABASE_*` — noting service role is Cloud-managed and not user-fetchable).
13. **Build, Dev, Deploy** — Vite dev flow, Cloudflare Worker runtime notes, `/api/public/*` prefix behavior.
14. **Known Constraints** — Worker runtime limits, no Node-only libs, RLS/GRANT rule.

## File 2 — `README.md` (product + feature guide)

1. **What is ClauseGraph** — 3-sentence pitch + hero screenshot placeholder.
2. **Quick Start** — sign in → auto 30-day Pro trial → sample contracts + supply chain seeded → try Simulate Impact.
3. **Feature Catalog** — one subsection per feature, each with: what it does, use case, where it lives in the UI, which route/component/serverFn powers it:
   - Dashboard portfolio overview
   - Contracts list & detail (clause ↔ regulation citations)
   - Regulatory Feed (curated ontology + live Federal Register)
   - Simulate Impact (paste regulation → blast radius on medallion)
   - Backtested Validation (historical enforcement cases)
   - Compliance Action Plan (structured report + PDF export)
   - Predictive Regulatory Radar (6–18 month forecast)
   - What-If Sandbox (LLM-drafted hypothetical rule → simulate)
   - Cross-Enterprise Supply Chain Blast Radius (recursive dependency graph)
   - Compliance-as-Code Autopilot (Python audit + Terraform fix)
   - Contract Upload Pipeline (PDF → Storage → Gemini extraction → clauses)
   - Team & Roles (admin/member, invites)
   - Billing (Free / Pro / Enterprise, trial, upgrade/downgrade, dunning)
   - Workspace deletion (30-day grace)
   - Light/Dark theme
4. **Regulatory Coverage** — the 10-regulation ontology (3 GDPR, 4 US, 3 Bangladesh) as a table.
5. **Plans & Limits** — pricing table with quotas per plan.
6. **Tech at a Glance** — short stack summary; link to `ARCHITECTURE.md`.
7. **Project Structure** — condensed tree.
8. **Security** — RLS, role separation, webhook signature verification, no PII on public routes.
9. **Troubleshooting** — common issues (stale sample IDs after re-seed, trial expiry, OAuth setup).
10. **Roadmap / Credits.**

## Notes
- Both files placed at repo root.
- All SQL, code, and diagrams in fenced blocks with language tags.
- Mermaid used for system, sequence, and ER diagrams.
- Documentation only — no product code changes.
