# ClauseGraph — Phase 1 Static Shell

Build the full visual system on hardcoded placeholder content. No backend, no data, no AI. Get the glass/typography/spacing rhythm right.

## Scope

- Design tokens (colors, radii, typography) wired into `src/styles.css`
- Fonts loaded via `<link>` in `__root.tsx` (Fraunces variable, Inter, JetBrains Mono from Google Fonts)
- App shell: left sidebar, top bar, main canvas
- Placeholder circular glass "seal" medallion in canvas center
- Route metadata for `/` (title, description, og/twitter)
- Responsive down to tablet width

Out of scope: routing beyond `/`, actual graph, animations beyond hover/press micro-motion, dark/light toggle (dark is the only mode), any data layer.

## Design tokens (src/styles.css)

Replace default shadcn tokens with the ClauseGraph system. Keep shadcn semantic names mapped so ui/ components keep working.

```
--ink-base: #0B0E14        → --background
--surface-raised: #151922  → --card
--brass: #C9A66B           → --primary, --ring, --accent
--risk-red: #E1524B        → --destructive
--text-primary: #F2F0EA    → --foreground
--text-muted: #9C978E      → --muted-foreground
--hairline: rgba(201,166,107,0.18) → --border, --input
--radius: 20px  (nested elements use 12px via radius-md)
```

Add non-shadcn tokens:
- `--surface-glass: rgba(255,255,255,0.06)`
- `--glow-brass: 0 0 40px -8px rgba(201,166,107,0.25)`

Add custom utilities:
- `@utility glass-panel` — `background: var(--surface-glass); backdrop-filter: blur(20px); border: 1px solid var(--hairline); border-radius: 20px; box-shadow: var(--glow-brass);`
- `@utility hairline` — 1px brass-at-18% border helper

Convert hex values to oklch to match the existing token format (still using the exact colors from the brief).

## Typography

Load in `__root.tsx` head links:
- `Fraunces:opsz,wght@9..144,300..700`
- `Inter:wght@400;500;600`
- `JetBrains+Mono:wght@400;500`

Register in `@theme`:
- `--font-display: "Fraunces", serif`
- `--font-sans: "Inter", sans-serif` (body default)
- `--font-mono: "JetBrains Mono", monospace`

## File plan

**Modify**
- `src/styles.css` — new token values, glass utility, font families
- `src/routes/__root.tsx` — Google Fonts `<link>`s, update meta (title "ClauseGraph — Regulatory Impact Simulation", matching description/og/twitter)
- `src/routes/index.tsx` — replace placeholder with dashboard layout

**Create**
- `src/components/clausegraph/AppShell.tsx` — sidebar + topbar + main slot
- `src/components/clausegraph/Sidebar.tsx` — nav items (Dashboard, Contracts, Regulatory Feed, Simulate Impact, Action Plans) with lucide icons; active state shows brass indicator
- `src/components/clausegraph/TopBar.tsx` — company name (placeholder "Meridian Capital"), "Simulate Impact" primary button
- `src/components/clausegraph/BlastRadiusSeal.tsx` — circular glass medallion, empty ring with a subtle brass inner rim, "Awaiting simulation" caption in mono

## Layout structure

```text
┌─────────────────────────────────────────────────┐
│  Sidebar (240px)  │   TopBar (72px)             │
│                   ├─────────────────────────────┤
│  · Dashboard      │                             │
│  · Contracts      │      ○  (glass seal,        │
│  · Reg Feed       │         ~480px circle)      │
│  · Simulate       │                             │
│  · Action Plans   │      placeholder caption    │
└─────────────────────────────────────────────────┘
```

- Sidebar: glass panel, 240px, full height, 24px inner padding, nav items with 12px radius hover state
- TopBar: glass panel spanning main column, company name in Fraunces, button in Inter
- Main canvas: 32px+ gutters, medallion vertically/horizontally centered
- Below 1024px (tablet): sidebar collapses to icon-only rail (64px)

## Micro-motion

All interactive elements: `transition: all 150ms ease-out`. Hover raises brass border opacity from 18% → 32%. Button press: 200ms scale-98. No decorative animation in Phase 1 (the "stamping" pulse arrives with the graph in a later phase).

## Verification

- Confirm build passes
- Screenshot the preview with Playwright to verify glass rendering, typography hierarchy, spacing, and the medallion composition
