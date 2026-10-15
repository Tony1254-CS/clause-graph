import { createServerFn } from "@tanstack/react-start";
import { requireAuth } from "./auth-middleware";
import { gatewayFetch, type PaddleEnv } from "./paddle.server";
import { PLANS, BILLING_ENABLED, type PlanId } from "./plans";

/**
 * Resolves a human-readable price id (e.g. "pro_monthly") to the Paddle
 * internal price id required by Paddle.js checkout.
 */
export const resolvePaddlePrice = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .validator((data: { priceId: string; environment: PaddleEnv }) => data)
  .handler(async ({ data }) => {
    if (!BILLING_ENABLED) throw new Error("Billing is currently disabled");
    const res = await gatewayFetch(
      data.environment,
      `/prices?external_id=${encodeURIComponent(data.priceId)}`,
    );
    if (!res.ok) throw new Error(`Failed to resolve price (${res.status})`);
    const json = (await res.json()) as { data?: Array<{ id: string }> };
    if (!json.data?.length) throw new Error("Price not found");
    return json.data[0].id;
  });

/**
 * Create a Paddle customer portal session so the user can update payment
 * methods or cancel their subscription. Returns the overview URL.
 */
export const createBillingPortalSession = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((data?: { environment?: PaddleEnv }) => ({
    environment: (data?.environment === "live" ? "live" : "sandbox") as PaddleEnv,
  }))
  .handler(async ({ data, context }) => {
    if (!BILLING_ENABLED) throw new Error("Billing is currently disabled");
    const { orgId } = context;
    if (!orgId) throw new Error("No workspace");
    const { queryOne } = await import("./db.server");

    const sub = await queryOne<{
      paddle_customer_id: string;
      paddle_subscription_id: string | null;
      environment: string;
    }>(
      `SELECT paddle_customer_id, paddle_subscription_id, environment 
       FROM public.subscriptions 
       WHERE org_id = $1 AND environment = $2 
       ORDER BY created_at DESC LIMIT 1`,
      [orgId, data.environment]
    );

    if (!sub?.paddle_customer_id) {
      throw new Error("No subscription yet — upgrade to a paid plan first.");
    }

    const { getPaddleClient } = await import("./paddle.server");
    const paddle = getPaddleClient(sub.environment as PaddleEnv);
    const session = await paddle.customerPortalSessions.create(
      sub.paddle_customer_id,
      sub.paddle_subscription_id ? [sub.paddle_subscription_id] : [],
    );
    return { url: session.urls.general.overview };
  });

export type OrgUsage = {
  contracts: number;
  simulations: number;
  members: number;
  plan: "free" | "pro" | "team";
  plan_status: string;
  plan_renews_at: string | null;
  trial_ends_at: string | null;
  on_trial: boolean;
  trial_days_left: number | null;
  /** True only when a real Paddle subscription backs this workspace. */
  has_subscription: boolean;
  /** False while paid subscriptions are parked — everyone runs as Pro. */
  billing_enabled: boolean;
  deletion_scheduled_at: string | null;
};

