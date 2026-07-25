## Plan: premium UI rebuild + correct hover sidebar

### Goals
- Make the app feel clean, modern, premium, and “alive” without visual clutter.
- Fix the navigation ergonomics: users should not scroll the whole page to reach navbar items.
- Restore the behavior you asked for: sidebar expands on hover/focus and auto-minimizes when the cursor leaves.
- Keep all existing product features and routes intact.

### 1. Replace the current visual system
- Rework `src/styles.css` into a dark-first premium liquid-glass theme inspired by the reference image, without copying it.
- Use a controlled palette:
  - near-black graphite/teal background
  - luminous cyan as the primary living accent
  - warm off-white text
  - muted steel/ash secondary text
  - risk-red only for severity/exposure states
- Remove the cheap/messy background blobs/orbs and replace them with a subtle full-screen atmospheric gradient/grid treatment.
- Tighten border radii, borders, shadows, and blur so panels look like polished glass, not noisy cards.
- Preserve light mode, but make dark mode the flagship experience.

### 2. Rebuild the app shell layout
- Change `AppShell` to a true viewport app layout:
  - outer page does not need to scroll just to reach navigation
  - sidebar, top bar, banners, main content, and footer have clear independent areas
  - main content gets its own scroll container
- Reduce crowding in the top area so the dashboard breathes on short screens like the current preview height.
- Make spacing and typography more editorial and less dense.

### 3. Fix the sidebar properly
- Rebuild `Sidebar` as a hover-expanding rail:
  - collapsed width around 72–80px
  - expanded width around 250–280px
  - expands on `mouseenter` and `focus-within`
  - collapses on `mouseleave` and when focus exits
  - expansion overlays the content instead of pushing/reflowing the whole page
- Split sidebar into three zones:
  - logo pinned at top
  - scrollable nav list in the middle
  - settings/account pinned at bottom
- Ensure the nav list itself scrolls when needed, not the entire page.
- Show labels only when expanded; keep clean icons when collapsed.
- Add active route styling that feels premium and readable.

### 4. Redesign top bar and action area
- Simplify `TopBar` so it no longer feels crowded:
  - cleaner ClauseGraph wordmark
  - compact workspace/plan status
  - refined light/dark toggle
  - premium “Simulate Impact” CTA
  - calmer user menu
- Make trial/payment banners visually integrated instead of heavy bars dominating the first screen.

### 5. Refresh dashboard hero / medallion treatment
- Restyle `GraphMedallion` into a premium radar/seal centerpiece:
  - subtle cyan rings and depth
  - smooth breathing pulse only where meaningful
  - restrained graph nodes/edges
  - risk-red appears only after impact simulation
- Improve headline scale and copy hierarchy so it looks intentional, not crowded.

### 6. Apply the new surface language across repeated content
- Update the most visible ClauseGraph cards/panels to match the new system:
  - contract cards
  - clause rows
  - regulation/feed panels
  - action/compliance panels where needed
- Keep functionality unchanged; this is a presentation/system pass.

### 7. Responsive and interaction checks
- Verify at the current short desktop preview size that all nav items are reachable.
- Verify tablet/mobile behavior still works.
- Check hover expand/collapse, keyboard focus, route active states, and dark/light toggle.
- Run the project checks after implementation.

### Technical notes
- Files expected to change:
  - `src/styles.css`
  - `src/components/clausegraph/AppShell.tsx`
  - `src/components/clausegraph/Sidebar.tsx`
  - `src/components/clausegraph/TopBar.tsx`
  - `src/components/theme-toggle.tsx`
  - `src/components/clausegraph/GraphMedallion.tsx`
  - selected high-visibility ClauseGraph cards/panels if their old styling clashes
- No backend, billing, auth, AI, or data-model changes.
- Existing routes and features remain intact.