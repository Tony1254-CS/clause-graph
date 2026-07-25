import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { gatewayFetch, type PaddleEnv } from "./paddle.server";
import { PLANS, BILLING_ENABLED, type PlanId } from "./plans";

/**
 * Resolves a human-readable price id (e.g. "pro_monthly") to the Paddle
 * internal price id required by Paddle.js checkout.
 */
export const resolvePaddlePrice = createServerFn({ method: "GET" })
  .inputValidator((data: { priceId: string; environment: PaddleEnv }) => data)
  .handler(async ({ data }) => {
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
  .middleware([requireSupabaseAuth])
  .inputValidator((data?: { environment?: PaddleEnv }) => ({
    environment: (data?.environment === "live" ? "live" : "sandbox") as PaddleEnv,
  }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: prof } = await supabase
      .from("profiles")
      .select("org_id")
      .eq("id", userId)
      .maybeSingle();
    const orgId = prof?.org_id as string | undefined;
    if (!orgId) throw new Error("No workspace");

    const { data: sub } = await supabase
      .from("subscriptions")
      .select(
        "paddle_customer_id, paddle_subscription_id, environment",
      )
      .eq("org_id", orgId)
      .eq("environment", data.environment)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

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
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<OrgUsage> => {
    const { supabase, userId } = context;
    const { data: prof } = await supabase
      .from("profiles")
      .select("org_id")
      .eq("id", userId)
      .maybeSingle();
    const orgId = prof?.org_id as string | undefined;
    if (!orgId) throw new Error("No workspace");

    // Resolve plan server-side first: this also expires a lapsed trial so
    // reads and writes can never disagree about entitlement.
    await supabase.rpc("resolve_org_plan", { _org: orgId });

    const [{ data: usage }, { data: org }, { data: sub }] = await Promise.all([
      supabase.rpc("get_org_usage", { _org: orgId }).maybeSingle(),
      supabase
        .from("organizations")
        .select(
          "plan, plan_status, plan_renews_at, trial_ends_at, paddle_customer_id, deletion_scheduled_at",
        )
        .eq("id", orgId)
        .maybeSingle(),
      supabase
        .from("subscriptions")
        .select("paddle_subscription_id, status")
        .eq("org_id", orgId)
        .in("status", ["active", "trialing", "past_due", "paused"])
        .limit(1)
        .maybeSingle(),
    ]);

    const trialEnds = (org?.trial_ends_at as string | null) ?? null;
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

    // Billing parked: every workspace is Pro with an active status, no trial
    // clock and no dunning state. Never degrade to "free" here.
    const plan = BILLING_ENABLED
      ? ((org?.plan as OrgUsage["plan"]) ?? "free")
      : ("pro" as const);
    const planStatus = BILLING_ENABLED ? ((org?.plan_status as string) ?? "active") : "active";

    return {
      contracts: (usage as { contracts?: number } | null)?.contracts ?? 0,
      simulations: (usage as { simulations?: number } | null)?.simulations ?? 0,
      members: (usage as { members?: number } | null)?.members ?? 0,
      plan,
      plan_status: planStatus,
      plan_renews_at: BILLING_ENABLED ? ((org?.plan_renews_at as string | null) ?? null) : null,
      trial_ends_at: BILLING_ENABLED ? trialEnds : null,
      on_trial: onTrial,
      trial_days_left: trialDaysLeft,
      has_subscription: hasSubscription,
      billing_enabled: BILLING_ENABLED,
      deletion_scheduled_at: (org?.deletion_scheduled_at as string | null) ?? null,
    };
  });


/**
 * Change plan on an existing paid subscription. Swaps the items on the current
 * Paddle subscription rather than creating a new one — avoids double-billing.
 * Upgrades bill pro-rated immediately; downgrades take effect at next renewal.
 */
export const changeSubscriptionPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { newPlanId: PlanId; environment?: PaddleEnv }) => ({
    newPlanId: data.newPlanId,
    environment: (data.environment === "live" ? "live" : "sandbox") as PaddleEnv,
  }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const target = PLANS[data.newPlanId];
    if (!target?.priceId) throw new Error("Invalid plan");

    const { data: prof } = await supabase
      .from("profiles")
      .select("org_id")
      .eq("id", userId)
      .maybeSingle();
    const orgId = prof?.org_id as string | undefined;
    if (!orgId) throw new Error("No workspace");

    const { data: sub } = await supabase
      .from("subscriptions")
      .select("paddle_subscription_id, environment, status, price_id")
      .eq("org_id", orgId)
      .eq("environment", data.environment)
      .in("status", ["active", "trialing", "past_due"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

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
    await paddle.subscriptions.update(sub.paddle_subscription_id as string, {
      items: [{ priceId: paddlePriceId, quantity: 1 }],
      prorationBillingMode: isUpgrade
        ? "prorated_immediately"
        : "prorated_next_billing_period",
    });

    return { changed: true as const, upgraded: isUpgrade };
  });
