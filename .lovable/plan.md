# Two issues

## 1. Sidebar overflow — nav items unreachable

The floating rail in `src/components/clausegraph/Sidebar.tsx` renders 12 nav items plus a header and a bottom "Jurisdiction" card in a fixed-height container (`top-6 bottom-6`) with `overflow-hidden` and no inner scroll. On short viewports the bottom items ("Team", "Billing", "Account") get clipped and there's no way to reach them.

**Fix:**
- Wrap the `<nav>` in a scrollable region: `flex-1 min-h-0 overflow-y-auto` with a subtle scrollbar style so it still reads as glass.
- Move the "Jurisdiction" card out of `mt-auto` competition — keep it as a non-shrinking footer (`shrink-0`) below the scroll area, and hide it entirely when the rail is collapsed (already opacity-0, also make it not consume height when collapsed).
- Also apply the same `overflow-y-auto` pattern to `MobileRail` so mobile users can scroll all icons.
- Keep the 200ms expand animation and hover behavior unchanged.

## 2. The "No contract with ID …" screenshot

That's the `notFoundComponent` on `/contracts/$contractId` firing correctly — the ID `42c7a0fe-…` does not exist in the database (verified). This happened because the Phase 9 re-seed wiped and re-inserted the 15 sample contracts with fresh UUIDs, so any URL you had open from before that re-seed is now a dead link. It's not a bug in routing or data loading — going back to `/contracts` shows the live list with the new IDs.

**Small UX improvement to prevent confusion:**
- Tighten the not-found copy so it explains this is likely a stale link (e.g. "This contract no longer exists in your workspace. It may have been removed or re-seeded.") instead of the raw UUID being the headline.
- Keep the "Back to contracts" CTA.

## Scope

Frontend-only edits to:
- `src/components/clausegraph/Sidebar.tsx` (scroll region + mobile scroll)
- `src/routes/_authenticated/contracts.$contractId.tsx` (friendlier not-found copy)

No backend, schema, or business-logic changes.
