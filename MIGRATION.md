# Leaving Lovable Cloud — Self-Hosting ClauseGraph

This is the complete runbook for moving ClauseGraph off Lovable Cloud onto
**your own Supabase project** and **your own host**. Nothing in the app is
Lovable-specific except three things, all replaceable:

| Lovable dependency | What it does | Replacement |
|---|---|---|
| Lovable Cloud (Supabase) | Postgres, Auth, Storage | Your own Supabase project (or any Postgres + Supabase self-host) |
| Lovable AI Gateway (`LOVABLE_API_KEY`) | LLM calls for every AI feature | Your own OpenAI / Google API key |
| Lovable connector gateway | Injects Paddle API keys | Your own Paddle API keys, called directly |

Estimated time: **60–90 minutes**, most of it waiting on DNS and provider
dashboards.

---

## 0. Before you start

Have ready:

- A Supabase account (free tier is enough to start).
- An OpenAI API key (`sk-...`) — or a Google AI Studio key if you prefer Gemini.
- A host that runs a Node/edge server: Vercel, Netlify, Cloudflare Workers, Fly, or a VPS.
- Optional: a Paddle account, only if you intend to switch billing on.
- The repo cloned locally with `bun install` working.

> Billing is currently **parked** (`public.billing_enabled()` returns `false`,
> `BILLING_ENABLED = false` in `src/lib/plans.ts`). You can migrate without
> touching Paddle at all — skip §6.

---

## 1. Create the new Supabase project

