# Phase 10 — Two Category-Defining Features

## Feature 1: Cross-Enterprise Blast Radius (Supply Chain propagation)

Model a multi-hop counterparty graph and cascade regulatory impact across contract edges.

### Data
New migration:
- `supply_chain_nodes` (id, org_id, name, role: `self|supplier|subprocessor|vendor`, tier: int, jurisdiction, description)
- `supply_chain_edges` (id, org_id, from_node_id, to_node_id, contract_name, contract_value numeric, key_clauses text[], depends_on_regs text[])
- RLS scoped to `org_id = current_org_id()`; standard GRANTs.
- Seed a demo chain per org in `handle_new_user` (or on first visit): Self → Supplier A (cloud, tier 1) → Supplier B (data center, tier 2) → Supplier C (energy provider, tier 3), plus a parallel branch (Self → Payment Processor → Card Network).

### Server
`src/lib/supply-chain.functions.ts`:
- `getSupplyChain()` — returns nodes + edges for org.
- `simulateSupplyChainImpact({ regulationText, seedNodeIds? })` — calls the AI gateway (`google/gemini-3.6-flash`) with the chain + regulation to identify directly-hit nodes, then runs a deterministic BFS traversal across edges to compute cascade hops. Returns `{ hits: [{nodeId, hop, reason, brokenClause, severity, indirectExposureUSD}], totalIndirectExposure, remediation: string[] }`.
- Persist runs to existing `simulation_runs` with `run_type='supply_chain'`.

### UI
- New route `src/routes/_authenticated/supply-chain.tsx`.
- New sidebar item "Supply Chain" (icon: `Network`).
- Component `SupplyChainGraph.tsx`: force-directed / layered SVG graph with company boundary rings. Hop-delayed red wave animation (200ms per hop, respects `prefers-reduced-motion`).
- Side panel: cascade breakdown ("Hop 1 → 2 → 3"), indirect exposure $ in JetBrains Mono, brass-outlined "Require upstream audit" remediation cards.
- Input: regulation text box + "Simulate cascade" brass button; also a "Load EU Data Center Energy demo" preset for the wow moment.

## Feature 2: Compliance-as-Code Autopilot

Turn simulation findings into executable audit + remediation artifacts.

### Server
`src/lib/compliance-code.functions.ts`:
- `generateComplianceCode({ regulationText, gap, stack: 'aws'|'gcp'|'azure' })` — AI call returns structured JSON:
  - `auditScript`: { language: 'python'|'bash', code, description }
  - `remediation`: { language: 'terraform'|'yaml'|'bash', code, description }
  - `testCases`: string[]
  - `runbook`: string (markdown)
- Uses `google/gemini-3.6-flash` with a compliance-engineer system prompt; validates output with Zod; falls back to deterministic template when AI unavailable.
- Persists artifacts to a new `compliance_artifacts` table (id, org_id, simulation_run_id nullable, regulation_id nullable, gap, stack, audit_script jsonb, remediation jsonb, created_at) with RLS + GRANTs.

### UI
- New component `ComplianceCodePanel.tsx`: two tabbed code blocks (Audit / Remediation) with:
  - Monospace rendering, syntax color via light regex highlighting (no new dep) — brass accents on keywords.
  - Typing animation on first render (12ms/char, skip on reduced-motion or `Skip animation` click).
  - Copy button + "Download .py/.tf" buttons.
- Wire into `ActionPlanPanel.tsx` (new "Compliance-as-Code" tab) and the Supply Chain results panel (per-node "Generate fix" button).
- New route `src/routes/_authenticated/actions.$runId.tsx` optional — otherwise inline in existing action plan view.

## Design system
- Reuse tokens: brass for active/CTA, risk-red only for hit nodes and cascade wave, `surface-glass` panels, 20px/12px radii.
- New graph uses the same `hairline` divider color for idle edges; edges turn brass while "propagating", then risk-red when the hop lands.

## Technical details
- No new npm deps required; SVG graph is hand-rolled to keep bundle lean. If layout gets fiddly we add `dagre` (small).
- All AI calls go through existing `createLovableAiGatewayProvider` helper; server-only key handling unchanged.
- Zod schemas colocated in each `.functions.ts` file.
- Loaders use `queryClient.ensureQueryData` + `useSuspenseQuery` pattern (matches current codebase).
- Migration includes seed sample rows so demo works immediately on new signup and is backfilled for existing orgs.

## Deliverables
1. Migration: `supply_chain_nodes`, `supply_chain_edges`, `compliance_artifacts` + seed + backfill.
2. `src/lib/supply-chain.functions.ts`, `src/lib/compliance-code.functions.ts`.
3. `src/components/clausegraph/SupplyChainGraph.tsx`, `ComplianceCodePanel.tsx`.
4. Routes: `_authenticated/supply-chain.tsx` (+ optional `actions.$runId.tsx`).
5. Sidebar + ActionPlanPanel integration.
6. Head metadata on the new route.
