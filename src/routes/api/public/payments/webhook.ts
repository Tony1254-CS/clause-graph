import { createFileRoute } from "@tanstack/react-router";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { verifyWebhook, EventName, type PaddleEnv } from "@/lib/paddle.server";

let _supabase: SupabaseClient | null = null;
function getSupabase(): SupabaseClient {
  if (!_supabase) {
    _supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
  }
  return _supabase;
}

// Map human-readable Paddle product IDs → app plan tier.
function productToPlan(productExternalId: string | undefined): "free" | "pro" | "team" {
  if (productExternalId === "pro_plan") return "pro";
  if (productExternalId === "team_plan") return "team";
  return "free";
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleSubscriptionCreatedOrUpdated(data: any, env: PaddleEnv) {
  const { id, customerId, items, status, currentBillingPeriod, scheduledChange, customData } = data;
  const userId = customData?.userId as string | undefined;
  const orgId = customData?.orgId as string | undefined;

  const item = items?.[0];
  const priceExt = item?.price?.importMeta?.externalId as string | undefined;
  const productExt = item?.product?.importMeta?.externalId as string | undefined;
  if (!priceExt || !productExt) {
    console.warn("[paddle] skip: missing importMeta.externalId", { id });
    return;
  }

  const plan = productToPlan(productExt);
  const periodEnd = currentBillingPeriod?.endsAt as string | undefined;
  const cancelAtPeriodEnd = scheduledChange?.action === "cancel";
  const supa = getSupabase();

  // Upsert subscription row
  if (userId) {
    const { error } = await supa.from("subscriptions").upsert(
      {
        user_id: userId,
        org_id: orgId ?? null,
        paddle_subscription_id: id,
        paddle_customer_id: customerId,
        product_id: productExt,
        price_id: priceExt,
        status,
        current_period_start: currentBillingPeriod?.startsAt,
        current_period_end: periodEnd,
        cancel_at_period_end: cancelAtPeriodEnd,
        environment: env,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "paddle_subscription_id" },
    );
    if (error) console.error("[paddle] subscriptions upsert failed", error);
  }

  // Update org plan
  if (orgId) {
    // Only downgrade to `free` on a truly canceled/past-terminal state; active
    // paid subscriptions keep their tier.
    const orgPlan =
      status === "canceled" && !cancelAtPeriodEnd
        ? "free"
        : plan;
    const paying = ["active", "trialing", "past_due", "paused"].includes(status);
    const { error } = await supa
      .from("organizations")
      .update({
        plan: orgPlan,
        plan_status: status,
        plan_renews_at: periodEnd ?? null,
        paddle_customer_id: customerId,
        // A real subscription supersedes the signup trial, so the read-side
        // trial expiry can never downgrade a paying workspace.
        ...(paying ? { trial_ends_at: null } : {}),
      })
      .eq("id", orgId);
    if (error) console.error("[paddle] org update failed", error);
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleSubscriptionCanceled(data: any, env: PaddleEnv) {
  const supa = getSupabase();
  const { error } = await supa
    .from("subscriptions")
    .update({ status: "canceled", updated_at: new Date().toISOString() })
    .eq("paddle_subscription_id", data.id)
    .eq("environment", env);
  if (error) console.error("[paddle] cancel update failed", error);

  const orgId = data.customData?.orgId as string | undefined;
  if (orgId) {
    // Downgrade the org to free only after the period actually ends (Paddle
    // sends subscription.canceled at the end of the grace window).
    await supa
      .from("organizations")
      .update({ plan: "free", plan_status: "canceled" })
      .eq("id", orgId);
  }
}

export const Route = createFileRoute("/api/public/payments/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const url = new URL(request.url);
        const env = (url.searchParams.get("env") || "sandbox") as PaddleEnv;
        try {
          const event = await verifyWebhook(request, env);

          // Idempotency: skip if we've already processed this event
          const supa = getSupabase();
          const { error: dupErr } = await supa
            .from("paddle_events")
            .insert({ event_id: event.eventId, event_type: event.eventType });
          if (dupErr && dupErr.code === "23505") {
            return Response.json({ received: true, duplicate: true });
          }

          switch (event.eventType) {
            case EventName.SubscriptionCreated:
            case EventName.SubscriptionUpdated:
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              await handleSubscriptionCreatedOrUpdated(event.data as any, env);
              break;
            case EventName.SubscriptionCanceled:
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              await handleSubscriptionCanceled(event.data as any, env);
              break;
            case EventName.TransactionPaymentFailed: {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const d = event.data as any;
              const orgId = d?.customData?.orgId as string | undefined;
              if (orgId) {
                await getSupabase()
                  .from("organizations")
                  .update({ plan_status: "past_due" })
                  .eq("id", orgId);
              }
              break;
            }
            default:
              console.log("[paddle] unhandled event:", event.eventType);
          }
          return Response.json({ received: true });
        } catch (e) {
          console.error("[paddle] webhook error", e);
          return new Response("Webhook error", { status: 400 });
        }
      },
    },
  },
});
