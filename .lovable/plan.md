# Phase 2 — Real Data Wiring

Prove the data model and navigation with separate routes, realistic seed data, and one live external feed. No AI, no simulation logic — that's Phase 3.

## Data model (seed)

Two typed JSON files under `src/data/`, matching the exact schema you specified. Author both as TS modules so imports are typed and tree-shake cleanly.

**`src/data/regulations.ts`** — 10 entries. Realistic US financial-regulation ontology drawn from the actual regulatory landscape:

```ts
type Obligation = { id: string; text: string };
type Regulation = {
  id: string;              // e.g. "REG-SEC-10B5"
  jurisdiction: string;    // e.g. "SEC" | "CFTC" | "FINRA" | "OCC" | "Federal Reserve" | "EU-ESMA"
  title: string;           // e.g. "Rule 10b-5 — Anti-fraud"
  summary: string;         // 2–3 sentence plain-language summary
  obligations: Obligation[]; // 2–4 obligations each
};
```

Coverage: SEC Rule 10b-5, Reg BI (Best Interest), Dodd-Frank §619 (Volcker), Reg SHO, Sarbanes-Oxley §302, MiFID II Art. 24, Basel III Capital, CFTC Swap Reporting (Part 45), FINRA Rule 4511 (Recordkeeping), GDPR Art. 32 (financial-data security).

**`src/data/contracts.ts`** — 15 entries:

```ts
type Clause = {
  id: string;              // e.g. "CL-001-3"
  text: string;            // 1–2 sentence clause text
  linked_regs: string[];   // regulation IDs
};
type Contract = {
  id: string;              // e.g. "CTR-001"
  name: string;            // e.g. "ISDA Master Agreement — Nomura FX"
  counterparty: string;
  value: number;           // USD
  clauses: Clause[];       // 3–6 clauses per contract
};
```

Realistic mix: ISDA masters, prime brokerage, MSFTA, custody, revolver credit agreements, distribution agreements, subscription docs. Values from $2M to $850M. Each contract's clauses cite 1–3 regulations from the ontology, so the graph has real cross-links.

## Routes

New route files (each with its own `head()` — unique title, description, og:title, og:description):

- `src/routes/contracts.tsx` — layout with `<Outlet />`
- `src/routes/contracts.index.tsx` — Contracts list
- `src/routes/contracts.$contractId.tsx` — Contract detail
- `src/routes/feed.tsx` — Regulatory Feed (curated + live)
- `src/routes/regulations.$regId.tsx` — Regulation detail (opened from clause pills)
- `src/routes/index.tsx` — Dashboard (medallion, now graph-shaped)

Sidebar links become real `<Link>` components with `activeProps` styling. "Simulate Impact" and "Action Plans" nav items link to placeholder routes that render a "Coming in Phase 3" glass panel — the nav shape stays intact.

## Data access

Since all data is local + one public REST call, use TanStack Query directly in components (no server functions needed). All queries defined in `src/data/queries.ts`:

- `contractsQuery` — returns local array
- `contractQuery(id)` — returns one contract or throws `notFound()`
- `regulationQuery(id)` — same
- `regulationsQuery` — local array
- `federalRegisterQuery` — `fetch('https://www.federalregister.gov/api/v1/documents?per_page=5&order=newest')`, `staleTime: 5 min`, gracefully degrades (returns `{ results: [], error }` on failure so the panel shows a "Live feed unavailable" state instead of crashing)

Loaders call `context.queryClient.ensureQueryData(...)`. Components read via `useSuspenseQuery`. `notFoundComponent` and `errorComponent` set on every data route.

## Views

**Contracts list** (`/contracts`)
Responsive grid of glass cards (2 cols tablet, 3 cols desktop). Each card:
- Contract name in Fraunces (18px)
- Counterparty in Inter muted (13px)
- Value in JetBrains Mono, formatted `$127,500,000` (brass color, right-aligned)
- Clause-count badge — small mono pill, hairline border, "6 clauses"
- Hover: hairline opacity 18% → 32%, subtle translate-y

