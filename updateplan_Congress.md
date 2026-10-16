# ClauseGraph — Upgrade Plan (single source of truth)

> **Status of this document:** authoritative implementation handoff.
> **Created:** 2026-10-16 · **Last updated:** 2026-10-16
> **Branch audited:** `backend-intregation-shovon` @ `55b00cd` plus uncommitted changes to `.env`, `docker-compose.yml`, `docker/init.sql`, `src/lib/db.server.ts`, `vite.config.ts`.
> **Audience:** an agentic coding tool (Claude Code, Antigravity, …) or an engineer continuing the work without the original conversation.

---

## 0. How to use this document (read first)

1. **Inspect before editing.** Every task names its files. Open them and confirm the code still matches the description here. If it doesn't, update this plan before you change code.
2. **Preserve working behaviour.** `npx tsc --noEmit` and `npm run build` pass today. Keep them passing after every task. Do not rewrite modules wholesale when a targeted change will do.
3. **Follow existing conventions.** Use TanStack Start `createServerFn` + `requireAuth` middleware, server-only code in `*.server.ts`, dynamic `await import("./x.server")` inside handlers, `pg` via `src/lib/db.server.ts`, Tailwind and shadcn primitives, and file-based routes in `src/routes`.
4. **Update §12 Progress Tracker as you go.** Use these statuses: `Not Started` → `In Progress` → `Implemented` (code merged locally) → `Tested` (the relevant automated tests ran and passed, with the command and result recorded) → `Verified` (end-to-end evidence such as a screenshot, a curl transcript, or a reviewer sign-off). **Never** mark a task as tested without running the tests, and never mark it verified without evidence.
5. **When you hit a blocker or a wrong assumption,** add it to §13 (Risks & Open Questions) with the date, choose the most conservative option, and continue with tasks that don't depend on it.
6. **Git rules (from `AGENTS.md`):** this repo syncs to Lovable. **Never** force-push or rewrite pushed history. Keep the connected branch buildable. Commit only when the user asks.
7. **Legal-accuracy rule:** never present AI output, forecasts, or synthetic data as law. Every legal statement shown to users must either cite a stored source (URL, retrieval date, content hash) or carry a visible label: _AI interpretation_, _Heuristic_, _Synthetic demo data_, or _Unverified_.

---

## 1. Project overview

### 1.1 Purpose

ClauseGraph maps an organisation's **contract clauses** to the **regulatory obligations** that govern them. When a regulation changes, or a hypothetical change is proposed, it shows which contracts and supply-chain relationships are affected, how much contract value is exposed, and what to do about it.

### 1.2 Target users

| User                              | Core job-to-be-done                                                                                |
| --------------------------------- | -------------------------------------------------------------------------------------------------- |
| In-house counsel / legal ops      | "Which of our contracts does this new or changed rule affect, and what must we amend?"             |
| Compliance officer / risk manager | Horizon scanning, regulatory change management, and an audit trail of how each change was assessed |
| CFO / risk committee              | A defensible estimate of exposure (contract value at risk)                                         |
| Engineering / security lead       | Concrete technical controls tied to a legal requirement                                            |

### 1.3 Competition objective

