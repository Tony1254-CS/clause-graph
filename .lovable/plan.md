## What happened

This is not only the Supply Chain tab. Your new screenshot shows `/predictive` fails the same way on `clause-graph.vercel.app`.

Confirmed from the code:

- `/supply-chain` loads data through `getSupplyChain()` in `src/lib/supply-chain.functions.ts`.
- `/predictive` loads data through `predictAmendmentRisk()` in `src/lib/predict.functions.ts`.
- Both are authenticated TanStack server functions called from route loaders.
- `vite.config.ts` currently keeps the default Nitro target, which this project config documents as Cloudflare-oriented. That works on Lovable hosting, but the Vercel deployment needs a Vercel Nitro output.

So the root issue is: **Vercel is serving a build that is not correctly configured to run this app's server functions.** Pages that need server data crash into the root error boundary, which is the "This page didn't load" screen.

## Implementation plan

1. **Add Vercel-compatible build output**
   - Update `vite.config.ts` so it detects Vercel's build environment and uses Nitro's `vercel` preset there.
   - Keep the existing Cloudflare/Lovable path unchanged for normal Lovable publishing.
   - Add `vercel.json` pointing Vercel at the Nitro Build Output directory.

2. **Harden the crashing authenticated routes**
   - Add route-level error boundaries to the loader-heavy authenticated pages so a failed server call renders a styled in-app failure state instead of the whole app collapsing.
   - Cover the pages shown in your screenshots first: `/supply-chain` and `/predictive`.
   - Also cover related loader routes that can fail the same way: dashboard, contracts, feed, simulate, what-if, backtest, predictive detail, regulation detail, and team settings.

3. **Improve retry behavior**
   - Error UI will include a real retry action that invalidates/refetches route data, not just a visual reset.
   - Keep the UI in the ClauseGraph dark/mint glass style.

4. **Document Vercel environment requirements**
   - Add a short Vercel deployment checklist to `README.md`.
   - Include the required env vars for browser + server runtime, including backend/auth keys, Lovable AI key, and payment keys.
   - Note that missing Vercel env vars can still break server functions even after the build target is fixed.

## Files to change

- `vite.config.ts`
- `vercel.json`
- `README.md`
- `src/routes/_authenticated/supply-chain.tsx`
- `src/routes/_authenticated/predictive.tsx`
- Shared or repeated error-boundary code under `src/components/` or `src/routes/_authenticated/` to avoid copy-paste
- Any other authenticated route with a blocking loader that currently has no route-level error boundary

## Verification

- Confirm Nitro supports the `vercel` preset in installed dependencies.
- Run the normal build path to ensure Lovable hosting is not broken.
- Run a Vercel-targeted build locally by forcing the Vercel environment variable and confirm `.vercel/output` is produced.
- Check `/supply-chain` and `/predictive` locally after the changes.

## Expected result

After this, Vercel should serve the real server-rendered app with working server functions. If Vercel env vars are missing, the app will show a clean in-page error with retry instead of the ugly global crash screen.