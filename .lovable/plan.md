
Polish-only pass. No new features, no data model or route changes. Every change is presentational.

## 1. Motion consistency (150–200ms ease-out)

Audit found mixed durations: `transition-all` (no duration), `duration-500`, inline `400ms/500ms` on graph nodes, and untimed `transition-colors`. Normalize:

- Add a `.transition-ui` utility in `src/styles.css` = `transition: all 180ms ease-out;` and use it as the canonical interactive transition.
- Replace bare `transition-all` / `transition-colors` on buttons, links, cards, sidebar items, pills, chips, and inputs with `duration-150 ease-out` (or `duration-200` for cards with translate).
- `GraphMedallion` node/edge transitions stay 400–500ms (they are simulation reveal animations, not hover states) but get gated by reduced-motion (see §7).
- Simulate result panel `duration-500` opacity fade stays — it's a reveal, not a hover.

## 2. Corner radius normalization (20 / 12 only)

Current inventory outside spec: `6px, 8px, 10px, 14px, 16px`. Fold to spec:

- `JurisdictionChip` 6px → 12px (or keep as `rounded-full` pill — decide: 12px for consistency).
- `GraphMedallion` tooltip 8px → 12px.
- `ActionPlanPanel` copy/export buttons + tech-fix rows 10px → 12px.
- `BacktestCard` reconstructed clause rows + impact list items 10px → 12px; outer results panel 14px → 20px (it's a major nested panel).
- `FederalRegisterFeed` wrapper 16px → 20px.
- `Sidebar` collapsed-icon buttons 10px → 12px.
- Glass panel base (`.glass-panel` in styles.css) stays 20px. Full-round elements (`rounded-full` dots, avatars) are exempt.

## 3. Risk-red containment

Confirmed usages of `--risk`:
- Severity dots / node fills / exposure figure — **valid**
- Error-message text on Simulate + Backtest + ActionPlan failure lines — **decorative-adjacent**. Recolor these to `text-muted-foreground` with a small risk-red dot prefix, so red stays reserved for exposure semantics and errors read as system messages, not exposure signals.
- `--destructive` token in shadcn scope currently aliases `--risk`. Leave alias (shadcn primitives aren't used on risk surfaces in this app), but no new component may reference `bg-destructive` / `text-destructive`.

## 4. Empty & loading states in interface voice

Contracts list (`contracts.index.tsx`) and Feed (`feed.tsx`) currently rely on suspense/no explicit empty. Add:

- **Loading**: glass panel with hairline border, mono kicker "Loading", Fraunces line "Reading the corpus." / "Pulling the latest filings from the Federal Register.", one muted-body sentence explaining what's happening.
- **Empty (no data)**: same panel shell, copy shifts to "No contracts have been indexed yet. Add a corpus file to `src/data/contracts.ts` to populate this view." / "The Federal Register returned no recent filings. The curated ontology below is still available."
- **Error (Federal Register only)**: existing dashed-border panel already handles this; rewrite copy in interface voice ("The Federal Register API didn't respond. Curated ontology is unaffected — try again in a moment.").

No generic spinners.

## 5. Keyboard focus visibility

Add a global `:focus-visible` ring in `src/styles.css` for interactive elements: 2px `var(--brass)` outline at 60% opacity, 2px offset against `--ink-base`. Applied via a base selector on `a, button, [role="button"], input, textarea, select, summary, [tabindex]:not([tabindex="-1"])`. Remove ad-hoc `focus:ring-*` overrides on the Simulate textarea so it inherits the global style consistently.

## 6. Responsive checks at 1280 / 1024 / 768

Audit + adjust:

- `AppShell` sidebar is fixed-width; at 1024/768 sidebar becomes a collapsed icon rail (already partially wired via the collapsed variant in Sidebar.tsx — trigger it via `lg:` breakpoint instead of only manual toggle).
- Contracts grid: switch to `grid-cols-1 md:grid-cols-2 xl:grid-cols-3`.
- Simulate two-column layout: stack (`lg:grid-cols-[1fr_380px]` → single column below `lg`).
- Feed 3-column row (`grid-cols-[130px_1fr_auto]`) collapses cleanly at 768 → `grid-cols-1` with meta on top.
- Backtest cards: `grid-cols-1 lg:grid-cols-3`.
- Verify glass panels never touch viewport edges: main content padding stays `px-6` minimum, page container gets `max-w-[1440px] mx-auto`.

Playwright verify at 1280/1024/768 after edits; screenshot each breakpoint per key route.

## 7. prefers-reduced-motion

In `src/styles.css`:

```css
@media (prefers-reduced-motion: reduce) {
  .rim-pulse { animation: none; }
  * { transition-duration: 0ms !important; animation-duration: 0ms !important; }
}
```

Additionally in `GraphMedallion.tsx`: read `matchMedia('(prefers-reduced-motion: reduce)')` once; when true, skip the 1.5s pulse gate and render final impact state immediately without inline `transition` styles on nodes/edges.

## Files touched

- `src/styles.css` — motion utility, focus-visible base, reduced-motion block.
- `src/components/clausegraph/*` — radius + transition normalization; empty/loading states added to relevant components; medallion reduced-motion respect.
- `src/routes/contracts.index.tsx`, `src/routes/feed.tsx` — explicit loading/empty/error UI in interface voice.
- `src/routes/simulate.tsx`, `src/routes/contracts.$contractId.tsx`, `src/routes/regulations.$regId.tsx`, `src/components/clausegraph/BacktestCard.tsx`, `ActionPlanPanel.tsx`, `Sidebar.tsx`, `TopBar.tsx`, `JurisdictionChip.tsx`, `FederalRegisterFeed.tsx`, `GraphMedallion.tsx` — radius + transition + focus + error-color adjustments.

No new routes, no new components, no dependency changes.

## Verification

- Playwright screenshots of `/`, `/contracts`, `/contracts/CT-004`, `/feed`, `/simulate`, `/backtest` at 1280, 1024, 768.
- Tab through each route with `page.keyboard.press("Tab")` and screenshot to confirm focus ring on every interactive element.
- Toggle `emulateMedia(reducedMotion="reduce")` and confirm rim-pulse is off, node transitions instant.
