# ClauseGraph

> **Predictive legal-compliance intelligence.** Upload contracts, cite regulations, and simulate the blast radius of any rule — real, hypothetical, or forecasted — across your portfolio *and* your supply chain. Then ship the fix as executable code.

<p align="center"><em>Legal-grade rigor. Product-grade UX. One workspace.</em></p>

---

## 🚀 Quick Start

1. **Sign in** at `/auth` — email/password or Google.
2. You're auto-provisioned a private workspace on **Pro, free, with unlimited usage** (early access — no trial clock, no card, nothing to cancel), pre-seeded with a sample contract corpus and a supply-chain graph.
3. Open **Simulate Impact**, paste any regulation text, and watch the blast radius render on the central medallion.
4. Click **Generate Action Plan** to get a policy draft, amendment language, and a technical checklist you can export as PDF.

No setup, no credit card, no ceremony.


---

## ✨ Feature Catalog

Each feature below lists **what it does**, **when to use it**, **where to find it**, and **what powers it** under the hood.

### 1. Portfolio Dashboard
- **What**: A workspace-wide overview — total contract value, exposure, and a live medallion showing citation density across your portfolio.
- **Use case**: The first tab any GC or CFO opens on Monday morning.
- **Where**: `/dashboard`
- **Powered by**: `GraphMedallion.tsx` + `supabase.from('contracts').select(..., clauses(*))`

### 2. Contracts List & Detail
- **What**: Glass-card list of every contract with name, counterparty, value (mono), and clause-count badge. Detail view shows every clause with brass-outlined pills linking to the regulations it cites.
- **Use case**: Discovery — "which clauses in the Meridian MSA reference GDPR Article 44?"
- **Where**: `/contracts`, `/contracts/:contractId`
- **Powered by**: `ContractCard.tsx`, `ClauseRow.tsx`, `RegulationPill.tsx`

### 3. Regulatory Feed (Curated + Live)
- **What**: Your **10-regulation ontology** (see §Coverage) beside a **live Federal Register widget** showing the 5 most recent filings. Curated and live are visually separated so it's always obvious which is which.
- **Use case**: Daily situational awareness for compliance leads.
- **Where**: `/feed`
- **Powered by**: `FederalRegisterFeed.tsx` + `https://www.federalregister.gov/api/v1/documents`

### 4. Simulate Impact 🌊
- **What**: Paste any regulation (real or draft), click **Simulate Impact**. GPT-4o analyzes the pasted text against your contract corpus and the ontology, then the medallion's nodes light up **risk-red** for impacted contracts. A side panel shows total exposure in USD and per-contract amendment suggestions.
- **Use case**: "The new EU AI Act draft dropped this morning — what breaks?"
- **Where**: `/simulate` (or top-bar CTA on any page)
- **Powered by**: `simulate.functions.ts::simulateImpact` (GPT-4o), `GraphMedallion.tsx`

### 5. Backtested Validation
- **What**: A library of real enforcement cases (Meta / GDPR, Equifax / CCPA, Grameenphone / BTRC, etc.). Click **Run Analysis** and ClauseGraph reconstructs the pre-fine scenario and pipes it through the same Simulate Impact engine — proving the model catches known failures.
- **Use case**: Trust-building. Show the board "we would have caught this."
- **Where**: `/backtest`
- **Powered by**: `backtest.functions.ts::runBacktest`, `BacktestCard.tsx`

### 6. Compliance Action Plan
- **What**: From any simulation, generate a structured report: **policy draft**, **amendment language per contract**, **technical fix checklist**, timeline. One-click **Export to PDF**.
- **Use case**: Hand-off doc for outside counsel + engineering.
- **Where**: `/actions`
- **Powered by**: `action-plan.functions.ts::generateActionPlan` (GPT-4o), `jspdf`, `ActionPlanPanel.tsx`

### 7. Predictive Regulatory Radar 🔮
- **What**: A lightweight predictive model over historical amendment velocity forecasts which regulations are most likely to change in the next **6–18 months**. For each prediction the LLM drafts a **hypothetical amendment text**, which is then run through Simulate Impact to give you a pre-mortem blast radius.
- **Use case**: Strategic planning. Redirect Q3 legal budget to the regulation with a 78% amendment probability.
- **Where**: `/predictive`, `/predictive/:regulationId`
- **Powered by**: `predict.functions.ts::predictAmendment`, `regulation_amendments` table

