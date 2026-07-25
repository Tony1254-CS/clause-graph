## Phase 9 — Full spec pivot of the regulatory ontology

Replace the current 10 US-financial regulations with the exact mix your spec calls for (3 GDPR, 4 US, 3 Bangladesh), rewrite the seeded contract corpus to cite the new IDs, and re-seed the amendment history that the Predictive Radar reads from.

### The new 10 regulations

**EU — GDPR (3)**

```text
REG-GDPR-5      GDPR Art. 5 — Principles / Data Minimization
REG-GDPR-33     GDPR Art. 33 — Personal Data Breach Notification (72h)
REG-GDPR-44     GDPR Art. 44 — General Principle for International Transfers
```

**US (4) — a broader mix, not just financial**

```text
REG-SEC-17A4    SEC Rule 17a-4 — Broker-Dealer Records (immutable retention)
REG-CCPA-1798.120  CCPA §1798.120 — Right to Opt Out of Sale/Sharing
REG-HIPAA-SEC   HIPAA Security Rule (45 CFR §164.306–.312)
REG-SOX-302     SOX §302 — Officer Certification (kept from current set)
```

**Bangladesh (3)** — preferring the three named in your spec, with permission to substitute if English sourcing is thin:

```text
REG-BB-DPS-2023   Bangladesh Bank Digital Payment Security Circular (2023)
REG-BD-DSA-2018   Digital Security Act 2018 §26 — Data Breach & Identity Info
REG-BD-LA-2006    Bangladesh Labour Act 2006 §26 — Notice of Termination
```

Each entry: plain-language `summary` (2–3 sentences) + `obligations[]` (3–5 machine-readable tags like `data_minimization`, `72h_breach_notification`, `right_to_opt_out`). Written to be safe to paste verbatim into every LLM prompt.

### The new 15 sample contracts

Rewritten so the citation graph is dense and demo-legible. Roughly:

| # | Contract | Cites |
| --- | --- | --- |
| 1 | Data Processing Agreement — EU SaaS vendor | GDPR-5, GDPR-33, GDPR-44 |
| 2 | Standard Contractual Clauses addendum | GDPR-44 |
| 3 | Customer Terms of Service — EU consumers | GDPR-5, GDPR-33 |
| 4 | Employee Privacy Notice — EU workforce | GDPR-5 |
| 5 | Consumer Privacy Notice — California | CCPA-1798.120 |
| 6 | Adtech Data-Sharing Agreement — US | CCPA-1798.120, GDPR-44 |
| 7 | Business Associate Agreement (HIPAA) | HIPAA-SEC |
| 8 | Cloud Hosting Master Agreement — health-data workload | HIPAA-SEC, GDPR-33 |
| 9 | Broker-Dealer Recordkeeping SLA | SEC-17A4, SOX-302 |
| 10 | Audit Committee Charter | SOX-302 |
| 11 | Merchant Acquiring Agreement — Bangladesh | BB-DPS-2023 |
| 12 | Mobile Wallet Terms of Use — Bangladesh consumers | BB-DPS-2023, DSA-2018 |
| 13 | ISP Data-Retention Order Compliance Policy — Bangladesh | DSA-2018 |
| 14 | Fixed-Term Employment Contract — Bangladesh knitwear plant | LA-2006 |
| 15 | Cross-border Support Services Agreement — BD → EU data flow | LA-2006, GDPR-44 |

Each contract carries 3–4 clauses with real regulatory language (per your original spec: ≥8 contracts have explicit reg language, the rest are boilerplate).

### Amendment history for the Predictive Radar

Every one of the 10 new regs gets 3–5 dated entries in `regulation_amendments`, grounded in the actual public amendment record where possible (e.g. GDPR EDPB guidance updates on Art. 33, CCPA→CPRA amendment, Bangladesh Bank circular annexures). Each entry: `amended_on`, `summary`, `direction` (`tightened` / `loosened` / `clarified` / `expanded`). This drives the heuristic — the interval between amendments is what the Radar's probability model uses.

### How this affects existing orgs

Every seeded row in the DB is marked `is_sample = true`. There are currently no user-uploaded contracts. Plan:

- `DELETE FROM clauses WHERE contract_id IN (SELECT id FROM contracts WHERE is_sample = true)`
- `DELETE FROM contracts WHERE is_sample = true`
- Re-run the same seeding logic `handle_new_user()` uses, per existing org, from the new `sample_contracts` + `sample_clauses` rows

User-uploaded contracts (`is_sample = false`) are never touched — there are none today, but the query is scoped defensively.

### Migration structure (one migration, transactional)

```text
1. DELETE dependent rows (regulation_amendments, sample_clauses, is_sample clauses/contracts)
2. DELETE FROM regulations
3. INSERT 10 new regulations
4. INSERT ~40 amendment history rows
5. INSERT 15 sample_contracts + ~50 sample_clauses
6. For each existing organization: re-copy sample rows into contracts/clauses (matching handle_new_user)
```

### What does NOT change

- `backtest_cases`: self-contained (own reg strings, own reconstructed clause IDs) — untouched.
- `handle_new_user()` trigger: already reads from `sample_contracts`/`sample_clauses`, so new signups automatically pick up the new corpus.
- `predict.functions.ts` / `simulate.functions.ts` / Radar UI: they read whatever is in `regulations` + `regulation_amendments`, so no code changes needed — the pivot is data-only.
- Federal Register widget: continues to fetch live from federalregister.gov.

### Deliverable

A single Supabase migration containing all inserts and the cleanup + reseed of existing orgs. No frontend code changes needed after this — the entire app rerenders against the new ontology.