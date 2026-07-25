# Polish Pass: Responsive + Buttery-Smooth Motion

Make the whole app feel premium: fully responsive from 360 px up, snappy transitions everywhere, and a few signature animations that pop without ever feeling decorative.

## 1. Global motion baseline (`src/styles.css`)

Add reusable tokens and utilities so motion is consistent across every component:

- **Easing tokens**
  - `--ease-out-quart: cubic-bezier(0.25, 1, 0.5, 1)` — default UI ease
  - `--ease-out-expo: cubic-bezier(0.19, 1, 0.22, 1)` — entrance/exit
  - `--ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1)` — micro-bounces
- **Duration tokens**: `--dur-fast: 120ms`, `--dur-base: 180ms`, `--dur-slow: 320ms`, `--dur-hero: 600ms`
- Set `* { transition-timing-function: var(--ease-out-quart); }` for buttons/links (scoped, not universal `*`).
- `html { scroll-behavior: smooth; }` and `body { -webkit-font-smoothing: antialiased; text-rendering: optimizeLegibility; }`.
- `@media (prefers-reduced-motion: reduce)` block that collapses all durations to `0.01ms` — accessibility.
- Custom `@utility` helpers:
  - `hover-lift` — `translateY(-2px)` + subtle shadow on hover, 180ms
  - `press` — `active:scale-[0.98]`
  - `glass-hover` — hairline glow intensifies on hover
  - `shimmer` — mint-tinted shimmer keyframe for skeletons
  - `mint-glow` — pulsing box-shadow on focus/active mint elements
- New keyframes: `fade-up`, `fade-down`, `scale-in-soft`, `blur-in`, `shimmer`, `medallion-breathe`, `radar-sweep`, `count-up-fade`.

## 2. Route transitions

- Wrap `<Outlet />` in `_authenticated/route.tsx` and `__root.tsx` in a lightweight transition wrapper (CSS-only, keyed by pathname) that runs `fade-up` (12 px, 220 ms) on every route mount. No library — pure CSS + `key={pathname}`.
- Add a top progress hairline (mint, 2 px) that appears during TanStack Router pending navigations using `useRouterState({ select: s => s.isLoading })`.

## 3. Sidebar (`Sidebar.tsx`)

- Rail width transition already exists; extend it to also animate icon labels: labels start `opacity-0 -translate-x-1` and animate to `opacity-100 translate-x-0` with a **60 ms per-item stagger** using `transition-delay: calc(var(--index)*30ms)`.
- Active-state 4 px mint edge line: animate `scaleY` from 0 → 1 with `--ease-spring` when a route becomes active.
- Hover on rail items: `hover-lift` + hairline glow.
- Mobile (`< 768px`): rail collapses to a bottom-sheet trigger button; sheet slides in with `slide-in-right` (already in animation set).

## 4. TopBar (`TopBar.tsx`)

- Simulate Impact button: add `press` scale + mint glow pulse on hover.
- Workspace name: `truncate` + responsive font-size (`text-base sm:text-lg`).
- Grid header pattern from the responsive-layout guide (`grid-cols-[minmax(0,1fr)_auto]` on mobile, flex at `sm:`).

## 5. AppShell (`AppShell.tsx`)

- Ambient mint radial gradients: animate their position at 30 s cycle (`@keyframes ambient-drift`) — extremely slow, ~2 % opacity so it reads as atmospheric, not distracting.
- Content area gets `motion-safe:animate-fade-up` on route change.

## 6. GraphMedallion (`GraphMedallion.tsx`)

- Idle: keep the existing "breathe" ring pulse.
- On simulation result: nodes light up in a **cascading sweep** (delay proportional to distance from center) rather than all at once. Use `transition-delay` per node.
- Rim: slow brass-mint conic-gradient rotation on active state (`@keyframes rim-rotate 8s linear infinite`).
- Numbers (exposure USD): count-up animation over 800 ms using `requestAnimationFrame` in a tiny hook `useCountUp(value)`.