export const getOrgUsage = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }): Promise<OrgUsage> => {
    const { orgId } = context;
    if (!orgId) throw new Error("No workspace");
    const { query, queryOne } = await import("./db.server");

    // Resolve plan server-side first
    await query(`SELECT resolve_org_plan($1)`, [orgId]);

    const [usageRes, org, sub] = await Promise.all([
      queryOne<{ contracts: number; simulations: number; members: number }>(
        `SELECT (get_org_usage($1)).*`,
        [orgId]
      ),
      queryOne<{
        plan: string;
        plan_status: string;
        plan_renews_at: string | null;
        trial_ends_at: string | null;
        paddle_customer_id: string | null;
        deletion_scheduled_at: string | null;
      }>(
        `SELECT plan, plan_status, plan_renews_at, trial_ends_at, paddle_customer_id, deletion_scheduled_at 
         FROM public.organizations 
         WHERE id = $1`,
        [orgId]
      ),
      queryOne<{ paddle_subscription_id: string; status: string }>(
        `SELECT paddle_subscription_id, status 
         FROM public.subscriptions 
         WHERE org_id = $1 AND status IN ('active', 'trialing', 'past_due', 'paused') 
         LIMIT 1`,
        [orgId]
      ),
    ]);

    const trialEnds = org?.trial_ends_at ?? null;
    const hasSubscription = !!sub?.paddle_subscription_id;
    const onTrial =
      BILLING_ENABLED &&
      !!trialEnds &&
      !hasSubscription &&
      new Date(trialEnds).getTime() > Date.now();
    const trialDaysLeft = onTrial
      ? Math.max(
          0,
          Math.ceil(
            (new Date(trialEnds!).getTime() - Date.now()) / 86_400_000,
          ),
        )
      : null;

    const plan = BILLING_ENABLED
      ? ((org?.plan as OrgUsage["plan"]) ?? "free")
      : ("pro" as const);
    const planStatus = BILLING_ENABLED ? (org?.plan_status ?? "active") : "active";

    return {
      contracts: Number(usageRes?.contracts ?? 0),
      simulations: Number(usageRes?.simulations ?? 0),
      members: Number(usageRes?.members ?? 0),
      plan,
      plan_status: planStatus,
      plan_renews_at: BILLING_ENABLED ? (org?.plan_renews_at ?? null) : null,
      trial_ends_at: BILLING_ENABLED ? trialEnds : null,
      on_trial: onTrial,
      trial_days_left: trialDaysLeft,
      has_subscription: hasSubscription,
      billing_enabled: BILLING_ENABLED,
      deletion_scheduled_at: org?.deletion_scheduled_at ?? null,
    };
  });

/**
 * Change plan on an existing paid subscription.
 */
export const changeSubscriptionPlan = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((data: { newPlanId: PlanId; environment?: PaddleEnv }) => ({
    newPlanId: data.newPlanId,
    environment: (data.environment === "live" ? "live" : "sandbox") as PaddleEnv,
  }))
  .handler(async ({ data, context }) => {
    if (!BILLING_ENABLED) throw new Error("Billing is currently disabled");
    const { orgId } = context;
    const { queryOne } = await import("./db.server");

    const target = PLANS[data.newPlanId];
    if (!target?.priceId) throw new Error("Invalid plan");
    if (!orgId) throw new Error("No workspace");

    const sub = await queryOne<{
      paddle_subscription_id: string;
      environment: string;
      status: string;
      price_id: string;
    }>(
      `SELECT paddle_subscription_id, environment, status, price_id 
       FROM public.subscriptions 
       WHERE org_id = $1 AND environment = $2 AND status IN ('active', 'trialing', 'past_due') 
       ORDER BY created_at DESC LIMIT 1`,
      [orgId, data.environment]
    );

    if (!sub?.paddle_subscription_id) {
      throw new Error("NO_ACTIVE_SUB");
    }
    if (sub.price_id === target.priceId) {
      return { changed: false as const };
    }

    // Resolve target Paddle internal price id
    const env = sub.environment as PaddleEnv;
    const priceRes = await gatewayFetch(
      env,
      `/prices?external_id=${encodeURIComponent(target.priceId)}`,
    );
    const priceJson = (await priceRes.json()) as { data?: Array<{ id: string }> };
    const paddlePriceId = priceJson.data?.[0]?.id;
    if (!paddlePriceId) throw new Error("Target price not found in Paddle");

    // Detect upgrade vs downgrade by monthly USD amount
    const currentAmount =
      (Object.values(PLANS).find((p) => p.priceId === sub.price_id)?.priceUsd) ?? 0;
    const isUpgrade = target.priceUsd > currentAmount;

    const { getPaddleClient } = await import("./paddle.server");
    const paddle = getPaddleClient(env);
    await paddle.subscriptions.update(sub.paddle_subscription_id, {
      items: [{ priceId: paddlePriceId, quantity: 1 }],
      prorationBillingMode: isUpgrade
        ? "prorated_immediately"
        : "prorated_next_billing_period",
    });

    return { changed: true as const, upgraded: isUpgrade };
  });