**Contract detail** (`/contracts/$contractId`)
- Header: name (Fraunces 32px), counterparty + value (mono) + contract ID (mono muted)
- Clause list: each clause is a glass-panel-sm card
  - Clause ID in mono (top-left, tiny)
  - Clause text in Inter (15px, readable line-length)
  - Below the text: row of brass-outlined pills — `<Link>` to `/regulations/$regId`, each showing the regulation ID in mono and short title in Inter, brass border, hover fills brass at 8% opacity

**Regulation detail** (`/regulations/$regId`)
- Jurisdiction chip (mono)
- Title (Fraunces 28px), summary (Inter 15px, muted)
- Obligations rendered as numbered list, each in a hairline-bordered row
- "Cited by N clauses across M contracts" — computed from the corpus, links back to contracts

**Regulatory Feed** (`/feed`)
Two clearly distinct sections stacked vertically:

1. **Curated ontology** — labeled `CURATED · ClauseGraph ontology` in mono/brass. 10 entries as glass-panel rows, each with jurisdiction chip + title + summary + obligation count. Clicking opens the regulation detail.
2. **Live filings** — labeled `LIVE · Federal Register` with a small pulsing brass dot to signal live. Distinct visual treatment: no glass panel, instead flat rows on a slightly recessed surface (`surface-raised`) with dashed hairline separators — reads as "raw feed" vs. the polished ontology. Each row: publication date (mono), agency, title (Inter), external-link icon opening the FR document URL in a new tab. Loading skeleton + graceful error state.

**Dashboard medallion** — the seal now renders a real (static, non-simulated) node/edge graph:
- Nodes: 15 contracts + 10 regulations positioned via a deterministic circular layout (contracts on inner ring, regulations on outer ring)
- Edges: drawn from `contract.clauses[].linked_regs` — every citation becomes a thin hairline line through the medallion
- SVG-rendered inside the existing circular medallion
- All nodes/edges rendered in text-muted / hairline colors — NO red, NO brass fills. Just structure.
- Small legend below: "○ contract · △ regulation · — citation" in mono
- Hover a node: tooltip with its ID + name (no navigation — that's Phase 3 territory)

## File plan

**Create**
- `src/data/regulations.ts` (typed seed)
- `src/data/contracts.ts` (typed seed)
- `src/data/types.ts` (shared types)
- `src/data/queries.ts` (query options factories)
- `src/routes/contracts.tsx`, `contracts.index.tsx`, `contracts.$contractId.tsx`
- `src/routes/regulations.$regId.tsx`
- `src/routes/feed.tsx`
- `src/routes/simulate.tsx`, `src/routes/actions.tsx` (placeholder "Phase 3" panels)
- `src/components/clausegraph/ContractCard.tsx`
- `src/components/clausegraph/ClauseRow.tsx`
- `src/components/clausegraph/RegulationPill.tsx`
- `src/components/clausegraph/JurisdictionChip.tsx`
- `src/components/clausegraph/FederalRegisterFeed.tsx`
- `src/components/clausegraph/GraphMedallion.tsx` (replaces static seal on dashboard)

**Modify**
- `src/components/clausegraph/Sidebar.tsx` — `<Link>` navigation + active state via `useRouterState`
- `src/components/clausegraph/TopBar.tsx` — Simulate Impact button links to `/simulate`
- `src/routes/index.tsx` — swap `BlastRadiusSeal` for `GraphMedallion`
- `src/routes/__root.tsx` — no changes (fonts already loaded)

## Federal Register call

Client-side `fetch` (CORS is open on `federalregister.gov/api/v1`). Query key `["federal-register", "newest", 5]`, `staleTime: 5 * 60_000`, returns `{ results, error?: string }`. On failure the panel renders an inline "Live feed temporarily unavailable" message; the curated section keeps working.

## Verification

- Build passes
- `/`, `/contracts`, `/contracts/CTR-001`, `/regulations/REG-SEC-10B5`, `/feed` all load
- Playwright screenshot the dashboard (graph visible), contracts list, one contract detail, and the feed page
- Confirm the live FR section is visually distinct from curated ontology
- Confirm clicking a clause pill navigates to the regulation
