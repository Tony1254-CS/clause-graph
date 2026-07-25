## Goal

Kill the "trash" look: remove the two banners crowding the top, and replace the flat pure-black + white-only palette with a premium FlowState-inspired scheme — deep near-black background with a single vivid mint/cyan accent that actually pops. Clean up the sidebar so it reads as calm and expensive.

## 1. Remove the two banners

In `src/components/clausegraph/AppShell.tsx`:
- Delete `<PaymentTestModeBanner />` (the "PREVIEW RUNS IN TEST MODE — USE CARD 4242…" strip).
- Delete `<PlanStatusBanner />` (the "You're on the Pro trial — 30 days left" strip).
- Remove their imports.

The TopBar becomes the first thing under the shell edge — no stacked bars.

## 2. New palette — "Obsidian & Mint"

Rewrite the token block in `src/styles.css`:

- `--page-bg`: `#07090C` (deep obsidian, not pure black — pure #000 is what's reading as flat/cheap)
- `--shell-bg`: `#0C1014` (panel base, one step up from page)
- `--shell-secondary`: `#111620`
- `--surface-glass`: `rgba(255,255,255,0.03)`
- `--surface-glass-strong`: `rgba(255,255,255,0.06)`
- `--surface-raised`: `rgba(255,255,255,0.04)`
- `--hairline`: `rgba(255,255,255,0.07)`
- `--hairline-strong`: `rgba(94,234,212,0.22)` (mint-tinted hairline on interactive states)
- `--ink` / `--text-primary`: `#EAF2EF` (warm off-white, not pure white)
- `--text-muted`: `#7A8894`
- `--brass` (kept as token name; now our mint accent): `#5EEAD4`
- `--brass-strong`: `#8FF3E1`
- `--aura`: `#5EEAD4`
- `--glow-brass`: `0 20px 60px -24px rgba(94,234,212,0.45)`
- `--risk`: `#F87171` (unchanged, still reserved for exposure only)

Light mode gets a matching pass: warm paper `#F4F6F5` background, ink `#0B1220`, same mint accent at `#0EA48F` for contrast on light.

The mint is used only on: active nav item, primary buttons (Simulate Impact), key data numerals, medallion rim/pulse, focus rings. Never as a fill on large surfaces.

## 3. Sidebar cleanup

In `src/components/clausegraph/Sidebar.tsx`:
- Tighten rail width: collapsed `64px`, expanded `232px` (currently 68 / 248 — feels bulky).
- Icon stroke down to `1.5`, size `17px`, muted color `#6A7684`.
- Active state: mint dot (4px) on the left edge + `text-primary` label, no background fill. Removes the current "boxed" active look.
- Hover state: label fades in, icon shifts to `text-primary`, no background box.
- Remove any leftover glow / border on the aside; keep only a single right hairline.
- Confirm all 12 items fit at 900px viewport height without any scrollbar (they do — verified by item count × 36px row).

## 4. TopBar cleanup

In `src/components/clausegraph/TopBar.tsx`:
- Simulate Impact button: mint fill (`--brass`), black text, subtle mint glow on hover — matches the FlowState "Open workspace" button style.
- Theme toggle: keep pill, but reduce to two smaller icons with mint indicator on active side.
- Workspace label: uppercase tracking stays, but color drops to `text-muted` so "ClauseGraph" wordmark leads.

## 5. Component sweep

Any remaining hard-coded whites or old cyan references in:
- `BlastRadiusSeal.tsx` / `GraphMedallion.tsx` — rim + pulse use `--brass` (now mint), risk nodes stay `--risk`.
- `ActionPlanPanel.tsx`, `ComplianceCodePanel.tsx`, `SupplyChainGraph.tsx`, `BacktestCard.tsx` — already token-driven from the last pass, so they pick up the new mint automatically. Spot-check for any leftover `#ffffff` fills and swap to `var(--ink)`.

## Technical notes

- No business logic touched — pure CSS tokens + two component removals + sidebar/topbar restyle.
- Trial-tracking logic in `PlanStatusBanner` isn't deleted, just unmounted, so re-enabling later is a one-line add.
- `PaymentTestModeBanner` stays as a file (unused) in case sandbox mode messaging is wanted elsewhere.

## Out of scope

- No layout restructure of dashboard content.
- No new pages, no data changes.
- No touching auth, billing, or server functions.