1. supabase.com → **New project**. Pick a region close to your users.
2. Save the database password shown at creation — you will not see it again.
3. From **Project Settings → API**, copy:
   - Project URL → `SUPABASE_URL` / `VITE_SUPABASE_URL`
   - `anon` / publishable key → `SUPABASE_PUBLISHABLE_KEY` / `VITE_SUPABASE_PUBLISHABLE_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (**server only, never in the client bundle**)
   - Project ref → `VITE_SUPABASE_PROJECT_ID`

---

## 2. Recreate the schema

Open **SQL Editor** in the new project and run, in this exact order, the SQL
blocks from [`ARCHITECTURE.md` §6](./ARCHITECTURE.md#6-database--full-reference):

1. §6.3 — enum `app_role`
2. §6.4 — all `CREATE TABLE` + indexes
3. §6.5 — **all `GRANT`s** (skipping these produces `permission denied` at
   runtime even though RLS looks correct)
4. §6.6 — `ENABLE ROW LEVEL SECURITY` + every policy
5. §6.7 — functions (`has_role`, `current_org_id`, `billing_enabled`,
   `resolve_org_plan`, `get_org_usage`, `assert_within_quota`,
   `request_workspace_deletion`, `cancel_workspace_deletion`)
6. `seed_supply_chain` (below)
7. §6.8 — `handle_new_user` + the `on_auth_user_created` trigger on `auth.users`
8. §6.9 — the private `contract-files` storage bucket

Order matters: policies reference the functions, and `handle_new_user`
references `seed_supply_chain` and the `sample_*` tables.

### `seed_supply_chain` (referenced by the signup trigger)

```sql
CREATE OR REPLACE FUNCTION public.seed_supply_chain(_org uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  self_id uuid; cloud_id uuid; dc_id uuid; energy_id uuid; pay_id uuid; card_id uuid;
BEGIN
  IF EXISTS (SELECT 1 FROM public.supply_chain_nodes WHERE org_id = _org) THEN RETURN; END IF;

  INSERT INTO public.supply_chain_nodes (org_id, name, role, tier, jurisdiction, description) VALUES
    (_org, 'Your Company',         'self',         0, 'EU', 'Primary entity'),
    (_org, 'Northwind Cloud',      'supplier',     1, 'EU', 'Managed cloud infrastructure provider'),
    (_org, 'Meridian DataCenters', 'subprocessor', 2, 'DE', 'Colocation & hosting facility operator'),
    (_org, 'Rheinstrom Energy',    'vendor',       3, 'DE', 'Regional electricity supplier'),
    (_org, 'Paylane Processor',    'supplier',     1, 'US', 'Card payments processor'),
    (_org, 'GlobalCard Network',   'subprocessor', 2, 'US', 'International card scheme');

  SELECT id INTO self_id   FROM public.supply_chain_nodes WHERE org_id = _org AND name = 'Your Company';
  SELECT id INTO cloud_id  FROM public.supply_chain_nodes WHERE org_id = _org AND name = 'Northwind Cloud';
  SELECT id INTO dc_id     FROM public.supply_chain_nodes WHERE org_id = _org AND name = 'Meridian DataCenters';
  SELECT id INTO energy_id FROM public.supply_chain_nodes WHERE org_id = _org AND name = 'Rheinstrom Energy';
  SELECT id INTO pay_id    FROM public.supply_chain_nodes WHERE org_id = _org AND name = 'Paylane Processor';
  SELECT id INTO card_id   FROM public.supply_chain_nodes WHERE org_id = _org AND name = 'GlobalCard Network';

  INSERT INTO public.supply_chain_edges
    (org_id, from_node_id, to_node_id, contract_name, contract_value, key_clauses, depends_on_regs) VALUES
    (_org, self_id,  cloud_id,  'Master Cloud Services Agreement', 2000000,
      ARRAY['Adherence to all applicable laws','Force majeure on upstream regulatory failure','99.95% availability SLA'],
      ARRAY['GDPR-ART44']),
    (_org, cloud_id, dc_id,     'Colocation & Hosting SLA',         750000,
      ARRAY['Facility must maintain PUE <= 1.5','Compliance with local energy regulations','Right-to-audit'],
      ARRAY['EU-CSRD','EU-DATA-CENTER-ENERGY']),
    (_org, dc_id,    energy_id, 'Industrial Power Supply Contract', 1200000,
      ARRAY['Renewable mix reporting','Uninterrupted supply guarantee'],
      ARRAY['EU-DATA-CENTER-ENERGY']),
    (_org, self_id,  pay_id,    'Merchant Processing Agreement',     900000,
      ARRAY['PCI-DSS compliance','Chargeback handling','Data residency'],
      ARRAY['PCI-DSS']),
    (_org, pay_id,   card_id,   'Card Network Membership',            400000,
      ARRAY['Network rules adherence','Cross-border transfer safeguards'],
      ARRAY['PCI-DSS']);
END; $$;
```

---

## 3. Move the reference data

Four tables hold content, not user data, and must be copied for the app to be
useful on day one:

| Table | Rows | Why it matters |
|---|---|---|
| `regulations` (`org_id IS NULL`) | 10 | The ontology — every feature keys off these IDs |
| `regulation_amendments` | ~30 | Predictive radar has no signal without history |
| `backtest_cases` | 3 | Backtested Validation tab |
| `sample_contracts` + `sample_clauses` | 15 + 54 | Seeded into every new workspace by the signup trigger |

Export from the old database and import into the new one:

```bash
# From the old project (Lovable Cloud → Advanced settings → Export data gives CSVs),
# or with psql if you have a connection string:
\copy (SELECT * FROM public.regulations WHERE org_id IS NULL) TO 'regulations.csv' CSV HEADER
\copy (SELECT * FROM public.regulation_amendments)            TO 'amendments.csv'  CSV HEADER
\copy (SELECT * FROM public.backtest_cases)                   TO 'backtests.csv'   CSV HEADER
\copy (SELECT * FROM public.sample_contracts)                 TO 'samples.csv'     CSV HEADER
\copy (SELECT * FROM public.sample_clauses)                   TO 'sampleclauses.csv' CSV HEADER

# Into the new project (order matters — FKs):
\copy public.regulations           FROM 'regulations.csv'   CSV HEADER
\copy public.regulation_amendments FROM 'amendments.csv'    CSV HEADER
\copy public.backtest_cases        FROM 'backtests.csv'     CSV HEADER
\copy public.sample_contracts      FROM 'samples.csv'       CSV HEADER
\copy public.sample_clauses        FROM 'sampleclauses.csv' CSV HEADER
```

### Migrating live user data (optional)

Only needed if real customers already signed up.

1. Export `auth.users` from the old project (Supabase supports user import via
   the Admin API — `POST /auth/v1/admin/users` with `password_hash` preserved).
2. **Disable the trigger before importing users**, otherwise every imported user
   gets a fresh workspace:
   ```sql
   ALTER TABLE auth.users DISABLE TRIGGER on_auth_user_created;
   -- import users, then organizations → profiles → user_roles → contracts →
   -- clauses → simulation_runs → compliance_artifacts → supply_chain_* →
   -- subscriptions  (parents before children)
   ALTER TABLE auth.users ENABLE TRIGGER on_auth_user_created;
   ```
3. Copy storage objects: download the `contract-files` bucket and re-upload
   preserving the `<org_id>/<uuid>.pdf` key layout.

---

## 4. Auth configuration

In the new project → **Authentication**:

1. **Providers → Email**: enabled. Turn *Confirm email* **off** to match current
   behaviour (users are signed in immediately after sign-up).
2. **Providers → Google**: enable, and paste a Google OAuth client ID/secret from
   Google Cloud Console. Authorized redirect URI:
   `https://<your-project-ref>.supabase.co/auth/v1/callback`.
3. **URL Configuration**: set Site URL to your production origin and add
   `http://localhost:8080` plus your preview domains to Redirect URLs.
4. **Code change — Google sign-in.** The app currently signs in through the
   Lovable broker (`src/integrations/lovable/index.ts`). Off Lovable, replace the
   call in `src/routes/auth.tsx` with vanilla Supabase:

   ```ts
   await supabase.auth.signInWithOAuth({
     provider: "google",
     options: { redirectTo: `${window.location.origin}/auth/callback` },
   });
   ```
   Then delete `src/integrations/lovable/` and its imports. Email/password
   sign-in needs no change.
5. Optional but recommended: enable **leaked password protection** (HIBP) under
   Providers → Email.

---

## 5. AI provider

Every AI feature funnels through the Lovable AI Gateway today. Replace it in one
place per pipeline — the five `*.server.ts` modules that build the request:

`simulate.server.ts`, `action-plan.server.ts`, `predict.server.ts`,
`compliance-code.server.ts`, `upload.server.ts`.

Change the base URL and key:

```diff
- const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
-   headers: { Authorization: `Bearer ${process.env.LOVABLE_API_KEY}` },
+ const res = await fetch("https://api.openai.com/v1/chat/completions", {
+   headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
```

Model names map directly: `gpt-4o` stays `gpt-4o`; `gemini-2.5-flash` becomes
`gpt-4o-mini` (or keep Gemini via Google's own endpoint). The request/response
shape is OpenAI-compatible, so no other code changes. Every pipeline already has
a deterministic fallback, so a missing key degrades instead of crashing.

---

## 6. Paddle (only if you switch billing on)

Skip entirely while billing is parked.

1. Create a Paddle account; build the catalog with prices whose `external_id`
   values match `src/lib/plans.ts` (`pro_monthly`, `team_monthly`).
2. Replace the connector gateway in `src/lib/paddle.server.ts`: drop
   `GATEWAY_BASE_URL` and the `Lovable-API-Key` / `X-Connection-Api-Key`
   headers, and construct the SDK with your own key:
   ```ts
   new Paddle(process.env.PADDLE_API_KEY!, { environment: Environment.production });
   ```
3. Register the webhook in Paddle → Developer Tools → Notifications:
   `https://<your-domain>/api/public/payments/webhook?env=live`
   (and `?env=sandbox` for the sandbox account). Copy each signing secret into
   `PAYMENTS_LIVE_WEBHOOK_SECRET` / `PAYMENTS_SANDBOX_WEBHOOK_SECRET`.
4. Put the Paddle **client** token in `VITE_PAYMENTS_CLIENT_TOKEN`
   (`test_...` in `.env.development`, `live_...` in `.env.production`).
5. Turn billing on: `CREATE OR REPLACE FUNCTION public.billing_enabled() ...
   SELECT true` **and** `BILLING_ENABLED = true` in `src/lib/plans.ts`.

---

## 7. Environment variables

Set these on your host. Server variables must **not** be prefixed `VITE_`.

| Variable | Scope | Source |
|---|---|---|
| `VITE_SUPABASE_URL` | client | Supabase → API |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | client | Supabase → API (anon) |
| `VITE_SUPABASE_PROJECT_ID` | client | Supabase project ref |
| `SUPABASE_URL` | server | same as above |
| `SUPABASE_PUBLISHABLE_KEY` | server | same as above |
| `SUPABASE_SERVICE_ROLE_KEY` | server | Supabase → API (service_role) |
| `OPENAI_API_KEY` | server | OpenAI dashboard (replaces `LOVABLE_API_KEY`) |
| `PADDLE_API_KEY` | server | Paddle → Authentication (only if billing on) |
| `PAYMENTS_LIVE_WEBHOOK_SECRET` | server | Paddle notification settings |
| `PAYMENTS_SANDBOX_WEBHOOK_SECRET` | server | Paddle sandbox notification settings |
| `VITE_PAYMENTS_CLIENT_TOKEN` | client | Paddle → client-side token |

**The single most common self-host failure** is setting the client `VITE_*` vars
but forgetting the server ones. Every `createServerFn` reads `process.env` at
call time, so the pages still render but every data call fails and tabs look
empty. If a deployment shows blank panels everywhere, check the server vars
first.

---

## 8. Deploy

The app is TanStack Start v1 on Vite 7 with a Nitro build. `vite.config.ts`
already switches presets:

- **Vercel** — `vercel.json` is committed; `bun run build` produces the Build
  Output API bundle. Set all variables from §7 for *both* Production and Preview.
- **Cloudflare Workers** — default preset. `nodejs_compat` must be enabled.
- **Netlify / Node / VPS** — set `NITRO_PRESET` accordingly (`netlify`,
  `node-server`) and run `bun run build`, then serve the output.

Post-deploy smoke test:

```bash
curl https://<your-domain>/api/public/health     # → ok
```

Then sign up a brand-new account and verify:

- a workspace appears with 15 seeded contracts and 54 clauses,
- `/feed` lists 10 curated regulations plus the live Federal Register widget,
- `/simulate` returns a blast radius (proves the AI key works),
- `/supply-chain` renders 6 nodes (proves `seed_supply_chain` ran),
- `/settings/billing` shows the Pro / unlimited early-access panel.

---

## 9. Things that are *not* portable

- **Lovable preview auth** — preview URLs and the share-preview flow are a
  Lovable feature; your own deployment is simply public.
- **`SUPABASE_DB_URL` / Cloud-managed secrets** — replaced by your own
  connection string and host secret store.
- **One-click publish** — replaced by your host's CI.
- **`.lovable/` directory and the "Edit with Lovable" badge** — safe to delete.

Everything else — schema, RLS, functions, triggers, storage layout, server
functions, routing, design system — is standard Postgres and standard TanStack
Start, and moves as-is.
