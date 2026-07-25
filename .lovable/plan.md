## Fix messy UI: pure black + platinum ice, no sidebar scrollbar

### 1. Kill the sidebar scrollbar
- In `src/components/clausegraph/Sidebar.tsx`, remove the `premium-scrollbar` + `overflow-y-auto` on the nav list. The rail already holds 12 items; at 76px collapsed / 268px expanded with tight icon spacing they fit vertically on standard viewports.
- Reduce per-item vertical padding and gap so the full nav column fits without any scroll region on viewports down to ~640px tall.
- Move "Jurisdiction" chip out of the sidebar footer entirely (or hide when collapsed) — it's the main reason the rail overflows.
- Same treatment for `MobileRail`.

### 2. Repalette to pure black + platinum ice
Rewrite tokens in `src/styles.css`:
- `--page-bg: #000000` (pure black, was graphite `#05090d`)
- `--shell-bg: #0a0a0a` with subtle white-alpha overlay for glass
- `--surface-glass: rgba(255,255,255,0.04)`, `--surface-glass-strong: rgba(255,255,255,0.08)`
- `--hairline: rgba(232,236,241,0.10)`, `--hairline-strong: rgba(232,236,241,0.22)`
- Accent (replaces cyan `--brass`/`--aura`): `--ink-accent: #e8ecf1` (platinum), `--ink-accent-strong: #ffffff`
- `--text-primary: #f4f6f8`, `--text-muted: #7a8391`
- `--risk: #e1524b` (unchanged, severity only)
- Remove every cyan gradient, cyan glow, and cyan grid tint. Replace with neutral white-alpha at 3–8%.

### 3. Strip the noisy atmosphere
- Remove the two big radial cyan gradients + grid lines from `body` and `AppShell` overlays.
- Replace with a single, near-invisible vignette: `radial-gradient(ellipse at top, rgba(255,255,255,0.03), transparent 60%)` on the shell only. No grid, no orbs.
- Drop the `linear-gradient(110deg,…aura…)` sweep in `AppShell`.

### 4. Retone accent usage across components
Anywhere currently using `--brass`, `--aura`, or cyan color-mix (TopBar CTA, ThemeToggle active state, GraphMedallion rings, ContractCard hover, RegulationPill, FederalRegisterFeed live dot, PlanStatusBanner, PaymentTestModeBanner underline, ClauseRow, BacktestCard, ActionPlanPanel, ComplianceCodePanel, UploadContract):
- Swap to `--ink-accent` (platinum white) for active/hover/focus states, rings, and key numerals.
- Primary CTA "Simulate Impact": white fill, black text, subtle white glow — Tesla-style.
- Graph medallion rings: neutral white at descending opacity (14% → 4%), no cyan.
- Live/pulse indicators: white with low-opacity halo instead of cyan.
- Keep risk-red strictly for severity states.

### 5. Typography tightening
- Keep Sora / Inter / JetBrains Mono, but reduce uppercase-tracking usage. Currently every label is `uppercase tracking-[0.18em]` — it reads as cluttered. Restrict uppercase micro-labels to section headers only; body labels return to sentence case.

### 6. Verify
- Confirm 76 → 268px hover expand still works, no scrollbar visible in nav.
- Confirm no cyan remains via `rg -n "brass|aura|22dce6|19cce2|#22d|#19c" src/`.
- Screenshot dashboard + one interior route to confirm the black+platinum look reads clean.

### Files touched
- `src/styles.css` (token rewrite, remove cyan gradients)
- `src/components/clausegraph/Sidebar.tsx` (remove scrollbar, compact spacing)
- `src/components/clausegraph/AppShell.tsx` (remove atmospheric overlays)
- `src/components/clausegraph/TopBar.tsx`, `GraphMedallion.tsx`, `ContractCard.tsx`, `ClauseRow.tsx`, `RegulationPill.tsx`, `FederalRegisterFeed.tsx`, `PlanStatusBanner.tsx`, `BacktestCard.tsx`, `ActionPlanPanel.tsx`, `ComplianceCodePanel.tsx`, `UploadContract.tsx`
- `src/components/theme-toggle.tsx`, `src/components/PaymentTestModeBanner.tsx`

No backend, data, or feature changes.
