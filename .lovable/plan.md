# ClauseGraph — Liquid Glass Editorial Redesign

Full visual overhaul across every route. Feature logic, routes, data layer, server functions, and Cloud/backend stay untouched — this is a pure design-system swap.

## Design tokens (locked from the chosen direction)

- **Palette (Paper & Ink)**
  - Light: page `#e8e4dd`, shell surface `#f5f3ee`, ink `#0d0d0d`, graphite `#2d2d2d`, hairline `rgba(45,45,45,0.06)`
  - Dark: page `#1a1a1a`, shell surface `#0d0d0d`, secondary `#151515`, paper text `#f5f3ee`, hairline `rgba(255,255,255,0.06)`
  - Reserved risk red `#e11d48` (rose-500), reserved success emerald `#10b981`. No brass anywhere.
- **Type:** Sora (600) for display + numerics, Manrope (400/500/600) for body. Fraunces and JetBrains Mono removed.
- **Radii:** `32px` outer app shell, `24px` glass core, `16px` panels, `12px` inputs/buttons, `9999px` pills.
- **Glass recipe:** `bg-white/40 dark:bg-white/5` + `backdrop-blur-xl` + 1px `border-*-/5` + soft outer shadow. No hard drop shadows.
- **Motion:** 180ms ease-out interactions, 500ms cross-fade on theme toggle, medallion rim slow pulse retained for simulate.

## Theme system + light/dark toggle

- Replace `src/styles.css` tokens entirely. Keep OKLCH mapping but repoint every semantic token (background/foreground/card/primary/border/etc.) to the paper & ink values. Add a second `.dark` block with the dark values.
- Add `next-themes`-style toggle without the package: a tiny `ThemeProvider` in `src/components/theme-provider.tsx` that toggles `class="dark"` on `<html>`, persists to `localStorage`, and reads `prefers-color-scheme` on first paint (via inline script in `__root.tsx` `RootShell` to avoid FOUC).
- Add pill toggle (sun/moon) in the top bar — matches the direction's segmented control exactly.
- Fonts: swap Google Fonts `<link>` in `__root.tsx` from Fraunces/Inter/JetBrains to `Sora:wght@400;600` + `Manrope:wght@400;500;600`.

## Shell rebuild

- `AppShell.tsx`: rounded outer shell (`rounded-[32px]`, shadow-2xl, hairline border, page bg = `#e8e4dd`/`#1a1a1a`). Blurred background accent orbs top-right / bottom-left. Sidebar becomes solid tint (not glass) at 80px width; content area holds top bar + main + footer.
- `Sidebar.tsx`: convert current 12-item rail to the direction's style — 40px black square logo, single-column icon nav with `rounded-2xl` active pill (`bg-white/50 dark:bg-white/10`), gap-6, `overflow-y-auto no-scrollbar` (scroll fix preserved), settings/avatar pinned bottom. Drop the hover-expand behavior — it caused earlier complaints. Keep tooltips on hover instead.
- `TopBar.tsx`: 80px height, left = "ClauseGraph" Sora wordmark + vertical divider + workspace label (uppercase tracked), right = "Graph Sync Live" glass status pill + segmented theme toggle + "Simulate Impact" primary button + user avatar. Trial/past-due banners restyled as slim inline pills instead of full-width bars.
- Footer: 48px utility bar with uppercase micro-text (build id, links).

## Page redesigns (structure preserved, styling replaced)

- **Dashboard `/dashboard`**: keep `GraphMedallion` component but restyle — orbital hairline rings at 100%/70%/40%, liquid glass core with hero stat (`15` contracts / `10` regulations big Sora numeric), two floating glass data cards (Active Nodes, Risk Exposure) with connector hairlines. Metric footer row with three stats.
- **Contracts list / detail**: cards become `rounded-2xl` glass tiles, mono contract value swapped to Sora tabular numerics, regulation pills become graphite outline chips (no brass), stale-link 404 copy retained.
- **Simulate, Predictive, What-If, Backtest, Supply Chain, Actions, Feed**: reuse the same glass panel, chip, input, button primitives. Risk-red kept exclusively for exposure severity, otherwise everything is ink/graphite.
- **Auth, Terms, Privacy, Refund, Reset, Index landing**: apply the paper background + Sora headings + glass cards. No content changes.
- **Settings (Account, Team, Billing)** and **PlanLimitDialog / PaymentTestModeBanner / PlanStatusBanner**: restyle only.

## Primitive updates

- `src/components/ui/*` (shadcn): buttons switch to solid ink primary + glass secondary + ghost variants; inputs get `rounded-xl bg-white/60 dark:bg-white/5 backdrop-blur` with hairline border; dialog / sheet / popover get glass surface + `rounded-3xl`.
- Remove `.rim-pulse` brass color, keep the animation but recolor to graphite; keep `prefers-reduced-motion` guard.

## Out of scope

- No changes to server functions, Paddle wiring, Supabase schema, seeded data, auth flows, routing, or any business rule.
- No new features. Feature parity 1:1.

## Files touched

Design system: `src/styles.css`, `src/routes/__root.tsx` (fonts + theme init script), new `src/components/theme-provider.tsx`, new `src/components/theme-toggle.tsx`.

Shell + primitives: `src/components/clausegraph/AppShell.tsx`, `Sidebar.tsx`, `TopBar.tsx`, `GraphMedallion.tsx`, `BlastRadiusSeal.tsx`, `ContractCard.tsx`, `ClauseRow.tsx`, `RegulationPill.tsx`, `JurisdictionChip.tsx`, `FederalRegisterFeed.tsx`, `ActionPlanPanel.tsx`, `BacktestCard.tsx`, `SupplyChainGraph.tsx`, `ComplianceCodePanel.tsx`, `UploadContract.tsx`, `PlanStatusBanner.tsx`, `PaymentTestModeBanner.tsx`, `PlanLimitDialog.tsx`.

Routes (styling only): all `src/routes/**/*.tsx` files receive className updates; no logic changes.

## Verification

1. Build passes (`tsgo` clean, dev server 200).
2. Playwright screenshots at 1280×1800 and 390×844 of: `/dashboard`, `/contracts`, `/contracts/:id`, `/simulate`, `/supply-chain`, `/predictive`, `/backtest`, `/actions`, `/feed`, `/settings/account`, `/auth`, `/` — in both light and dark modes. Visual diff against chosen direction.
3. Sidebar scroll still works; theme toggle persists across reload; no FOUC.