## 7. Cards & panels

- `ContractCard`, `BacktestCard`, `ActionPlanPanel`, `SupplyChainGraph` outer cards, `ComplianceCodePanel`:
  - `hover-lift` on hover, hairline border brightens 0.14 → 0.28 opacity
  - `motion-safe:animate-fade-up` with staggered `animation-delay` when a list renders (`style={{ animationDelay: `${i * 40}ms` }}` capped at 400 ms)
  - Loading state: replace flat "Loading…" with mint `shimmer` skeleton blocks

## 8. Buttons & inputs (`components/ui/button.tsx`, `input.tsx`)

- Add `press` (`active:scale-[0.98]`) and remove any lingering `transition-colors`; switch to `transition-all duration-180 ease-out-quart`.
- Focus-visible ring transitions in over 180 ms instead of appearing instantly.
- Primary mint buttons: on hover, glow via `box-shadow: 0 0 0 0 mint → 0 0 24px -4px mint`.
- Inputs: label float / border-color transition 180 ms.

## 9. Responsive audit (mobile-first)

Every route touched to survive 360 px:
- `Sidebar`: converts to bottom-sheet under `md:`.
- `AppShell` main grid: `grid-cols-1` on mobile, `md:grid-cols-[auto,1fr]`.
- Headers everywhere use the `grid-cols-[minmax(0,1fr)_auto]` pattern with `min-w-0` / `truncate` / `shrink-0`.
- `GraphMedallion` capped at `min(80vw, 480px)` on mobile.
- `SupplyChainGraph` becomes horizontally scrollable inside a `overflow-x-auto` container on mobile; nodes stay legible.
- `ActionPlanPanel` PDF button becomes full-width on mobile.
- Tables in `settings.billing.tsx` / `settings.team.tsx`: switch to stacked card rows below `sm:`.
- All fixed pixel values re-checked against `min-w-0` + `flex-wrap` rules.

## 10. Micro-interactions

- Regulation pills: hover expands padding subtly + glows mint.
- Toasts: slide-in-right + fade, exit with fade-out.
- Dialog (`PlanLimitDialog`): scale-in-soft + `blur-in` backdrop.
- Theme toggle: crossfade icon over 240 ms with a 90° rotation.
- Command palette / search inputs: focus expands width slightly on `md+`.

## 11. Performance guardrails

- Only animate `transform` and `opacity` — never `width/height/top/left` in hot paths.
- Add `will-change: transform` sparingly on the medallion + sidebar rail only.
- Every animation gated behind `motion-safe:` (Tailwind) so `prefers-reduced-motion` disables it automatically.
- No new dependencies — everything is pure CSS + a single tiny `useCountUp` hook.

## Files touched (no new routes, no schema changes)

- `src/styles.css` — tokens, keyframes, utilities, reduced-motion.
- `src/routes/__root.tsx`, `src/routes/_authenticated/route.tsx` — pending progress bar + route-transition wrapper.
- `src/components/clausegraph/AppShell.tsx`, `Sidebar.tsx`, `TopBar.tsx`, `GraphMedallion.tsx`, `ContractCard.tsx`, `BacktestCard.tsx`, `ActionPlanPanel.tsx`, `SupplyChainGraph.tsx`, `ComplianceCodePanel.tsx`, `RegulationPill.tsx`, `PlanLimitDialog.tsx`, `theme-provider` toggle button.
- `src/components/ui/button.tsx`, `input.tsx`, `dialog.tsx`, `sheet.tsx` — motion tuning (variants only).
- `src/hooks/useCountUp.ts` — new tiny hook.
- Route files under `_authenticated/` — responsive header pattern + list stagger where applicable.

## Out of scope

- No new features or DB changes.
- No new libraries (no Framer Motion / GSAP) — CSS + minimal hooks only.
- Design tokens (Obsidian + Mint palette) unchanged.