### 8. What-If Sandbox
- **What**: A free-form playground — type a hypothesis ("what if GDPR banned all US transfers?") and get a synthesized rule + full simulation.
- **Use case**: Board tabletop exercises, scenario stress tests.
- **Where**: `/what-if`
- **Powered by**: same pipeline as Simulate Impact

### 9. Cross-Enterprise Supply Chain Blast Radius 🕸️
- **What**: The killer feature. ClauseGraph traces recursive contract dependencies — Your Company → Cloud Provider → Data Center → Energy Utility → Card Network. A regulation firing at Tier 3 cascades **red** back to you through every intermediate contract, showing indirect exposure most tools miss.
- **Use case**: DORA, CSRD, and third-party-risk audits.
- **Where**: `/supply-chain`
- **Powered by**: `supply-chain.functions.ts::traceSupplyChain`, `SupplyChainGraph.tsx`, tables `supply_chain_nodes` + `supply_chain_edges`

### 10. Compliance-as-Code Autopilot ⚙️
- **What**: For any identified gap, generate an executable **Python audit script** (proves the gap in your infra) plus a **Terraform remediation** (fixes it) plus a runbook. Rendered in a terminal-style panel — copy, run, done.
- **Use case**: Close the loop between legal advice and engineering delivery.
- **Where**: `/supply-chain` → Compliance-as-Code tab
- **Powered by**: `compliance-code.functions.ts::generateComplianceCode` (GPT-4o), `ComplianceCodePanel.tsx`, `compliance_artifacts` table

### 11. Contract Upload Pipeline
- **What**: Drag a PDF. It's uploaded to private Storage, a Gemini 2.5 Flash extractor parses out clauses and their linked regulations, and the contract appears in the list within seconds.
- **Use case**: Onboarding your real portfolio.
- **Where**: `/contracts` → **Upload**
- **Powered by**: `upload.functions.ts::extractContract`, bucket `contract-files`, Gemini 2.5 Flash

### 12. Team & Roles
- **What**: Invite teammates, promote/demote between `admin` and `member`. Role isolation is enforced by RLS + `has_role()` — no client-side checks.
- **Where**: `/settings/team`
- **Powered by**: `team.functions.ts`, `user_roles` table

### 13. Billing — parked (everything is free right now)
- **What**: Subscriptions are fully built but **switched off**. Every workspace runs on Pro with unlimited contracts, simulations and seats. `/settings/billing` shows a plain "early access — nothing to pay" panel instead of pricing cards, and no upgrade prompt exists anywhere in the app.
- **Under the hood**: the Paddle integration stays intact — checkout, pro-rated plan swaps via the Paddle Node SDK, customer portal, dunning, and the HMAC-verified webhook. Two switches turn it on: `public.billing_enabled()` in the database and `BILLING_ENABLED` in `src/lib/plans.ts`. Flip both and the paid experience returns with no rebuild.
- **Where**: `/settings/billing`
- **Powered by**: `billing.functions.ts`, `usePaddleCheckout.ts`, webhook `/api/public/payments/webhook`


### 14. Workspace Deletion (30-day grace)
- **What**: Admin schedules deletion; workspace remains restorable for 30 days. Admins can cancel any time before the deadline.
- **Where**: `/settings/account`
- **Powered by**: `request_workspace_deletion` / `cancel_workspace_deletion` SQL functions

### 15. Light / Dark Theme
- **What**: The Obsidian & Mint palette in dark, plus a warm "Paper & Ink" light mode. Persisted per-device.
- **Where**: Sidebar footer toggle
- **Powered by**: `theme-provider.tsx`

---

## 🌍 Regulatory Coverage

Ten regulations across three jurisdictions ship in the ontology out of the box:

| Jurisdiction | Regulation | ID |
|---|---|---|
| 🇪🇺 EU | GDPR — Lawful Basis (Art. 6) | `GDPR-ART6` |
| 🇪🇺 EU | GDPR — International Transfers (Art. 44) | `GDPR-ART44` |
| 🇪🇺 EU | GDPR — Breach Notification (Art. 33) | `GDPR-ART33` |
| 🇺🇸 US | SEC Cybersecurity Disclosure Rule | `SEC-CYBER` |
| 🇺🇸 US | CCPA / CPRA | `CCPA` |
| 🇺🇸 US | HIPAA — Security Rule | `HIPAA-SEC` |
| 🇺🇸 US | Sarbanes-Oxley §404 | `SOX-404` |
| 🇧🇩 BD | Digital Security Act 2018 | `BD-DSA` |
| 🇧🇩 BD | BTRC Data Localization Directive | `BD-BTRC-LOC` |
| 🇧🇩 BD | Bangladesh Bank ICT Security Guideline | `BB-ICT-SEC` |