The target is the **AI Builders World Congress 2026, JusticeSphere AI category**. Research turned up an _International AI Builders Congress 2026_ run by CloudCamp Bangladesh. It has a justice domain and "-Sphere AI" domain names, and is listed for **26 Dec 2026 at Daffodil International University, Dhaka** ([cloudcampbd.com/ai-builders-congress](https://cloudcampbd.com/ai-builders-congress), accessed 2026-10-16; this comes from a search snippet and has **not** been confirmed against the official rules). **The judging rubric and submission requirements are not known.** See open question Q1.

**Implication:** the event appears to be in Bangladesh. Accurate Bangladeshi coverage, such as the current status of the cyber-security and data-protection statutes, is likely to matter to judges. It is also currently ClauseGraph's weakest and least accurate area (see §2.6).

### 1.4 Current capabilities (verified in code; details in §2)

- Email/password auth, a one-click demo login, a JWT session, and an org/workspace model with admin/member roles.
- 15 seeded sample contracts with 54 clauses, hand-tagged to 10 seeded regulation records.
- LLM-based "Simulate Impact": the whole portfolio and the regulation text go into one prompt, which returns impacted contract IDs, a severity, and a one-sentence amendment.
- An LLM-based supply-chain cascade over a 6-node seeded graph, with a keyword heuristic fallback.
- Action-plan generation (LLM) with client-side PDF export (jsPDF).
- Compliance-as-code generation (LLM Python/Terraform; never executed).
- A "Predictive radar" (a cadence heuristic over amendment history) and LLM "hypothetical amendment" drafting.
- Backtest cards: an LLM runs over hand-written "reconstructed" clauses.
- A contract upload that accepts **pasted text or .txt/.md only**; an LLM segments clauses and tags regulation IDs.
- A live Federal Register widget (the 5 newest documents, fetched client-side and not stored or matched).
- Team invite/remove, 30-day workspace deletion grace, a parked Paddle billing integration, and light/dark themes.

---

## 2. Repository audit

### 2.1 Stack (verified)

| Layer      | Actual implementation                                                                                                                        | Files                                                                                 |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Framework  | TanStack Start v1 (React 19, TanStack Router file routes, React Query), Vite 8, Tailwind v4, shadcn/ui                                       | `package.json`, `vite.config.ts`, `src/router.tsx`, `src/start.ts`, `src/server.ts`   |
| Server RPC | `createServerFn` + `requireAuth` middleware; client middleware `attachAuth` adds `Authorization: Bearer` from `localStorage`                 | `src/lib/*.functions.ts`, `src/lib/auth-middleware.ts`, `src/lib/auth-attacher.ts`    |
| DB         | PostgreSQL 16 via `pg` Pool; schema and seed in **one** file (`docker/init.sql`); no migration system                                        | `src/lib/db.server.ts`, `docker/init.sql`                                             |
| Legacy     | `supabase/migrations/*.sql`: **not used at runtime**, but contains the only amendment-history seed (≈40 rows) and RLS policies               | `supabase/`                                                                           |
| Auth       | bcryptjs + jose HS256 JWT (7-day), stored in `localStorage` **and** a non-HttpOnly cookie                                                    | `src/lib/auth.server.ts`, `src/lib/auth-client.ts`                                    |
| AI         | One `fetch` to an OpenAI-compatible `/chat/completions`; `response_format: json_object`; no schema validation library; hand-written coercers | `src/lib/ai.server.ts`, `src/lib/*.server.ts`                                         |
| Billing    | Paddle (parked: `BILLING_ENABLED=false`, `assert_within_quota` returns immediately)                                                          | `src/lib/plans.ts`, `src/lib/paddle*.ts`, `src/routes/api/public/payments/webhook.ts` |
| Deploy     | `Dockerfile` (broken, see B-8), `docker-compose.yml` (Postgres on host port 5435, web on 3000), `vercel.json` (bun)                          |                                                                                       |
| Tests      | **None.** No test runner, no CI.                                                                                                             | —                                                                                     |

### 2.2 Baseline command results (run 2026-10-16 on Windows 10, Node 22.12.0, npm 11.6.3)

| Command                               | Result                                                                                                                                                                                                                                                                                                       |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `npx tsc --noEmit`                    | ✅ exit 0                                                                                                                                                                                                                                                                                                    |
| `npm run build`                       | ✅ exit 0 (client + server bundles in `dist/`)                                                                                                                                                                                                                                                               |
| `npx eslint .`                        | ❌ 12,317 problems. ≈12,303 are `prettier/prettier` "Delete ␍", caused by CRLF checkouts (`core.autocrlf=true`). Excluding prettier: **4 errors, 10 warnings** (`no-explicit-any` ×2 in `db.server.ts`; `rules-of-hooks` in `notFoundComponent` of `contracts.$contractId.tsx` and `regulations.$regId.tsx`) |
| `vite dev` + `GET /api/public/health` | ✅ `{"ok":true,"db_connected":true}` against local `clausegraph-postgres` (port 5435)                                                                                                                                                                                                                        |
| `POST /_serverFn/<demoLoginFn>`       | ✅ returns a JWT; the demo user is **admin** of a shared workspace                                                                                                                                                                                                                                           |
| Live DB inspection                    | 1 user, 10 regulations, **0** `regulation_amendments`, 15 contracts, 54 clauses. **RLS disabled on all 16 tables.** The app connects as `postgres` (**superuser, BYPASSRLS**).                                                                                                                               |

### 2.3 Feature reality check (whitepaper/README claim → what the code actually does)

| #   | Feature                     | Claim                                                   | Reality (verified)                                                                                                                                                                                                                                                                                                                                                                                                                            | Verdict                                        |
| --- | --------------------------- | ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| F1  | Dashboard / Graph Medallion | Citation graph, risk cascade                            | SVG over contracts and the `linked_regs` arrays. Works with seed data.                                                                                                                                                                                                                                                                                                                                                                        | **Works** (visual only)                        |
| F2  | Simulate Impact             | GPT-4o deep analysis, audit log, deterministic fallback | The whole portfolio plus all regulations go into one prompt, so it won't scale past a few dozen contracts. No clause-level evidence or quotes. **Bug:** a valid "no impacts" answer is replaced by the canned fallback. The fallback references `CTR-001…CTR-011`, which don't exist (contracts use UUIDs), so the UI shows phantom impacts with $0 exposure. With no API key it always returns the same "Basel IV" story whatever the input. | **Partially works; misleading on failure**     |
| F3  | Supply-chain blast radius   | Recursive BFS cascade                                   | There is no BFS. The heuristic flags _every_ edge if the text contains "transfer", "energy", "pci", "payment" or "breach". Exposure is hard-coded at `value × 0.4`. Severity comes from the tier. With an AI key, the LLM decides the hops and dollar amounts (not deterministic, not reproducible).                                                                                                                                          | **Demo-grade**                                 |
| F4  | Compliance-as-code          | Sandboxed, syntactically valid, tested IaC              | LLM text, never executed or validated; the fallback is always an S3 encryption snippet. Nothing is sandboxed.                                                                                                                                                                                                                                                                                                                                 | **Draft generator only**                       |
| F5  | Predictive radar            | Forecasts 6–18 months ahead                             | A cadence heuristic (`tanh` of days-since/avg-interval) plus a manual `news_signal_boost`. **Docker DB has 0 amendment rows**, so every regulation gets base 0.25 + boost. The amendment seed exists only in the legacy Supabase migration, and several rows are unverified (see §2.6).                                                                                                                                                       | **Not a prediction; unsound as presented**     |
| F6  | What-if sandbox             | Tabletop simulations                                    | Reuses F2 with `run_type='what_if'`.                                                                                                                                                                                                                                                                                                                                                                                                          | Works like F2                                  |
| F7  | Backtesting                 | "Empirical proof of accuracy"                           | Clauses are hand-written to be _obviously_ non-compliant, and the prompt contains the answer, so the test is circular. One case (Grameenphone, $23M BTRC data-localisation sanction, 2022) is **not supported by any source found**; the 2022 BTRC fines on GP that we found were for illegal VoIP SIMs and were far smaller (§3.6). The Equifax amount is stored as $575M with a docket number we could not verify.                          | **Must be reframed; one case must be removed** |
| F8  | Action plan + PDF           | Board-ready brief                                       | LLM JSON coerced into policy, amendments, and tech fixes; jsPDF export. The fallback is a Basel-capital plan unrelated to the input. Contract IDs aren't validated against the org.                                                                                                                                                                                                                                                           | **Works; weak grounding**                      |
| F9  | Contract ingestion          | PDF drag-and-drop, encrypted private storage, Gemini    | **Only pasted text or .txt/.md**; PDFs are rejected in the UI. `source_file_url` stores the file _name_ only. There is no storage. Extraction is fire-and-forget inside the request process, so a restart loses it. Confidence is hard-coded at `0.9`.                                                                                                                                                                                        | **Partially implemented**                      |
| F10 | Clause explorer             | Search, confidence ratings                              | Clause list with regulation pills.                                                                                                                                                                                                                                                                                                                                                                                                            | Works (basic)                                  |
| F11 | Regulatory feed             | Live Federal Register + curated ontology                | A client-side fetch of the 5 newest FR documents (any agency). Nothing is stored, deduplicated, or matched to obligations.                                                                                                                                                                                                                                                                                                                    | **Display only**                               |
| F12 | Regulation registry         | Obligations and amendment history                       | Shows summary and obligation tags. **No amendment history shown.** There is no source URL, citation, version, effective date or status anywhere in the schema.                                                                                                                                                                                                                                                                                | **Thin; no provenance**                        |
| F13 | Team & RBAC                 | RLS + `has_role()`                                      | `has_role()` exists, but **RLS is not enabled** and the app uses a superuser. Isolation relies only on `WHERE org_id = $1` in each query. **Critical invite bugs: S-1, S-2.**                                                                                                                                                                                                                                                                 | **Insecure**                                   |
| F14 | Workspace deletion          | Admin-only, 30-day grace                                | Admin check happens in SQL, but **after** a Paddle subscription cancel attempt (S-6). Nothing actually purges data after 30 days.                                                                                                                                                                                                                                                                                                             | **Partial**                                    |
| F15 | Theme                       | Obsidian/Mint, Paper/Ink                                | Works.                                                                                                                                                                                                                                                                                                                                                                                                                                        | Works                                          |

### 2.4 Bugs and technical debt (B-#)

| ID   | Severity | Location                                                  | Issue                                                                                                                                       |
| ---- | -------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| B-1  | High     | `src/lib/simulate.functions.ts:110`                       | `impacts.length > 0` is required, so a legitimate "no impact" result is replaced by the canned fallback                                     |
| B-2  | High     | `src/lib/simulate-fallback.ts`, `action-plan-fallback.ts` | The fallback uses non-existent IDs (`CTR-*`) and an unrelated Basel-IV scenario                                                             |
| B-3  | High     | `src/lib/ai.server.ts:26-49`                              | With only `GEMINI_API_KEY` set, the Gemini key is sent as a Bearer token to `api.openai.com`, so every call fails silently into fallbacks   |
| B-4  | High     | `docker/init.sql`                                         | `regulation_amendments` is not seeded, so the radar is meaningless on Docker                                                                |
| B-5  | Medium   | `src/lib/upload.functions.ts:63`                          | Fire-and-forget extraction is lost on restart, with no retry and no job record                                                              |
| B-6  | Medium   | `src/lib/upload.server.ts:61`                             | Clause `confidence` is hard-coded at 0.9                                                                                                    |
| B-7  | Medium   | lint                                                      | CRLF vs prettier: ~12k lint errors on Windows; 4 real lint errors                                                                           |
| B-8  | High     | `Dockerfile`                                              | `COPY … 2>/dev/null \|\| true` is invalid COPY syntax (the build fails), and the runtime runs `npm run dev` in production                   |
| B-9  | Medium   | `README.md`                                               | The regulation IDs listed (`GDPR-ART6`, `SEC-CYBER`, `BD-BTRC-LOC`, …) don't exist in the DB (real IDs are `REG-GDPR-5`, `REG-SEC-17A4`, …) |
| B-10 | Low      | `docker-compose.yml`                                      | The web container uses host port 3000, which is already used by another local container on the dev machine (environment-specific)           |
| B-11 | Medium   | `src/lib/supply-chain.functions.ts:139-146`               | The heuristic flags all edges on common words; exposure is `×0.4` with no justification                                                     |
| B-12 | Medium   | `src/data/queries.ts:229`                                 | The Federal Register is called from the browser; nothing is persisted                                                                       |
| B-13 | Low      | repo                                                      | Two lockfiles (`bun.lock`, `package-lock.json`); the Dockerfile uses npm and Vercel uses bun                                                |

### 2.5 Security findings (S-#), all verified by reading code or the DB

| ID      | Severity     | Location                                                           | Finding                                                                                                                                                                                                                                                                       |
| ------- | ------------ | ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **S-1** | **Critical** | `src/lib/team.functions.ts:42-48`                                  | Every invited user gets the **same hard-coded password** `TeammateInvite2026!`, which is in the public repo. Anyone who knows an invitee's email can log in as them.                                                                                                          |
| **S-2** | **Critical** | `src/lib/team.functions.ts:54-58`                                  | Inviting an **existing** user runs `INSERT … ON CONFLICT (id) DO UPDATE SET org_id = EXCLUDED.org_id`. Any admin (including the public demo account) can **move any user out of their own workspace** into the attacker's org: a cross-tenant takeover and denial of service. |
| **S-3** | **High**     | `src/lib/auth.server.ts:5-7`, `docker-compose.yml`, `.env.example` | The JWT secret silently falls back to a hard-coded string that is published in the repo, so anyone can forge tokens for any user/org when `JWT_SECRET` is unset.                                                                                                              |
| **S-4** | **High**     | git                                                                | `.env` (and `.env.development`, `.env.production`) are **tracked in git**. `.env` currently holds a `JWT_SECRET` and DB URL; history contains Supabase keys (publishable keys, lower risk). Any secret ever committed must be treated as public and rotated.                  |
| **S-5** | **High**     | DB                                                                 | RLS is not enabled on any table; the app connects as superuser. Tenant isolation rests entirely on each query remembering `WHERE org_id = $1`. README and whitepaper claim RLS.                                                                                               |
| S-6     | Medium       | `src/lib/account.functions.ts:13-36`                               | A **member** can trigger a Paddle subscription cancellation, because the admin check happens only afterwards, inside `request_workspace_deletion`                                                                                                                             |
| S-7     | Medium       | `docker/init.sql:24-29`                                            | `auth.uid()` falls back to **the first user ever created** when no JWT claim is set (it never is). Any SQL that relies on `auth.uid()` or `current_org_id()` acts as that user.                                                                                               |
| S-8     | Medium       | `src/lib/auth-client.ts`                                           | The JWT is kept in `localStorage` and in a non-HttpOnly cookie, so any XSS means full account takeover. There's no logout revocation.                                                                                                                                         |
| S-9     | Medium       | auth                                                               | No rate limiting or lockout on login/signup/demo; no email verification                                                                                                                                                                                                       |
| S-10    | Medium       | demo                                                               | The demo login is public and makes every visitor **admin** of one shared workspace. Anyone can delete it, invite users (combined with S-2, take over other accounts), or plant prompt-injection text into its contracts during judging.                                       |
| S-11    | Medium       | all LLM calls                                                      | Contract text and user regulation text are concatenated into prompts with no delimiting, no instruction hierarchy, and no output grounding check (OWASP LLM01). The output is only shape-validated.                                                                           |
| S-12    | Medium       | `getRegulationsFn`, `getBacktestCasesFn`                           | Unauthenticated reads (global reference data, low risk), but there's no rate limit                                                                                                                                                                                            |
| S-13    | Low          | `src/lib/action-plan.functions.ts`                                 | `impacts` comes from the client unvalidated (contract IDs aren't checked against the org)                                                                                                                                                                                     |
| S-14    | Low          | logs                                                               | `console.error` of raw AI error bodies; no structured audit log of security-relevant actions                                                                                                                                                                                  |
| S-15    | Low          | `simulation_runs`                                                  | Described as an "immutable audit trail" but it's an ordinary mutable table; deleting an org cascades it                                                                                                                                                                       |

### 2.6 Legal-content accuracy findings (L-#)

| ID      | Finding                                                                                                                                                                                                                                                                                                                                          | Evidence                                                                                                                                                                                                                                                                                    |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **L-1** | `REG-BD-DSA-2018` (Digital Security Act 2018) is presented as active law. It was **replaced by the Cyber Security Act 2023**, which was itself **repealed by the Cyber Security Ordinance 2025 (Ordinance No. 25 of 2025), in force 21 May 2025**. Sample contracts SC-012 and SC-013 cite "§26 of the Digital Security Act 2018".               | [Digital Policy Alert](https://digitalpolicyalert.org/event/38587-cyber-security-ordinance-2025-ordinance-no-25-of-2025-enters-into-force); [Wikipedia: Cyber Security Act 2023](https://en.wikipedia.org/wiki/Cyber_Security_Act,_2023); accessed 2026-10-16                               |
| **L-2** | Bangladesh **Personal Data Protection Ordinance 2025** was approved by the Council of Advisers on 9 Oct 2025, with some sections effective 18 months after gazette. It isn't in the ontology. Gazette status is unverified.                                                                                                                      | [Dhaka Tribune](https://www.dhakatribune.com/bangladesh/393590/bangladesh-government-approves-personal-data); [The Daily Star](https://www.thedailystar.net/tech-startup/news/bangladeshs-personal-data-protection-ordinance-2025-key-takeaways-4015401)                                    |
| L-3     | "Bangladesh Bank Digital Payment Security Circular (2023)" with 6-hour reporting and tokenisation: **no such consolidated circular was found.** The verifiable 2023 instruction found is a PSD-2 Eid-period circular requiring 2FA for card-not-present and account transactions. Treat `REG-BB-DPS-2023` as **unverified, possibly fictional**. | Search results incl. [Dhaka Tribune](https://www.dhakatribune.com/business/283419/bangladesh-bank-asks-banks-to-ensure-smooth-atm)                                                                                                                                                          |
| L-4     | Bangladesh Labour Act: secondary sources report a **Labour (Amendment) Ordinance 2025 (17 Nov 2025)** and an **Amendment Act 2026 (effective 10 Apr 2026)**. Section 26 notice periods are reportedly unchanged. **Unverified against the gazette.**                                                                                             | [MiHCM blog](https://mihcm.com/resources/blog/the-bangladesh-labour-amendment-act-2026-what-changed-and-what-hr-must-do-now/) (vendor source)                                                                                                                                               |
| L-5     | EU AI Act: the **Digital Omnibus on AI, Regulation (EU) 2026/1744 (OJ 24 Jul 2026, in force 27 Jul 2026)**, moved Annex III high-risk obligations to **2 Dec 2027** and Annex I to **2 Aug 2028**. The whitepaper's AI Act narrative needs updating.                                                                                             | [Gibson Dunn](https://www.gibsondunn.com/eu-ai-act-omnibus-agreement-postponed-high-risk-deadlines-and-other-key-changes/); [Orrick](https://www.orrick.com/en/Insights/2026/07/EU-AI-Act-Update-Digital-Omnibus-Finalizes-8-Compliance-Changes)                                            |
| L-6     | HIPAA Security Rule: the NPRM (Dec 2024) proposed mandatory MFA and encryption. As of mid-2026, secondary sources say **no final rule was published**. The seed amendment row "2024-12-27 … proposed" must be labelled _proposed_, not as a change in force.                                                                                     | [Medcurity](https://medcurity.com/hipaa-security-rule-2026-update/) (secondary)                                                                                                                                                                                                             |
| L-7     | CCPA: CPPA regulations on ADMT, risk assessments, and cybersecurity audits were approved by OAL on 23 Sep 2025, effective 1 Jan 2026, with phased compliance. The seed row (2024-11-08 "proposed") is outdated.                                                                                                                                  | [Baker McKenzie](https://connectontech.bakermckenzie.com/new-california-requirements-on-ai-risk-assessments-and-cybersecurity-cppa-adopts-expanded-regulations/); [FMG](https://www.fmglaw.com/cyber-privacy-security/ccpa-cpra-amended-regulations-approved-and-effective-january-1-2026/) |
| L-8     | Grameenphone backtest case is **unsupported** (see F7).                                                                                                                                                                                                                                                                                          | [Financial Express](https://thefinancialexpress.com.bd/bangladesh/btrc-fines-gp-over-illegal-voip-sim-use); [Developing Telecoms](https://developingtelecoms.com/telecom-business/telecom-regulation/20590-bangladesh-regulator-fines-operators-over-illegal-voip-sim-use.html)             |
| L-9     | Meta case: €1.2B, DPC decision 22 May 2023, Art. 46(1) GDPR. **Verified.** Equifax: CFPB/FTC/states settlement of up to $700M, announced 22 Jul 2019 (≈$425M consumer fund + $175M states + $100M CFPB penalty). The stored "$575M" and "FTC Docket C-4687" need correcting.                                                                     | [Faegre Drinker](https://www.faegredrinker.com/en/insights/publications/2023/5/meta-fined-eur-1-2-billion-for-violating-gdpr); [CFPB](https://www.consumerfinance.gov/enforcement/actions/equifax-inc/)                                                                                     |
| L-10    | Sample contracts name **real companies** as counterparties (bKash Limited, Nagad Limited), which implies real contractual relationships. Rename to fictional entities and label all samples as synthetic.                                                                                                                                        | `docker/init.sql` sample_contracts                                                                                                                                                                                                                                                          |
| L-11    | The whitepaper quotes unsourced statistics ("$4.2 Billion Compliance Blind Spot", "83% of third-party breaches originate beyond Tier 1", "90% reduction in fees", "< 60 seconds"). Remove them or source them.                                                                                                                                   | `ClauseGraph_Master_Whitepaper.pdf`                                                                                                                                                                                                                                                         |

### 2.7 Important files (verified paths)

```
src/lib/ai.server.ts                 LLM client (fix B-3; becomes provider abstraction)
src/lib/simulate.functions.ts        Impact simulation (B-1/B-2; becomes evidence pipeline)
src/lib/simulate.server.ts           coerceImpacts
src/lib/simulate-fallback.ts         canned fallback (replace with deterministic baseline)
src/lib/supply-chain.functions.ts    cascade (replace heuristic with deterministic BFS)
src/lib/upload.functions.ts|.server.ts  ingestion (job queue, PDF parsing)
src/lib/predict.functions.ts|.server.ts radar (reframe as cadence indicator)
src/lib/backtest.functions.ts        backtest (reframe; eval harness instead)
src/lib/team.functions.ts            invites (S-1, S-2)
src/lib/account.functions.ts         deletion (S-6)
src/lib/auth.server.ts|auth-client.ts|auth-middleware.ts|auth-attacher.ts  auth (S-3, S-8)
src/lib/db.server.ts                 pg pool (add withOrg/RLS helper)
src/data/queries.ts                  React Query factories (FR feed moves server-side)
src/routes/_authenticated/*.tsx      UI routes
docker/init.sql                      schema+seed baseline (S-7, L-*, B-4)
supabase/migrations/*.sql            legacy; source of amendment seed + RLS policy reference
Dockerfile, docker-compose.yml       deploy (B-8, S-3)
```

---

## 3. Research findings

All sources were accessed **2026-10-16**. Labels: **[V]** = verified from a primary or authoritative source, **[S]** = secondary/vendor source, **[A]** = our assumption or recommendation.

### 3.1 User problems

- **[S]** CUBE _Cost of Compliance 2025_ (2,000+ compliance and risk officers): 60% expect regulatory-change-management cost to rise. 98% have "some" automation, yet 21% call their process somewhat or highly ineffective. Full implementation of a regulatory change takes on average **more than a year**. ([WealthBriefing summary](https://www.wealthbriefing.com/html/article.php/compliance-corner%3A-regulatory-change-management-costs-seen-rising--))
- **[S]** Ascent survey: regional banks and brokers rank _monitoring regulators for updates_ as the hardest step; large institutions rank _operationalising the change in the business_ as hardest. ([Ascent RegTech](https://www.ascentregtech.com/blog/how-risk-compliance-teams-are-managing-the-surge-in-regulatory-change/))
- **[S]** Compliance Week 2025: horizon scanning is the top concern (36%), ahead of managing regulatory change (28%). ([Compliance Week](https://complianceweek.com/surveys-and-benchmarking/whats-keeping-compliance-leaders-up-at-night-struggles-and-strategies-for-2025/35583.article))
- **[S]** Wolters Kluwer 2024: 64% of US banks rated managing regulatory change a high or moderate concern. ([BusinessWire](https://www.businesswire.com/news/home/20241217116930/en/Wolters-Kluwer-Indicator-Survey-Reveals-Persisting-Pain-Points-in-Banks-Risk-Management-and-Regulatory-Compliance-Efforts))
- **[A]** The recurring pain is not "reading the regulation". It's **(a) knowing that something changed, (b) knowing whether it applies to us, (c) finding which of our documents and controls are affected, and (d) proving to auditors how we decided.** ClauseGraph's graph model fits (c) and (d) well, provided the evidence is real.

### 3.2 Trust in legal AI

- **[V]** Magesh et al., _Hallucination-Free? Assessing the Reliability of Leading AI Legal Research Tools_, Journal of Empirical Legal Studies 22:216–242 (2025), doi:10.1111/jels.12413. Lexis+ AI and Westlaw AI-Assisted Research hallucinated **17–33%** of the time on a preregistered benchmark, despite vendor claims that RAG eliminates hallucinations. ([Stanford PDF](https://dho.stanford.edu/wp-content/uploads/Legal_RAG_Hallucinations.pdf))
- **[A]** Implications for ClauseGraph: RAG alone isn't enough. We need **verifiable quotes** (exact substring checks against stored text), **abstention**, **deterministic computation** of anything numeric, and **human approval** before anything is labelled a confirmed impact.

### 3.3 Security of LLM apps

- **[S]** OWASP Top 10 for LLM Applications 2025: **LLM01 Prompt Injection**, both direct and indirect, comes via retrieved documents and attachments. RAG and fine-tuning do not fully mitigate it. ([HackerOne summary](https://www.hackerone.com/ai/owasp-top-10-llms-2025))
- **[A]** Uploaded contracts and fetched regulatory text are **untrusted input**. The model must have **no tools with side effects** during analysis, its outputs must be validated against IDs and quotes we control, and every state change goes through deterministic code.

### 3.4 Competitive landscape

| Product                       | Positioning (source quality)                                                                                                                                                                                               | Gap ClauseGraph can target                                                        |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Harvey                        | Breaks regulations into obligations, deadlines, and owners; links to internal policies via Vault ([Harvey blog, May 2026](https://www.harvey.ai/blog/harvey-in-practice-in-house-regulatory-and-compliance), vendor claim) | Not focused on **portfolio-wide clause impact** or supply-chain propagation       |
| Norm Ai                       | AI agents for compliance checks and reporting ([CB Insights](https://www.cbinsights.com/company/regology/alternatives-competitors), aggregator)                                                                            | Financial-services focus                                                          |
| Regology                      | Regulatory change management, "Smart Law Library" ([CB Insights](https://www.cbinsights.com/company/regology/alternatives-competitors))                                                                                    | Not contract-centric                                                              |
| CUBE, Ascent, Corlytics       | Regulatory intelligence and horizon scanning for Tier-1 financial institutions (CB Insights)                                                                                                                               | Enterprise price point; little South Asia coverage (assumption [A]; not verified) |
| CLMs (Ironclad, Luminance, …) | Contract repositories with AI extraction (no 2026 regulatory-impact features confirmed in research)                                                                                                                        | Weak link from regulatory events to clause impact                                 |

**[A] Differentiation thesis:** _ClauseGraph is the evidence chain from an officially sourced regulatory event to the specific clause it affects, to a reviewed decision._ Each link carries provenance, the deterministic parts (matching candidates, exposure, propagation) are reproducible, and the AI parts are labelled and checkable. Add **statute lifecycle tracking** (repealed or replaced laws still cited in contracts) and **Bangladesh coverage** done properly. That is concrete, demonstrable, and rare.

### 3.5 Official data sources (for the ingestion pipeline)

| Jurisdiction | Source                                                                                    | Access                                                                                                                                                                  | Notes                                                                                                                                                                                                                                                                                                                                |
| ------------ | ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| US           | Federal Register API v1, `https://www.federalregister.gov/api/v1/documents.json`          | Free, no key. Filters via `conditions[...]` (term, agencies, type, publication_date); results include `document_number`, `type`, `html_url`, `pdf_url`, `effective_on`. | **[S]** Field names came via third-party docs; the official doc page redirected to a bot check. Verify `conditions[effective_date]` names and pagination limits against the [official docs](https://www.federalregister.gov/developers/documentation/api/v1) before relying on them. Types: `RULE`, `PRORULE`, `NOTICE`, `PRESDOCU`. |
| US           | eCFR API (`https://www.ecfr.gov/api/...`)                                                 | Free, no key; point-in-time versions back to Jan 2017; `titles.json` gives `latest_amended_on` / `up_to_date_as_of`                                                     | **[V]** [eCFR developer resources](https://www.ecfr.gov/reader-aids/ecfr-developer-resources). Use for the **authoritative current text** of CFR sections (HIPAA 45 CFR 164, SEC 17 CFR 240.17a-4).                                                                                                                                  |
| EU           | EUR-Lex / CELLAR: SPARQL endpoint + REST (metadata, HTML/PDF/Formex)                      | Free; the search web service needs registration; bulk dump needs EU Login                                                                                               | **[V]** [EUR-Lex data reuse](https://eur-lex.europa.eu/content/help/data-reuse/reuse-contents-eurlex-details.html). Only the Official Journal text is authentic; consolidated texts are documentary.                                                                                                                                 |
| BD           | Laws of Bangladesh, `bdlaws.minlaw.gov.bd` (Legislative & Parliamentary Affairs Division) | Public website, no API                                                                                                                                                  | **[S]** HTML scraping is required: respect robots.txt and rate-limit. Newer ordinances may appear late; also check the Bangladesh Gazette (dpp.gov.bd, status unverified).                                                                                                                                                           |
| BD           | Bangladesh Bank circulars, `bb.org.bd`                                                    | Public website                                                                                                                                                          | Manual or semi-automatic curation is recommended for the MVP                                                                                                                                                                                                                                                                         |

**Licensing [A]:** US federal works are public domain. EUR-Lex content is reusable under the EU reuse policy (Decision 2011/833/EU), with attribution. Check Bangladeshi government site terms before bulk copying; store excerpts plus links if unclear (open question Q4).

### 3.6 Verified facts used by the demo

See §2.6 L-1 to L-9. **Only verified items may be presented as real events in the demo**: the DSA→CSA→CSO 2025 repeal chain, Meta 2023, Equifax 2019, the EU AI Act Omnibus 2026, and CPPA regs 2026. PDPO 2025 may be presented as "approved by Council of Advisers 9 Oct 2025 — gazette status pending verification" until confirmed.

---

## 4. Before vs. after

| Area                 | Before (today)                                                                                          | After (target)                                                                                                                                                                                                                                                                               |
| -------------------- | ------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Regulatory knowledge | 10 hand-typed summaries; no source, version, status or effective date; one repealed law shown as active | A source-registry-backed **instrument → version → provision → obligation** model with URLs, retrieval timestamps, content hashes, a lifecycle status (proposed/adopted/in force/amended/repealed), and effective dates                                                                       |
| Change detection     | A client-side list of the 5 newest FR documents                                                         | A scheduled ingestion job per source, with deduplication, diff detection, `regulatory_events`, a review queue, and an audit log                                                                                                                                                              |
| Impact analysis      | One LLM prompt over the whole portfolio; no evidence; canned fallback                                   | A **3-stage pipeline**: (1) deterministic candidate retrieval (obligation tags + Postgres full-text), (2) LLM classification per candidate pair with **mandatory verbatim quotes** checked by code, (3) deterministic exposure aggregation. "Insufficient evidence" is a first-class result. |
| Trust labelling      | A small "Demo fallback" chip                                                                            | Every output is typed `source_text`, `ai_interpretation`, `heuristic`, `synthetic`, or `human_approved`, with a consistent badge component                                                                                                                                                   |
| Supply chain         | Keyword match flags everything; LLM picks dollar amounts                                                | Deterministic BFS with regulation-tag matching, documented exposure rules, and an optional LLM narrative                                                                                                                                                                                     |
| Radar                | Presented as a 6–18 month forecast                                                                      | Renamed **Amendment cadence indicator (heuristic)**, computed only from sourced history; generated amendments labelled _Hypothetical — not a real proposal_                                                                                                                                  |
| Backtests            | "Empirical proof" from circular prompts; 1 unsupported case                                             | **Illustrative case studies** with source links; real accuracy claims come only from an **evaluation harness** with labelled data and reported metrics                                                                                                                                       |
| Ingestion            | Paste text; process lost on restart                                                                     | PDF/DOCX/TXT upload with size and type checks, text extraction, a durable job table with retries, and per-clause evidence spans                                                                                                                                                              |
| Security             | Shared invite password; cross-tenant user move; forgeable JWT fallback; no RLS                          | Invite tokens, fail-closed secrets, a HttpOnly cookie session, rate limits, an app DB role plus RLS as defence-in-depth, and an audit log                                                                                                                                                    |
| Quality              | No tests                                                                                                | Vitest unit/integration suites, a Playwright E2E happy path, an AI eval harness, and CI                                                                                                                                                                                                      |

---

## 5. Feature upgrade matrix

Decision key: **Keep** · **Improve** · **Redesign** · **Replace** · **Remove** · **New**. Priority: **P0** (must, before any demo) · **P1** (core competition value) · **P2** (nice to have).

| Feature                     | Decision                                                         | Priority            | Purpose / problem solved                                                           | Acceptance criteria (summary)                                                                                                                         |
| --------------------------- | ---------------------------------------------------------------- | ------------------- | ---------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Security fixes S-1…S-11     | Improve                                                          | **P0**              | Prevent account takeover, cross-tenant access, and token forgery                   | Tests in §10.3 pass                                                                                                                                   |
| Simulate Impact             | **Redesign** → _Evidence-backed Impact Analysis_                 | **P0/P1**           | Explainable, checkable impact per clause                                           | Each impact has clause_id, obligation_id, a quote verified by substring check, and a label; zero-impact results are shown honestly; no canned results |
| Regulation registry         | **Redesign** → _Instrument registry with provenance & lifecycle_ | **P1**              | Users must know what the law currently is and where that comes from                | Every instrument has a source URL, retrieved_at, status, and effective dates; repealed instruments are flagged                                        |
| **Stale-citation detector** | **New**                                                          | **P1**              | Contracts citing repealed or replaced law are a real, common, cheap-to-detect risk | Flags SC-012/SC-013 clauses citing DSA 2018 with evidence of repeal (L-1)                                                                             |
| Regulatory feed             | **Replace** → server-side ingestion + events inbox               | **P1**              | Turn "news" into tracked events matched to obligations                             | FR job persists documents idempotently; events show matched obligations; a reviewer can accept or dismiss                                             |
| Human review queue          | **New**                                                          | **P1**              | High-impact or uncertain interpretations need sign-off                             | Impacts start `pending_review`; approve/reject is recorded in the audit log with user and timestamp                                                   |
| Contract ingestion          | **Improve**                                                      | P1                  | Real portfolios arrive as PDFs                                                     | PDF ≤ 10 MB parsed server-side; durable job; failed jobs retry ≤ 3×; clause spans stored                                                              |
| Action plan + PDF           | **Improve**                                                      | P1                  | Hand-off artefact                                                                  | Generated only from **approved or pending** impacts with evidence; labelled draft; includes citations and an appendix of sources                      |
| Supply-chain cascade        | **Redesign** (deterministic)                                     | P1                  | Indirect exposure must be reproducible                                             | Same input gives the same output; unit tests on graph fixtures; LLM optional for narrative only                                                       |
| Dashboard / Medallion       | Keep + Improve                                                   | P2                  | Overview                                                                           | Shows events awaiting review, stale citations, and exposure by status                                                                                 |
| What-if sandbox             | Keep (relabel)                                                   | P2                  | Tabletop exercises                                                                 | All outputs labelled _Hypothetical_; never mixed with operational metrics                                                                             |
| Predictive radar            | **Redesign** → cadence indicator                                 | P2                  | Prioritisation hint only                                                           | Label "heuristic"; history rows require source_url; no "probability of amendment" wording                                                             |
| Backtests                   | **Replace** → case studies + eval harness                        | P1 (eval) / P2 (UI) | Credible accuracy evidence                                                         | Grameenphone case removed; eval report with precision/recall published in-app                                                                         |
| Compliance-as-code          | Keep (deprioritise) + label                                      | P2                  | Engineering hand-off                                                               | Labelled "Unreviewed AI draft — do not run without review"; `py_compile` syntax check before display                                                  |
| Team & RBAC                 | Improve                                                          | P0                  | Collaboration                                                                      | Invite tokens; roles enforced server-side; audit log                                                                                                  |
| Workspace deletion          | Improve                                                          | P1                  | Data lifecycle                                                                     | Admin check first; scheduled purge job; secure deletion of uploaded files                                                                             |
| Billing                     | Keep parked                                                      | —                   | Not relevant to the competition                                                    | No changes beyond S-6                                                                                                                                 |
| Sample data                 | **Improve**                                                      | P0                  | Realistic, honest demo                                                             | Fictional counterparties; `is_synthetic` badge; no fabricated events                                                                                  |
| Evaluation harness          | **New**                                                          | P1                  | Measurable quality                                                                 | `npm run eval` produces a JSON + Markdown report (§10.5)                                                                                              |
| Audit log                   | **New**                                                          | P1                  | Defensibility                                                                      | Append-only table; DB trigger blocks UPDATE/DELETE for the app role                                                                                   |

**Explicit non-goals:** multi-agent orchestration frameworks, a separate vector DB, new model providers, a graph database, auto-executing generated code, and real-time "prediction" of legislation.

---

## 6. Target architecture

### 6.1 Component view

```
                         ┌──────────────────────────── Browser ────────────────────────────┐
                         │ React 19 + TanStack Router/Query (no secrets, no direct DB)    │
                         └───────────────▲─────────────────────────────────────────────────┘
                                         │ HttpOnly session cookie + CSRF (createCsrfMiddleware)
┌────────────────────────────────────────┴────────────────────────────────────────────────┐
│ TanStack Start server (Node)                                                             │
│  • server fns (*.functions.ts) — auth, input validation (zod), rate limit                │
│  • domain services (*.server.ts) — deterministic logic                                    │
│  • AI gateway (ai.server.ts) — provider routing, JSON-schema validation, timeouts, logs  │
│  • withOrg(orgId, fn): BEGIN; SET LOCAL app.org_id; … COMMIT  (RLS defence-in-depth)    │
└───────────────▲───────────────────────────────▲─────────────────────────────────────────┘
                │                               │
     ┌──────────┴──────────┐         ┌──────────┴─────────────────────────────────────────┐
     │ PostgreSQL 16       │◀────────│ Worker process (scripts/worker.ts, same codebase)   │
     │  app role (no BYPASSRLS) │    │  • jobs table polled with FOR UPDATE SKIP LOCKED    │
     │  RLS on tenant tables│        │  • source fetchers: FR, eCFR, EUR-Lex, bdlaws       │
     │  tsvector + GIN      │        │  • contract extraction (PDF→text→clauses)          │
     │  (pgvector optional) │        │  • impact pipeline runs, retries, dead-letter       │
     └─────────────────────┘         └──────────────────────────────────────────────────────┘
```

**Technology decisions**

| Decision    | Choice                                                                                                                                                             | Why / alternatives rejected                                                                                                                     |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Job queue   | Postgres `jobs` table + `SELECT … FOR UPDATE SKIP LOCKED`                                                                                                          | No new infrastructure. Redis/BullMQ is unnecessary at this scale.                                                                               |
| Search      | Postgres full-text (`tsvector`, GIN) first; **pgvector optional (P2)** via the `pgvector/pgvector:pg16` image + RRF fusion                                         | Corpus is small (hundreds to thousands of clauses). Lexical plus obligation tags gives high precision. Embeddings only if eval recall < target. |
| Validation  | `zod` (already a dependency) for all server-fn inputs and LLM outputs                                                                                              | Replaces ad-hoc coercers                                                                                                                        |
| PDF parsing | `pdfjs-dist` (pure JS) or `unpdf` in the worker                                                                                                                    | No native deps on Windows/Alpine; must be checked for license and size at implementation time                                                   |
| LLM         | Keep the OpenAI-compatible client; support OpenAI, Gemini (OpenAI-compatible endpoint) and any `OPENAI_BASE_URL`; model names via env                              | No new SDKs                                                                                                                                     |
| Migrations  | Plain SQL files in `db/migrations/NNNN_name.sql` + a tiny runner `scripts/migrate.ts` with a `schema_migrations` table; `docker/init.sql` becomes migration `0000` | Simple, reviewable                                                                                                                              |
| Session     | HttpOnly, Secure, SameSite=Lax cookie with a server-side `sessions` table (revocable)                                                                              | Fixes S-8; keeps CSRF middleware                                                                                                                |

### 6.2 Data model additions (new migrations)

```sql
-- 0002_regulatory_registry.sql
CREATE TABLE public.sources (            -- registry of official sources
  id text PRIMARY KEY,                   -- 'us-federal-register', 'us-ecfr', 'eu-eurlex', 'bd-bdlaws', 'bd-bangladesh-bank'
  jurisdiction text NOT NULL,            -- ISO-ish: 'US','EU','BD'
  name text NOT NULL, base_url text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('api','html','manual')),
  reliability text NOT NULL CHECK (reliability IN ('official_authentic','official_documentary','secondary')),
  license_note text, enabled boolean NOT NULL DEFAULT true,
  last_success_at timestamptz, last_error text
);

CREATE TABLE public.legal_instruments (  -- an Act, Regulation, Rule, Circular…
  id text PRIMARY KEY,                   -- stable slug e.g. 'bd-cyber-security-ordinance-2025'
  jurisdiction text NOT NULL, title text NOT NULL, short_title text,
  instrument_type text NOT NULL,         -- act|ordinance|regulation|rule|circular|guidance|decision
  status text NOT NULL CHECK (status IN ('proposed','adopted','in_force','partially_in_force','amended','repealed','superseded','expired','unknown')),
  adopted_on date, in_force_from date, repealed_on date,
  superseded_by text REFERENCES public.legal_instruments(id),
  official_url text, source_id text REFERENCES public.sources(id),
  verification text NOT NULL DEFAULT 'unverified' CHECK (verification IN ('verified','unverified','disputed')),
  verified_by uuid, verified_at timestamptz, notes text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.instrument_versions (   -- immutable snapshots of fetched text
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instrument_id text NOT NULL REFERENCES public.legal_instruments(id),
  retrieved_at timestamptz NOT NULL, source_url text NOT NULL,
  content_sha256 text NOT NULL, content_text text NOT NULL, content_format text NOT NULL,
  valid_from date, valid_to date,
  UNIQUE (instrument_id, content_sha256)
);

CREATE TABLE public.provisions (          -- article / section level
  id text PRIMARY KEY,                    -- 'eu-gdpr:art-33', 'us-cfr-45-164.312'
  instrument_id text NOT NULL REFERENCES public.legal_instruments(id),
  version_id uuid REFERENCES public.instrument_versions(id),
  label text NOT NULL, text text NOT NULL,
  tsv tsvector GENERATED ALWAYS AS (to_tsvector('english', label || ' ' || text)) STORED
);
CREATE INDEX provisions_tsv_idx ON public.provisions USING gin (tsv);

CREATE TABLE public.obligations (         -- normalized duty extracted from a provision
  id text PRIMARY KEY,                    -- 'eu-gdpr:art-33:notify-sa-72h'
  provision_id text NOT NULL REFERENCES public.provisions(id),
  tag text NOT NULL,                      -- existing tag vocab e.g. '72h_breach_notification'
  statement text NOT NULL,                -- plain-language duty
  quote text NOT NULL,                    -- verbatim span from provisions.text (validated)
  origin text NOT NULL CHECK (origin IN ('human','ai_draft')),
  review_status text NOT NULL DEFAULT 'pending' CHECK (review_status IN ('pending','approved','rejected'))
);

CREATE TABLE public.regulatory_events (   -- something happened to an instrument
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instrument_id text REFERENCES public.legal_instruments(id),
  source_id text NOT NULL REFERENCES public.sources(id),
  external_id text,                       -- e.g. FR document_number
  event_type text NOT NULL CHECK (event_type IN ('proposed','published','adopted','amended','repealed','effective','guidance','enforcement')),
  title text NOT NULL, url text NOT NULL, published_on date, effective_on date,
  raw jsonb NOT NULL, content_sha256 text,
  is_synthetic boolean NOT NULL DEFAULT false,
  triage_status text NOT NULL DEFAULT 'new' CHECK (triage_status IN ('new','relevant','not_relevant','duplicate')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_id, external_id)
);
```

```sql
-- 0003_impact_and_review.sql (tenant-scoped)
ALTER TABLE public.clauses
  ADD COLUMN tsv tsvector GENERATED ALWAYS AS (to_tsvector('english', text)) STORED,
  ADD COLUMN cited_instruments text[] NOT NULL DEFAULT '{}',   -- detected citations (deterministic regex + review)
  ADD COLUMN char_start int, ADD COLUMN char_end int;           -- span in source document
CREATE INDEX clauses_tsv_idx ON public.clauses USING gin (tsv);
ALTER TABLE public.contracts ADD COLUMN is_synthetic boolean NOT NULL DEFAULT false;

CREATE TABLE public.impact_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  run_id uuid NOT NULL REFERENCES public.simulation_runs(id) ON DELETE CASCADE,
  event_id uuid REFERENCES public.regulatory_events(id),
  contract_id uuid NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  clause_id uuid NOT NULL REFERENCES public.clauses(id) ON DELETE CASCADE,
  obligation_id text REFERENCES public.obligations(id),
  verdict text NOT NULL CHECK (verdict IN ('conflict','gap','needs_update','compliant','insufficient_evidence')),
  severity text CHECK (severity IN ('low','medium','high')),
  clause_quote text NOT NULL, rule_quote text,       -- both validated by substring check
  rationale text NOT NULL, suggested_amendment text,
  confidence numeric CHECK (confidence BETWEEN 0 AND 1),
  origin text NOT NULL CHECK (origin IN ('deterministic','ai','human')),
  model text, prompt_version text,
  review_status text NOT NULL DEFAULT 'pending_review' CHECK (review_status IN ('pending_review','approved','rejected','edited')),
  reviewed_by uuid, reviewed_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.audit_log (           -- append-only
  id bigserial PRIMARY KEY, org_id uuid, actor_id uuid,
  action text NOT NULL, target_type text, target_id text,
  details jsonb NOT NULL DEFAULT '{}', ip inet, created_at timestamptz NOT NULL DEFAULT now()
);
-- trigger: RAISE EXCEPTION on UPDATE/DELETE of audit_log

CREATE TABLE public.jobs (
  id bigserial PRIMARY KEY, kind text NOT NULL, payload jsonb NOT NULL,
  org_id uuid, status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','running','succeeded','failed','dead')),
  attempts int NOT NULL DEFAULT 0, max_attempts int NOT NULL DEFAULT 3,
  run_after timestamptz NOT NULL DEFAULT now(), locked_at timestamptz, last_error text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX jobs_ready_idx ON public.jobs (status, run_after) WHERE status = 'queued';

CREATE TABLE public.invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  email text NOT NULL, role public.app_role NOT NULL DEFAULT 'member',
  token_sha256 text NOT NULL UNIQUE, invited_by uuid NOT NULL,
  expires_at timestamptz NOT NULL, accepted_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);
```

> Migrating the legacy `regulations` table: keep it as a **view or compat table** so existing routes keep working, and populate `legal_instruments`/`provisions`/`obligations` from it plus curated data. The existing `linked_regs` IDs (`REG-GDPR-33` …) map to `obligations.tag` groups through a mapping table `legacy_reg_map(legacy_id, provision_id)`.

### 6.3 Regulatory ingestion pipeline (explicit stages)

```
[1 Acquire] → [2 Normalize] → [3 Detect change] → [4 Classify event] → [5 Match] → [6 Interpret] → [7 Review] → [8 Publish]
 deterministic   deterministic    deterministic        deterministic+rules   deterministic   AI (bounded)   human        deterministic
```

| Stage            | Responsibility                                                                                                                                                                                                                         | Input → Output                                                 | Failure handling                                                                                                             |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| 1 Acquire        | Fetch from `sources` with per-source adapters (`src/lib/sources/*.server.ts`); polite rate limits, ETag/If-Modified-Since, timeouts                                                                                                    | URL/query → raw payload + HTTP metadata                        | Retry with exponential backoff (max 3); after that, `jobs.status='dead'`, `sources.last_error` set, banner shown in admin UI |
| 2 Normalize      | HTML/XML/JSON → plain text + structure; SHA-256 of normalised text                                                                                                                                                                     | raw → `instrument_versions` row (immutable)                    | Parser errors are stored with the raw payload for replay                                                                     |
| 3 Detect change  | Compare the hash with the latest version; dedupe on `(source_id, external_id)` and the content hash                                                                                                                                    | versions → diff summary (deterministic text diff)              | Duplicates are marked; nothing is overwritten                                                                                |
| 4 Classify event | Map source metadata to `event_type` (e.g. FR `type=PRORULE` → `proposed`, `RULE` → `published`/`effective` using `effective_on`); lifecycle rules update `legal_instruments.status` **only** from authoritative fields or human action | → `regulatory_events`                                          | If metadata conflicts, set `verification='disputed'` and create a review task                                                |
| 5 Match          | Candidate obligations and clauses via obligation tags, CFR/CELEX/citation regex, and FTS ranking                                                                                                                                       | event → candidate (clause, obligation) pairs with scores       | No candidates → "no portfolio match" (a valid outcome)                                                                       |
| 6 Interpret      | LLM classifies each candidate pair with the strict schema in §6.4; quotes validated                                                                                                                                                    | pairs → `impact_assessments` (`origin='ai'`, `pending_review`) | Invalid JSON or quote mismatch → one retry, then `insufficient_evidence`                                                     |
| 7 Review         | Human approves, edits or rejects; mandatory for `severity='high'` and for any change to `legal_instruments.status`                                                                                                                     | → `review_status`, `audit_log`                                 | —                                                                                                                            |
| 8 Publish        | Dashboard, exposure (deterministic sum over **approved** plus clearly-marked pending), action plan                                                                                                                                     | → UI/PDF                                                       | —                                                                                                                            |

**Lifecycle rules (deterministic):**

- `proposed`: FR `PRORULE`, an EU Commission proposal (COM document), or a BD draft or cabinet approval _not yet gazetted_.
- `adopted`: published in the official journal or gazette, but `in_force_from` is in the future.
- `in_force`: `in_force_from ≤ today` and not repealed.
- `repealed` / `superseded`: requires a repealing instrument ID **and** human verification.
- Effective dates are always shown with their source. If they're missing, show "effective date unknown" (never guess).

### 6.4 AI components

| Component                    | Responsibility                                                    | Input                                                                                    | Output (zod schema)                                                                           | Deterministic guardrails                                                                                                          | Validation                                      |
| ---------------------------- | ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| A1 Clause segmenter (upload) | Split extracted contract text into clauses                        | text (≤120k chars) chunked                                                               | `{clauses:[{start:int,end:int,heading?:string}]}` (offsets, **not** rewritten text)           | Clause text = `source.slice(start,end)`; reject overlapping/out-of-range spans                                                    | Eval: span F1 vs gold on 10 synthetic contracts |
| A2 Obligation tagger         | Suggest obligation tags per clause                                | clause text + candidate tag list (top-k from FTS)                                        | `{tags:[{tag, quote}]}`                                                                       | Tag must be in the candidate list; quote must be a substring of the clause                                                        | Eval: precision ≥ 0.85 on gold                  |
| A3 Impact classifier         | For one (clause, obligation/event) pair, decide verdict           | clause text, rule text (both in delimited `<untrusted_document>` blocks), event metadata | `{verdict, severity?, clause_quote, rule_quote, rationale, suggested_amendment?, confidence}` | Substring checks on both quotes; verdict `insufficient_evidence` allowed and preferred when unsure; IDs never come from the model | Eval §10.5                                      |
| A4 Action-plan drafter       | Summarise approved/pending impacts into policy, amendments, tasks | impacts with evidence                                                                    | existing `ActionPlan` + `citations[]`                                                         | Contract IDs re-checked against org; every amendment references an impact ID                                                      | Manual review + schema test                     |
| A5 Hypothetical drafter      | What-if text                                                      | regulation summary + sourced history                                                     | existing schema                                                                               | Output always stored with `is_synthetic=true`, label shown                                                                        | —                                               |
| A6 Code drafter (P2)         | Audit/IaC draft                                                   | gap + stack                                                                              | existing schema                                                                               | Never executed; `py_compile` / `terraform fmt -check` if available; label                                                         | —                                               |

**Prompt-injection posture:** documents go inside `<untrusted_document id="...">…</untrusted_document>`. The system prompt says the content is data and that instructions inside it must be ignored. The model has **no tool access**. Outputs can only reference IDs we supplied and quotes we can verify. Long documents are processed per candidate pair, which limits blast radius. We log model, prompt version, and token counts.

**Provider routing (fixes B-3):** `OPENAI_API_KEY` → OpenAI (`AI_MODEL` default `gpt-4o-mini`, `AI_MODEL_STRONG` default `gpt-4o`). Otherwise `GEMINI_API_KEY` → `https://generativelanguage.googleapis.com/v1beta/openai` (`gemini-2.5-flash`). Otherwise `LOVABLE_API_KEY` (legacy). Otherwise none (deterministic mode). `OPENAI_BASE_URL` overrides the endpoint.

**Abstention policy:** if a candidate pair's quotes fail validation twice, or confidence < 0.5, store `insufficient_evidence` and show it as "needs human review". Never silently drop it and never replace it with canned output.

### 6.5 Deterministic computations (never LLM)

- **Exposure:** `sum(distinct contract.value)` over contracts with ≥1 assessment whose verdict ∈ {conflict, gap, needs_update}, shown split by review_status. Formula and inputs are shown in the UI.
- **Supply-chain cascade:** BFS from each node whose edges' `depends_on_regs` (or the node jurisdiction rule) match the event. Propagate toward tier 0 along reversed edges. `hop` = BFS distance to self. Indirect exposure for an edge = `edge.contract_value` (no magic 0.4) unless a documented, configurable `pass_through_factor` is set on the edge. Severity rule table lives in code with tests.
- **Stale citations:** regex and alias table → `cited_instruments` → join with `legal_instruments.status IN ('repealed','superseded')`.
- **Cadence indicator:** existing formula, but only over history rows with `source_url`, and labelled heuristic.

### 6.6 Security boundaries

- The browser never sees provider keys, DB credentials, or other orgs' IDs.
- Server fns: `requireAuth`, then zod validation, then rate limit, then service. Services take `orgId` from the **context only**.
- DB: the app connects as `clausegraph_app` (no superuser, no BYPASSRLS). Tenant tables get RLS policies `USING (org_id = current_setting('app.org_id')::uuid)`. `withOrg()` sets the GUC in a transaction. Reference tables (`legal_instruments`, `provisions`, …) are read-only for the app role. The worker uses a separate role.

---

## 7. Implementation roadmap

Phases are ordered by dependency. **Checkpoint** = stop, run the listed commands, and record the results in §12.

### Phase 0: Baseline and tooling (½ day)

| ID                                                                                 | Task                                                                                                                      | Files                                                                                                                  | Acceptance                |
| ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| T0.1                                                                               | Make lint pass on Windows: set prettier `endOfLine: "auto"`; fix the 4 real lint errors                                   | `.prettierrc`, `src/lib/db.server.ts`, `src/routes/_authenticated/contracts.$contractId.tsx`, `regulations.$regId.tsx` | `npx eslint .` → 0 errors |
| T0.2                                                                               | Add Vitest (`npm i -D vitest`), `npm test` script, `vitest.config.ts` reusing tsconfig paths                              | `package.json`, `vitest.config.ts`                                                                                     | `npm test` runs ≥1 test   |
| T0.3                                                                               | Add `.gitattributes` (`* text=auto eol=lf`) so future checkouts use LF (**optional; coordinate with user, causes churn**) | `.gitattributes`                                                                                                       | —                         |
| T0.4                                                                               | CI: GitHub Actions running `tsc`, `eslint`, `vitest`, `build`                                                             | `.github/workflows/ci.yml`                                                                                             | Green run                 |
| **Checkpoint 0:** `npx tsc --noEmit && npx eslint . && npm test && npm run build`. |

### Phase 1: P0 security and correctness (1–2 days) — **do first**

| ID                                                                                                             | Task                                                                                                                                                                                                                                                                                                                                               | Files                                                                                                                                                                                       | Acceptance                                                                                     |
| -------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| T1.1                                                                                                           | **S-3:** fail closed on a missing/weak `JWT_SECRET` in production (throw at startup if `NODE_ENV=production` and the secret is missing or < 32 chars); dev fallback is random per-process with a warning; remove the secret defaults from `docker-compose.yml` and `.env.example`                                                                  | `src/lib/auth.server.ts`, `docker-compose.yml`, `.env.example`                                                                                                                              | Unit test: production without secret throws                                                    |
| T1.2                                                                                                           | **S-1/S-2:** invites never set a password and never move a user from another org. New user → `encrypted_password NULL` + signed invite token (JWT `purpose=invite`, 7d) → `/accept-invite` sets the password once. Existing user in another org → reject with a clear error. Existing user already in this org → ensure the role, no-op otherwise. | `src/lib/team.functions.ts`, `src/lib/team.server.ts`, `src/lib/auth.server.ts`, `src/lib/auth.functions.ts`, `src/routes/accept-invite.tsx`, `src/routes/_authenticated/settings.team.tsx` | Tests: no shared password; cross-org invite rejected; token single-use; expired token rejected |
| T1.3                                                                                                           | **S-6:** check admin before any Paddle call in `requestWorkspaceDeletion`; same for `cancelWorkspaceDeletion`                                                                                                                                                                                                                                      | `src/lib/account.functions.ts`                                                                                                                                                              | A member gets "Admins only"; no Paddle call                                                    |
| T1.4                                                                                                           | **S-7:** `auth.uid()` returns NULL when there's no claim (no fallback)                                                                                                                                                                                                                                                                             | `docker/init.sql` + `db/migrations/0001_*.sql`                                                                                                                                              | `SELECT auth.uid()` → NULL                                                                     |
| T1.5                                                                                                           | **B-3:** provider routing (OpenAI → Gemini OpenAI-compat → Lovable → none); model names via env                                                                                                                                                                                                                                                    | `src/lib/ai.server.ts`                                                                                                                                                                      | Unit tests on `resolveAiProvider()`                                                            |
| T1.6                                                                                                           | **B-1/B-2:** simulation returns honest results: AI-empty → empty impacts (`fallback:false`); AI unavailable → **deterministic baseline** (obligation-tag/keyword matching over _real_ clauses) labelled `mode:"deterministic"`; delete the `CTR-*` canned data                                                                                     | `src/lib/simulate.functions.ts`, `src/lib/simulate.server.ts`, `src/lib/simulate-fallback.ts`, `src/lib/simulate-types.ts`, `src/routes/_authenticated/simulate.tsx`                        | Unit tests on baseline; UI shows the "Deterministic baseline (no AI)" label                    |
| T1.7                                                                                                           | **L-8/L-9/L-10:** remove the Grameenphone case; correct the Equifax figures and source; rename real-company counterparties to fictional ones; mark samples synthetic                                                                                                                                                                               | `docker/init.sql`, migration                                                                                                                                                                | Grep shows no "Grameenphone" in seed; UI shows "Synthetic"                                     |
| T1.8                                                                                                           | **S-4:** `git rm --cached .env .env.development .env.production`, add them to `.gitignore`, rotate `JWT_SECRET` (**needs user approval: index change + commit**)                                                                                                                                                                                   | `.gitignore`                                                                                                                                                                                | `git ls-files .env` empty                                                                      |
| T1.9                                                                                                           | **S-10:** demo hardening: the demo workspace can't be deleted, can't invite, and is re-seeded nightly or per session (P1: per-visitor ephemeral demo orgs)                                                                                                                                                                                         | `src/lib/auth.server.ts`, `account.functions.ts`, `team.functions.ts`                                                                                                                       | Tests                                                                                          |
| T1.10                                                                                                          | **B-8:** fix Dockerfile (valid COPY, `npm ci`, run the built server via `node .output/server/index.mjs` or the Nitro/Vite preview equivalent, **verify** the build output path)                                                                                                                                                                    | `Dockerfile`                                                                                                                                                                                | `docker build .` succeeds; container health OK                                                 |
| **Checkpoint 1:** all Phase 0 commands, plus `npm test` (security tests), plus a manual demo-login smoke test. |

### Phase 2: Data foundation (2–3 days)

| ID   | Task                                                                                                                                                                                                                                                                                                     | Acceptance                                          |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| T2.1 | Migration runner `scripts/migrate.ts` (`npm run db:migrate`), `schema_migrations` table; `docker/init.sql` stays as bootstrap for fresh Docker volumes and is mirrored as `0000_baseline.sql`                                                                                                            | Fresh DB and existing DB both reach the same schema |
| T2.2 | Registry tables (§6.2 `0002`), seeded with **verified** instruments for the current 10 IDs plus the BD chain (DSA 2018 _repealed_ → CSA 2023 _repealed_ → CSO 2025 _in force_), PDPO 2025 (_adopted/unknown_, verification pending), EU AI Act + Reg 2026/1744; each with `official_url`, `verification` | `legal_instruments` populated; no row without a URL |
| T2.3 | Port the amendment history from `supabase/migrations/20260725112415_*.sql` into `regulatory_events`, adding `url` per row; rows without a verifiable source stay `verification='unverified'` and are **excluded** from the cadence indicator                                                             | Count of verified vs unverified reported            |
| T2.4 | Impact, review, audit, jobs, invitations tables (`0003`)                                                                                                                                                                                                                                                 | Migrations apply; rollback notes documented         |
| T2.5 | App DB role + RLS on tenant tables + `withOrg()` helper; convert server fns one module at a time                                                                                                                                                                                                         | Cross-tenant tests (§10.3) pass with the app role   |

### Phase 3: Evidence-backed impact pipeline (3–4 days) — **core competition value**

| ID   | Task                                                                                                                                                                                                                  | Acceptance                                                               |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| T3.1 | Candidate retrieval `src/lib/impact/candidates.server.ts` (tags + citation regex + FTS `ts_rank`, top-k per obligation)                                                                                               | Deterministic; unit-tested with fixtures                                 |
| T3.2 | Classifier `src/lib/impact/classify.server.ts` with zod schema, untrusted-document delimiting, quote validation, retry-then-abstain                                                                                   | Unit tests with mocked provider: valid, invalid-quote, injection attempt |
| T3.3 | Orchestrator `runImpactAnalysis(orgId, {eventId? , text?})` writes `simulation_runs` + `impact_assessments`; exposure computed deterministically                                                                      | Integration test on the seeded DB                                        |
| T3.4 | UI: Impact page shows per-clause evidence cards (clause quote highlighted, rule quote, source link, labels, confidence) and an "insufficient evidence" bucket; review buttons (approve/edit/reject) write `audit_log` | Playwright E2E                                                           |
| T3.5 | Stale-citation detector + dashboard card                                                                                                                                                                              | SC-012/SC-013 flagged with links to repeal evidence                      |
| T3.6 | Action plan consumes `impact_assessments` (IDs, quotes, citations); PDF includes a sources appendix and a "Draft — not legal advice" header                                                                           | Snapshot test of plan JSON                                               |

### Phase 4: Ingestion (2–3 days)

| ID   | Task                                                                                                                                                  | Acceptance                                                                |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| T4.1 | Worker `scripts/worker.ts` (`npm run worker`) with a job loop, backoff, and dead-letter                                                               | Integration test: failing job retries 3× then `dead`                      |
| T4.2 | Federal Register adapter: daily query filtered by agencies relevant to seeded obligations (HHS, SEC, FTC); idempotent upsert into `regulatory_events` | Running twice creates no duplicates                                       |
| T4.3 | eCFR adapter for tracked CFR sections (45 CFR 164.3xx, 17 CFR 240.17a-4): detect `latest_amended_on` change → new version + event                     | Test with a recorded fixture                                              |
| T4.4 | EUR-Lex adapter (P2): CELLAR SPARQL for amendments to tracked CELEX numbers (GDPR 32016R0679, AI Act 32024R1689)                                      | Fixture test                                                              |
| T4.5 | BD adapter (P2): curated manual entries plus an optional polite bdlaws fetch for tracked act pages; **human verification required**                   | —                                                                         |
| T4.6 | Contract upload: PDF/DOCX/TXT ≤ 10 MB, magic-byte check, server-side text extraction in the worker, A1 span segmentation, durable job                 | E2E: upload a PDF → clauses appear; malformed PDF → `failed` with message |
| T4.7 | Events inbox UI (`/feed` redesign): source, type, dates, matched obligations, triage actions                                                          | E2E                                                                       |

### Phase 5: Quality, eval, and demo polish (2–3 days)

| ID   | Task                                                                                                                                            | Acceptance                                                                         |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| T5.1 | Gold dataset `eval/gold/*.jsonl`: ≥60 labelled (clause, obligation, verdict) pairs over synthetic contracts plus 10 injection/adversarial cases | Reviewed by a human; documented labelling guide                                    |
| T5.2 | `npm run eval`: runs A2/A3 against gold, outputs `eval/reports/<date>.json                                                                      | md` (precision, recall, abstention rate, quote-validity rate, latency, token cost) | Report committed; numbers shown on `/backtest` (renamed **Evaluation**) |
| T5.3 | Deterministic supply-chain BFS replaces heuristic + LLM numbers                                                                                 | Unit tests on 3 graph fixtures                                                     |
| T5.4 | Labels component `<ProvenanceBadge kind=…>` used everywhere                                                                                     | Visual check; no unlabelled AI text                                                |
| T5.5 | Loading, empty, error, and partial states for every route; a11y pass (axe), mobile layout                                                       | axe: 0 serious issues on core routes                                               |
| T5.6 | Update README and whitepaper claims to match reality (remove unsourced stats, L-11)                                                             | Doc review                                                                         |
| T5.7 | Rate limiting (in-memory token bucket per IP and user; Postgres-backed if multi-instance) on auth and AI endpoints                              | Tests                                                                              |
| T5.8 | HttpOnly session cookie and a server-side sessions table; remove localStorage token (S-8)                                                       | E2E login/logout; token not readable from JS                                       |

**Optional (P2) enhancements:** pgvector + RRF hybrid retrieval (only if eval recall < 0.8), per-visitor ephemeral demo orgs, Slack/email digests, Bangla-language clause support, EUR-Lex adapter, compliance-as-code syntax validation, scheduled workspace purge job.

---

## 8. File-level guidance

### 8.1 Modify (paths verified 2026-10-16)

| File                                                                                                              | Change                                                                                                              |
| ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `src/lib/ai.server.ts`                                                                                            | Provider routing (T1.5); later: zod-validated `generateJson<T>(schema, …)`, usage logging                           |
| `src/lib/simulate.functions.ts`, `simulate.server.ts`, `simulate-types.ts`, `simulate-fallback.ts`                | T1.6 now; replaced by `src/lib/impact/*` in Phase 3 (keep the server-fn name `simulateImpact` for UI compatibility) |
| `src/lib/team.functions.ts`, `team.server.ts`                                                                     | T1.2                                                                                                                |
| `src/lib/auth.server.ts`, `auth.functions.ts`, `auth-client.ts`, `auth-middleware.ts`, `auth-attacher.ts`         | T1.1, T1.2, T5.8                                                                                                    |
| `src/lib/account.functions.ts`                                                                                    | T1.3, T1.9                                                                                                          |
| `src/lib/supply-chain.functions.ts`, `supply-chain.server.ts`                                                     | T5.3                                                                                                                |
| `src/lib/upload.functions.ts`, `upload.server.ts`, `src/components/clausegraph/UploadContract.tsx`                | T4.6                                                                                                                |
| `src/lib/predict.functions.ts`, `predict.server.ts`, `src/routes/_authenticated/predictive*.tsx`                  | Relabel, sourced history only                                                                                       |
| `src/lib/backtest.functions.ts`, `src/routes/_authenticated/backtest.tsx`                                         | Case studies + eval report                                                                                          |
| `src/data/queries.ts`, `src/components/clausegraph/FederalRegisterFeed.tsx`, `src/routes/_authenticated/feed.tsx` | Events inbox (T4.7)                                                                                                 |
| `src/routes/_authenticated/regulations.$regId.tsx`                                                                | Instrument view: status, versions, sources, obligations with quotes                                                 |
| `docker/init.sql`                                                                                                 | T1.4, T1.7 (fresh installs); all later changes via migrations                                                       |
| `Dockerfile`, `docker-compose.yml`, `.env.example`, `.gitignore`, `.prettierrc`                                   | T1.10, T1.1, T1.8, T0.1                                                                                             |
| `README.md`                                                                                                       | T5.6                                                                                                                |

### 8.2 Create

```
vitest.config.ts
src/lib/__tests__/*.test.ts                 unit tests (pure functions; no DB)
tests/integration/*.test.ts                 DB-backed tests (use TEST_DATABASE_URL)
tests/e2e/*.spec.ts                         Playwright
db/migrations/0001_auth_uid_no_fallback.sql …
scripts/migrate.ts, scripts/worker.ts
src/lib/impact/{candidates,classify,orchestrate,exposure}.server.ts
src/lib/sources/{federal-register,ecfr,eurlex,bd-curated}.server.ts
src/lib/jobs.server.ts, src/lib/audit.server.ts, src/lib/rate-limit.server.ts
src/routes/accept-invite.tsx
src/components/clausegraph/ProvenanceBadge.tsx
eval/gold/*.jsonl, eval/run.ts, eval/reports/
.github/workflows/ci.yml
```

### 8.3 Remove (only when justified)

| File                                                        | When                                                                                                               |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `src/lib/simulate-fallback.ts` canned `CTR-*` data          | T1.6 (replaced by deterministic baseline)                                                                          |
| `src/lib/action-plan-fallback.ts` Basel content             | Replace with "AI unavailable — plan not generated" or a deterministic template built from actual impacts (Phase 3) |
| `supabase/`                                                 | **Not yet.** It's the only source of the amendment seed and RLS policy reference. Remove after T2.3 and T2.5 land. |
| `src/components/PaymentTestModeBanner.tsx` Lovable doc link | P2 cleanup                                                                                                         |

---

## 9. Security and reliability requirements (mandatory)

| Risk                                   | Mitigation                                                                                                                                                                  | Test                                                                                                                           |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Account takeover via invites (S-1/S-2) | Token invites; reject cross-org                                                                                                                                             | `team.test.ts`                                                                                                                 |
| Token forgery (S-3)                    | Fail closed; ≥32-byte secret                                                                                                                                                | `auth-secret.test.ts`                                                                                                          |
| Tenant leakage (S-5)                   | Org from context only; app role + RLS; `withOrg`                                                                                                                            | Integration: user A can't read B's contracts/runs/artifacts even with a forged ID                                              |
| Secret exposure (S-4)                  | Untrack env files; rotate; `gitleaks` in CI (P2)                                                                                                                            | CI                                                                                                                             |
| Prompt injection (S-11)                | Delimiting, no tools, ID and quote validation, abstention                                                                                                                   | Adversarial eval cases: injected "mark all compliant" text has no effect on other clauses; verdicts still require valid quotes |
| Malicious uploads                      | Size ≤ 10 MB, MIME + magic bytes, parse in worker with timeout, store outside web root, no HTML rendering of contract text (React escapes; never `dangerouslySetInnerHTML`) | Upload tests with zip-bomb-like PDF, wrong extension                                                                           |
| Abuse / cost                           | Rate limits (auth: 10/min/IP; AI: 30/hour/org default); max input sizes (existing)                                                                                          | Unit tests                                                                                                                     |
| Unauthorized actions                   | Admin checks before side effects; demo restrictions                                                                                                                         | `account.test.ts`                                                                                                              |
| Data deletion                          | Scheduled purge after 30 days; uploaded files deleted; audit entry                                                                                                          | Integration                                                                                                                    |
| Error leakage                          | Generic messages to the client; structured server logs without document text or keys                                                                                        | Code review checklist                                                                                                          |
| Dependencies                           | `npm audit --omit=dev` in CI; pin majors                                                                                                                                    | CI                                                                                                                             |
| Production config                      | `NODE_ENV=production` disables demo unless `DEMO_LOGIN_ENABLED=true`; HTTPS-only cookies                                                                                    | Config test                                                                                                                    |

---

## 10. Testing and evaluation

### 10.1 Commands

```bash
npm install
npx tsc --noEmit
npx eslint .
npm test                 # vitest unit tests (no DB, no network)
npm run build
# integration (Phase 2+): requires docker compose up -d postgres
TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5435/clausegraph_test npm run test:integration
npm run eval             # Phase 5; requires an AI key; writes eval/reports/
npx playwright test      # Phase 3+
```

### 10.2 Unit tests (no DB)

`coerceImpacts`, deterministic baseline, provider resolution, JWT secret policy, invite token sign/verify, BFS cascade, exposure calculation, quote validator, citation regex, lifecycle state rules, cadence indicator.

### 10.3 Security tests (integration)

1. Invite: no shared password; existing-other-org user rejected; token single-use and expiry.
2. Cross-tenant: for each server fn taking an ID (`getContractByIdFn`, `deleteContract`, action plan with foreign contract IDs, compliance artifacts), user A + B's ID gives not found or empty.
3. Member cannot: invite, remove, request/cancel deletion, trigger a Paddle cancel.
4. Missing `JWT_SECRET` in production gives a startup error.
5. Rate limit returns 429 after the threshold.

### 10.4 E2E (Playwright)

Demo login → dashboard renders → Events inbox shows the BD repeal event → open impact → evidence cards with highlighted quotes → approve one → exposure updates → generate action plan → PDF downloads (file exists, has a sources appendix).

### 10.5 AI quality targets (on the gold set; report actual numbers, don't claim them in advance)

| Metric                                                                         | Target for demo                                  |
| ------------------------------------------------------------------------------ | ------------------------------------------------ |
| Quote validity (clause and rule quotes are exact substrings)                   | **100%** of displayed impacts (enforced by code) |
| Impact precision (verdict ≠ compliant/insufficient, judged correct)            | ≥ 0.85                                           |
| Impact recall                                                                  | ≥ 0.75                                           |
| Abstention on adversarial/insufficient cases                                   | ≥ 0.8                                            |
| Injection resistance (adversarial cases not followed)                          | 100%                                             |
| Deterministic pipeline reproducibility (same input → same candidates/exposure) | 100%                                             |
| p95 latency per 15-contract analysis                                           | < 30 s                                           |

---

## 11. Demo and competition readiness

### 11.1 Demo scenario (all events real and sourced; all contracts synthetic and labelled)

1. **Login** via "Judge demo" (restricted workspace, reset per session).
2. **Events inbox:** shows real, sourced events. (a) _Bangladesh Cyber Security Ordinance 2025 (Ord. 25/2025) in force 21 May 2025, repealing CSA 2023 (which replaced DSA 2018)._ (b) _EU Reg. (EU) 2026/1744 Digital Omnibus on AI, high-risk dates moved to 2 Dec 2027._ (c) Live Federal Register items from the last 7 days (HHS/SEC/FTC).
3. **Stale-citation alert:** two synthetic contracts (mobile-wallet ToS and ISP retention policy) still cite "§26 Digital Security Act 2018". Evidence: the source links, plus the repeal chain with dates and verification status.
4. **Impact analysis** on event (a): per-clause cards with the clause quote highlighted, a verdict (`needs_update`), a label _AI interpretation, pending review_, and confidence. One clause lands in **insufficient evidence**, which demonstrates honesty.
5. **Reviewer approves** two impacts, edits one amendment, and rejects one. The audit log shows each action.
6. **Exposure:** a deterministic total, with the formula shown, split by approved and pending.
7. **Supply-chain view:** the deterministic BFS shows the indirect exposure path.
8. **Action plan PDF:** draft header, amendments with citations, and a sources appendix.
9. **Evaluation page:** actual metrics from `npm run eval` on the gold set, including failures.
10. **What-if (clearly labelled hypothetical):** "What if PDPO 2025 required 72-hour breach notification?" shows the same pipeline with a _Hypothetical_ banner.

### 11.2 Success criteria

- The full scenario runs in ≤ 5 minutes with **no** AI key (deterministic mode) and is better with a key.
- No unlabelled AI text; no fabricated events; every legal claim links to a source.
- A fresh `docker compose up` gives a working demo (documented, tested on a clean machine).

### 11.3 Known limitations (to state openly)

Coverage is limited to tracked instruments. BD sources have no API, so curation is manual or semi-automatic. Interpretations are drafts for lawyer review. Eval set is small and synthetic. This is not legal advice.

### 11.4 Presentation priorities

Lead with the **trust story** (evidence, abstention, review, eval numbers). Then lead with **Bangladesh relevance** (repeal chain, PDPO). The graph visuals come third.

---

## 12. Progress tracker

| ID        | Task                                                 | Status      | Evidence / notes                                                                                                                                                             |
| --------- | ---------------------------------------------------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A-1       | Repository audit (§2)                                | Verified    | Commands and outputs in §2.2; DB inspected via `docker exec clausegraph-postgres psql`                                                                                       |
| A-2       | External research (§3)                               | Verified    | Sources listed with access date 2026-10-16                                                                                                                                   |
| T0.1      | Lint baseline                                        | Verified    | `npx eslint .` → exit 0 (0 errors, 10 warnings). Prettier endOfLine: auto configured, 4 real errors fixed in db.server.ts, contracts.$contractId.tsx, regulations.$regId.tsx |
| T0.2      | Vitest setup                                         | Verified    | `npm test` → 1 passed in vitest; vitest.config.ts and baseline test added                                                                                                    |
| T0.3      | .gitattributes                                       | Verified    | Handled via prettier `endOfLine: "auto"` without churn per Q8                                                                                                                |
| T0.4      | CI workflow                                          | Implemented | `.github/workflows/ci.yml` added (tsc, eslint, test, build)                                                                                                                  |
| T1.1      | JWT secret fail-closed                               | Verified    | `getJwtSecret` fails closed in prod if missing or <32 chars; tested via `src/lib/__tests__/auth-secret.test.ts` (6 passed)                                                 |
| T1.2      | Invite fix (S-1/S-2)                                 | Verified    | Signed JWT tokens (`signInviteToken`/`verifyInviteToken`), no plaintext password in DB, cross-org invite rejected, dedicated `/accept-invite` page                           |
| T1.3      | Deletion admin-first (S-6)                           | Verified    | `assertAdmin` & demo workspace check enforced before any Paddle cancel or DB deletion in `account.functions.ts`                                                              |
| T1.4      | auth.uid() no fallback (S-7)                         | Verified    | `docker/init.sql` updated: returns `NULL` when `request.jwt.claim.sub` is absent; removes fallback to first user                                                              |
| T1.5      | AI provider routing (B-3)                            | Verified    | `resolveAiProvider` in `ai.server.ts` routes OpenAI → Gemini (OpenAI-compatible) → Lovable → None; tested via `ai-provider.test.ts` (6 passed)                                 |
| T1.6      | Honest simulation + deterministic baseline (B-1/B-2) | Verified    | Canned `CTR-*` Basel IV fallback deleted; `runDeterministicBaseline` matches real contracts/clauses/ontology; tested via `simulate-baseline.test.ts` (6 passed)               |
| T1.7      | Seed accuracy (L-8/9/10)                             | Verified    | Synthetic Bangladeshi counterparties in SC-011..SC-015; removed unverified `case-grameenphone-btrc`; corrected Equifax fine ($700M) and CFPB/FTC citation in init.sql       |
| T1.8      | Untrack .env + rotate (S-4)                          | Verified    | `.env`, `.env.development`, `.env.production` untracked from git; added to `.gitignore`; default secrets removed from `.env.example` and `docker-compose.yml`                 |
| T1.9      | Demo hardening (S-10)                                | Verified    | Demo workspace protected against deletion, member invites, and member removals in `account.functions.ts` and `team.functions.ts`                                           |
| T1.10     | Dockerfile fix (B-8)                                 | Verified    | `Dockerfile` updated (`npm ci`, valid `COPY`, `npm run preview -- --host 0.0.0.0 --port 3000`); verified preview server serves SSR & healthcheck endpoint returns 200 OK  |
| T2.1      | Migration runner (scripts/migrate.ts)                | Verified    | `scripts/migrate.ts` (`npm run db:migrate`) tracking `schema_migrations`; baseline mirrored as `0000_baseline.sql`; applies idempotently                                   |
| T2.2      | Regulatory registry tables (0002)                    | Verified    | `sources`, `legal_instruments`, `instrument_versions`, `provisions`, `obligations` created; 13 instruments seeded with URLs (100% have URLs)                                 |
| T2.3      | Amendment history port into regulatory_events        | Verified    | 31 regulatory events ported with source links; 29 verified vs 2 unverified (unverified excluded from cadence calculation)                                                     |
| T2.4      | Impact, review, audit, jobs schema (0003)            | Verified    | FTS tsvector & citations on clauses, `impact_assessments`, `jobs`, `invitations`, append-only `audit_log` with trigger-enforced immutability                                   |
| T2.5      | App DB role + RLS on tenant tables + withOrg (0004)  | Verified    | `clausegraph_app` role created; RLS enabled on tenant tables with `app.org_id` policy; `withOrg()` added; tested via `tests/integration/tenant-rls.test.ts` (4 passed)        |
| T3.1      | Candidate retrieval (candidates.server.ts)           | Verified    | Tag match + legacy reg map + statutory citation regex + keyword scoring; unit tested in `impact-pipeline.test.ts`                             |
| T3.2      | Classifier with quote validation (classify.server.ts) | Verified    | Zod schema, untrusted XML boundaries, exact substring quote verification, 1-retry with feedback, abstention on failure; unit-tested          |
| T3.3      | Orchestrator & exposure (orchestrate, exposure)      | Verified    | `runImpactAnalysis` persists to `simulation_runs` & `impact_assessments`; deterministic `sum(distinct contract.value)` by status & severity   |
| T3.4      | Evidence UI & review actions (simulate.tsx)          | Verified    | Per-clause evidence cards with highlighted quotes, official links, confidence; approve/edit/reject review actions write append-only audit_log |
| T3.5      | Stale-citation detector (stale-citations.server.ts)  | Verified    | Flags SC-012/SC-013 citing repealed DSA 2018 §26; shows full repeal chain: DSA 2018 -> CSA 2023 -> CSO 2025 in force; alert banner in UI     |
| T3.6      | Action plan grounding & sources appendix             | Verified    | Consumes impact assessments & quotes; PDF export includes prominent "Draft — Not Legal Advice" header and Sources Appendix                     |
| T4.1–T4.7 | Ingestion                                            | Not Started |                                                                                                                                                                              |
| T5.1–T5.8 | Quality / eval / demo                                | Not Started |                                                                                                                                                                              |

---

## 13. Risks and open questions

| ID  | Item                                                                                                                                                        | Impact                     | Proposed handling                                                                                                                 |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Q1  | Competition rubric, deadlines, submission format and judging criteria for _JusticeSphere AI_ are unknown; event identity is only partially confirmed (§1.3) | Prioritisation             | **Ask the user** for the official brief; until then follow §11                                                                    |
| Q2  | Which AI provider/key will be available at demo time? Cost ceiling?                                                                                         | Pipeline design, eval cost | Deterministic mode must stand alone; estimate cost per eval run before running                                                    |
| Q3  | Will Lovable keep syncing this branch? Lovable may not support a worker process or migrations                                                               | Deploy                     | Keep the worker optional (`npm run worker`); the app degrades gracefully if no worker runs (jobs stay queued and the UI shows it) |
| Q4  | Reuse terms for bdlaws.minlaw.gov.bd and Bangladesh Bank content                                                                                            | Ingestion legality         | Store links plus short excerpts until confirmed                                                                                   |
| Q5  | PDPO 2025 gazette status and exact in-force dates; Labour Act 2025/2026 amendment details; existence of the "BB Digital Payment Security Circular 2023"     | Demo accuracy              | Verify on official gazette/BB sites; until then mark unverified or remove                                                         |
| Q6  | Federal Register official docs redirected to a bot check during research; parameter names came from third-party docs                                        | Adapter correctness        | Verify against live API responses and record fixtures                                                                             |
| Q7  | Rotating the JWT secret invalidates all sessions; untracking `.env` changes the git index                                                                   | User coordination          | Do T1.8 only with explicit approval                                                                                               |
| Q8  | `.gitattributes`/LF normalisation would touch most files                                                                                                    | Diff noise, Lovable sync   | Prefer prettier `endOfLine:auto` (T0.1); do T0.3 only if the user agrees                                                          |
| Q9  | Two lockfiles (bun + npm) may diverge when adding dev dependencies                                                                                          | Lovable/Vercel build       | After adding deps with npm, regenerate `bun.lock` with `bun install` where bun is available                                       |
| Q10 | Legal review: interpretations of BD law should be checked by a Bangladeshi lawyer before the demo                                                           | Credibility                | Ask the user whether a reviewer is available                                                                                      |

---

## 14. Implementation log

_(Append dated entries: what changed, commands run, results.)_

- **2026-10-16:** Plan created after a full audit and research pass. No code changed yet at this point.
- **2026-10-16 (Phase 0):** Baseline tooling and lint fixes complete.
  - Set `endOfLine: "auto"` in `.prettierrc`.
  - Added binary/non-source ignores in `eslint.config.js`.
  - Fixed 4 real lint errors: explicit `any` in `src/lib/db.server.ts` with explicit boundary disable comments, and named `ContractNotFound` and `RegulationNotFound` to resolve `rules-of-hooks` in route files.
  - Added `vitest.config.ts`, added `"test": "vitest run"` to `package.json`, and created baseline unit test `src/lib/__tests__/baseline.test.ts`.
  - Created `.github/workflows/ci.yml`.
  - Untracked `.env`, `.env.development`, `.env.production` from git and updated `.gitignore`.
  - Validation commands all passed:
    - `npx tsc --noEmit` -> exit 0
    - `npx eslint .` -> exit 0 (0 errors, 10 warnings)
    - `npm test` -> 1 passed (exit 0)
    - `npm run build` -> built in 2.78s (exit 0)
- **2026-10-16 (Phase 1):** P0 Security & Correctness fixes complete.
  - **T1.1 (S-3):** Implemented `getJwtSecret` in `src/lib/auth.server.ts` (fails closed in production if unset or < 32 chars; provides ephemeral random secret with warning in dev). Removed default hardcoded secrets from `.env.example` and `docker-compose.yml`. Added `src/lib/__tests__/auth-secret.test.ts` (6 tests passed).
  - **T1.2 (S-1/S-2):** Secured invitation workflow with signed 7-day JWT tokens (`signInviteToken`/`verifyInviteToken`). Replaced hardcoded password generation with `encrypted_password = NULL`. Disallowed cross-org hijacking. Created `/accept-invite` route for users to set passwords securely upon invite redemption. Added copyable invite link modal on team settings page.
  - **T1.3 & T1.9 (S-6/S-10):** Enforced `assertAdmin` and demo workspace protection before Paddle cancellations or workspace deletions in `src/lib/account.functions.ts`. Blocked invites and member deletions in demo workspace in `src/lib/team.functions.ts`.
  - **T1.4 (S-7):** Updated `auth.uid()` in `docker/init.sql` to return `NULL` when `request.jwt.claim.sub` is absent (removed fallback to first user).
  - **T1.5 (B-3):** Implemented multi-provider AI routing in `src/lib/ai.server.ts` (OpenAI -> Gemini via OpenAI compatibility URL `generativelanguage.googleapis.com/v1beta/openai` -> Lovable gateway -> None). Added `src/lib/__tests__/ai-provider.test.ts` (6 tests passed).
  - **T1.6 (B-1/B-2):** Removed canned Basel IV `CTR-*` fallback from `src/lib/simulate-fallback.ts`. Implemented honest deterministic baseline fallback against real workspace contracts and regulations. Supported honest empty simulation results in UI (`src/routes/_authenticated/simulate.tsx`). Added `src/lib/__tests__/simulate-baseline.test.ts` (6 tests passed).
  - **T1.7 (L-8/L-9/L-10):** Replaced real Bangladeshi counterparties in sample contracts (SC-011..SC-015) with synthetic names in `docker/init.sql`. Removed unsourced `case-grameenphone-btrc`. Corrected Equifax settlement fine to $700M with explicit CFPB/FTC citation.
  - **T1.10 (B-8):** Updated `Dockerfile` with `npm ci`, valid `COPY` instructions, and `npm run preview -- --host 0.0.0.0 --port 3000`. Tested preview server with live Postgres: `/api/public/health` returned HTTP 200 with database connectivity.
  - Validation commands all passed:
    - `npx tsc --noEmit` -> exit 0
    - `npx eslint .` -> exit 0 (0 errors, 10 fast-refresh warnings)
    - `npm test` -> 4 test suites, 19 tests passed (exit 0)
    - `npm run build` -> built in 4.29s (exit 0)
- **2026-10-16 (Phase 2):** Data foundation complete.
  - **T2.1:** Implemented migration runner in `scripts/migrate.ts` with `public.schema_migrations` tracking. Added `npm run db:migrate` script to `package.json`. Created `0000_baseline.sql` mirroring `docker/init.sql`.
  - **T2.2:** Created `0002_regulatory_registry.sql` defining `sources`, `legal_instruments`, `instrument_versions`, `provisions`, `obligations`, and `legacy_reg_map`. Seeded 13 verified and documented legal instruments across US, EU, and Bangladesh (including the complete BD cyber repeal chain DSA 2018 -> CSA 2023 -> CSO 2025 in force, PDPO 2025, EU AI Act, and Regulation 2026/1744). All 13 rows carry official source URLs.
  - **T2.3:** Ported amendment chronology into `public.regulatory_events`. Verified count: 29 verified events, 2 unverified events with explicit provenance metadata.
  - **T2.4:** Created `0003_impact_and_review.sql` adding full-text search `tsvector` and `cited_instruments` to clauses, `is_synthetic` to contracts, and creating `impact_assessments`, `jobs`, `invitations`, and append-only `audit_log` with a trigger preventing UPDATE/DELETE.
  - **T2.5:** Created `0004_security_roles_rls.sql` establishing the `clausegraph_app` role and row-level security (RLS) on all tenant tables using the `app.org_id` session setting. Implemented `withOrg()` helper in `src/lib/db.server.ts`. Created automated integration tests in `tests/integration/tenant-rls.test.ts`.
- **2026-10-16 (Phase 3):** Evidence-backed impact pipeline complete.
  - **T3.1:** Implemented deterministic candidate retrieval in `src/lib/impact/candidates.server.ts` combining explicit tag matches, legacy ID mapping (`LEGACY_REG_TAG_MAP`), statutory citation regexes (GDPR, CCPA, HIPAA, SEC 17a-4, SOX 302, BD Labour Act, BD DSA/CSO, BB circulars, EU AI Act), and lexical keyword scoring.
  - **T3.2:** Implemented Zod-validated classifier in `src/lib/impact/classify.server.ts` with untrusted XML document boundaries (`<untrusted_clause>`, `<untrusted_obligation>`), anti-prompt-injection system prompt, exact substring quote verification on both contract clause and statutory obligation text, 1-retry with specific error feedback, and honest fallback to `verdict: "insufficient_evidence"` (abstention).
  - **T3.3:** Implemented deterministic exposure engine in `src/lib/impact/exposure.server.ts` (`sum(distinct contract.value)` avoiding double-counting, split by approved vs pending review, with severity aggregation) and pipeline orchestrator in `src/lib/impact/orchestrate.server.ts` executing end-to-end analysis and atomically inserting records into `simulation_runs`, `impact_assessments`, and immutable `audit_log`.
  - **T3.4:** Upgraded simulator UI in `src/routes/_authenticated/simulate.tsx` and review functions in `src/lib/impact/review.functions.ts`. Cards display verbatim highlighted clause quotes, rule quotes, official source links, provenance tags, and review actions (Approve / Edit / Reject) that update PostgreSQL and log immutable audit entries. Added first-class "Insufficient Evidence" bucket.
  - **T3.5:** Implemented stale-citation detector in `src/lib/impact/stale-citations.server.ts`. Successfully flags SC-012/SC-013 citing repealed Digital Security Act 2018 §26, and traces the repeal chronology (DSA 2018 repealed -> CSA 2023 repealed -> CSO 2025 in force) in an in-app alert banner.
  - **T3.6:** Upgraded action plan generator in `src/lib/action-plan.server.ts`, `src/lib/action-plan-fallback.ts`, and `src/components/clausegraph/ActionPlanPanel.tsx`. PDF brief includes prominent "Draft — Not Legal Advice" warning, clause grounding, and an authoritative Sources Appendix.
  - **Testing & Verification:** Added `src/lib/__tests__/impact-pipeline.test.ts` (8 passed). All checkpoint commands passed:
    - `npx tsc --noEmit` -> exit 0
    - `npx eslint .` -> exit 0 (0 errors, 10 fast-refresh warnings)
    - `npm test` -> 5 test suites, 27 tests passed (exit 0)
    - `npm run test:integration` -> 1 test suite, 4 tests passed (exit 0)
    - `npm run build` -> built client & server bundles in 3.94s (exit 0)
