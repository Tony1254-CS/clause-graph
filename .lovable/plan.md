## Goals

1. Fix the sidebar so it behaves like a proper auto-expanding rail (icon-only at rest, expands on hover, collapses on leave).
2. Close out any unresolved items from the earlier production build audit so the app is launch-ready.

---

## 1. Sidebar UX rework

Current problem: sidebar is a static wide panel taking up too much space, no hover-expand behavior.

Change `src/components/clausegraph/Sidebar.tsx` + `AppShell.tsx`:
- Default state: collapsed rail at 64px width, showing only icons (brass at active state, muted otherwise).
- On `onMouseEnter`: expand to 240px with labels fading in (180ms ease-out).
- On `onMouseLeave`: collapse back to 64px.
- Keep it pinned-open on `/settings/*` sub-routes so nested nav labels stay readable while configuring.
- Respect `prefers-reduced-motion`: skip the width transition, snap instantly.
- Keyboard: focusing any nav item also expands the rail (so tab navigation still shows labels). Collapse on `blur` when focus leaves the sidebar.
- Mobile (<768px): unchanged — off-canvas drawer via existing `SidebarTrigger`.
- Main content margin animates in sync so nothing jumps.

Uses local `useState` + a `useReducedMotion` hook. No new deps.

---

## 2. Resolve remaining gaps

From the earlier audit, verify and finish anything still open:

**a. Account deletion flow (`/settings/account`)**
- Confirm the 30-day soft-delete + cancel-deletion path renders and the server function is wired. If missing UI copy or confirmation modal, add them.

**b. Plan swap flow (`/settings/billing`)**
- Verify `changeSubscriptionPlan` is called on upgrade/downgrade (not new checkout) and the 12s polling shows a success toast when the webhook lands.
- Add a clear "prorated" note in the confirm dialog.

**c. Dunning / past_due banner**
- Confirm `PlanStatusBanner` renders for `past_due`, `paused`, and `scheduled_cancel` states with a "Update payment method" link into Paddle's customer portal.

**d. Plan limit dialog**
- Confirm every quota-guarded action (upload contract, simulate, invite teammate) routes errors through `handlePlanLimitError` and opens the upgrade dialog instead of a raw toast.

**e. Legal + footer in authenticated shell**
- Confirm Terms / Privacy / Refund links appear in the app footer.

**f. Email verification**
- Confirm `auto_confirm_email` is on and the signup path lands users directly in the app (no "check your email" screen).

**g. Onboarding polish**
- First-run empty state on `/contracts` and `/regulatory-feed` should CTA to upload / simulate (already added in the polish pass — verify still present after later changes).

Anything already correctly in place: leave alone. Anything missing or half-wired: complete it in this pass.

---

## 3. Verification

- Manual walkthrough at 1280 / 1024 / 768: sidebar hover-expand feels right, no layout jump.
- Trigger a quota error on upload → confirm `PlanLimitDialog` opens.
- Trigger a plan change → confirm no second Paddle checkout opens.
- Delete workspace → confirm 30-day banner appears, cancel restores.

---

## Technical notes

- Sidebar width driven by `--sidebar-width` CSS var toggled between `64px` and `240px` on the provider wrapper; use `w-[var(--sidebar-width)]` per the Tailwind 4 sidebar fix.
- Transition: `transition-[width,margin] duration-200 ease-out motion-reduce:transition-none`.
- Labels use `opacity` + `translate-x-1` transition, not `display:none`, so they animate cleanly.
- No changes to routing, data layer, or server functions unless a gap in section 2 requires it.
