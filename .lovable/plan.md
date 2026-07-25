# Phase 6 — Stripe Billing & Phase 7 — Observability / Launch

Phase 2 (auth + multi-tenancy), Phase 2.5 (team invites), and Phase 3 (contract upload pipeline) are live. Time to gate usage behind plans and finish launch polish.

Payment provider check: `recommend_payment_provider` returned **Paddle** as eligible (standard B2B SaaS). Earlier in the build the user explicitly picked **built-in Stripe** and Stripe is what this plan uses. Say the word if you'd rather switch to Paddle before I enable — Paddle handles tax/compliance globally as merchant of record, Stripe gives per-transaction flexibility.

---

## Phase 6 — Stripe Billing

Goal: three plans (Free, Pro, Team) with quotas that gate uploads/simulations; Stripe Checkout + Customer Portal; org-scoped billing state.

### 1. Plans & quotas

| Plan | Contracts | Simulations / month | Teammates | Price |
|---|---|---|---|---|
| Free | 3 | 5 | 1 | $0 |
| Pro | 50 | 100 | 3 | $49 / mo |
| Team | Unlimited | Unlimited | Unlimited | $199 / mo |

- `organizations.plan` already exists (`free` default). Add `stripe_customer_id text`, `stripe_subscription_id text`, `plan_renews_at timestamptz`, `plan_status text` (active/past_due/canceled).
- `simulation_runs` already timestamps every run → month counts computed by SQL, no denormalized counter needed.

### 2. Enable Stripe

- Call `enable_stripe_payments` (Lovable-managed, no API key from user).
- Set tax handling to **full compliance handling** (`managed_payments: true`) since it's digital SaaS.
- Create 2 products with `batch_create_product` (Pro, Team; monthly recurring, tax code `txcd_10103001` — SaaS).

### 3. Server-side quota enforcement

Add a `public.assert_within_quota(_org uuid, _action text)` SQL function (SECURITY DEFINER) that:
- Reads `organizations.plan`.
- Counts `contracts` (org-scoped) for `_action = 'upload_contract'`.
- Counts `simulation_runs` this month for `_action = 'run_simulation'`.
- Raises exception with `HINT: PLAN_LIMIT` if over.

Call it at the top of `startContractExtraction` and `simulateImpact` server fns. Same helper called from `inviteTeammate` for seat count.

### 4. Checkout & portal

- `/api/public/stripe/checkout` server route (auth-gated inside handler — reads bearer, resolves org, calls Stripe SDK to create a Checkout Session with `client_reference_id = org_id`). Returns `{ url }`.
- `/api/public/stripe/portal` — creates a Customer Portal session for the org's existing `stripe_customer_id`.
- Both use the built-in Stripe SDK; no BYOK secret needed.

### 5. Webhook

- `/api/public/stripe/webhook` server route.
- Verify signature against Lovable-provided webhook secret.
- Handle: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`.
- Update `organizations.plan / plan_status / stripe_customer_id / stripe_subscription_id / plan_renews_at` via `supabaseAdmin` (import inside handler).
- Idempotent: track processed event ids in `stripe_events` table.

### 6. Billing UI

- New route `/settings/billing` (admin-only view; members see current plan read-only).
- Glass panel with current plan card, usage meters (contracts X/Y, sims X/Y this month), and:
  - Free → "Upgrade to Pro" / "Upgrade to Team" buttons hitting the checkout route.
  - Paid → "Manage subscription" button hitting the portal route.
- Quota-exceeded errors from server fns caught in the UI and shown as a paywall dialog with an upgrade CTA (no dead ends).

### 7. Sidebar & TopBar

- Add "Billing" nav item (admin-only, small `Wallet` icon).
- TopBar badge next to workspace name: plan chip in brass (`FREE` / `PRO` / `TEAM`).

### 8. Migration

Single migration:
- `ALTER organizations ADD stripe_customer_id, stripe_subscription_id, plan_renews_at, plan_status`.
- `CREATE TABLE stripe_events (event_id primary key, received_at)` + grants + RLS (service_role only).
- `CREATE FUNCTION public.assert_within_quota(uuid, text)` + `has_role`-scoped grant to `authenticated`.

### 9. Verification

- Free org hits contract limit → upload UI shows paywall.
- Upgrade to Pro via checkout in Stripe test mode → webhook flips `plan` → limits lift immediately.
- Cancel via portal → `plan_status = canceled` at period end; still `pro` until `plan_renews_at`.
- Two orgs cannot see each other's Stripe state (RLS + `service_role`-only writes).

---

## Phase 7 — Observability & Launch Polish

Small, no-ceremony pass to make the app production-shippable.

### 1. Error tracking

- Wire **Sentry** (browser + server functions). Store DSN via `add_secret` (`SENTRY_DSN` server, `VITE_SENTRY_DSN` public). Init in `__root.tsx` and inside a shared `withSentry` wrapper for critical server fns (`simulateImpact`, `startContractExtraction`, Stripe webhook).
- Scrub PII: never send contract text, only ids/status/duration.

### 2. Structured logging

- Small `logger.server.ts` helper — one-line JSON logs with `level`, `org_id`, `user_id`, `route`, `duration_ms`. Use in every server fn / route. Cloudflare Worker logs pick these up.

### 3. Rate limits (soft)

- In-memory sliding-window limiter keyed by `user_id` on `simulateImpact` and `startContractExtraction`: 10/min, 60/hour. Returns a friendly 429 message. Complementary to plan quotas — this catches abuse, quotas catch usage.

### 4. Health check

- `GET /api/public/health` returns `{ ok: true, db: <ms>, ai: <ms>|null, ts }` — pings DB and (optionally, once/min cached) the AI gateway. Wire an uptime monitor (UptimeRobot / BetterStack free tier) against `project--<id>.lovable.app/api/public/health`.

### 5. Legal + landing

- `/privacy` and `/terms` static routes (glass-panel layout, one-file each, boilerplate the user can edit).
- Landing page (`/`) polish pass: pricing section reading from same source of truth as billing UI so plans stay in sync; add TOS/privacy links in footer.

### 6. SEO / share

- Verify every route has unique `head()` title + description + og image (already handled per route in Phase 2/3 — spot-check `dashboard`, `contracts`, `simulate`, `feed`, `backtest`, `actions`, `settings/team`, `settings/billing`).
- Sitemap route `/api/sitemap.xml` listing the public pages.

### 7. Backups & data ops

- Confirm Lovable Cloud automatic backups are on (surface a note in Settings → Danger Zone with a "Contact us to restore" line).
- Add an admin-only "Export org data" server fn returning a JSON dump of the org's contracts + clauses + simulation_runs — GDPR-friendly and useful for account moves.

### 8. Publish

- Set custom domain (if user provides one) via `preview_ui--publish` once above is green.
- Turn off "Edit with Lovable" badge (`publish_settings--set_badge_visibility`) if user prefers.

### 9. Verification

- Sentry sees a forced test error from the browser and from a server fn.
- Health endpoint 200 with sane numbers.
- Uptime monitor connected.
- Legal pages reachable while signed out.
- Pricing on landing matches billing UI.

---

## Sequencing

I'll ship Phase 6 first (self-contained value; requires enabling Stripe), then Phase 7 (no external tools beyond a Sentry DSN if you want error tracking).

Two decisions I need before starting Phase 6:
1. **Stripe or Paddle?** (Paddle was the eligibility recommendation; Stripe was your earlier pick.)
2. **Plan prices** — I've proposed Free / $49 Pro / $199 Team. Confirm or tell me your numbers.