Add more by inserting into `public.regulations` — the whole app auto-picks them up.

---

## 💰 Plans & Limits

| | **Free** | **Pro** (30-day trial default) | **Enterprise** |
|---|:-:|:-:|:-:|
| Contracts | 3 | 50 | ∞ |
| Simulations / month | 5 | 100 | ∞ |
| Team members | 1 | 3 | ∞ |
| Predictive Radar | — | ✓ | ✓ |
| Compliance-as-Code | — | ✓ | ✓ |
| Supply-chain graph | Preview | Full | Full + custom nodes |
| SSO / audit log | — | — | ✓ |

Limits are enforced at the database (`assert_within_quota`) — no client bypass is possible.

---

## 🧰 Tech at a Glance

- **Frontend** — React 19, TanStack Start v1, TanStack Router (file-based), TanStack Query, Vite 7, TypeScript strict, Tailwind v4, shadcn/ui.
- **Backend** — Lovable Cloud (Supabase Postgres + Auth + Storage + RLS), TanStack `createServerFn`, Cloudflare Workers.
- **AI** — Lovable AI Gateway (Gemini 2.5 Flash + GPT-4o).
- **Billing** — Paddle (Node SDK + Paddle.js).
- **External** — Federal Register API.

Deep detail: see **[`ARCHITECTURE.md`](./ARCHITECTURE.md)**.

### Vercel deployment notes

ClauseGraph now detects Vercel builds and emits Nitro's Vercel Build Output API bundle, so authenticated server-function routes such as **Supply Chain** and **Predictive Radar** run as Vercel functions instead of collapsing into static-only routing.

Set the same production environment variables in Vercel that the app uses at runtime: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `LOVABLE_API_KEY`, and the Paddle variables used by billing/webhooks. Private backend values must stay in Vercel's encrypted environment-variable UI — never commit them.

---

## 🗂 Project Structure (condensed)

```
src/
├── routes/                     File-based routes (public + _authenticated/)
├── components/clausegraph/     Product components (AppShell, Sidebar, GraphMedallion, ...)
├── components/ui/              shadcn primitives
├── lib/*.functions.ts          Server functions (simulate, action-plan, upload, ...)
├── integrations/supabase/      Auto-generated Supabase clients + middleware
├── data/                       Query factories + types
├── hooks/                      Paddle, mobile
└── styles.css                  Every design token
```

---

## 🔐 Security

- **Row-Level Security** on every user-facing table, scoped by `current_org_id()`.
- **Roles in a separate table** (`user_roles`) — never on `profiles`. Checked via the `SECURITY DEFINER` function `has_role()` to prevent recursion and privilege escalation.
- **Webhooks** verified with HMAC + `timingSafeEqual` before any privileged write.
- **Service-role key** is used only inside verified webhook handlers, loaded via dynamic import so it never enters the client bundle.
- **`/api/public/*` routes** bypass the auth wall by design — every handler re-verifies the caller before acting.

---

## 🩺 Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| "Contract not found" after a re-seed | Sample contract IDs were regenerated | Return to `/contracts` and open the newly-seeded item |
| Trial banner disappears and quotas tighten | 30-day Pro trial expired, no paid subscription | Upgrade in `/settings/billing` — takes effect immediately |
| "Unsupported provider" on Google sign-in | Google OAuth not enabled for the project | Ask the workspace owner to enable Google via the Connectors settings |
| Simulate returns a canned result | AI Gateway rate-limited or unreachable — deterministic fallback served | Retry in a minute; check `LOVABLE_API_KEY` in your project secrets |
| Upload stuck on "Extracting…" | Gemini timeout on a very large PDF | Split into smaller docs; the state auto-recovers on retry |

---

## 🗺 Roadmap

- Multi-language contract extraction (Bangla, German, French)
- Redlining suggestions rendered directly on the source PDF
- Slack / Teams delivery of daily Federal Register + ontology-matched digest
- Public API for programmatic Simulate Impact
- SSO (SAML / SCIM) on Enterprise

---


