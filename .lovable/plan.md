# Predictive Regulatory Blast Radius — Phase 8

Add a Predictive Radar to ClauseGraph that forecasts which regulations are likely to change, generates a plausible hypothetical amendment via LLM, and runs the existing blast-radius simulation against that forecast. Includes a What-If Sandbox for user-authored hypotheticals.

## Scope

**In:**
1. Regulation amendment-history data model + seeded history for the 10 existing ontology entries.
2. Heuristic prediction engine (time-since-last-amendment vs average interval + optional news-signal boost).
3. LLM-generated hypothetical amendment text (grounded in past amendment summaries).
4. Predictive Radar dashboard route with probability badges and timeframe.
5. One-click "Simulate this forecast" → reuses existing simulate pipeline; results labeled as forecast.
6. What-If Sandbox: free-form hypothetical rule input → same pipeline.
7. Anticipatory Action Plan variant (reuses existing action-plan generator, prefixed as preemptive).

**Out (roadmap, not built):**
- Live RSS/news scraper (mocked as manual boost field for the demo).
- Real EUR-Lex SPARQL pull (seed from static curated amendment history).
- Trained ML model (heuristic only, per spec).

## Data model

New table `regulation_amendments` (org-agnostic reference data, readable by all authenticated users):
- `regulation_id` (FK → `regulations.id`)
- `amended_on` (date)
- `summary` (text) — one line describing the change
- `direction` (enum: `tightened` | `loosened` | `clarified` | `expanded`)

Seed 3–5 historical amendments per regulation across the 10 curated entries (GDPR 33 shortened deadlines, CCPA opt-out expansions, HIPAA Security Rule updates, Bangladesh Bank fintech circular revisions, etc.). Sourced from public records; realistic dates.

Add optional column to `regulations`:
- `news_signal_boost` (numeric 0–1, default 0) — manual editorial nudge used in the heuristic.

## Prediction heuristic (server function)

`predictAmendmentRisk` → for each regulation:
1. Compute average interval between historical amendments.
2. `ratio = time_since_last / avg_interval`.
3. `base_probability = clamp(ratio / 1.0 × 0.7, 0, 0.7)` — caps at 70% from timing alone.
4. `boost = news_signal_boost × 0.3`.
5. `probability = base_probability + boost`.
6. Bucket into High (>70%), Medium (40–70%), Low (<40%).
7. `estimated_window`: derived from `avg_interval − time_since_last`, floored at 3 months, clamped to 3/6/12/18-month buckets.

Returns array sorted by probability desc.

## Hypothetical amendment generation

New server function `generateHypotheticalAmendment(regulationId)`:
- Fetches regulation text + amendment history summaries.
- Calls Lovable AI Gateway (`google/gemini-3.6-flash`, project default) with a prompt anchored on past directional patterns: "Draft a plausible near-future amendment. Follow the historical direction of change. Output only the amended clause text (≤ 200 words). This is an adversarial what-if scenario, not a leak."
- Returns `{ amendment_text, rationale, based_on_patterns[] }`.

Result is cached per regulation in `simulation_runs` (existing table, extended `run_type` column: `reactive` | `forecast` | `what_if`).

## Blast-radius reuse

The forecast simulation calls the existing `simulateImpact` server function with the generated amendment text — no duplicate pipeline. UI labels the medallion header "Forecast simulation — not yet enacted" and switches the exposure panel copy to future-tense ("will be exposed if this passes").

## UI

New routes:
- `/predictive` — Radar dashboard. Cards for each regulation showing: name, probability badge (High/Medium/Low in brass/amber/muted — **not red**, red stays reserved for exposure), estimated window, last-amended date, "Simulate forecast" button.
- `/predictive/$regulationId` — Detail view. Shows historical amendments timeline, generated hypothetical text (in JetBrains Mono, framed as "adversarial what-if"), then embeds the existing simulate results component.
- `/what-if` — Free-form textarea + "Simulate" button. Feeds directly into `simulateImpact`. Results tagged `what_if`.

Sidebar: add "Predictive Radar" and "What-If Sandbox" entries. Both gated behind Pro plan (existing quota system).

Action Plan panel: when invoked from a forecast run, header changes to "Anticipatory Action Plan" and language shifts to preemptive ("start remediation before enactment").

## Honesty guardrails (per spec section 6.3 tone)

- Every forecast card carries a small mono caption: "Heuristic forecast from public amendment history. Not a leak, not a legal prediction."
- Hypothetical amendment text always renders with a brass-outlined "GENERATED" tag adjacent to the mono block.
- Confidence scores show the underlying reasoning on hover (avg interval, time since last, boost applied).

## Files

**New:**
- `supabase` migration: `regulation_amendments` table + GRANTs + RLS (read for authenticated) + `news_signal_boost` column + amendment seed rows.
- `src/lib/predict.functions.ts` — `predictAmendmentRisk`, `generateHypotheticalAmendment`.
- `src/routes/predictive.tsx`, `src/routes/predictive.$regulationId.tsx`, `src/routes/what-if.tsx`.
- `src/components/clausegraph/RadarCard.tsx`, `AmendmentTimeline.tsx`, `HypotheticalAmendmentBlock.tsx`.

**Modified:**
- `src/components/clausegraph/Sidebar.tsx` — nav entries.
- `src/lib/simulate.functions.ts` — accept optional `run_type` param.
- `src/components/clausegraph/ActionPlanPanel.tsx` — variant copy for forecast runs.
- `src/data/queries.ts` — TanStack Query wrappers.

## Verification

- Radar page loads with ≥3 High/Medium regulations from seeded history.
- Clicking one generates hypothetical text + runs simulation end-to-end.
- What-If sandbox accepts free text and returns a blast graph.
- Forecast runs are stored in `simulation_runs` with `run_type='forecast'` and count against Pro quotas.
- Reduced-motion honored; risk-red still exclusive to exposure severity, not probability badges.
