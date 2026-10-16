// Single source of truth for plan pricing, quotas, and marketing copy.
// Update this file and Paddle prices together — the pricing page and
// billing UI both read from here.

/**
 * Master switch for paid subscriptions.
 *
 * While this is `false` the whole billing surface is PARKED: nobody is
 * charged, nothing is gated, and every workspace runs as Pro with unlimited
 * quotas. All Paddle code (checkout hook, webhook route, portal, plan swap)
 * stays in the codebase, ready to be reactivated.
 *
 * To re-enable paid plans:
 *   1. set BILLING_ENABLED = true here, and
 *   2. run: CREATE OR REPLACE FUNCTION public.billing_enabled()
 *           RETURNS boolean LANGUAGE sql IMMUTABLE
 *           SET search_path = public AS $$ SELECT true $$;
 * Both must flip together — the database enforces quotas, the client draws UI.
 */
export const BILLING_ENABLED = false;

export type PlanId = "free" | "pro" | "team";

export type Plan = {
  id: PlanId;
  name: string;
  priceUsd: number; // monthly
  priceId: string | null; // Paddle human-readable price id
  tagline: string;
  contracts: number;
  simulationsPerMonth: number;
  seats: number;
  features: string[];
};

export const UNLIMITED = 1_000_000;

export const PLANS: Record<PlanId, Plan> = {
  free: {
    id: "free",
    name: "Free",
    priceUsd: 0,
    priceId: null,
    tagline: "For evaluation and single-user pilots.",
    contracts: 3,
    simulationsPerMonth: 5,
    seats: 1,
    features: [
      "3 contracts",
      "5 impact simulations / month",
      "Full regulatory ontology",
      "Backtested validation library",
    ],
  },
  pro: {
    id: "pro",
    name: "Pro",
    priceUsd: 49,
    priceId: "pro_monthly",
    tagline: "For growing legal teams.",
    contracts: 50,
    simulationsPerMonth: 100,
    seats: 3,
    features: [
      "50 contracts",
      "100 impact simulations / month",
      "3 teammates",
      "Compliance action plans + PDF export",
      "Federal Register live feed",
    ],
  },
  team: {
    id: "team",
    name: "Team",
    priceUsd: 199,
    priceId: "team_monthly",
    tagline: "For legal & compliance departments.",
    contracts: UNLIMITED,
    simulationsPerMonth: UNLIMITED,
    seats: UNLIMITED,
    features: [
      "Unlimited contracts",
      "Unlimited simulations",
      "Unlimited teammates",
      "Priority support",
      "Compliance action plans + PDF export",
    ],
  },
};

export function formatLimit(n: number): string {
  return n >= UNLIMITED ? "Unlimited" : n.toLocaleString();
}

/**
 * Effective quota for a plan. While billing is parked every limit is
 * unlimited, regardless of the plan stored on the workspace.
 */
export function effectiveLimit(
  planId: PlanId,
  key: "contracts" | "simulationsPerMonth" | "seats",
): number {
  if (!BILLING_ENABLED) return UNLIMITED;
  return PLANS[planId][key];
}

export function isPlanLimitError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err ?? "");
  return msg.includes("PLAN_LIMIT");
}
