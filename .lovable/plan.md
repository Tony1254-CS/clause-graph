## What I actually verified (not guesses)

I queried the live database, the Paddle catalog (test + live), and read the billing/auth/server code. Findings below are each backed by a check.

### 1. Regulation detail: obligations render as empty rows (your screenshots 1 & 2)
Confirmed by query: all 10 regulations store `obligations` as a **plain string array** (`["data_minimization","purpose_limitation",...]`), but the UI renders `ob.text` and uses `key={ob.id}` — both `undefined`. So you get 5 empty numbered cards, plus duplicate-key React warnings. Every regulation page in the app is affected, in all jurisdictions.

### 2. "PRO" badge vs "Free" billing page (screenshot 3) — two conflicting sources of truth
Confirmed by query: your org row is `plan=pro, plan_status=active, trial_ends_at=2026-08-24, paddle_customer_id=null`. The trial IS provisioned correctly. The mismatch is in the app:
- The top-bar pill reads `organizations.plan` **directly from the database** through the browser client → shows PRO.
- The billing page reads the same value through the `getOrgUsage` **server function** and falls back to `"free"` whenever that call fails, with the error silently swallowed (no error UI, no retry).
- The screenshot proves the server call failed: it shows **Seats 0/1**, but your org has at least 1 member — so `usage.data` was `undefined`, not "free data".

### 3. Why the server call fails on the Vercel deployment
The red `PADDLE_LIVE_API_KEY is not configured` panel is the same root cause: every server function reads its config from server environment variables (`SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `LOVABLE_API_KEY`, `PADDLE_LIVE_API_KEY`, webhook secrets). Those exist in Lovable but **are not set in the Vercel project**, so on `clause-graph.vercel.app` the auth middleware throws before any query runs. That takes down usage/plan, upload, simulate, supply-chain, predictive, action plans, and live checkout at once — "nothing is here".

### 4. Trial users literally cannot pay you (worst commercial bug)
On trial the org plan is `pro` with **no Paddle subscription**. On the billing page:
- Pro is marked "Current" → its button is disabled → a trial user can never convert to paid Pro.
- Clicking Team calls `changeSubscriptionPlan` (because plan ≠ free), which requires an existing Paddle subscription → throws `NO_ACTIVE_SUB`.
- "Manage subscription" is shown for any non-free plan, including trials → throws "No subscription yet".

### 5. Trial expiry is invisible to the UI
`assert_within_quota` expires the trial lazily (only when someone uploads/simulates/invites). Read paths never do. So after day 30 a user keeps seeing "PRO", Pro quotas (50 contracts / 100 simulations / 3 seats) and Pro-labelled entitlements until they happen to trigger a write. Entitlement drift.

### 6. Status banners built but never mounted
`PlanStatusBanner` (past-due dunning, paused, scheduled workspace deletion, trial countdown) is not rendered anywhere in the app. Past-due and pending-deletion states are therefore completely invisible to users, even though the webhook writes `plan_status='past_due'`.

### 7. Paid features are not gated at all
Plan copy sells "Compliance action plans + PDF export" and the live feed as Pro features, but there is zero plan check anywhere except numeric quotas. Free users get action plans, PDF export, predictive radar, compliance-as-code and supply-chain. Also: action plans, compliance-as-code, backtest runs and what-if runs consume LLM credits with **no quota accounting at all** (only upload / simulate / supply-chain / invite call `assert_within_quota`).

### 8. Smaller findings
- Webhook `subscription.canceled` sets org to `free` immediately, ignoring remaining paid period (no grace access).
- Webhook never clears `trial_ends_at` on first payment; entitlement currently survives on `paddle_customer_id` alone — fragile.
- `changeSubscriptionPlan` compares plans by `price_id` but derives current price from an org-wide "latest subscription" without env filter; a sandbox row can shadow a live row (both envs share the table).
- `getOrgUsage` reads no `deletion_scheduled_at`, so the deletion banner branch can never fire.
- Missing `errorComponent` / `notFoundComponent` on `dashboard`, `simulate`, `backtest`, `actions`, `what-if`, `settings.*` — a failing server call there shows the generic crash screen instead of a retry.
- Billing usage bars divide by `1,000,000` for unlimited plans (always ~0%) and can exceed 100% width visually on over-limit orgs.

---

## Fix plan

**A. Data model — obligations**
Migrate `regulations.obligations` to the object shape the app expects (`[{id, text}]`) with real obligation sentences per regulation (GDPR 5/17/33, US SEC/CCPA/HIPAA/GLBA, Bangladesh DPA/BTRC/BB), and make `mapRegulation` tolerant: accept both string and object entries so no page can ever render blank rows again.

**B. One source of truth for plan + trial**
- Add a single `entitlement` server function (plan, effective plan after trial expiry, status, trial days left, has-paid-subscription, deletion date, quotas used/limit).
- Server-side trial expiry on read: expire in the DB when `trial_ends_at < now()` and there is no active subscription, so reads and writes agree.
- Top-bar pill, billing page, banners and all gates consume that one call. Pill shows `PRO · TRIAL · 24d` while on trial instead of a bare "PRO" that contradicts billing.
- Surface query failure explicitly (error panel + Retry) instead of silently degrading to "Free".

**C. Trial → paid conversion**
- Treat "on trial, no Paddle subscription" as *not yet a customer*: Pro card shows **"Start Pro subscription"** (opens checkout), Team opens checkout too; `changeSubscriptionPlan` is only used when a real Paddle subscription exists.
- Hide "Manage subscription" unless a Paddle subscription actually exists.
- Show trial state on the plan card ("Trial · ends Aug 24 — subscribe to keep Pro").

**D. Entitlement gates**
- Server-side: PDF/action-plan generation, compliance-as-code, predictive radar and what-if runs check plan on the server and return a `PLAN_LIMIT`-style error for Free.
- Client-side: those buttons show an upgrade prompt via the existing `PlanLimitDialog` instead of failing silently.
- Add quota accounting for action-plan / compliance-code / backtest / what-if runs so LLM spend is bounded on Free.

**E. Banners + resilience**
- Mount `PlanStatusBanner` in `AppShell` (past-due, paused, trial ending soon ≤7 days, scheduled deletion). Compact single-line style consistent with the current header — no stacked banners like before.
- Add `errorComponent` + `notFoundComponent` with Retry to every remaining authenticated route.
- Fix usage bars for unlimited plans and clamp over-limit states.

**F. Billing correctness**
- Cancel keeps access until `current_period_end`, then downgrades (grace period), and clears `trial_ends_at` on first successful payment.
- Filter subscription lookups by `environment` everywhere so test rows can never drive live behaviour.

**G. Deployment (the "nothing is here" fix)**
- Make missing server env vars fail *loudly and legibly* in the UI ("Backend not configured for this deployment") instead of a red raw variable name.
- Update `README.md` with the exact Vercel environment-variable checklist, including the Paddle live key and both webhook secrets, plus the webhook URL to register for the Vercel domain.
- Note: I can't set Vercel environment variables for you — after this ships you must paste them into the Vercel project, or use the Lovable-published domain (`clause-graph.lovable.app`) where they're already injected.

### Technical notes
Migration for A/F touches `regulations.obligations` (data only) and adds a `SECURITY DEFINER` read-side trial-expiry function reused by `assert_within_quota`. No table drops. Entitlement checks live in `src/lib/*.server.ts` helpers called from existing server functions; UI changes are confined to `settings.billing.tsx`, `TopBar.tsx`, `AppShell.tsx`, `PlanStatusBanner.tsx`, `regulations.$regId.tsx`, and the route files gaining error boundaries.
