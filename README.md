# ClauseGraph

> **Predictive legal-compliance intelligence.** Upload contracts, cite regulations, and simulate the blast radius of any rule — real, hypothetical, or forecasted — across your portfolio _and_ your supply chain. Then ship the fix as executable code.

<p align="center"><em>Legal-grade rigor. Product-grade UX. One workspace.</em></p>

---

## 🚀 Quick Start

### Option A: 1-Click Hackathon Evaluation

1. Launch the app locally or visit the deployment.
2. Go to `/auth` and click **"⚡ Instant Hackathon Demo (1-Click Judge Access)"**.
3. You're auto-provisioned into an enterprise workspace with pre-seeded contracts, curated regulatory ontology, and multi-tier supply chain.
4. Open **Simulate Impact**, paste any regulation, and watch the blast radius calculate financial exposure live!

### Option B: Run with Docker Compose (PostgreSQL 16 + Web App)

```bash
# 1. Clone & copy environment variables
cp .env.example .env

# 2. Start PostgreSQL and the fullstack app
docker compose up --build
```

Open [http://localhost:3000](http://localhost:3000) in your browser. All tables, functions, and seed data are automatically initialized via `docker/init.sql`.

---

## ✨ Feature Catalog

Each feature below lists **what it does**, **when to use it**, **where to find it**, and **what powers it** under the hood.

### 1. Portfolio Dashboard

- **What**: A workspace-wide overview — total contract value, exposure, and a live medallion showing citation density across your portfolio.
- **Use case**: The first tab any GC or CFO opens on Monday morning.
- **Where**: `/dashboard`
- **Powered by**: `GraphMedallion.tsx` + `getContractsFn()` (PostgreSQL `json_agg` clauses)

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

### 4. Evidence-Backed Impact Analysis 🌊

- **What**: Paste any regulation (real or draft) or select from tracked filings, and click **Analyze Impact**. A 3-stage pipeline (candidate retrieval → Zod-validated classifier with mandatory verbatim substring quote verification → deterministic exposure aggregation) evaluates compliance. Cards highlight verbatim contract clauses and statutory rules, provide official citation URLs, confidence scores, and provenance badges (`source_text`, `ai_interpretation`, `heuristic`, `synthetic`, `human_approved`).
- **Use case**: "The new EU AI Act draft dropped this morning — what breaks, which contracts are exposed, and what are the exact statutory quotes?"
- **Where**: `/simulate` (or top-bar CTA on any page)
- **Powered by**: `src/lib/impact/orchestrate.server.ts`, `classify.server.ts`, `candidates.server.ts`, `exposure.server.ts`

### 5. Empirical Evaluation & Landmark Case Studies 🎯

- **What**: Automated evaluation harness benchmarks over a 70-pair ground-truth gold dataset (`eval/gold/gold_dataset.jsonl`), validating 100% quote validity, ≥85% precision, ≥75% recall, and 100% prompt-injection resistance. Below the live benchmark metrics, reconstructed contract scenarios for landmark enforcement actions (Meta €1.2B DPC decision, Equifax $700M CFPB/FTC settlement) run live through the pipeline.
- **Use case**: Boardroom credibility and empirical audit: "Prove the pipeline catches known enforcement outcomes and never hallucinates legal quotes."
- **Where**: `/backtest`
- **Powered by**: `npm run eval`, `eval/run.ts`, `eval/reports/latest.json`, `BacktestCard.tsx`

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

- **What**: The supply-chain cascade engine traces recursive contract dependencies — Your Organization → Cloud Infrastructure Provider → Data Center → Network Gateway → Subprocessors. Instead of heuristic guessing, a **deterministic BFS shortest-path cascade** traverses dependency edges matching the regulatory obligations, computes pass-through exposure factors, and determines contract-value-weighted severities.
- **Use case**: DORA Article 28, NIS2, CSRD, and third-party risk management audits.
- **Where**: `/supply-chain`
- **Powered by**: `supply-chain.server.ts::computeDeterministicBfsCascade`, `SupplyChainGraph.tsx`, tables `supply_chain_nodes` + `supply_chain_edges`

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

## 🌍 Regulatory Coverage & Legal Instruments

Verified legal instruments across EU, US, and Bangladesh are maintained in `public.legal_instruments` with official URLs, retrieval timestamps, and statutory lifecycle statuses:

| Jurisdiction | Legal Instrument                              | Primary Citation / Identifier     | Status                                  | Official Source                                                                                                                      |
| ------------ | --------------------------------------------- | --------------------------------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| 🇪🇺 EU        | General Data Protection Regulation (GDPR)     | Regulation (EU) 2016/679          | In Force                                | [EUR-Lex 32016R0679](https://eur-lex.europa.eu/eli/reg/2016/679/oj)                                                                  |
| 🇪🇺 EU        | EU Artificial Intelligence Act                | Regulation (EU) 2024/1689         | In Force (Phased)                       | [EUR-Lex 32024R1689](https://eur-lex.europa.eu/eli/reg/2024/1689/oj)                                                                 |
| 🇪🇺 EU        | Digital Omnibus on AI                         | Regulation (EU) 2026/1744         | In Force                                | [OJ L 2026/1744](https://eur-lex.europa.eu/eli/reg/2026/1744/oj)                                                                     |
| 🇺🇸 US        | Broker-Dealer Electronic Recordkeeping        | 17 CFR §240.17a-4                 | In Force                                | [eCFR Title 17 §240.17a-4](https://www.ecfr.gov/current/title-17/section-240.17a-4)                                                  |
| 🇺🇸 US        | HIPAA Security Rule (Technical Safeguards)    | 45 CFR §164.312                   | In Force                                | [eCFR Title 45 §164.312](https://www.ecfr.gov/current/title-45/section-164.312)                                                      |
| 🇺🇸 US        | California Consumer Privacy Act (CCPA / CPRA) | Cal. Civ. Code §1798.100 et seq.  | In Force                                | [California Legislative Info](https://leginfo.legislature.ca.gov/faces/codes_displayText.xhtml?lawCode=CIV&division=3.&title=1.81.5) |
| 🇺🇸 US        | SEC Cybersecurity Disclosure Rule             | 17 CFR Parts 229 & 249            | In Force                                | [SEC Release No. 33-11216](https://www.sec.gov/rules/final/2023/33-11216.pdf)                                                        |
| 🇺🇸 US        | Sarbanes-Oxley Act Internal Controls          | 15 U.S.C. §7262 (§404)            | In Force                                | [GovInfo 15 U.S.C. §7262](https://www.govinfo.gov/app/details/USCODE-2022-title15/USCODE-2022-title15-chap98-subchapIV-sec7262)      |
| 🇧🇩 BD        | Cyber Security Ordinance 2025                 | Ordinance No. 25 of 2025          | **In Force (21 May 2025)**              | [Bangladesh Gazette](https://digitalpolicyalert.org/event/38587-cyber-security-ordinance-2025)                                       |
| 🇧🇩 BD        | Digital Security Act 2018                     | Act No. 46 of 2018                | **Repealed** (by CSO 2025 via CSA 2023) | [Laws of Bangladesh](http://bdlaws.minlaw.gov.bd/act-1262.html)                                                                      |
| 🇧🇩 BD        | Bangladesh Labour Act 2006                    | Act No. 42 of 2006 (§26 Notice)   | In Force                                | [Laws of Bangladesh](http://bdlaws.minlaw.gov.bd/act-957.html)                                                                       |
| 🇧🇩 BD        | BB Digital Payment Security Guidelines        | PSD Circular (2FA/Tokenisation)   | In Force                                | [Bangladesh Bank](https://www.bb.org.bd/)                                                                                            |
| 🇧🇩 BD        | Personal Data Protection Ordinance 2025       | Draft / Advisory Council Approval | Verification Pending                    | [Dhaka Tribune / Advisory Council](https://www.dhakatribune.com/bangladesh/393590/bangladesh-government-approves-personal-data)      |

> [!NOTE]
> **Stale Citation Detection:** ClauseGraph automatically flags contract clauses citing repealed laws (such as DSA 2018 §26) and provides an alert banner with the statutory repeal chronology: `DSA 2018 (Repealed)` → `CSA 2023 (Repealed)` → `CSO 2025 (In Force)`.

---

## 💰 Plans & Limits

**Current state: every workspace is on Pro, free, with unlimited usage.**
Billing is parked while the product is in early access — there is no trial
countdown, no paywall and no upgrade nag anywhere in the product.

|                                                                     | **Today (early access)** |
| ------------------------------------------------------------------- | :----------------------: |
| Contracts                                                           |            ∞             |
| Simulations / month                                                 |            ∞             |
| Team members                                                        |            ∞             |
| Every feature (Radar, Supply Chain, Compliance-as-Code, PDF export) |            ✓             |
| Price                                                               |            $0            |

<details>
<summary>The tier design kept for when billing is switched on</summary>

|                                       | **Free** | **Pro** — $49/mo | **Team** — $199/mo |
| ------------------------------------- | :------: | :--------------: | :----------------: |
| Contracts                             |    3     |        50        |         ∞          |
| Simulations / month                   |    5     |       100        |         ∞          |
| Team members                          |    1     |        3         |         ∞          |
| Action plans + PDF export             |    —     |        ✓         |         ✓          |
| Predictive Radar / Compliance-as-Code |    —     |        ✓         |         ✓          |

Enabling it takes two edits: `public.billing_enabled()` → `SELECT true`, and
`BILLING_ENABLED = true` in `src/lib/plans.ts`. Limits are enforced at the
database (`assert_within_quota`) — no client bypass is possible.

</details>

---

## 🧰 Tech at a Glance

- **Frontend** — React 19, TanStack Start v1, TanStack Router (file-based), TanStack Query, Vite, TypeScript strict, Tailwind v4, shadcn/ui.
- **Backend** — Pure PostgreSQL 16+ (`pg` connection pool with `withOrg()` RLS transaction context), dedicated `clausegraph_app` application role, TanStack `createServerFn` RPC data layer.
- **Sessions & Auth** — HttpOnly, Secure, SameSite=Lax cookie-based sessions, server-side revocable session table (`public.sessions`), signed JWT invite tokens, fail-closed JWT secrets.
- **Rate Limiting** — In-memory sliding-window token bucket enforcing 10 req/min per IP on auth endpoints and 30 req/hr per org on AI analysis.
- **Background Worker** — Durable PostgreSQL queue (`SELECT FOR UPDATE SKIP LOCKED`), exponential backoff (`3^attempts * 5s`), dead-letter queueing after 3 failed attempts (`npm run worker`).
- **AI Routing** — Multi-provider routing (OpenAI GPT-4o → Google Gemini via OpenAI-compat URL → Lovable gateway → Deterministic fallback).
- **Evaluation Harness** — Automated quality benchmarks (`npm run eval`) testing against 70 ground-truth pairs with verbatim quote verification and adversarial injection defenses.

Deep detail: see **[`ARCHITECTURE.md`](./ARCHITECTURE.md)** — including the complete PostgreSQL DDL and every SQL function.

### CLI Commands

```bash
# Run type check and linter
npx tsc --noEmit
npx eslint .

# Run test suite
npm test

# Run quality evaluation benchmark harness (Precision, Recall, Quote Validity)
npm run eval

# Run database migrations
npm run db:migrate

# Run background ingestion worker
npm run worker
```

---

## 🗂 Project Structure (condensed)

```
src/
├── routes/                     File-based routes (public + _authenticated/)
├── components/clausegraph/     Product components (AppShell, ProvenanceBadge, BacktestCard, ...)
├── components/ui/              shadcn primitives
├── lib/db.server.ts            Native PostgreSQL pool (pg) & query helpers with withOrg()
├── lib/auth.server.ts          Auth service, bcrypt hashing, HttpOnly session store & revocation
├── lib/auth.functions.ts       Auth server functions (signIn, signUp, demoLogin, signOut)
├── lib/rate-limit.server.ts    Sliding-window token bucket rate limiter
├── lib/impact/                 Evidence-backed impact pipeline (candidates, classify, orchestrate)
├── lib/sources/                Regulatory adapters (Federal Register, eCFR, EUR-Lex, BD curated)
├── lib/supply-chain.server.ts  Deterministic BFS supply-chain cascade algorithm
├── lib/*.functions.ts          Domain server functions (simulate, action-plan, upload, ...)
├── data/                       Query factories + types
eval/
├── gold/gold_dataset.jsonl     70 ground-truth pairs (60 statutory + 10 adversarial vectors)
├── run.ts                      Automated benchmark execution harness
└── reports/                    Committed evaluation reports (JSON + Markdown)
db/migrations/                  Numbered, idempotent migration files (0000..0005)
```

---

## 🔐 Security & Defenses

- **Row-Level Security (RLS)**: Enforced across all tenant tables (`USING (org_id = current_setting('app.org_id')::uuid)`) connecting as unprivileged role `clausegraph_app`.
- **HttpOnly Session Cookies**: Session tokens stored in secure, HttpOnly, SameSite=Lax cookies with SHA-256 session token revocation table in PostgreSQL (`public.sessions`).
- **Fail-Closed Secrets**: `getJwtSecret()` fails closed in production if unset or under 32 characters, generating ephemeral random secrets with warnings in development.
- **Untrusted Input Boundaries**: External contract clauses and statutory texts are delimited within XML boundary tags (`<untrusted_clause>`, `<untrusted_obligation>`) preventing prompt-injection breakouts.
- **Verbatim Quote Verification**: Code verifies that all extracted quotes are exact substrings of source documents, failing closed to `insufficient_evidence` if quotes are hallucinated.
- **Sliding-Window Rate Limiting**: Token-bucket rate limiting shields authentication and AI simulation endpoints against brute-force and resource exhaustion attacks.
- **Append-Only Audit Log**: Security-relevant actions and review decisions are recorded in `public.audit_log` with database triggers preventing UPDATE or DELETE.

---

## 🩺 Troubleshooting

| Symptom                                   | Cause                                                                                                    | Fix                                                                   |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| "Contract not found" after a re-seed      | Sample contract IDs were regenerated                                                                     | Return to `/contracts` and open the newly-seeded item                 |
| Header says PRO but billing looked "Free" | Fixed — plan is now resolved server-side from one source; while billing is parked every workspace is Pro | Nothing to do; hard-refresh if a stale tab is open                    |
| Blank panels on a self-hosted deployment  | Server-side env vars missing on the host                                                                 | Set the `SUPABASE_*` / AI key server variables (see deployment notes) |
| "Unsupported provider" on Google sign-in  | Google OAuth not enabled for the project                                                                 | Ask the workspace owner to enable Google via the Connectors settings  |
| Simulate returns a canned result          | AI Gateway rate-limited or unreachable — deterministic fallback served                                   | Retry in a minute; check `LOVABLE_API_KEY` in your project secrets    |
| Upload stuck on "Extracting…"             | Gemini timeout on a very large PDF                                                                       | Split into smaller docs; the state auto-recovers on retry             |

---

## 🗺 Roadmap

- Multi-language contract extraction (Bangla, German, French)
- Redlining suggestions rendered directly on the source PDF
- Slack / Teams delivery of daily Federal Register + ontology-matched digest
- Public API for programmatic Simulate Impact
- SSO (SAML / SCIM) on Enterprise

---
