
## 1. Backtested Validation tab

New route `/backtest` (replaces or joins existing nav) that showcases 3 real enforcement cases, each analyzed live through the existing Simulate Impact pipeline.

**Cases (real, well-documented enforcement actions):**
- Wells Fargo — $3.0B (2020, DOJ/SEC) — fake accounts, consumer protection violations (Dodd-Frank / FTC Act §5)
- Goldman Sachs — $2.9B (2020, 1MDB, FCPA)
- Credit Suisse — $475M (2022, Mozambique "tuna bond" bribery, FCPA / MAR)

Each case ships with:
- Real metadata: company, fine amount, date, regulation violated, one-paragraph public summary + source citation
- A `reconstructed_scenario`: 2–4 short synthetic clauses phrased like real contract language matching the violation pattern, plus a short "proposed regulation" style prompt that mirrors the enforcement theory

**UI:** three glass cards in a row (stacks on tablet). Each card:
- Header: company + fine in Fraunces (mono for the dollar figure), date in mono
- Regulation violated + short summary
- **Prominent disclosure banner** (brass hairline, muted copy): *"Reconstruction, not this company's actual contracts. Clauses are synthetic, drafted to mirror the enforcement pattern."*
- "Run Analysis" brass button
- On click: card expands / a side region below fills with a mini blast-radius summary (total exposure across the reconstructed clauses, per-clause severity, suggested amendment) — same visual language as `/simulate`, framed as "reconstructed scenario, analyzed live"
- Small "Analyzed live via gpt-4o" mono tag on the result to make it obvious it's not pre-written

**Backend:** add a companion server fn `simulateBacktest` that accepts a `caseId`, loads the reconstructed scenario from a static file, and runs the same gateway call as `simulateImpact` but with the reconstructed clauses as the contract context (instead of the full portfolio). Falls back to a pre-saved response per case on error, matching the existing fallback pattern.

## 2. Compliance Action Plan generator

After a Simulate Impact run finishes (`status === "done"` in `simulate.tsx`), show a **"Generate Action Plan"** brass button under the side panel's affected-contracts list.

**On click:** call a new server fn `generateActionPlan` that sends the simulation result + regulation text to gpt-4o and returns:
```
{
  policy_draft: string,           // one paragraph of updated internal policy language
  amendments: [{ contract_id, contract_name, suggestion, rationale }],
  tech_fixes: [{ priority: "P0"|"P1"|"P2", title, detail }]
}
```

**UI — new glass panel** that slides in below the results (or a modal overlay, TBD by user later, defaulting to inline panel):
- Header "Compliance Action Plan" + mono timestamp
- **Standing disclaimer banner:** *"Draft output. Every amendment is marked for legal review — never a final position."*
- Section: *Policy draft* — paragraph in Inter, monospace label above
- Section: *Contract amendments* — list, each row shows contract id/name (mono), the suggestion, rationale, and a **"For legal review"** brass-outlined pill on every item
- Section: *Technical fix checklist* — prioritized (P0/P1/P2 with colored dots, reserving red only for P0), each row a checkbox + title + detail
- Toolbar at bottom right: **Copy to clipboard** (formatted markdown) and **Export PDF** buttons

**PDF export:** client-side using `jspdf` (small, no native deps, Worker-safe since it's client-only). Renders a plain typographic PDF — title, timestamp, sections mirroring the on-screen structure, with the disclaimer at top. No canvas-of-DOM approach, so glass effects aren't preserved but the content is clean and legal-review-ready.

**Fallback:** if the gateway call fails, use a pre-saved sample action plan (per the existing `simulate-fallback` pattern) so the flow never dead-ends.

## Files

New:
- `src/data/backtest-cases.ts` — the 3 real cases + reconstructed scenarios + fallback results
- `src/lib/action-plan-types.ts` — `ActionPlan`, `Amendment`, `TechFix`
- `src/lib/action-plan-fallback.ts`
- `src/lib/action-plan.functions.ts` — `generateActionPlan` server fn
- `src/lib/backtest.functions.ts` — `simulateBacktest` server fn
- `src/components/clausegraph/BacktestCard.tsx`
- `src/components/clausegraph/ActionPlanPanel.tsx`
- `src/routes/backtest.tsx`

Modified:
- `src/routes/simulate.tsx` — add "Generate Action Plan" button + render `ActionPlanPanel`
- `src/components/clausegraph/Sidebar.tsx` — add "Backtest" nav link (Actions stays for now)

Package add: `jspdf`.

## Non-goals

- No changes to the existing Simulate Impact model call, fallback, or medallion animation.
- No changes to `/actions` placeholder route (the action plan lives on `/simulate` inline, which is where the user's mental context already is).
- Copy-to-clipboard uses plain-text markdown; not rich HTML.
